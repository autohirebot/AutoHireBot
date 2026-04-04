/**
 * AutoHireBot - Placement Tracking Handler
 * Tracks successful placements, updates platform stats, sends notifications
 */

const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

const zeptoApiKey = defineSecret('ZEPTO_API_KEY');
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');

const ZEPTO_CONFIG = {
  fromEmail: 'noreply@autohirebot.com',
  fromName: 'AutoHireBot'
};

/**
 * Send email via ZeptoMail API (local helper)
 */
async function sendEmail(to, subject, html) {
  let apiKey;
  try {
    apiKey = zeptoApiKey.value();
  } catch (e) {
    console.error('Failed to get ZEPTO_API_KEY');
    return;
  }

  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  const emailData = {
    from: { address: ZEPTO_CONFIG.fromEmail, name: ZEPTO_CONFIG.fromName },
    to: [{ email_address: { address: to, name: to.split('@')[0] } }],
    subject,
    htmlbody: html
  };

  try {
    const response = await fetch('https://api.zeptomail.in/v1.1/email', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('ZeptoMail placement email error:', result);
    } else {
      console.log('✅ Placement email sent to', to);
    }
  } catch (error) {
    console.error('Placement email failed:', error.message);
  }
}

/**
 * Send WhatsApp text message
 */
async function sendWhatsAppText(to, text) {
  let phoneNumberId, accessToken;
  try {
    phoneNumberId = WHATSAPP_PHONE_ID.value();
    accessToken = WHATSAPP_TOKEN.value();
  } catch (e) {
    console.log('WhatsApp secrets not available, skipping');
    return;
  }

  if (!phoneNumberId || !accessToken || !to) return;

  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  // Format phone for WhatsApp (add 91 if needed)
  let phone = to.replace(/[^0-9]/g, '');
  if (phone.length === 10) phone = '91' + phone;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text }
      })
    });
    console.log('✅ WhatsApp placement message sent to', to);
  } catch (err) {
    console.log('WhatsApp placement message skipped:', err.message);
  }
}

/**
 * Get initials from a name (e.g., "Priya Kumari" → "P.K.")
 */
function getInitials(name) {
  if (!name) return '??';
  return name.split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('.') + '.';
}

/**
 * Handle a successful placement when a candidate is moved to "hired" stage.
 * Called from ats-features.js updateCandidateStage.
 *
 * @param {string} matchId - The match document ID
 * @param {Object} matchData - The match document data
 */
async function handlePlacement(matchId, matchData) {
  const db = admin.firestore();

  console.log(`🎉 Processing placement for match ${matchId}`);

  // Fetch seeker and job details
  const [seekerDoc, jobDoc] = await Promise.all([
    db.collection('jobSeekers').doc(matchData.seekerId).get(),
    db.collection('jobs').doc(matchData.jobId).get()
  ]);

  const seeker = seekerDoc.exists ? seekerDoc.data() : {};
  const job = jobDoc.exists ? jobDoc.data() : {};

  const now = new Date();
  const createdAt = matchData.createdAt?.toDate ? matchData.createdAt.toDate() : new Date(matchData.createdAt || now);
  const timeToPlacementDays = Math.max(1, Math.round((now - createdAt) / (1000 * 60 * 60 * 24)));

  const placementData = {
    matchId,
    seekerId: matchData.seekerId,
    seekerInitials: getInitials(matchData.seekerName || seeker.name),
    seekerName: matchData.seekerName || seeker.name || 'Unknown',
    recruiterId: matchData.recruiterId,
    jobId: matchData.jobId,
    jobTitle: matchData.jobTitle || job.jobTitle || 'Staff Nurse',
    hospitalName: matchData.recruiterName || job.facilityName || job.hospitalName || 'Hospital',
    location: job.location || seeker.preferredLocation || 'India',
    matchScore: matchData.matchScore || 0,
    timeToPlacementDays,
    hiredAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // 1. Create placement document
  await db.collection('placements').add(placementData);
  console.log('✅ Placement document created');

  // 2. Update platformStats/live via transaction
  const statsRef = db.collection('platformStats').doc('live');
  await db.runTransaction(async (txn) => {
    const statsDoc = await txn.get(statsRef);

    if (!statsDoc.exists) {
      // First placement ever — initialize stats
      txn.set(statsRef, {
        totalPlacements: 1,
        thisMonthPlacements: 1,
        avgTimeToPlacement: timeToPlacementDays,
        totalTimeToPlacement: timeToPlacementDays,
        lastResetMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        recentPlacements: [{
          initials: placementData.seekerInitials,
          hospital: placementData.hospitalName,
          location: placementData.location,
          jobTitle: placementData.jobTitle,
          hiredAt: now.toISOString()
        }],
        updatedAt: now.toISOString()
      });
    } else {
      const stats = statsDoc.data();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const newTotal = (stats.totalPlacements || 0) + 1;
      const newTotalTime = (stats.totalTimeToPlacement || 0) + timeToPlacementDays;

      // Reset monthly counter if new month
      const thisMonth = stats.lastResetMonth === currentMonth
        ? (stats.thisMonthPlacements || 0) + 1
        : 1;

      // Prepend to recent placements, cap at 10
      const recent = stats.recentPlacements || [];
      recent.unshift({
        initials: placementData.seekerInitials,
        hospital: placementData.hospitalName,
        location: placementData.location,
        jobTitle: placementData.jobTitle,
        hiredAt: now.toISOString()
      });
      if (recent.length > 10) recent.length = 10;

      txn.update(statsRef, {
        totalPlacements: newTotal,
        thisMonthPlacements: thisMonth,
        lastResetMonth: currentMonth,
        avgTimeToPlacement: Math.round(newTotalTime / newTotal),
        totalTimeToPlacement: newTotalTime,
        recentPlacements: recent,
        updatedAt: now.toISOString()
      });
    }
  });
  console.log('✅ Platform stats updated');

  // 3. Mark seeker as placed
  if (seekerDoc.exists) {
    await db.collection('jobSeekers').doc(matchData.seekerId).update({
      placed: true,
      placedAt: admin.firestore.FieldValue.serverTimestamp(),
      placedJobTitle: placementData.jobTitle,
      placedHospital: placementData.hospitalName,
      placedLocation: placementData.location
    });
    console.log('✅ Seeker marked as placed');
  }

  // 4. Send congratulations email
  try {
    const seekerEmail = matchData.seekerEmail || seeker.email;
    if (seekerEmail) {
      await sendEmail(
        seekerEmail,
        `🎉 Congratulations! You've been hired as ${placementData.jobTitle}`,
        buildCongratsEmail(placementData.seekerName, placementData.jobTitle, placementData.hospitalName, placementData.location)
      );
    }
  } catch (e) {
    console.error('Congrats email failed:', e.message);
  }

  // 5. Send WhatsApp notification
  try {
    const seekerPhone = matchData.seekerPhone || seeker.phone;
    if (seekerPhone) {
      await sendWhatsAppText(
        seekerPhone,
        `🎉 Congratulations ${placementData.seekerName}! You've been selected as ${placementData.jobTitle} at ${placementData.hospitalName}, ${placementData.location}. Your placement through AutoHireBot is confirmed! The recruiter will contact you with joining details. Best wishes for your new role! 🏥`
      );
    }
  } catch (e) {
    console.error('WhatsApp congrats failed:', e.message);
  }

  console.log(`🎉 Placement complete for ${placementData.seekerName} at ${placementData.hospitalName}`);
  return placementData;
}

/**
 * Build congratulations HTML email
 */
function buildCongratsEmail(name, jobTitle, hospital, location) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;">
    <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:30px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:28px;">🎉 Congratulations!</h1>
      <p style="margin:10px 0 0;font-size:16px;opacity:0.9;">You've Been Successfully Placed</p>
    </div>
    <div style="padding:30px;">
      <p style="font-size:16px;color:#333;">Dear <strong>${name}</strong>,</p>
      <p style="font-size:15px;color:#555;line-height:1.6;">
        We are thrilled to inform you that you have been <strong style="color:#0d9488;">successfully selected</strong> for the following position:
      </p>
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Position</td>
            <td style="padding:8px 0;color:#333;font-size:14px;font-weight:bold;text-align:right;">${jobTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Hospital</td>
            <td style="padding:8px 0;color:#333;font-size:14px;font-weight:bold;text-align:right;">${hospital}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Location</td>
            <td style="padding:8px 0;color:#333;font-size:14px;font-weight:bold;text-align:right;">${location}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:15px;color:#555;line-height:1.6;">
        The recruiting team will contact you shortly with onboarding and joining details. Please keep your documents ready.
      </p>
      <div style="text-align:center;margin:25px 0;">
        <a href="https://autohirebot.com/jobs" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">View Your Dashboard</a>
      </div>
      <p style="font-size:14px;color:#888;border-top:1px solid #eee;padding-top:15px;margin-top:25px;">
        Thank you for choosing AutoHireBot. We wish you great success in your new role!
      </p>
    </div>
    <div style="background:#f9fafb;padding:15px;text-align:center;font-size:12px;color:#aaa;">
      AutoHireBot &mdash; India's #1 AI-Powered Nursing Recruitment Platform<br>
      <a href="https://autohirebot.com" style="color:#0d9488;">autohirebot.com</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  handlePlacement
};
