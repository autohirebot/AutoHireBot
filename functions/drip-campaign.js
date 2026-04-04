/**
 * AutoHireBot - Email Drip Campaign & Weekly Job Digest
 * Automated re-engagement emails to keep seekers active until placed
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

const zeptoApiKey = defineSecret('ZEPTO_API_KEY');

const ZEPTO_CONFIG = {
  fromEmail: 'noreply@autohirebot.com',
  fromName: 'AutoHireBot'
};

// ==================== EMAIL HELPER ====================

async function sendEmail(to, subject, html) {
  let apiKey;
  try {
    apiKey = zeptoApiKey.value();
  } catch (e) {
    console.error('Failed to get ZEPTO_API_KEY');
    return false;
  }

  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  try {
    const response = await fetch('https://api.zeptomail.in/v1.1/email', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        from: { address: ZEPTO_CONFIG.fromEmail, name: ZEPTO_CONFIG.fromName },
        to: [{ email_address: { address: to, name: to.split('@')[0] } }],
        subject,
        htmlbody: html
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Drip email error:', err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Drip email failed:', error.message);
    return false;
  }
}

// ==================== DUPLICATE PREVENTION ====================

async function alreadySent(db, seekerId, campaignType) {
  const snap = await db.collection('emailCampaignLog')
    .where('seekerId', '==', seekerId)
    .where('campaignType', '==', campaignType)
    .limit(1)
    .get();
  return !snap.empty;
}

async function logSent(db, seekerId, campaignType, email) {
  await db.collection('emailCampaignLog').add({
    seekerId,
    campaignType,
    email,
    sentAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// ==================== DRIP EMAIL TEMPLATES ====================

function completeProfileEmail(name) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:24px;text-align:center;color:#fff;">
    <h2 style="margin:0;">Complete Your Profile, ${name}!</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#555;line-height:1.6;">You're just one step away from getting matched with top hospitals across India.</p>
    <p style="color:#555;line-height:1.6;">Nurses with complete profiles get <strong style="color:#0d9488;">3x more interview calls</strong>. Make sure you've added:</p>
    <ul style="color:#555;line-height:2;">
      <li>Your nursing qualification (GNM/BSc/ANM/MSc)</li>
      <li>Work experience and specialization</li>
      <li>Preferred location and salary expectation</li>
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://autohirebot.com/#forms" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">Complete Your Profile</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:12px;text-align:center;font-size:12px;color:#aaa;">AutoHireBot &mdash; India's #1 AI Nursing Recruitment Platform</div>
</div>
</body></html>`;
}

function matchHighlightEmail(name, matches) {
  const matchList = matches.slice(0, 3).map(m =>
    `<li style="margin-bottom:12px;padding:12px;background:#f0fdfa;border-radius:8px;border-left:3px solid #0d9488;">
      <strong style="color:#111;">${m.jobTitle}</strong> at ${m.recruiterName || 'Hospital'}<br>
      <span style="color:#666;font-size:13px;">Match Score: <strong style="color:#0d9488;">${m.matchScore}%</strong></span>
    </li>`
  ).join('');

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:24px;text-align:center;color:#fff;">
    <h2 style="margin:0;">You Have ${matches.length} New Matches, ${name}!</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#555;line-height:1.6;">Great news! Our AI has found hospitals looking for nurses with your qualifications:</p>
    <ul style="list-style:none;padding:0;">${matchList}</ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://autohirebot.com/jobs" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">View All Matches</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:12px;text-align:center;font-size:12px;color:#aaa;">AutoHireBot &mdash; India's #1 AI Nursing Recruitment Platform</div>
</div>
</body></html>`;
}

function expandedMatchEmail(name, newMatchCount) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;color:#fff;">
    <h2 style="margin:0;">Placement Assurance Activated, ${name}!</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#555;line-height:1.6;">As part of our <strong>Placement Assurance Program</strong>, we've expanded your matching criteria to find even more opportunities for you.</p>
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
      <div style="font-size:28px;font-weight:800;color:#d97706;">${newMatchCount}</div>
      <div style="font-size:14px;color:#92400e;">New Expanded Matches Found</div>
    </div>
    <p style="color:#555;line-height:1.6;">Our team is personally reviewing your profile to ensure the best possible placement. You'll hear from us soon!</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://autohirebot.com/jobs" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">View New Matches</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:12px;text-align:center;font-size:12px;color:#aaa;">AutoHireBot &mdash; Placement Assurance Program</div>
</div>
</body></html>`;
}

function socialProofEmail(name, stats) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:24px;text-align:center;color:#fff;">
    <h2 style="margin:0;">Nurses Are Getting Placed, ${name}!</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#555;line-height:1.6;">Here's what's happening on AutoHireBot:</p>
    <div style="display:flex;gap:12px;margin:20px 0;text-align:center;">
      <div style="flex:1;background:#f0fdfa;border-radius:8px;padding:16px;">
        <div style="font-size:24px;font-weight:800;color:#0d9488;">${stats.totalPlacements || 0}</div>
        <div style="font-size:12px;color:#666;">Total Placed</div>
      </div>
      <div style="flex:1;background:#f0fdfa;border-radius:8px;padding:16px;">
        <div style="font-size:24px;font-weight:800;color:#0d9488;">${stats.thisMonthPlacements || 0}</div>
        <div style="font-size:12px;color:#666;">This Month</div>
      </div>
      <div style="flex:1;background:#f0fdfa;border-radius:8px;padding:16px;">
        <div style="font-size:24px;font-weight:800;color:#0d9488;">${stats.avgTimeToPlacement || 0}d</div>
        <div style="font-size:12px;color:#666;">Avg Time</div>
      </div>
    </div>
    <p style="color:#555;line-height:1.6;">Don't miss out! Your profile is active and our AI is continuously matching you with new opportunities.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://autohirebot.com/jobs" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">Browse Latest Jobs</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:12px;text-align:center;font-size:12px;color:#aaa;">AutoHireBot &mdash; India's #1 AI Nursing Recruitment Platform</div>
</div>
</body></html>`;
}

function weeklyDigestEmail(name, jobs) {
  const jobList = jobs.slice(0, 5).map(j =>
    `<tr>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
        <strong style="color:#111;">${j.jobTitle}</strong><br>
        <span style="color:#666;font-size:13px;">${j.facilityName || 'Hospital'} &bull; ${j.location || 'India'}</span>
      </td>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">
        <span style="color:#0d9488;font-weight:700;">${j.matchScore || ''}%</span>
      </td>
    </tr>`
  ).join('');

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:24px;text-align:center;color:#fff;">
    <h2 style="margin:0;">Your Weekly Job Digest, ${name}</h2>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Top matches from this week</p>
  </div>
  <div style="padding:24px;">
    <table style="width:100%;border-collapse:collapse;">${jobList}</table>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://autohirebot.com/jobs" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">View All Jobs</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:12px;text-align:center;font-size:12px;color:#aaa;">AutoHireBot &mdash; India's #1 AI Nursing Recruitment Platform</div>
</div>
</body></html>`;
}

// ==================== DAILY DRIP CAMPAIGN ====================

/**
 * Daily drip campaign - runs at 8:30 AM IST
 * Sends targeted emails based on seeker registration age
 */
exports.dailyDripCampaign = functions
  .runWith({ secrets: [zeptoApiKey], timeoutSeconds: 300, memory: '512MB' })
  .pubsub.schedule('30 8 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('📧 Running daily drip campaign...');
    const db = admin.firestore();
    const now = new Date();

    // Fetch all verified, non-placed seekers
    const seekersSnap = await db.collection('jobSeekers')
      .where('verified', '==', true)
      .get();

    let sent24h = 0, sent3d = 0, sent7d = 0, sent14d = 0;

    for (const doc of seekersSnap.docs) {
      const seeker = doc.data();
      if (seeker.placed) continue;
      if (!seeker.email) continue;

      const createdAt = seeker.createdAt?.toDate ? seeker.createdAt.toDate() : new Date(seeker.createdAt || now);
      const daysSinceReg = (now - createdAt) / (1000 * 60 * 60 * 24);

      try {
        // 24-hour: Complete profile reminder
        if (daysSinceReg >= 1 && daysSinceReg < 2) {
          if (!(await alreadySent(db, doc.id, '24h_complete_profile'))) {
            const success = await sendEmail(seeker.email, `Complete your profile to get matched, ${seeker.name}!`, completeProfileEmail(seeker.name));
            if (success) { await logSent(db, doc.id, '24h_complete_profile', seeker.email); sent24h++; }
          }
        }

        // 3-day: Match highlights
        if (daysSinceReg >= 3 && daysSinceReg < 4) {
          if (!(await alreadySent(db, doc.id, '3d_match_highlight'))) {
            const matchesSnap = await db.collection('matches')
              .where('seekerId', '==', doc.id)
              .orderBy('matchScore', 'desc')
              .limit(3)
              .get();

            if (matchesSnap.size > 0) {
              const matches = matchesSnap.docs.map(m => m.data());
              const success = await sendEmail(seeker.email, `You have ${matchesSnap.size} new job matches!`, matchHighlightEmail(seeker.name, matches));
              if (success) { await logSent(db, doc.id, '3d_match_highlight', seeker.email); sent3d++; }
            }
          }
        }

        // 7-day: Placement Assurance - auto re-match with relaxed criteria
        if (daysSinceReg >= 7 && daysSinceReg < 8) {
          if (!(await alreadySent(db, doc.id, '7d_placement_assurance'))) {
            // Check if seeker has few matches
            const existingMatches = await db.collection('matches')
              .where('seekerId', '==', doc.id)
              .get();

            if (existingMatches.size < 3) {
              // Re-match with relaxed score (minMatchScore=30 instead of 40)
              // This calls the main matching function with relaxed config
              try {
                const indexModule = require('./index');
                const result = await indexModule._matchSeekerWithJobs(doc.id, { minMatchScore: 30 });
                const newCount = result.matchCount || 0;

                const success = await sendEmail(seeker.email, `Placement Assurance: ${newCount} new matches found!`, expandedMatchEmail(seeker.name, newCount));
                if (success) { await logSent(db, doc.id, '7d_placement_assurance', seeker.email); sent7d++; }
              } catch (matchErr) {
                console.error('Auto re-match failed for', doc.id, matchErr.message);
              }
            }
          }
        }

        // 14-day: Social proof email
        if (daysSinceReg >= 14 && daysSinceReg < 15) {
          if (!(await alreadySent(db, doc.id, '14d_social_proof'))) {
            const statsDoc = await db.collection('platformStats').doc('live').get();
            const stats = statsDoc.exists ? statsDoc.data() : {};
            const success = await sendEmail(seeker.email, 'Nurses are getting placed — see the latest!', socialProofEmail(seeker.name, stats));
            if (success) { await logSent(db, doc.id, '14d_social_proof', seeker.email); sent14d++; }
          }
        }
      } catch (err) {
        console.error(`Drip error for seeker ${doc.id}:`, err.message);
      }
    }

    console.log(`📧 Drip campaign complete: 24h=${sent24h}, 3d=${sent3d}, 7d=${sent7d}, 14d=${sent14d}`);
    return null;
  });

// ==================== WEEKLY JOB DIGEST ====================

/**
 * Weekly job digest - runs every Monday at 9 AM IST
 * Sends personalized top-5 matching jobs from the past week
 */
exports.weeklyJobDigest = functions
  .runWith({ secrets: [zeptoApiKey], timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 9 * * 1')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('📧 Running weekly job digest...');
    const db = admin.firestore();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get jobs posted in the last week
    const newJobsSnap = await db.collection('jobs')
      .where('status', '==', 'active')
      .where('createdAt', '>=', oneWeekAgo)
      .get();

    if (newJobsSnap.empty) {
      console.log('No new jobs this week, skipping digest');
      return null;
    }

    const newJobs = newJobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get all verified, non-placed seekers
    const seekersSnap = await db.collection('jobSeekers')
      .where('verified', '==', true)
      .get();

    let sentCount = 0;

    for (const seekerDoc of seekersSnap.docs) {
      const seeker = seekerDoc.data();
      if (seeker.placed || !seeker.email) continue;

      // Find top 5 matching new jobs for this seeker
      const seekerData = { id: seekerDoc.id, ...seeker };
      const scoredJobs = [];

      for (const job of newJobs) {
        // Simple score: check location + qualification overlap
        let score = 0;
        if (seeker.preferredLocation && job.location &&
            seeker.preferredLocation.toLowerCase().includes(job.location.toLowerCase())) {
          score += 40;
        }
        if (seeker.qualification && job.qualification &&
            seeker.qualification.toLowerCase() === job.qualification.toLowerCase()) {
          score += 30;
        }
        if (seeker.experience && job.minExperience != null &&
            parseInt(seeker.experience) >= parseInt(job.minExperience)) {
          score += 20;
        }
        if (score >= 20) {
          scoredJobs.push({ ...job, matchScore: score });
        }
      }

      scoredJobs.sort((a, b) => b.matchScore - a.matchScore);
      const topJobs = scoredJobs.slice(0, 5);

      if (topJobs.length > 0) {
        try {
          const success = await sendEmail(
            seeker.email,
            `${topJobs.length} new nursing jobs matched for you this week!`,
            weeklyDigestEmail(seeker.name, topJobs)
          );
          if (success) sentCount++;
        } catch (err) {
          console.error('Digest email failed for', seekerDoc.id, err.message);
        }
      }
    }

    console.log(`📧 Weekly digest complete: ${sentCount} emails sent`);
    return null;
  });
