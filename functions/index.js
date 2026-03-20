/**
 * AutoHireBot - Firebase Cloud Functions
 * Version: 4.0.0 - ZeptoMail Integration
 * Updated: Email delivery via ZeptoMail API for better inbox delivery
 */

const aiFeatures = require('./ai-features-integration');
const whatsapp = require('./whatsapp-integration');
const cashfree = require('./cashfree-integration');
const embeddings = require('./embeddings-matching');
const dbMigration = require('./db-migration');
const ats = require('./ats-features');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin (only once)
admin.initializeApp();
const db = admin.firestore();

// ==================== ZEPTOMAIL EMAIL SERVICE ====================

// ZeptoMail Configuration using Firebase Secret Manager
const { defineSecret } = require('firebase-functions/params');
const zeptoApiKey = defineSecret('ZEPTO_API_KEY');
const groqApiKey = defineSecret('GROQ_API_KEY');
const adminAccessCode = defineSecret('ADMIN_ACCESS_CODE');

const ZEPTO_CONFIG = {
  fromEmail: 'noreply@autohirebot.com',
  fromName: 'AutoHireBot'
};

// Helper to get API key (from secret or fallback)
function getZeptoApiKey() {
  try {
    return zeptoApiKey.value();
  } catch (e) {
    console.error('Failed to get secret, check ZEPTO_API_KEY is set');
    return null;
  }
}

/**
 * Send email via ZeptoMail API
 * Much better deliverability than SMTP for transactional emails
 */
async function sendEmail(to, subject, html, textBody = null) {
  const apiKey = getZeptoApiKey();
  const fromEmail = ZEPTO_CONFIG.fromEmail;
  const fromName = ZEPTO_CONFIG.fromName;

  if (!apiKey) {
    console.error('❌ ZeptoMail API key not configured');
    throw new Error('Email service not configured');
  }
  
  console.log(`📧 Sending email via ZeptoMail to ${to}`);

  // Dynamic import for node-fetch (ES module)
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

  const emailData = {
    from: {
      address: fromEmail,
      name: fromName
    },
    to: [{
      email_address: {
        address: to,
        name: to.split('@')[0]
      }
    }],
    subject: subject,
    htmlbody: html
  };

  // Add plain text version if provided
  if (textBody) {
    emailData.textbody = textBody;
  }

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
      console.error('❌ ZeptoMail Error:', result);
      throw new Error(result.message || 'Email sending failed');
    }

    console.log(`✅ Email sent via ZeptoMail to ${to}:`, result.request_id);
    return { success: true, messageId: result.request_id };

  } catch (error) {
    console.error('❌ ZeptoMail request failed:', error.message);
    throw error;
  }
}

// ==================== OTP FUNCTIONS ====================

function generateOTP(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += chars[randomBytes[i] % chars.length];
  }
  return {
    code: otp,
    hash: hashOTP(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  };
}

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp + 'autohirebot_secret').digest('hex');
}

// ==================== INPUT VALIDATION ====================

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePhone(phone) {
  const re = /^[+]?[\d\s-]{10,15}$/;
  return re.test(String(phone));
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength).replace(/<[^>]*>/g, '');
}

function validateMatchInput(data) {
  const errors = [];
  if (data.type && !['seeker', 'job', 'all'].includes(data.type)) {
    errors.push('Invalid match type');
  }
  if (data.id && typeof data.id !== 'string') {
    errors.push('Invalid ID format');
  }
  return errors;
}

function verifyOTPCode(inputOTP, storedHash, expiresAt) {
  if (new Date() > new Date(expiresAt)) {
    return { valid: false, reason: 'expired' };
  }
  const inputHash = hashOTP(inputOTP.toUpperCase());
  if (inputHash === storedHash) {
    return { valid: true };
  }
  return { valid: false, reason: 'invalid' };
}

// ==================== EMAIL TEMPLATES ====================

async function sendOTPEmail(to, name, otp) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 500px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #0891b2, #0e7490); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏥 AutoHireBot</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">AI-Powered Healthcare Recruitment</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 10px; font-size: 22px;">Verify Your Email</h2>
              <p style="color: #64748b; margin: 0 0 30px;">Hello <strong>${name || 'there'}</strong>,<br>Use the verification code below to complete your registration.</p>
              <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); border-radius: 12px; padding: 25px; text-align: center; margin: 0 0 30px;">
                <p style="color: rgba(255,255,255,0.9); margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <p style="color: #ffffff; margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${otp}</p>
              </div>
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">⏱️ This code expires in <strong>10 minutes</strong></p>
              </div>
              <p style="color: #94a3b8; margin: 25px 0 0; font-size: 13px;">If you didn't request this code, please ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">&copy; 2025 AutoHireBot | X VIRUS LAB</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textBody = `Your AutoHireBot verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;

  return sendEmail(to, `${otp} is your AutoHireBot verification code`, html, textBody);
}

async function sendSeekerMatchEmail(seeker, job, matchScore) {
  const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f7fa;">
  <table style="width:100%;"><tr><td align="center" style="padding:30px 15px;">
    <table style="width:100%;max-width:550px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
      <tr><td style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:35px;text-align:center;">
        <div style="font-size:45px;margin-bottom:10px;">🎯</div>
        <h1 style="color:#fff;margin:0;font-size:22px;">New Job Match!</h1>
        <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px;">${matchScore}% Match Score</p>
      </td></tr>
      <tr><td style="padding:35px;">
        <p style="color:#1e293b;font-size:16px;margin:0 0 20px;">Hi <strong>${seeker.name}</strong>,</p>
        <p style="color:#475569;font-size:15px;margin:0 0 20px;">Great news! Our AI found a job that matches your profile.</p>
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;margin:20px 0;">
          <h3 style="color:#0e7490;margin:0 0 15px;font-size:18px;">${job.jobTitle || 'Healthcare Position'}</h3>
          <p style="color:#475569;margin:5px 0;font-size:14px;">🏥 <strong>${job.facilityName || job.recruiterName || 'Healthcare Facility'}</strong></p>
          <p style="color:#475569;margin:5px 0;font-size:14px;">📍 ${job.location || 'Location TBD'}</p>
          <p style="color:#475569;margin:5px 0;font-size:14px;">🏷️ ${job.department || 'General'}</p>
        </div>
        <div style="background:#fef3c7;padding:15px;border-radius:8px;margin:20px 0;">
          <p style="color:#92400e;margin:0;font-size:13px;">📞 <strong>Keep your phone available</strong> for interview calls!</p>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;margin:0;font-size:12px;">© 2025 AutoHireBot | <a href="https://autohirebot.com" style="color:#0891b2;">autohirebot.com</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  try {
    await sendEmail(seeker.email, `🎯 New Job Match: ${job.jobTitle || 'Healthcare Position'} (${matchScore}% Match)`, html);
    console.log('✅ Match email sent to seeker:', seeker.email);
    // Also send WhatsApp notification
    try {
      await whatsapp.sendMatchAlertToSeeker(seeker, job, matchScore);
    } catch (waErr) {
      console.log('WhatsApp notification skipped:', waErr.message);
    }
  } catch (error) {
    console.error('❌ Seeker match email error:', error.message);
  }
}

async function sendRecruiterMatchEmail(recruiter, seeker, job, matchScore) {
  const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f7fa;">
  <table style="width:100%;"><tr><td align="center" style="padding:30px 15px;">
    <table style="width:100%;max-width:550px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
      <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:35px;text-align:center;">
        <div style="font-size:45px;margin-bottom:10px;">👤</div>
        <h1 style="color:#fff;margin:0;font-size:22px;">New Candidate Match!</h1>
        <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px;">${matchScore}% Match Score</p>
      </td></tr>
      <tr><td style="padding:35px;">
        <p style="color:#1e293b;font-size:16px;margin:0 0 20px;">Dear <strong>${recruiter.facilityName || 'Recruiter'}</strong> Team,</p>
        <p style="color:#475569;font-size:15px;margin:0 0 20px;">Our AI matched a candidate for your <strong>${job.jobTitle || 'position'}</strong>.</p>
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;margin:20px 0;">
          <h3 style="color:#0e7490;margin:0 0 10px;font-size:18px;">${seeker.name}</h3>
          <p style="color:#475569;margin:5px 0;font-size:14px;">👨‍⚕️ <strong>${seeker.jobRole || 'Nurse'}</strong></p>
          <p style="color:#475569;margin:5px 0;font-size:14px;">📅 Experience: ${seeker.experienceYears || 'Fresher'} years</p>
          <p style="color:#475569;margin:5px 0;font-size:14px;">📍 Location: ${seeker.location || 'Not specified'}</p>
          <p style="color:#475569;margin:5px 0;font-size:14px;">📞 Phone: ${seeker.phone || 'N/A'}</p>
          <p style="color:#475569;margin:5px 0;font-size:14px;">📧 Email: ${seeker.email}</p>
        </div>
        <div style="text-align:center;margin:25px 0;">
          <a href="https://autohirebot.com/recruiter-dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;text-decoration:none;padding:14px 30px;border-radius:10px;font-weight:600;">View in Dashboard →</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;margin:0;font-size:12px;">© 2025 AutoHireBot | <a href="https://autohirebot.com" style="color:#0891b2;">autohirebot.com</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  try {
    await sendEmail(recruiter.email, `👤 New Candidate: ${seeker.name} for ${job.jobTitle || 'Position'} (${matchScore}% Match)`, html);
    console.log('✅ Match email sent to recruiter:', recruiter.email);
    // Also send WhatsApp notification
    try {
      await whatsapp.sendCandidateAlertToRecruiter(recruiter, seeker, job, matchScore);
    } catch (waErr) {
      console.log('WhatsApp notification skipped:', waErr.message);
    }
  } catch (error) {
    console.error('❌ Recruiter match email error:', error.message);
  }
}

async function sendWelcomeEmail(to, name, matchCount = 0) {
  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f4f8;">
  <table style="width: 100%;"><tr><td align="center" style="padding: 40px 0;">
    <table style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden;">
      <tr><td style="background: linear-gradient(135deg, #10b981, #059669); padding: 50px 30px; text-align: center;">
        <div style="font-size: 60px; margin-bottom: 15px;">🎉</div>
        <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Welcome to AutoHireBot!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0;">Your healthcare career journey starts here</p>
      </td></tr>
      <tr><td style="padding: 40px 30px;">
        <p style="color: #1e293b; font-size: 16px; margin: 0 0 20px;">Hi <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 25px;">
          Thank you for joining AutoHireBot! Your profile has been verified and our AI is already working to find the best job matches for you.
        </p>
        ${matchCount > 0 ? `
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0;">
          <p style="color: #ffffff; margin: 0; font-size: 48px; font-weight: 700;">${matchCount}</p>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">potential job matches found!</p>
        </div>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://autohirebot.com" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #0e7490); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600;">Explore Jobs</a>
        </div>
      </td></tr>
      <tr><td style="background: #f8fafc; padding: 20px; text-align: center;">
        <p style="color: #94a3b8; margin: 0; font-size: 12px;">&copy; 2025 AutoHireBot | X VIRUS LAB</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return sendEmail(to, `🎉 Welcome to AutoHireBot, ${name}!`, html);
}

async function sendRecruiterApprovalEmail(recruiter) {
  const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:30px 40px;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
        <h1 style="color:#ffffff;margin:0;font-size:28px;">AutoHireBot</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <div style="text-align:center;margin-bottom:30px;">
          <span style="font-size:60px;">🎉</span>
        </div>
        <h2 style="color:#333;margin:0 0 20px;text-align:center;">Account Approved!</h2>
        <p style="color:#666;font-size:16px;line-height:1.6;">
          Hello ${recruiter.contactName || 'there'},<br><br>
          Great news! Your recruiter account for <strong>${recruiter.facilityName}</strong> has been verified and approved.
        </p>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://autohirebot.com/recruiter-dashboard.html" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
            Access Dashboard →
          </a>
        </div>
        <p style="color:#666;font-size:14px;">
          You can now:<br>
          ✅ Post job openings<br>
          ✅ View AI-matched candidates<br>
          ✅ Access recruiter analytics
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px;background-color:#f8f9fa;text-align:center;">
        <p style="color:#999;font-size:12px;margin:0;">© 2025 AutoHireBot</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail(recruiter.email, `🎉 Your AutoHireBot Recruiter Account is Approved!`, html);
}

// ==================== MATCHING CONFIGURATION ====================

const MATCH_CONFIG = {
  MIN_MATCH_SCORE: 40,
  HIGH_MATCH_SCORE: 80,
  MAX_MATCHES_PER_JOB: 50,
  MAX_MATCHES_PER_SEEKER: 20,
  WEIGHTS: {
    skills: 0.30,
    experience: 0.25,
    location: 0.20,
    salary: 0.15,
    qualification: 0.10
  }
};

// ==================== AI MATCHING SCORING FUNCTIONS ====================

function calculateSkillScore(seekerSkills, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) return 100;
  if (!seekerSkills || seekerSkills.length === 0) return 0;
  
  const seekerLower = seekerSkills.map(s => s.toLowerCase());
  const requiredLower = requiredSkills.map(s => s.toLowerCase());
  
  let matchCount = 0;
  requiredLower.forEach(skill => {
    if (seekerLower.some(s => s.includes(skill) || skill.includes(s))) {
      matchCount++;
    }
  });
  
  const baseScore = (matchCount / requiredLower.length) * 100;
  const bonus = Math.min((seekerLower.length - matchCount) * 2, 10);
  return Math.min(baseScore + bonus, 100);
}

function calculateExperienceScore(seekerExp, requiredMin, requiredMax) {
  const exp = parseFloat(seekerExp) || 0;
  const minReq = parseFloat(requiredMin) || 0;
  const maxReq = parseFloat(requiredMax) || 10;
  
  if (exp >= minReq && exp <= maxReq) return 100;
  if (exp > maxReq) return Math.max(100 - ((exp - maxReq) * 10), 60);
  if (minReq === 0) return 80;
  return Math.max((exp / minReq) * 100, 30);
}

function calculateLocationScore(seekerLocations, jobLocation) {
  if (!jobLocation) return 100;
  if (!seekerLocations || seekerLocations.length === 0) return 50;
  
  const jobLoc = jobLocation.toLowerCase();
  const seekerLocs = Array.isArray(seekerLocations) 
    ? seekerLocations.map(l => l.toLowerCase())
    : [seekerLocations.toLowerCase()];
  
  if (seekerLocs.some(l => l === jobLoc)) return 100;
  if (seekerLocs.some(l => l.includes(jobLoc) || jobLoc.includes(l))) return 85;
  
  const cityAliases = {
    'bangalore': ['bengaluru', 'karnataka'],
    'mumbai': ['bombay', 'maharashtra'],
    'chennai': ['madras', 'tamil nadu'],
    'delhi': ['new delhi', 'ncr', 'gurgaon', 'noida'],
    'hyderabad': ['telangana', 'secunderabad'],
    'kolkata': ['calcutta', 'west bengal'],
    'pune': ['maharashtra']
  };
  
  for (const [city, aliases] of Object.entries(cityAliases)) {
    if (jobLoc.includes(city) || aliases.some(a => jobLoc.includes(a))) {
      if (seekerLocs.some(l => l.includes(city) || aliases.some(a => l.includes(a)))) {
        return 80;
      }
    }
  }
  return 40;
}

function calculateSalaryScore(seekerExpected, jobOffered) {
  const seekerMin = parseFloat(seekerExpected?.min) || 0;
  const seekerMax = parseFloat(seekerExpected?.max) || 100000;
  const jobMin = parseFloat(jobOffered?.min) || 0;
  const jobMax = parseFloat(jobOffered?.max) || 100000;
  
  const overlapStart = Math.max(seekerMin, jobMin);
  const overlapEnd = Math.min(seekerMax, jobMax);
  
  if (overlapStart <= overlapEnd) {
    const overlapRange = overlapEnd - overlapStart;
    const seekerRange = seekerMax - seekerMin || 1;
    return Math.min((overlapRange / seekerRange) * 100 + 20, 100);
  }
  
  if (jobMax < seekerMin) {
    const gap = seekerMin - jobMax;
    return Math.max(50 - (gap / seekerMin) * 100, 10);
  }
  return 90;
}

function calculateQualificationScore(seekerQual, requiredQuals) {
  if (!requiredQuals || requiredQuals.length === 0) return 100;
  
  const qualRank = {
    'anm': 1, 'gnm': 2, 'b.sc nursing': 3, 'bsc nursing': 3,
    'post basic b.sc': 4, 'm.sc nursing': 5, 'msc nursing': 5
  };
  
  const seekerRank = qualRank[seekerQual?.toLowerCase()] || 2;
  const minRequired = Math.min(...requiredQuals.map(q => qualRank[q.toLowerCase()] || 2));
  
  if (seekerRank >= minRequired) return 100;
  if (seekerRank === minRequired - 1) return 70;
  return 40;
}

function calculateMatchScore(seeker, job) {
  const skillScore = calculateSkillScore(
    [...(seeker.specialties || []), ...(seeker.skills || [])],
    job.requiredSkills || job.skills || []
  );
  const experienceScore = calculateExperienceScore(
    seeker.experienceYears,
    job.requiredExperience?.min || 0,
    job.requiredExperience?.max || 10
  );
  const locationScore = calculateLocationScore(
    seeker.preferredLocations || [seeker.location],
    job.location
  );
  const salaryScore = calculateSalaryScore(seeker.expectedSalary, job.salaryRange);
  const qualificationScore = calculateQualificationScore(seeker.qualification, job.requiredQualification);
  
  const totalScore = Math.round(
    (skillScore * MATCH_CONFIG.WEIGHTS.skills) +
    (experienceScore * MATCH_CONFIG.WEIGHTS.experience) +
    (locationScore * MATCH_CONFIG.WEIGHTS.location) +
    (salaryScore * MATCH_CONFIG.WEIGHTS.salary) +
    (qualificationScore * MATCH_CONFIG.WEIGHTS.qualification)
  );
  
  return {
    totalScore,
    skillScore: Math.round(skillScore),
    experienceScore: Math.round(experienceScore),
    locationScore: Math.round(locationScore),
    salaryScore: Math.round(salaryScore),
    qualificationScore: Math.round(qualificationScore)
  };
}

// ==================== MATCH CREATION ====================

async function createMatch(seeker, job, scores) {
  const existingMatch = await db.collection('matches')
    .where('seekerId', '==', seeker.id)
    .where('jobId', '==', job.id)
    .limit(1)
    .get();
  
  if (!existingMatch.empty) {
    await existingMatch.docs[0].ref.update({
      matchScore: scores.totalScore,
      skillScore: scores.skillScore,
      experienceScore: scores.experienceScore,
      locationScore: scores.locationScore,
      salaryScore: scores.salaryScore,
      qualificationScore: scores.qualificationScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { updated: true, matchId: existingMatch.docs[0].id };
  }
  
  const matchData = {
    seekerId: seeker.id,
    seekerName: seeker.name,
    seekerEmail: seeker.email,
    seekerPhone: seeker.phone,
    seekerRole: seeker.jobRole,
    seekerExperience: seeker.experienceYears,
    seekerLocation: seeker.location,
    jobId: job.id,
    jobTitle: job.jobTitle,
    jobDepartment: job.department,
    jobLocation: job.location,
    recruiterId: job.recruiterId,
    recruiterName: job.facilityName || job.recruiterName,
    recruiterEmail: job.recruiterEmail,
    matchScore: scores.totalScore,
    skillScore: scores.skillScore,
    experienceScore: scores.experienceScore,
    locationScore: scores.locationScore,
    salaryScore: scores.salaryScore,
    qualificationScore: scores.qualificationScore,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  const matchRef = await db.collection('matches').add(matchData);
  return { created: true, matchId: matchRef.id, matchData };
}

// ==================== MAIN MATCHING FUNCTIONS ====================

async function matchSeekerWithJobs(seekerId) {
  console.log('🔍 Matching seeker:', seekerId);
  
  const seekerDoc = await db.collection('jobSeekers').doc(seekerId).get();
  if (!seekerDoc.exists) {
    console.log('Seeker not found');
    return { success: false, error: 'Seeker not found' };
  }
  
  const seeker = { id: seekerDoc.id, ...seekerDoc.data() };
  const jobsSnap = await db.collection('jobs').where('status', '==', 'active').get();
  
  const matches = [];
  
  for (const jobDoc of jobsSnap.docs) {
    const job = { id: jobDoc.id, ...jobDoc.data() };
    const scores = calculateMatchScore(seeker, job);
    
    if (scores.totalScore >= MATCH_CONFIG.MIN_MATCH_SCORE) {
      const result = await createMatch(seeker, job, scores);
      
      if (result.created) {
        matches.push({ jobId: job.id, jobTitle: job.jobTitle, matchScore: scores.totalScore });
        
        if (scores.totalScore >= MATCH_CONFIG.HIGH_MATCH_SCORE) {
          const recruiterDoc = await db.collection('recruiters').doc(job.recruiterId).get();
          if (recruiterDoc.exists) {
            const recruiter = { id: recruiterDoc.id, ...recruiterDoc.data() };
            await sendSeekerMatchEmail(seeker, job, scores.totalScore);
            await sendRecruiterMatchEmail(recruiter, seeker, job, scores.totalScore);
          }
        }
      }
    }
  }
  
  console.log(`✅ Created ${matches.length} matches for seeker`);
  return { success: true, matchCount: matches.length, matches };
}

async function matchJobWithSeekers(jobId) {
  console.log('🔍 Matching job:', jobId);
  
  const jobDoc = await db.collection('jobs').doc(jobId).get();
  if (!jobDoc.exists) {
    console.log('Job not found');
    return { success: false, error: 'Job not found' };
  }
  
  const job = { id: jobDoc.id, ...jobDoc.data() };
  const recruiterDoc = await db.collection('recruiters').doc(job.recruiterId).get();
  const recruiter = recruiterDoc.exists ? { id: recruiterDoc.id, ...recruiterDoc.data() } : null;
  
  const seekersSnap = await db.collection('jobSeekers').where('verified', '==', true).get();
  const matches = [];
  
  for (const seekerDoc of seekersSnap.docs) {
    const seeker = { id: seekerDoc.id, ...seekerDoc.data() };
    const scores = calculateMatchScore(seeker, job);
    
    if (scores.totalScore >= MATCH_CONFIG.MIN_MATCH_SCORE) {
      const result = await createMatch(seeker, job, scores);
      
      if (result.created) {
        matches.push({ seekerId: seeker.id, seekerName: seeker.name, matchScore: scores.totalScore });
        
        if (scores.totalScore >= MATCH_CONFIG.HIGH_MATCH_SCORE && recruiter) {
          await sendSeekerMatchEmail(seeker, job, scores.totalScore);
          await sendRecruiterMatchEmail(recruiter, seeker, job, scores.totalScore);
        }
      }
    }
  }
  
  console.log(`✅ Created ${matches.length} matches for job`);
  return { success: true, matchCount: matches.length, matches };
}

// ==================== CALLABLE FUNCTIONS ====================

// Verify Admin Access Code (server-side)
exports.verifyAdminAccess = functions.runWith({
  secrets: [adminAccessCode]
}).https.onCall(async (data, context) => {
  const { code } = data;

  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Access code required');
  }

  const validCode = adminAccessCode.value();
  if (!validCode) {
    throw new functions.https.HttpsError('internal', 'Access code not configured');
  }

  // Constant-time comparison to prevent timing attacks
  const isValid = code.length === validCode.length &&
    crypto.timingSafeEqual(Buffer.from(code), Buffer.from(validCode));

  return { valid: isValid };
});

// Send OTP
exports.sendOTP = functions.runWith({
  memory: '256MB',
  secrets: [zeptoApiKey]
}).https.onCall(async (data, context) => {
  const { email, name } = data;

  if (email && !validateEmail(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
  }

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email required');
  }
  
  try {
    const recentOtps = await db.collection('otps')
      .where('email', '==', email.toLowerCase())
      .where('createdAt', '>', new Date(Date.now() - 60000))
      .get();
    
    if (!recentOtps.empty) {
      throw new functions.https.HttpsError('resource-exhausted', 'Please wait before requesting another code');
    }
    
    const otp = generateOTP();
    
    await db.collection('otps').add({
      email: email.toLowerCase(),
      hash: otp.hash,
      expiresAt: otp.expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await sendOTPEmail(email, name, otp.code);
    
    console.log(`✅ OTP sent to ${email}`);
    return { success: true };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('❌ Error sending OTP:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send OTP');
  }
});

// Verify OTP
exports.verifyOTP = functions.runWith({ memory: '256MB' }).https.onCall(async (data, context) => {
  const { email, otp } = data;
  
  if (!email || !otp) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and OTP required');
  }
  
  try {
    const otpDocs = await db.collection('otps')
      .where('email', '==', email.toLowerCase())
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (otpDocs.empty) {
      throw new functions.https.HttpsError('not-found', 'No OTP found');
    }
    
    const otpDoc = otpDocs.docs[0];
    const otpData = otpDoc.data();
    
    if (otpData.attempts >= 5) {
      await otpDoc.ref.delete();
      throw new functions.https.HttpsError('permission-denied', 'Too many attempts');
    }
    
    const result = verifyOTPCode(otp, otpData.hash, otpData.expiresAt);
    
    if (!result.valid) {
      await otpDoc.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      throw new functions.https.HttpsError('invalid-argument', 
        result.reason === 'expired' ? 'OTP expired' : 'Invalid OTP');
    }
    
    await otpDoc.ref.delete();
    
    console.log(`✅ OTP verified for ${email}`);
    return { success: true };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('❌ Verify error:', error);
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});

// Resend OTP
exports.resendOTP = functions.runWith({ 
  memory: '256MB',
  secrets: [zeptoApiKey]
}).https.onCall(async (data, context) => {
  const { email, name } = data;
  
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email required');
  }
  
  try {
    const recentOtps = await db.collection('otps')
      .where('email', '==', email.toLowerCase())
      .where('createdAt', '>', new Date(Date.now() - 60000))
      .get();
    
    if (!recentOtps.empty) {
      throw new functions.https.HttpsError('resource-exhausted', 'Please wait 1 minute');
    }
    
    const oldOtps = await db.collection('otps').where('email', '==', email.toLowerCase()).get();
    const batch = db.batch();
    oldOtps.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    const otp = generateOTP();
    
    await db.collection('otps').add({
      email: email.toLowerCase(),
      hash: otp.hash,
      expiresAt: otp.expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await sendOTPEmail(email, name, otp.code);
    
    console.log(`✅ OTP resent to ${email}`);
    return { success: true };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('❌ Resend error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to resend');
  }
});

// Manual Trigger Matching (Admin)
exports.triggerMatching = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  
  const { type, id } = data;
  
  if (type === 'seeker' && id) {
    return await matchSeekerWithJobs(id);
  } else if (type === 'job' && id) {
    return await matchJobWithSeekers(id);
  } else if (type === 'all') {
    const jobsSnap = await db.collection('jobs').where('status', '==', 'active').get();
    let totalMatches = 0;
    
    for (const jobDoc of jobsSnap.docs) {
      const result = await matchJobWithSeekers(jobDoc.id);
      totalMatches += result.matchCount || 0;
    }
    
    return { success: true, totalMatches };
  }
  
  throw new functions.https.HttpsError('invalid-argument', 'Invalid type');
});

// Get Match Analytics
exports.getMatchAnalytics = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  
  const { recruiterId } = data;
  let query = db.collection('matches');
  
  if (recruiterId) {
    query = query.where('recruiterId', '==', recruiterId);
  }
  
  const matchesSnap = await query.get();
  const matches = matchesSnap.docs.map(d => d.data());
  
  return {
    totalMatches: matches.length,
    avgMatchScore: matches.length > 0 
      ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length) 
      : 0,
    highMatches: matches.filter(m => m.matchScore >= 80).length,
    mediumMatches: matches.filter(m => m.matchScore >= 60 && m.matchScore < 80).length,
    hired: matches.filter(m => m.status === 'hired').length,
    pending: matches.filter(m => m.status === 'pending').length
  };
});

// Submit Match Feedback
exports.submitMatchFeedback = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  
  const { matchId, rating, feedback, outcome, userType } = data;
  
  if (!matchId || !rating) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  
  const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  
  if (userType === 'recruiter') {
    updateData.recruiterFeedback = { rating, feedback, outcome };
    updateData.status = outcome || 'viewed';
  } else {
    updateData.seekerFeedback = { rating, feedback };
  }
  
  await db.collection('matches').doc(matchId).update(updateData);
  
  await db.collection('matchFeedback').add({
    matchId, userType, rating, feedback, outcome,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { success: true };
});

// Approve Recruiter (Admin function)
exports.approveRecruiter = functions.runWith({ secrets: [zeptoApiKey] }).https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const adminCheck = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminCheck.exists || adminCheck.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { recruiterId } = data;

  try {
    const recruiterDoc = await db.collection('recruiters').doc(recruiterId).get();
    
    if (!recruiterDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Recruiter not found');
    }

    const recruiter = recruiterDoc.data();

    // Update status
    await db.collection('recruiters').doc(recruiterId).update({
      status: 'approved',
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send approval email
    await sendRecruiterApprovalEmail({ ...recruiter, email: recruiter.email });

    return { success: true, message: 'Recruiter approved and notified' };

  } catch (error) {
    console.error('Error approving recruiter:', error);
    throw new functions.https.HttpsError('internal', 'Approval failed');
  }
});

// ==================== FIRESTORE TRIGGERS ====================

// When Job Seeker Verifies (runs matching)
exports.onSeekerVerified = functions.runWith({ secrets: [zeptoApiKey] }).firestore
  .document('jobSeekers/{seekerId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (!before.verified && after.verified) {
      console.log('🆕 Job seeker verified, running AI matching...');
      const result = await matchSeekerWithJobs(context.params.seekerId);
      
      // Send welcome email
      try {
        await sendWelcomeEmail(after.email, after.name, result.matchCount || 0);
      } catch (e) {
        console.error('Welcome email failed:', e.message);
      }
        // WhatsApp welcome
        try {
          await whatsapp.sendWelcomeMessage(after.phone, after.name, result.matchCount || 0);
        } catch (waErr) {
          console.log('WhatsApp welcome skipped:', waErr.message);
        }
    }
    return null;
  });

// When New Job Posted (runs matching)
exports.onNewJobPosted = functions.runWith({ secrets: [zeptoApiKey] }).firestore
  .document('jobs/{jobId}')
  .onCreate(async (snap, context) => {
    console.log('🆕 New job posted, running AI matching...');
    await matchJobWithSeekers(context.params.jobId);
    return null;
  });

// When Job Updated/Reactivated
exports.onJobUpdated = functions.runWith({ secrets: [zeptoApiKey] }).firestore
  .document('jobs/{jobId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (before.status !== 'active' && after.status === 'active') {
      console.log('🔄 Job reactivated, running AI matching...');
      await matchJobWithSeekers(context.params.jobId);
    }
    return null;
  });

// ==================== SCHEDULED FUNCTIONS ====================

// Daily OTP Cleanup (midnight IST)
exports.dailyCleanup = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('🧹 Running daily cleanup...');
    
    try {
      const expiredOTPs = await db.collection('otps').where('expiresAt', '<', new Date()).get();
      const batch = db.batch();
      expiredOTPs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Deleted ${expiredOTPs.size} expired OTPs`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    return null;
  });

// Daily Match Refresh (6 AM IST)
exports.dailyMatchRefresh = functions.runWith({ secrets: [zeptoApiKey] }).pubsub
  .schedule('30 0 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('🔄 Running daily AI matching refresh...');
    
    const jobsSnap = await db.collection('jobs').where('status', '==', 'active').get();
    
    for (const jobDoc of jobsSnap.docs) {
      await matchJobWithSeekers(jobDoc.id);
    }
    
    console.log('✅ Daily matching refresh complete');
    return null;
  });

// ==================== HTTP ENDPOINTS ====================

// Health Check
exports.healthCheck = functions.runWith({ secrets: [zeptoApiKey] }).https.onRequest((req, res) => {
  const apiKey = getZeptoApiKey();
  res.json({
    status: 'ok',
    version: '4.3.0',
    features: ['OTP', 'AI Matching', 'ZeptoMail', 'Carebot (Groq)'],
    timestamp: new Date().toISOString(),
    email: {
      service: 'ZeptoMail',
      from: ZEPTO_CONFIG.fromEmail,
      configured: !!apiKey,
      secureStorage: 'Firebase Secret Manager'
    }
  });
});

// Test Email Endpoint (for debugging - remove in production)
exports.testEmail = functions.runWith({ secrets: [zeptoApiKey] }).https.onRequest(async (req, res) => {
  const testTo = req.query.email || 'test@example.com';
  
  try {
    await sendEmail(
      testTo,
      'AutoHireBot Test Email',
      '<h1>Test Email</h1><p>If you received this, ZeptoMail is working correctly!</p>',
      'Test Email - If you received this, ZeptoMail is working correctly!'
    );
    res.json({ success: true, message: `Test email sent to ${testTo}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AI CHATBOT ====================

// AutoHireBot Knowledge Base
const AUTOHIREBOT_KNOWLEDGE = `
# AutoHireBot - AI-Powered Healthcare Recruitment Platform

## About AutoHireBot
AutoHireBot is India's #1 AI-powered platform connecting qualified nurses and healthcare professionals with hospitals. We use advanced AI matching algorithms to find the perfect job matches in under 2 minutes with 95% accuracy.

## Key Features
- **AI Talent Matching**: 95% accuracy in under 2 minutes
- **Healthcare Specialized**: Built specifically for nursing and medical staffing
- **Instant Verification**: OTP-based recruiter authentication
- **Real-Time Alerts**: Email notifications when matches are found
- **HIPAA Compliant**: Enterprise-grade security with end-to-end encryption
- **Free for Job Seekers**: 100% free for all healthcare professionals

## For Job Seekers (Nurses & Healthcare Professionals)
- Registration is completely FREE
- Supported roles: Registered Nurse (RN), Licensed Practical Nurse (LPN), Nurse Practitioner (NP), Certified Nursing Assistant (CNA), Medical Assistant, and more
- Specialties supported: ICU/Critical Care, Emergency Room, Medical-Surgical, Pediatrics, Labor & Delivery, Operating Room, Oncology, Cardiology, Geriatrics, Psychiatric
- Experience levels: Fresher to 10+ years
- Get matched with hospitals across India

## For Recruiters (Hospitals & Healthcare Facilities)
- One-time registration fee: ₹999
- Post unlimited job openings
- AI-matched candidates delivered to your dashboard
- Verified candidate profiles
- Access to recruiter analytics
- Facility types: Hospital, Clinic, Nursing Home, Rehabilitation Center, Urgent Care, Home Health Agency

## How It Works
### For Job Seekers:
1. Fill out the registration form with your details
2. Select your specialties and experience
3. Verify your email with OTP
4. Our AI finds matching jobs automatically
5. Receive notifications when matched

### For Recruiters:
1. Register with facility details
2. Verify email with OTP
3. Complete payment (₹999)
4. Post job openings
5. Receive AI-matched candidates

## Statistics
- 95% Match Accuracy
- <2 minutes Average Match Time
- 10,000+ Healthcare Matches
- 500+ Partner Hospitals

## Contact & Support
- Website: https://autohirebot.com
- Email: admin@autohirebot.com

## FAQs
Q: Is AutoHireBot free for job seekers?
A: Yes, completely free for all healthcare job seekers.

Q: How fast are matches delivered?
A: Our AI matches in under 2 minutes with real-time notifications.

Q: Is my data safe?
A: Yes, we are HIPAA compliant with end-to-end encryption.

Q: What specialties are supported?
A: All major nursing specialties including ICU, ER, Medical-Surgical, Pediatrics, L&D, OR, Oncology, Cardiology, Geriatrics, and Psychiatric.

Q: How does recruiter verification work?
A: Recruiters receive OTP via email and pay ₹999 registration fee for verification.
`;

// System prompt for the chatbot
const CHATBOT_SYSTEM_PROMPT = `You are Carebot, a friendly and helpful AI assistant for AutoHireBot - India's #1 AI-powered healthcare recruitment platform.

IMPORTANT: Always respond in ENGLISH by default. Only respond in Hindi if the user writes their message in Hindi first.

Your role is to:
1. Welcome visitors warmly as Carebot
2. Answer questions about AutoHireBot
3. Guide job seekers and recruiters through registration
4. Be helpful, professional, and encouraging

Guidelines:
- ALWAYS respond in English unless the user writes in Hindi
- Be concise but informative (2-3 sentences max per response unless detailed info is needed)
- Use emojis sparingly to be friendly 😊
- If someone wants to register, guide them to click the "Register" button on the website
- For job seekers, emphasize it's completely FREE
- For recruiters, mention the ₹999 one-time registration fee
- If you don't know something, offer to connect them with support at admin@autohirebot.com
- Always be positive about healthcare careers

Key Information:
- AutoHireBot uses AI to match nurses with hospitals in under 2 minutes
- Job Seekers: FREE registration, get matched with 500+ partner hospitals
- Recruiters: ₹999 one-time fee, post unlimited jobs, get AI-matched candidates
- Supported roles: RN, LPN, NP, CNA, Medical Assistant
- Specialties: ICU, Emergency, Pediatrics, Surgery, Cardiology, etc.
- 95% match accuracy, 10,000+ successful matches

Knowledge Base:
${AUTOHIREBOT_KNOWLEDGE}

Remember: Respond in ENGLISH by default!`;

/**
 * AI Chatbot endpoint - Powered by Groq (Llama 3)
 * Super fast responses for great user experience!
 */
exports.chatbot = functions.runWith({
  secrets: [groqApiKey],
  memory: '512MB',
  timeoutSeconds: 60
}).https.onRequest(async (req, res) => {
  // Enable CORS
  const allowedOrigins = ['https://autohirebot.com', 'https://autohirebot.firebaseapp.com', 'https://autohirebot.web.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message, conversationHistory = [], sessionId } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    let apiKey;
    try {
      apiKey = groqApiKey.value();
    } catch (e) {
      console.error('Failed to get Groq API key');
    }
    
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    // Build messages array with system prompt
    const messages = [
      { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    // Call Groq API (OpenAI-compatible format)
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fast and capable
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API error:', data);
      throw new Error(data.error?.message || 'AI service error');
    }

    const assistantMessage = data.choices[0].message.content;

    // Log conversation for analytics (optional)
    if (sessionId) {
      try {
        await db.collection('chatbotLogs').add({
          sessionId,
          userMessage: message,
          assistantMessage,
          model: 'llama-3.1-8b-instant',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error('Failed to log chat:', logError);
      }
    }

    res.json({
      success: true,
      message: assistantMessage,
      conversationHistory: [
        ...conversationHistory.slice(-10),
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });

  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      error: 'Sorry, I encountered an error. Please try again or contact support.',
      fallbackMessage: "Hi! I'm Carebot, having a brief technical issue. In the meantime, you can:\n\n• **Job Seekers**: Click 'Register' above - it's FREE!\n• **Recruiters**: Click 'Register' and select 'I'm a Recruiter'\n• **Questions**: Email admin@autohirebot.com"
    });
  }
});

/**
 * Collect lead from chatbot
 */
exports.collectLead = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { name, email, phone, userType, source } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    await db.collection('chatbotLeads').add({
      name: name || '',
      email: email.toLowerCase(),
      phone: phone || '',
      userType: userType || 'unknown', // 'jobseeker' or 'recruiter'
      source: source || 'chatbot',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Lead collected successfully' });
  } catch (error) {
    console.error('Lead collection error:', error);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// === AI FEATURES v5.0 ===
exports.parseResume = aiFeatures.parseResume;
exports.autoFillFromResume = aiFeatures.autoFillFromResume;
exports.carebotWithMemory = aiFeatures.carebotWithMemory;
exports.clearCarebotMemory = aiFeatures.clearCarebotMemory;
exports.runRecruitmentWorkflow = aiFeatures.runRecruitmentWorkflow;
exports.autoMatchOnRegistration = aiFeatures.autoMatchOnRegistration;
exports.aiHealthCheck = aiFeatures.aiHealthCheck;

// ==================== CASHFREE PAYMENT EXPORTS ====================
exports.createPaymentOrder = cashfree.createPaymentOrder;
exports.verifyPayment = cashfree.verifyPayment;
exports.cashfreeWebhook = cashfree.cashfreeWebhook;
exports.getPaymentStatus = cashfree.getPaymentStatus;

// ==================== WHATSAPP NOTIFICATION EXPORTS ====================
exports.whatsappWebhook = whatsapp.whatsappWebhook;
exports.sendTestWhatsApp = whatsapp.sendTestWhatsApp;
exports.getWhatsAppLogs = whatsapp.getWhatsAppLogs;

// ==================== EMBEDDINGS MATCHING EXPORTS ====================
exports.generateSeekerEmbedding = embeddings.generateSeekerEmbedding;
exports.generateJobEmbedding = embeddings.generateJobEmbedding;
exports.findEmbeddingMatches = embeddings.findEmbeddingMatches;
exports.regenerateAllEmbeddings = embeddings.regenerateAllEmbeddings;

// ==================== DATABASE & JOB MANAGEMENT EXPORTS ====================
exports.migrateJobsToCollection = dbMigration.migrateJobsToCollection;
exports.normalizeMatches = dbMigration.normalizeMatches;
exports.createJob = dbMigration.createJob;
exports.updateJob = dbMigration.updateJob;
exports.getRecruiterJobs = dbMigration.getRecruiterJobs;
exports.expireOldJobs = dbMigration.expireOldJobs;

// ==================== ATS FEATURE EXPORTS ====================
exports.updateCandidateStage = ats.updateCandidateStage;
exports.getPipelineView = ats.getPipelineView;
exports.bulkUpdateCandidates = ats.bulkUpdateCandidates;
exports.scheduleInterview = ats.scheduleInterview;
exports.getInterviews = ats.getInterviews;
exports.updateInterview = ats.updateInterview;
exports.getRecruiterAnalytics = ats.getRecruiterAnalytics;
exports.exportCandidates = ats.exportCandidates;
exports.addCandidateNote = ats.addCandidateNote;
exports.getCandidateNotes = ats.getCandidateNotes;
