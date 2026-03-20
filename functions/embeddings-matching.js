/**
 * AutoHireBot - Embeddings-Based Matching Engine
 * Uses vector embeddings for fast, scalable job-seeker matching
 * Falls back to weighted scoring when embeddings are unavailable
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 256; // Reduced for cost efficiency

// ==================== EMBEDDING GENERATION ====================

/**
 * Generate embedding vector for text using OpenAI
 */
async function generateEmbedding(text, apiKey) {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Limit input length
      dimensions: EMBEDDING_DIMENSIONS
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || 'Embedding generation failed');
  }

  return result.data[0].embedding;
}

/**
 * Generate batch embeddings (up to 100 texts)
 */
async function generateBatchEmbeddings(texts, apiKey) {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  const truncated = texts.map(t => t.substring(0, 8000));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncated,
      dimensions: EMBEDDING_DIMENSIONS
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || 'Batch embedding failed');
  }

  return result.data.map(d => d.embedding);
}

// ==================== VECTOR MATH ====================

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Convert similarity score (0-1) to match percentage (0-100)
 */
function similarityToScore(similarity) {
  // Embedding similarity typically ranges 0.5-0.95 for relevant matches
  // Map to 0-100 score with appropriate scaling
  const normalized = Math.max(0, (similarity - 0.3) / 0.6);
  return Math.round(Math.min(normalized * 100, 100));
}

// ==================== PROFILE TEXT BUILDERS ====================

/**
 * Build searchable text representation of a job seeker profile
 */
function buildSeekerText(seeker) {
  const parts = [];

  if (seeker.qualification) parts.push(`Qualification: ${seeker.qualification}`);
  if (seeker.experience) parts.push(`Experience: ${seeker.experience}`);
  if (seeker.experienceYears) parts.push(`${seeker.experienceYears} years experience`);

  if (seeker.specializations?.length) {
    parts.push(`Specializations: ${seeker.specializations.join(', ')}`);
  }
  if (seeker.skills?.length) {
    parts.push(`Skills: ${seeker.skills.join(', ')}`);
  }
  if (seeker.preferredLocations?.length) {
    parts.push(`Preferred locations: ${seeker.preferredLocations.join(', ')}`);
  } else if (seeker.preferredCity) {
    parts.push(`Preferred city: ${seeker.preferredCity}`);
  }
  if (seeker.jobRole) parts.push(`Role: ${seeker.jobRole}`);
  if (seeker.expectedSalary) {
    if (typeof seeker.expectedSalary === 'object') {
      parts.push(`Expected salary: ${seeker.expectedSalary.min}-${seeker.expectedSalary.max}`);
    } else {
      parts.push(`Expected salary: ${seeker.expectedSalary}`);
    }
  }

  return parts.join('. ') || 'Healthcare professional seeking nursing position';
}

/**
 * Build searchable text representation of a job posting
 */
function buildJobText(job) {
  const parts = [];

  if (job.jobTitle) parts.push(`Position: ${job.jobTitle}`);
  if (job.department) parts.push(`Department: ${job.department}`);
  if (job.location || job.city) parts.push(`Location: ${job.location || job.city}`);
  if (job.facilityName || job.hospital) parts.push(`Hospital: ${job.facilityName || job.hospital}`);

  if (job.requiredSkills?.length) {
    parts.push(`Required skills: ${job.requiredSkills.join(', ')}`);
  } else if (job.skills?.length) {
    parts.push(`Skills: ${job.skills.join(', ')}`);
  }

  if (job.requiredQualification?.length) {
    parts.push(`Required qualification: ${job.requiredQualification.join(', ')}`);
  }
  if (job.requiredExperience) {
    parts.push(`Experience required: ${job.requiredExperience.min || 0}-${job.requiredExperience.max || 10} years`);
  }
  if (job.salaryRange) {
    parts.push(`Salary: ${job.salaryRange.min || 0}-${job.salaryRange.max || 'negotiable'}`);
  }
  if (job.description) parts.push(job.description.substring(0, 500));

  return parts.join('. ') || 'Healthcare position at hospital';
}

// ==================== CLOUD FUNCTIONS ====================

/**
 * Generate and store embedding for a job seeker profile
 * Called when a seeker registers or updates their profile
 */
exports.generateSeekerEmbedding = functions
  .runWith({
    secrets: [OPENAI_API_KEY],
    memory: '256MB',
    timeoutSeconds: 30
  })
  .firestore.document('jobSeekers/{seekerId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return; // Deleted

    const data = change.after.data();
    const seekerId = context.params.seekerId;

    // Skip if embedding was just updated (prevent loops)
    if (data._embeddingUpdatedAt &&
        change.before.exists &&
        change.before.data()._embeddingUpdatedAt &&
        data._embeddingUpdatedAt.isEqual(change.before.data()._embeddingUpdatedAt)) {
      return;
    }

    try {
      const text = buildSeekerText(data);
      const embedding = await generateEmbedding(text, OPENAI_API_KEY.value());

      const db = admin.firestore();
      await db.collection('embeddings').doc(`seeker_${seekerId}`).set({
        type: 'seeker',
        refId: seekerId,
        embedding,
        text,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Mark the document so we don't re-trigger
      await change.after.ref.update({
        _embeddingUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Embedding generated for seeker: ${seekerId}`);
    } catch (error) {
      console.error(`Embedding error for seeker ${seekerId}:`, error.message);
    }
  });

/**
 * Generate and store embedding for a job posting
 */
exports.generateJobEmbedding = functions
  .runWith({
    secrets: [OPENAI_API_KEY],
    memory: '256MB',
    timeoutSeconds: 30
  })
  .firestore.document('jobs/{jobId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;

    const data = change.after.data();
    const jobId = context.params.jobId;

    if (data._embeddingUpdatedAt &&
        change.before.exists &&
        change.before.data()._embeddingUpdatedAt &&
        data._embeddingUpdatedAt.isEqual(change.before.data()._embeddingUpdatedAt)) {
      return;
    }

    try {
      const text = buildJobText(data);
      const embedding = await generateEmbedding(text, OPENAI_API_KEY.value());

      const db = admin.firestore();
      await db.collection('embeddings').doc(`job_${jobId}`).set({
        type: 'job',
        refId: jobId,
        embedding,
        text,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await change.after.ref.update({
        _embeddingUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Embedding generated for job: ${jobId}`);
    } catch (error) {
      console.error(`Embedding error for job ${jobId}:`, error.message);
    }
  });

/**
 * Find top matching jobs for a seeker using embeddings
 */
exports.findEmbeddingMatches = functions
  .runWith({
    secrets: [OPENAI_API_KEY],
    memory: '512MB',
    timeoutSeconds: 120
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { seekerId, limit: matchLimit = 20, minScore = 40 } = data;

    if (!seekerId) {
      throw new functions.https.HttpsError('invalid-argument', 'Seeker ID required');
    }

    const db = admin.firestore();

    try {
      // Get seeker embedding
      const seekerEmbDoc = await db.collection('embeddings').doc(`seeker_${seekerId}`).get();

      let seekerEmbedding;
      if (seekerEmbDoc.exists) {
        seekerEmbedding = seekerEmbDoc.data().embedding;
      } else {
        // Generate on-the-fly
        const seekerDoc = await db.collection('jobSeekers').doc(seekerId).get();
        if (!seekerDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'Seeker not found');
        }
        const text = buildSeekerText(seekerDoc.data());
        seekerEmbedding = await generateEmbedding(text, OPENAI_API_KEY.value());
      }

      // Get all job embeddings
      const jobEmbSnap = await db.collection('embeddings')
        .where('type', '==', 'job')
        .get();

      if (jobEmbSnap.empty) {
        return { success: true, matches: [], message: 'No job embeddings available' };
      }

      // Calculate similarity scores
      const scored = [];
      for (const doc of jobEmbSnap.docs) {
        const jobEmb = doc.data();
        const similarity = cosineSimilarity(seekerEmbedding, jobEmb.embedding);
        const score = similarityToScore(similarity);

        if (score >= minScore) {
          scored.push({
            jobId: jobEmb.refId,
            embeddingScore: score,
            similarity: Math.round(similarity * 1000) / 1000
          });
        }
      }

      // Sort by score descending and limit
      scored.sort((a, b) => b.embeddingScore - a.embeddingScore);
      const topMatches = scored.slice(0, matchLimit);

      // Enrich with job details
      const enriched = [];
      for (const match of topMatches) {
        const jobDoc = await db.collection('jobs').doc(match.jobId).get();
        if (jobDoc.exists) {
          const job = jobDoc.data();
          enriched.push({
            ...match,
            jobTitle: job.jobTitle,
            location: job.location,
            department: job.department,
            facilityName: job.facilityName || job.hospital,
            salaryRange: job.salaryRange
          });
        }
      }

      return {
        success: true,
        matches: enriched,
        totalJobsScored: jobEmbSnap.size,
        matchesFound: enriched.length
      };

    } catch (error) {
      console.error('Embedding match error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Matching failed');
    }
  });

/**
 * Batch regenerate all embeddings (admin utility)
 */
exports.regenerateAllEmbeddings = functions
  .runWith({
    secrets: [OPENAI_API_KEY],
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

    const apiKey = OPENAI_API_KEY.value();
    const results = { seekers: 0, jobs: 0, errors: [] };

    // Process seekers in batches
    const seekerSnap = await db.collection('jobSeekers').get();
    const seekerTexts = [];
    const seekerIds = [];

    for (const doc of seekerSnap.docs) {
      seekerTexts.push(buildSeekerText(doc.data()));
      seekerIds.push(doc.id);
    }

    // Process in batches of 50
    for (let i = 0; i < seekerTexts.length; i += 50) {
      const batchTexts = seekerTexts.slice(i, i + 50);
      const batchIds = seekerIds.slice(i, i + 50);

      try {
        const embeddings = await generateBatchEmbeddings(batchTexts, apiKey);
        const batch = db.batch();

        for (let j = 0; j < embeddings.length; j++) {
          const ref = db.collection('embeddings').doc(`seeker_${batchIds[j]}`);
          batch.set(ref, {
            type: 'seeker',
            refId: batchIds[j],
            embedding: embeddings[j],
            text: batchTexts[j],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
        results.seekers += embeddings.length;
      } catch (error) {
        results.errors.push(`Seeker batch ${i}: ${error.message}`);
      }
    }

    // Process jobs
    const jobSnap = await db.collection('jobs').get();
    const jobTexts = [];
    const jobIds = [];

    for (const doc of jobSnap.docs) {
      jobTexts.push(buildJobText(doc.data()));
      jobIds.push(doc.id);
    }

    for (let i = 0; i < jobTexts.length; i += 50) {
      const batchTexts = jobTexts.slice(i, i + 50);
      const batchIds = jobIds.slice(i, i + 50);

      try {
        const embeddings = await generateBatchEmbeddings(batchTexts, apiKey);
        const batch = db.batch();

        for (let j = 0; j < embeddings.length; j++) {
          const ref = db.collection('embeddings').doc(`job_${batchIds[j]}`);
          batch.set(ref, {
            type: 'job',
            refId: batchIds[j],
            embedding: embeddings[j],
            text: batchTexts[j],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
        results.jobs += embeddings.length;
      } catch (error) {
        results.errors.push(`Job batch ${i}: ${error.message}`);
      }
    }

    return {
      success: true,
      ...results,
      total: results.seekers + results.jobs
    };
  });

// Export utilities for use by other modules
exports._cosineSimilarity = cosineSimilarity;
exports._similarityToScore = similarityToScore;
exports._buildSeekerText = buildSeekerText;
exports._buildJobText = buildJobText;
exports._generateEmbedding = generateEmbedding;
