/**
 * AutoHireBot - Database Migration Utilities
 * Normalizes the database schema for scalability
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Migrate jobs from recruiters subcollection to top-level jobs collection
 * Run once to normalize the database
 */
exports.migrateJobsToCollection = functions
  .runWith({
    memory: '1GB',
    timeoutSeconds: 540
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }

    const results = { migrated: 0, skipped: 0, errors: [] };

    try {
      // Get all recruiters with jobDetails
      const recruitersSnap = await db.collection('recruiters').get();

      for (const recruiterDoc of recruitersSnap.docs) {
        const recruiter = recruiterDoc.data();

        if (!recruiter.jobDetails) {
          results.skipped++;
          continue;
        }

        const jobDetails = recruiter.jobDetails;
        const jobData = {
          // Core job info
          jobTitle: jobDetails.jobTitle || jobDetails.position || 'Healthcare Position',
          department: jobDetails.department || jobDetails.specialization || null,
          description: jobDetails.description || null,
          requirements: jobDetails.requirements || null,

          // Location & salary
          location: jobDetails.location || recruiter.city || null,
          salaryRange: jobDetails.salaryRange || jobDetails.salary || null,

          // Requirements
          requiredSkills: jobDetails.requiredSkills || jobDetails.skills || [],
          requiredQualification: jobDetails.requiredQualification || [],
          requiredExperience: jobDetails.requiredExperience || { min: 0, max: 10 },

          // Recruiter reference
          recruiterId: recruiterDoc.id,
          facilityName: recruiter.facilityName || null,
          recruiterEmail: recruiter.contactEmail || recruiter.email || null,
          recruiterPhone: recruiter.contactPhone || recruiter.phone || null,

          // Status
          status: recruiter.paymentStatus === 'completed' ? 'active' : 'pending',
          verified: recruiter.verified || false,

          // Timestamps
          createdAt: recruiter.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedFrom: 'recruiters',
          migratedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Check if already migrated
        const existing = await db.collection('jobs')
          .where('recruiterId', '==', recruiterDoc.id)
          .where('migratedFrom', '==', 'recruiters')
          .limit(1)
          .get();

        if (!existing.empty) {
          results.skipped++;
          continue;
        }

        try {
          await db.collection('jobs').add(jobData);
          results.migrated++;
        } catch (err) {
          results.errors.push(`Recruiter ${recruiterDoc.id}: ${err.message}`);
        }
      }

      return {
        success: true,
        ...results,
        message: `Migration complete: ${results.migrated} jobs migrated, ${results.skipped} skipped`
      };

    } catch (error) {
      console.error('Migration error:', error);
      throw new functions.https.HttpsError('internal', 'Migration failed: ' + error.message);
    }
  });

/**
 * Migrate matches to use normalized structure
 * Ensures all matches reference the jobs collection
 */
exports.normalizeMatches = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 300
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }

    const results = { updated: 0, skipped: 0 };

    // Move aiMatches from jobSeekers to dedicated matches collection
    const seekersSnap = await db.collection('jobSeekers').get();

    for (const seekerDoc of seekersSnap.docs) {
      const seeker = seekerDoc.data();

      if (!seeker.aiMatches || seeker.aiMatches.length === 0) {
        results.skipped++;
        continue;
      }

      const batch = db.batch();

      for (const match of seeker.aiMatches) {
        const matchRef = db.collection('matches').doc();
        batch.set(matchRef, {
          seekerId: seekerDoc.id,
          seekerName: seeker.fullName || seeker.name || null,
          seekerEmail: seeker.email || null,
          jobId: match.jobId || null,
          matchScore: match.matchScore || 0,
          matchReasons: match.matchReasons || [],
          recommendation: match.recommendation || null,
          status: 'pending',
          source: 'ai_registration',
          createdAt: seeker.matchedAt || admin.firestore.FieldValue.serverTimestamp(),
          normalizedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Remove aiMatches from the seeker doc to prevent duplication
      batch.update(seekerDoc.ref, {
        aiMatchesMigrated: true,
        aiMatchesCount: seeker.aiMatches.length
      });

      await batch.commit();
      results.updated++;
    }

    return {
      success: true,
      ...results,
      message: `Normalized ${results.updated} seekers, ${results.skipped} had no matches`
    };
  });

/**
 * Create a new job in the normalized jobs collection
 */
exports.createJob = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const {
      jobTitle, department, description, requirements,
      location, salaryRange, requiredSkills,
      requiredQualification, requiredExperience
    } = data;

    if (!jobTitle) {
      throw new functions.https.HttpsError('invalid-argument', 'Job title required');
    }

    const db = admin.firestore();

    // Verify recruiter exists and is approved
    const recruiterDoc = await db.collection('recruiters').doc(context.auth.uid).get();
    if (!recruiterDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Recruiter account required');
    }

    const recruiter = recruiterDoc.data();

    const jobData = {
      jobTitle: jobTitle.trim().substring(0, 200),
      department: department || null,
      description: description ? description.substring(0, 5000) : null,
      requirements: requirements ? requirements.substring(0, 3000) : null,
      location: location || recruiter.city || null,
      salaryRange: salaryRange || null,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills.slice(0, 20) : [],
      requiredQualification: Array.isArray(requiredQualification) ? requiredQualification : [],
      requiredExperience: requiredExperience || { min: 0, max: 10 },
      recruiterId: context.auth.uid,
      facilityName: recruiter.facilityName || null,
      recruiterEmail: recruiter.contactEmail || recruiter.email || null,
      status: recruiter.paymentStatus === 'completed' ? 'active' : 'pending',
      applicantCount: 0,
      viewCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const jobRef = await db.collection('jobs').add(jobData);

    return {
      success: true,
      jobId: jobRef.id,
      status: jobData.status
    };
  });

/**
 * Update a job posting
 */
exports.updateJob = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { jobId, updates } = data;

    if (!jobId || !updates) {
      throw new functions.https.HttpsError('invalid-argument', 'Job ID and updates required');
    }

    const db = admin.firestore();
    const jobDoc = await db.collection('jobs').doc(jobId).get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Job not found');
    }

    // Only the owner recruiter or admin can update
    const job = jobDoc.data();
    if (job.recruiterId !== context.auth.uid) {
      const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
      if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized');
      }
    }

    // Sanitize updates - only allow specific fields
    const allowedFields = [
      'jobTitle', 'department', 'description', 'requirements',
      'location', 'salaryRange', 'requiredSkills',
      'requiredQualification', 'requiredExperience', 'status'
    ];

    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitized[key] = value;
      }
    }

    sanitized.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('jobs').doc(jobId).update(sanitized);

    return { success: true, jobId };
  });

/**
 * Get jobs for a recruiter
 */
exports.getRecruiterJobs = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { recruiterId, status } = data;
    const db = admin.firestore();

    let query = db.collection('jobs')
      .where('recruiterId', '==', recruiterId || context.auth.uid)
      .orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.limit(100).get();
    const jobs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null
    }));

    return { success: true, jobs };
  });

/**
 * Auto-expire old job postings (called by scheduler)
 */
exports.expireOldJobs = functions.pubsub
  .schedule('0 2 * * *') // 2 AM IST daily
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const oldJobs = await db.collection('jobs')
      .where('status', '==', 'active')
      .where('createdAt', '<', thirtyDaysAgo)
      .get();

    if (oldJobs.empty) {
      console.log('No expired jobs found');
      return null;
    }

    const batch = db.batch();
    oldJobs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`Expired ${oldJobs.size} old job postings`);
    return null;
  });
