/**
 * AutoHireBot - ATS (Applicant Tracking System) Features
 * Candidate pipeline, interview scheduling, recruiter analytics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

const zeptoApiKey = defineSecret('ZEPTO_API_KEY');

// ==================== APPLICATION PIPELINE ====================

const PIPELINE_STAGES = ['applied', 'screening', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

/**
 * Move a candidate through the hiring pipeline
 */
exports.updateCandidateStage = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { matchId, newStage, notes } = data;

    if (!matchId || !newStage) {
      throw new functions.https.HttpsError('invalid-argument', 'Match ID and stage required');
    }

    if (!PIPELINE_STAGES.includes(newStage)) {
      throw new functions.https.HttpsError('invalid-argument', `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}`);
    }

    const db = admin.firestore();
    const matchDoc = await db.collection('matches').doc(matchId).get();

    if (!matchDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Match not found');
    }

    const match = matchDoc.data();

    // Verify the caller is the recruiter or admin
    if (match.recruiterId !== context.auth.uid) {
      const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
      if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized');
      }
    }

    const previousStage = match.status || 'pending';

    // Update the match
    await db.collection('matches').doc(matchId).update({
      status: newStage,
      previousStage,
      stageNotes: notes || null,
      stageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log the stage change
    await db.collection('pipelineHistory').add({
      matchId,
      seekerId: match.seekerId,
      recruiterId: match.recruiterId,
      jobId: match.jobId,
      fromStage: previousStage,
      toStage: newStage,
      notes: notes || null,
      changedBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      matchId,
      previousStage,
      newStage
    };
  });

/**
 * Get pipeline view for a recruiter
 */
exports.getPipelineView = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { jobId } = data;
    const db = admin.firestore();

    let query = db.collection('matches')
      .where('recruiterId', '==', context.auth.uid);

    if (jobId) {
      query = query.where('jobId', '==', jobId);
    }

    const snap = await query.get();

    // Organize by stage
    const pipeline = {};
    PIPELINE_STAGES.forEach(stage => { pipeline[stage] = []; });
    pipeline['pending'] = []; // Include legacy pending status

    snap.docs.forEach(doc => {
      const match = { id: doc.id, ...doc.data() };
      const stage = match.status || 'pending';
      if (pipeline[stage]) {
        pipeline[stage].push(match);
      } else {
        pipeline['pending'].push(match);
      }
    });

    // Sort each stage by match score
    Object.keys(pipeline).forEach(stage => {
      pipeline[stage].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    });

    return {
      success: true,
      pipeline,
      stages: PIPELINE_STAGES,
      totalCandidates: snap.size
    };
  });

/**
 * Bulk update candidates (shortlist/reject multiple)
 */
exports.bulkUpdateCandidates = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { matchIds, newStage, notes } = data;

    if (!Array.isArray(matchIds) || matchIds.length === 0 || !newStage) {
      throw new functions.https.HttpsError('invalid-argument', 'Match IDs array and stage required');
    }

    if (matchIds.length > 50) {
      throw new functions.https.HttpsError('invalid-argument', 'Maximum 50 candidates per batch');
    }

    const db = admin.firestore();
    const batch = db.batch();
    const results = { updated: 0, errors: [] };

    for (const matchId of matchIds) {
      try {
        const matchRef = db.collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
          results.errors.push(`${matchId}: not found`);
          continue;
        }

        const match = matchDoc.data();
        if (match.recruiterId !== context.auth.uid) {
          results.errors.push(`${matchId}: not authorized`);
          continue;
        }

        batch.update(matchRef, {
          status: newStage,
          previousStage: match.status || 'pending',
          stageNotes: notes || null,
          stageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        results.updated++;
      } catch (err) {
        results.errors.push(`${matchId}: ${err.message}`);
      }
    }

    await batch.commit();

    return { success: true, ...results };
  });

// ==================== INTERVIEW SCHEDULING ====================

/**
 * Schedule an interview
 */
exports.scheduleInterview = functions
  .runWith({ secrets: [zeptoApiKey] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { matchId, interviewDate, interviewTime, interviewType, location, meetingLink, notes } = data;

    if (!matchId || !interviewDate || !interviewTime) {
      throw new functions.https.HttpsError('invalid-argument', 'Match ID, date, and time required');
    }

    const db = admin.firestore();
    const matchDoc = await db.collection('matches').doc(matchId).get();

    if (!matchDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Match not found');
    }

    const match = matchDoc.data();

    if (match.recruiterId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    // Create interview record
    const interview = {
      matchId,
      seekerId: match.seekerId,
      seekerName: match.seekerName,
      seekerEmail: match.seekerEmail,
      seekerPhone: match.seekerPhone,
      recruiterId: match.recruiterId,
      recruiterName: match.recruiterName,
      jobId: match.jobId,
      jobTitle: match.jobTitle,
      interviewDate,
      interviewTime,
      interviewType: interviewType || 'in-person', // in-person, phone, video
      location: location || null,
      meetingLink: meetingLink || null,
      notes: notes || null,
      status: 'scheduled',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const interviewRef = await db.collection('interviews').add(interview);

    // Update match stage to interview
    await db.collection('matches').doc(matchId).update({
      status: 'interview',
      interviewId: interviewRef.id,
      interviewDate,
      interviewTime,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log pipeline change
    await db.collection('pipelineHistory').add({
      matchId,
      seekerId: match.seekerId,
      recruiterId: match.recruiterId,
      jobId: match.jobId,
      fromStage: match.status || 'pending',
      toStage: 'interview',
      notes: `Interview scheduled for ${interviewDate} at ${interviewTime}`,
      changedBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      interviewId: interviewRef.id,
      interview
    };
  });

/**
 * Get interviews for a recruiter
 */
exports.getInterviews = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { status, dateFrom, dateTo } = data || {};
    const db = admin.firestore();

    let query = db.collection('interviews')
      .where('recruiterId', '==', context.auth.uid)
      .orderBy('interviewDate', 'asc');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.limit(100).get();
    const interviews = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Optionally filter by date range client-side
    let filtered = interviews;
    if (dateFrom) {
      filtered = filtered.filter(i => i.interviewDate >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(i => i.interviewDate <= dateTo);
    }

    return { success: true, interviews: filtered };
  });

/**
 * Update interview status (complete, cancel, reschedule)
 */
exports.updateInterview = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { interviewId, status, feedback, rating, newDate, newTime } = data;

    if (!interviewId || !status) {
      throw new functions.https.HttpsError('invalid-argument', 'Interview ID and status required');
    }

    const validStatuses = ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'];
    if (!validStatuses.includes(status)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid status');
    }

    const db = admin.firestore();
    const interviewDoc = await db.collection('interviews').doc(interviewId).get();

    if (!interviewDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Interview not found');
    }

    const interview = interviewDoc.data();
    if (interview.recruiterId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (feedback) updateData.feedback = feedback;
    if (rating) updateData.rating = Math.min(Math.max(rating, 1), 5);
    if (status === 'rescheduled' && newDate && newTime) {
      updateData.interviewDate = newDate;
      updateData.interviewTime = newTime;
      updateData.status = 'scheduled'; // Reset to scheduled with new date
      updateData.rescheduledFrom = {
        date: interview.interviewDate,
        time: interview.interviewTime
      };
    }

    await db.collection('interviews').doc(interviewId).update(updateData);

    return { success: true, interviewId, status: updateData.status };
  });

// ==================== RECRUITER ANALYTICS ====================

/**
 * Get comprehensive recruiter analytics
 */
exports.getRecruiterAnalytics = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const db = admin.firestore();
    const recruiterId = context.auth.uid;

    // Fetch all data in parallel
    const [matchesSnap, jobsSnap, interviewsSnap, pipelineSnap] = await Promise.all([
      db.collection('matches').where('recruiterId', '==', recruiterId).get(),
      db.collection('jobs').where('recruiterId', '==', recruiterId).get(),
      db.collection('interviews').where('recruiterId', '==', recruiterId).get(),
      db.collection('pipelineHistory').where('recruiterId', '==', recruiterId)
        .orderBy('createdAt', 'desc').limit(50).get()
    ]);

    const matches = matchesSnap.docs.map(d => d.data());
    const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const interviews = interviewsSnap.docs.map(d => d.data());

    // Pipeline breakdown
    const pipelineBreakdown = {};
    PIPELINE_STAGES.forEach(s => { pipelineBreakdown[s] = 0; });
    pipelineBreakdown['pending'] = 0;
    matches.forEach(m => {
      const stage = m.status || 'pending';
      pipelineBreakdown[stage] = (pipelineBreakdown[stage] || 0) + 1;
    });

    // Score distribution
    const scoreRanges = { 'excellent (80-100)': 0, 'good (60-79)': 0, 'fair (40-59)': 0 };
    matches.forEach(m => {
      const score = m.matchScore || 0;
      if (score >= 80) scoreRanges['excellent (80-100)']++;
      else if (score >= 60) scoreRanges['good (60-79)']++;
      else scoreRanges['fair (40-59)']++;
    });

    // Time to hire (for completed hires)
    const hiredMatches = matches.filter(m => m.status === 'hired' && m.createdAt && m.stageUpdatedAt);
    let avgTimeToHire = null;
    if (hiredMatches.length > 0) {
      const totalDays = hiredMatches.reduce((sum, m) => {
        const created = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
        const hired = m.stageUpdatedAt.toDate ? m.stageUpdatedAt.toDate() : new Date(m.stageUpdatedAt);
        return sum + (hired - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgTimeToHire = Math.round(totalDays / hiredMatches.length);
    }

    // Interview stats
    const interviewStats = {
      total: interviews.length,
      scheduled: interviews.filter(i => i.status === 'scheduled').length,
      completed: interviews.filter(i => i.status === 'completed').length,
      cancelled: interviews.filter(i => i.status === 'cancelled').length,
      noShow: interviews.filter(i => i.status === 'no-show').length
    };

    // Per-job stats
    const jobStats = jobs.map(job => {
      const jobMatches = matches.filter(m => m.jobId === job.id);
      return {
        jobId: job.id,
        jobTitle: job.jobTitle,
        status: job.status,
        totalCandidates: jobMatches.length,
        shortlisted: jobMatches.filter(m => m.status === 'shortlisted').length,
        interviewed: jobMatches.filter(m => m.status === 'interview').length,
        hired: jobMatches.filter(m => m.status === 'hired').length,
        avgMatchScore: jobMatches.length > 0
          ? Math.round(jobMatches.reduce((s, m) => s + (m.matchScore || 0), 0) / jobMatches.length)
          : 0
      };
    });

    // Recent activity
    const recentActivity = pipelineSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() || null
    }));

    return {
      success: true,
      overview: {
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.status === 'active').length,
        totalCandidates: matches.length,
        totalHired: pipelineBreakdown['hired'] || 0,
        avgMatchScore: matches.length > 0
          ? Math.round(matches.reduce((s, m) => s + (m.matchScore || 0), 0) / matches.length)
          : 0,
        avgTimeToHire
      },
      pipelineBreakdown,
      scoreDistribution: scoreRanges,
      interviewStats,
      jobStats,
      recentActivity
    };
  });

/**
 * Export candidates to CSV format
 */
exports.exportCandidates = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { jobId, stages } = data || {};
    const db = admin.firestore();

    let query = db.collection('matches')
      .where('recruiterId', '==', context.auth.uid);

    if (jobId) {
      query = query.where('jobId', '==', jobId);
    }

    const snap = await query.get();
    let candidates = snap.docs.map(d => d.data());

    if (stages && Array.isArray(stages)) {
      candidates = candidates.filter(c => stages.includes(c.status));
    }

    // Build CSV
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Experience', 'Location', 'Match Score', 'Stage', 'Job Title'];
    const rows = candidates.map(c => [
      c.seekerName || '',
      c.seekerEmail || '',
      c.seekerPhone || '',
      c.seekerRole || '',
      c.seekerExperience || '',
      c.seekerLocation || '',
      c.matchScore || 0,
      c.status || 'pending',
      c.jobTitle || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');

    return {
      success: true,
      csv,
      totalCandidates: candidates.length,
      filename: `candidates_${new Date().toISOString().split('T')[0]}.csv`
    };
  });

/**
 * Add notes to a candidate
 */
exports.addCandidateNote = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { matchId, note } = data;

    if (!matchId || !note) {
      throw new functions.https.HttpsError('invalid-argument', 'Match ID and note required');
    }

    const db = admin.firestore();
    const matchDoc = await db.collection('matches').doc(matchId).get();

    if (!matchDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Match not found');
    }

    if (matchDoc.data().recruiterId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    await db.collection('candidateNotes').add({
      matchId,
      recruiterId: context.auth.uid,
      note: note.substring(0, 2000),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  });

/**
 * Get notes for a candidate
 */
exports.getCandidateNotes = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { matchId } = data;

    if (!matchId) {
      throw new functions.https.HttpsError('invalid-argument', 'Match ID required');
    }

    const db = admin.firestore();
    const snap = await db.collection('candidateNotes')
      .where('matchId', '==', matchId)
      .where('recruiterId', '==', context.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const notes = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() || null
    }));

    return { success: true, notes };
  });
