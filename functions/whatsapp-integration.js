/**
 * AutoHireBot - WhatsApp Cloud API Integration
 * Sends match alerts, interview reminders, and status updates via WhatsApp
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Send WhatsApp message via Cloud API
 */
async function sendWhatsAppMessage(phoneNumberId, accessToken, to, templateName, templateParams, language = 'en') {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  // Format phone number for WhatsApp (add country code if missing)
  const formattedPhone = formatPhoneForWhatsApp(to);
  if (!formattedPhone) {
    console.error('Invalid phone number:', to);
    return { success: false, error: 'Invalid phone number' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: templateParams ? [{
        type: 'body',
        parameters: templateParams.map(param => ({
          type: 'text',
          text: String(param)
        }))
      }] : []
    }
  };

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return { success: false, error: result.error?.message || 'Send failed' };
    }

    console.log('WhatsApp message sent:', result.messages?.[0]?.id);
    return { success: true, messageId: result.messages?.[0]?.id };

  } catch (error) {
    console.error('WhatsApp send error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a free-form text message (for service/utility conversations)
 */
async function sendWhatsAppText(phoneNumberId, accessToken, to, text) {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  const formattedPhone = formatPhoneForWhatsApp(to);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: text }
        })
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp text error:', result);
      return { success: false, error: result.error?.message || 'Send failed' };
    }

    return { success: true, messageId: result.messages?.[0]?.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Format phone for WhatsApp (Indian numbers)
 */
function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;

  // Remove all non-digit characters
  let cleaned = String(phone).replace(/\D/g, '');

  // Handle Indian numbers
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned; // Add India country code
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '91' + cleaned.substring(1);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    // Already has country code
  } else if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

// ==================== NOTIFICATION FUNCTIONS ====================

/**
 * Send match notification to job seeker via WhatsApp
 * Template: autohirebot_match_alert
 * Parameters: [seeker_name, job_title, hospital_name, match_score, location]
 */
exports.sendMatchAlertToSeeker = async function(seeker, job, matchScore) {
  try {
    const phoneId = WHATSAPP_PHONE_ID.value();
    const token = WHATSAPP_TOKEN.value();

    if (!phoneId || !token) {
      console.log('WhatsApp not configured, skipping notification');
      return { success: false, error: 'WhatsApp not configured' };
    }

    return await sendWhatsAppMessage(
      phoneId, token,
      seeker.phone,
      'autohirebot_match_alert',
      [
        seeker.name || 'there',
        job.jobTitle || 'Healthcare Position',
        job.facilityName || job.recruiterName || 'Healthcare Facility',
        String(matchScore),
        job.location || 'India'
      ]
    );
  } catch (e) {
    console.error('WhatsApp match alert error:', e.message);
    return { success: false, error: e.message };
  }
};

/**
 * Send new candidate notification to recruiter via WhatsApp
 * Template: autohirebot_candidate_alert
 * Parameters: [recruiter_name, candidate_name, position, match_score, experience]
 */
exports.sendCandidateAlertToRecruiter = async function(recruiter, seeker, job, matchScore) {
  try {
    const phoneId = WHATSAPP_PHONE_ID.value();
    const token = WHATSAPP_TOKEN.value();

    if (!phoneId || !token) {
      console.log('WhatsApp not configured, skipping notification');
      return { success: false, error: 'WhatsApp not configured' };
    }

    return await sendWhatsAppMessage(
      phoneId, token,
      recruiter.contactPhone || recruiter.phone,
      'autohirebot_candidate_alert',
      [
        recruiter.contactPerson || recruiter.facilityName || 'Recruiter',
        seeker.name || 'A Candidate',
        job.jobTitle || 'Healthcare Position',
        String(matchScore),
        seeker.experienceYears ? `${seeker.experienceYears} years` : 'Fresher'
      ]
    );
  } catch (e) {
    console.error('WhatsApp candidate alert error:', e.message);
    return { success: false, error: e.message };
  }
};

/**
 * Send welcome message to new job seeker
 * Template: autohirebot_welcome
 * Parameters: [name, match_count]
 */
exports.sendWelcomeMessage = async function(phone, name, matchCount) {
  try {
    const phoneId = WHATSAPP_PHONE_ID.value();
    const token = WHATSAPP_TOKEN.value();

    if (!phoneId || !token) return { success: false, error: 'WhatsApp not configured' };

    return await sendWhatsAppMessage(
      phoneId, token,
      phone,
      'autohirebot_welcome',
      [name || 'there', String(matchCount || 0)]
    );
  } catch (e) {
    console.error('WhatsApp welcome error:', e.message);
    return { success: false, error: e.message };
  }
};

/**
 * Send interview reminder
 * Template: autohirebot_interview_reminder
 * Parameters: [name, hospital, position, date, time]
 */
exports.sendInterviewReminder = async function(phone, name, hospital, position, date, time) {
  try {
    const phoneId = WHATSAPP_PHONE_ID.value();
    const token = WHATSAPP_TOKEN.value();

    if (!phoneId || !token) return { success: false, error: 'WhatsApp not configured' };

    return await sendWhatsAppMessage(
      phoneId, token,
      phone,
      'autohirebot_interview_reminder',
      [name, hospital, position, date, time]
    );
  } catch (e) {
    console.error('WhatsApp interview reminder error:', e.message);
    return { success: false, error: e.message };
  }
};

/**
 * Send payment confirmation to recruiter
 * Template: autohirebot_payment_confirmed
 * Parameters: [name, amount, order_id]
 */
exports.sendPaymentConfirmation = async function(phone, name, amount, orderId) {
  try {
    const phoneId = WHATSAPP_PHONE_ID.value();
    const token = WHATSAPP_TOKEN.value();

    if (!phoneId || !token) return { success: false, error: 'WhatsApp not configured' };

    return await sendWhatsAppMessage(
      phoneId, token,
      phone,
      'autohirebot_payment_confirmed',
      [name, String(amount), orderId]
    );
  } catch (e) {
    console.error('WhatsApp payment confirmation error:', e.message);
    return { success: false, error: e.message };
  }
};

/**
 * Send application status update
 * Template: autohirebot_status_update
 * Parameters: [name, position, hospital, status]
 */
exports.sendStatusUpdate = async function(phone, name, position, hospital, status) {
  try {
    const phoneId = WHATSAPP_PHONE_ID.value();
    const token = WHATSAPP_TOKEN.value();

    if (!phoneId || !token) return { success: false, error: 'WhatsApp not configured' };

    return await sendWhatsAppMessage(
      phoneId, token,
      phone,
      'autohirebot_status_update',
      [name, position, hospital, status]
    );
  } catch (e) {
    console.error('WhatsApp status update error:', e.message);
    return { success: false, error: e.message };
  }
};

// ==================== WEBHOOK (Incoming Messages) ====================

/**
 * WhatsApp Webhook - handle incoming messages and status updates
 */
exports.whatsappWebhook = functions
  .runWith({
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID],
    memory: '512MB',
    timeoutSeconds: 60
  })
  .https.onRequest(async (req, res) => {
    // Webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // The verify token should match what you set in Meta dashboard
      if (mode === 'subscribe' && token === 'autohirebot_whatsapp_verify') {
        console.log('WhatsApp webhook verified');
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send('Verification failed');
      return;
    }

    // Handle incoming messages (POST)
    if (req.method === 'POST') {
      try {
        const body = req.body;

        if (body.object !== 'whatsapp_business_account') {
          res.status(400).send('Invalid object');
          return;
        }

        const entries = body.entry || [];
        const db = admin.firestore();
        const phoneId = WHATSAPP_PHONE_ID.value();
        const token = WHATSAPP_TOKEN.value();

        // Lazy-load bot module
        const whatsappBot = require('./whatsapp-bot');

        for (const entry of entries) {
          const changes = entry.changes || [];

          for (const change of changes) {
            const value = change.value;

            // Handle message status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                await db.collection('whatsappLogs').add({
                  type: 'status_update',
                  messageId: status.id,
                  recipientId: status.recipient_id,
                  status: status.status,
                  timestamp: new Date(parseInt(status.timestamp) * 1000),
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
              }
            }

            // Handle incoming messages via conversational bot
            if (value.messages) {
              for (const message of value.messages) {
                const from = message.from;
                const msgBody = message.text?.body || '';
                const msgType = message.type;

                // Log the message
                await db.collection('whatsappLogs').add({
                  type: 'incoming_message',
                  from,
                  messageType: msgType,
                  body: msgBody,
                  messageId: message.id,
                  timestamp: new Date(parseInt(message.timestamp) * 1000),
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Delegate to conversational bot handler
                await whatsappBot.handleIncomingMessage(from, message, phoneId, token);
              }
            }
          }
        }

        // Always return 200 to prevent WhatsApp retries
        res.status(200).json({ success: true });

      } catch (error) {
        console.error('WhatsApp webhook error:', error);
        // Still return 200 to prevent infinite retries from WhatsApp
        res.status(200).json({ success: false, error: 'Processing failed' });
      }

      return;
    }

    res.status(405).send('Method not allowed');
  });

// ==================== CALLABLE FUNCTIONS ====================

/**
 * Send test WhatsApp message (admin only)
 */
exports.sendTestWhatsApp = functions
  .runWith({
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID],
    memory: '256MB'
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

    const { phone, message } = data;
    if (!phone || !message) {
      throw new functions.https.HttpsError('invalid-argument', 'Phone and message required');
    }

    const result = await sendWhatsAppText(
      WHATSAPP_PHONE_ID.value(),
      WHATSAPP_TOKEN.value(),
      phone,
      message
    );

    return result;
  });

/**
 * Get WhatsApp notification logs
 */
exports.getWhatsAppLogs = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }

    const { limit: queryLimit = 50, type } = data;

    let query = db.collection('whatsappLogs')
      .orderBy('createdAt', 'desc')
      .limit(Math.min(queryLimit, 200));

    if (type) {
      query = query.where('type', '==', type);
    }

    const snap = await query.get();
    const logs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      timestamp: doc.data().timestamp?.toDate?.() || null
    }));

    return { success: true, logs };
  });

/**
 * Send an interactive message (buttons or lists) via WhatsApp Cloud API
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} accessToken - WhatsApp access token
 * @param {object} payload - Full message payload (from whatsapp-bot-messages.js builders)
 */
async function sendWhatsAppInteractive(phoneNumberId, accessToken, payload) {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  // Ensure phone is formatted
  if (payload.to) {
    const formatted = formatPhoneForWhatsApp(payload.to);
    if (!formatted) return { success: false, error: 'Invalid phone number' };
    payload.to = formatted;
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp interactive error:', result);
      return { success: false, error: result.error?.message || 'Send failed' };
    }

    return { success: true, messageId: result.messages?.[0]?.id };
  } catch (error) {
    console.error('WhatsApp interactive send error:', error.message);
    return { success: false, error: error.message };
  }
}

// Export helper functions for use by other modules
exports._sendWhatsAppMessage = sendWhatsAppMessage;
exports._sendWhatsAppText = sendWhatsAppText;
exports._sendWhatsAppInteractive = sendWhatsAppInteractive;
exports._formatPhoneForWhatsApp = formatPhoneForWhatsApp;
