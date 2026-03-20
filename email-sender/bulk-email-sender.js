/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  AUTOHIREBOT - BULK EMAIL SENDER (ZeptoMail)                              ║
 * ║  Send outreach emails to nursing colleges                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * SETUP:
 * 1. npm install node-fetch
 * 2. Add your college emails to the COLLEGE_EMAILS array below
 * 3. Add your ZeptoMail API key
 * 4. Run: node bulk-email-sender.js
 * 
 * IMPORTANT: ZeptoMail has rate limits. Send in batches of 50-100 per hour.
 */

const fs = require('fs');

// ==================== CONFIGURATION ====================

// Your ZeptoMail API Key (same as in Firebase)
const ZEPTO_API_KEY = 'YOUR_ZEPTO_API_KEY_HERE'; // Replace with your actual key

// Sender details
const FROM_EMAIL = 'noreply@autohirebot.com';
const FROM_NAME = 'AutoHireBot';

// Email subject
const EMAIL_SUBJECT = '🏥 Free Job Placement Platform for Your Nursing Students - AutoHireBot';

// College email list - Add your emails here
const COLLEGE_EMAILS = [
  // { email: 'principal@college1.edu.in', name: 'ABC Nursing College' },
  // { email: 'placement@college2.ac.in', name: 'XYZ Institute of Nursing' },
  // Add more colleges...
];

// Delay between emails (in milliseconds) - to avoid rate limiting
const DELAY_BETWEEN_EMAILS = 2000; // 2 seconds

// ==================== HTML EMAIL TEMPLATE ====================

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0891b2, #0e7490); padding: 40px 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🏥 AutoHireBot</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">AI-Powered Healthcare Recruitment Platform</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              
              <p style="color: #1e293b; font-size: 16px; margin: 0 0 20px;">
                Dear <strong>Principal / Placement Officer</strong>,
              </p>
              
              <p style="color: #475569; font-size: 15px; margin: 0 0 20px;">
                Greetings from <strong>AutoHireBot</strong>! We are India's first AI-powered healthcare recruitment platform, and we would like to offer our services <strong style="color: #0891b2;">completely FREE</strong> to your nursing students.
              </p>
              
              <!-- Value Proposition -->
              <div style="background: linear-gradient(135deg, #f0fdfa, #ecfeff); border: 1px solid #99f6e4; border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="color: #0e7490; margin: 0 0 15px; font-size: 18px;">🎯 What We Offer Your Students (FREE)</h3>
                <p style="color: #475569; font-size: 14px; margin: 5px 0;">✅ AI-powered job matching with 500+ hospitals</p>
                <p style="color: #475569; font-size: 14px; margin: 5px 0;">✅ Instant profile creation (under 2 minutes)</p>
                <p style="color: #475569; font-size: 14px; margin: 5px 0;">✅ Resume parsing with AI auto-fill</p>
                <p style="color: #475569; font-size: 14px; margin: 5px 0;">✅ Direct connection with hospital recruiters</p>
                <p style="color: #475569; font-size: 14px; margin: 5px 0;">✅ Real-time job alerts via Email & WhatsApp</p>
              </div>
              
              <!-- Specialties -->
              <p style="color: #475569; font-size: 15px; margin: 20px 0 10px;">
                <strong>Supported:</strong> GNM • BSc Nursing • ANM • MSc Nursing • ICU • Emergency • OT • NICU • Pediatrics
              </p>
              
              <!-- CTA -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://autohirebot.com" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #0e7490); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                  Visit AutoHireBot →
                </a>
              </div>
              
              <!-- Request -->
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 10px 10px 0; margin: 25px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>🤝 Our Request:</strong> Please share this platform with your final year nursing students. There is <strong>no cost</strong> involved.
                </p>
              </div>
              
              <p style="color: #475569; font-size: 15px; margin: 20px 0;">
                We are also open to <strong>campus placement drives</strong> and <strong>MoU partnerships</strong>.
              </p>
              
              <p style="color: #1e293b; font-size: 15px; margin: 25px 0 0;">
                Warm Regards,<br>
                <strong>Team AutoHireBot</strong>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                🌐 <a href="https://autohirebot.com" style="color: #0891b2;">autohirebot.com</a> &nbsp;|&nbsp;
                📧 <a href="mailto:admin@autohirebot.com" style="color: #0891b2;">admin@autohirebot.com</a> &nbsp;|&nbsp;
                📱 <a href="https://wa.me/919347143100" style="color: #0891b2;">WhatsApp</a>
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0;">© 2025 AutoHireBot | Powered by X VIRUS LAB</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==================== PLAIN TEXT VERSION ====================

const TEXT_TEMPLATE = `
Dear Principal / Placement Officer,

Greetings from AutoHireBot!

We are India's first AI-powered healthcare recruitment platform, and we would like to offer our services COMPLETELY FREE to your nursing students.

🎯 WHAT WE OFFER (FREE):
✅ AI-powered job matching with 500+ hospitals
✅ Instant profile creation (under 2 minutes)  
✅ Resume parsing with AI auto-fill
✅ Direct connection with hospital recruiters
✅ Real-time job alerts via Email & WhatsApp

Supported: GNM • BSc Nursing • ANM • MSc Nursing • ICU • Emergency • OT • NICU • Pediatrics

🔗 Website: https://autohirebot.com

Please share this platform with your final year nursing students. There is NO COST involved.

We are also open to campus placement drives and MoU partnerships.

Warm Regards,
Team AutoHireBot

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 autohirebot.com | 📧 admin@autohirebot.com | 📱 +91 93471 43100
`;

// ==================== EMAIL SENDING FUNCTION ====================

async function sendEmail(toEmail, toName) {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const emailData = {
    from: {
      address: FROM_EMAIL,
      name: FROM_NAME
    },
    to: [{
      email_address: {
        address: toEmail,
        name: toName || toEmail.split('@')[0]
      }
    }],
    subject: EMAIL_SUBJECT,
    htmlbody: HTML_TEMPLATE,
    textbody: TEXT_TEMPLATE
  };

  try {
    const response = await fetch('https://api.zeptomail.in/v1.1/email', {
      method: 'POST',
      headers: {
        'Authorization': ZEPTO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed: ${toEmail} - ${result.message || 'Unknown error'}`);
      return { success: false, email: toEmail, error: result.message };
    }

    console.log(`✅ Sent: ${toEmail}`);
    return { success: true, email: toEmail, messageId: result.request_id };

  } catch (error) {
    console.error(`❌ Error: ${toEmail} - ${error.message}`);
    return { success: false, email: toEmail, error: error.message };
  }
}

// ==================== DELAY HELPER ====================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== MAIN BULK SENDER ====================

async function sendBulkEmails() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AUTOHIREBOT - BULK EMAIL SENDER');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📧 Total emails to send: ${COLLEGE_EMAILS.length}`);
  console.log(`⏱️  Delay between emails: ${DELAY_BETWEEN_EMAILS}ms`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (COLLEGE_EMAILS.length === 0) {
    console.log('⚠️  No emails in the list! Add college emails to COLLEGE_EMAILS array.');
    return;
  }

  if (ZEPTO_API_KEY === 'YOUR_ZEPTO_API_KEY_HERE') {
    console.log('⚠️  Please add your ZeptoMail API key!');
    return;
  }

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < COLLEGE_EMAILS.length; i++) {
    const college = COLLEGE_EMAILS[i];
    console.log(`[${i + 1}/${COLLEGE_EMAILS.length}] Sending to ${college.email}...`);
    
    const result = await sendEmail(college.email, college.name);
    
    if (result.success) {
      results.success.push(result);
    } else {
      results.failed.push(result);
    }

    // Wait before sending next email (to avoid rate limiting)
    if (i < COLLEGE_EMAILS.length - 1) {
      await delay(DELAY_BETWEEN_EMAILS);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Successfully sent: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed emails:');
    results.failed.forEach(f => console.log(`  - ${f.email}: ${f.error}`));
  }

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(`email-results-${timestamp}.json`, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: email-results-${timestamp}.json`);
}

// ==================== RUN ====================

sendBulkEmails().catch(console.error);
