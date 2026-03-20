/**
 * AutoHireBot - Cashfree Payment Integration
 * Handles order creation, payment verification, and webhooks
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { defineSecret } = require('firebase-functions/params');

const CASHFREE_APP_ID = defineSecret('CASHFREE_APP_ID');
const CASHFREE_SECRET_KEY = defineSecret('CASHFREE_SECRET_KEY');

// Use production URL for live, test URL for sandbox
const CASHFREE_API_URL = 'https://api.cashfree.com/pg';
// For testing: 'https://sandbox.cashfree.com/pg'

const PAYMENT_AMOUNT = 999;
const CURRENCY = 'INR';

/**
 * Create a Cashfree payment order
 */
exports.createPaymentOrder = functions
  .runWith({
    secrets: [CASHFREE_APP_ID, CASHFREE_SECRET_KEY],
    memory: '256MB',
    timeoutSeconds: 30
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { recruiterId, customerName, customerEmail, customerPhone } = data;

    if (!recruiterId || !customerEmail || !customerPhone) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
    }

    const db = admin.firestore();
    const orderId = `AHB_${recruiterId}_${Date.now()}`;

    try {
      const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

      const orderPayload = {
        order_id: orderId,
        order_amount: PAYMENT_AMOUNT,
        order_currency: CURRENCY,
        customer_details: {
          customer_id: recruiterId,
          customer_name: customerName || customerEmail.split('@')[0],
          customer_email: customerEmail,
          customer_phone: customerPhone
        },
        order_meta: {
          return_url: `https://autohirebot.com/recruiter-dashboard.html?order_id=${orderId}&status={order_status}`,
          notify_url: 'https://us-central1-autohirebot.cloudfunctions.net/cashfreeWebhook'
        },
        order_note: 'AutoHireBot Recruiter Registration Fee'
      };

      const response = await fetch(`${CASHFREE_API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': CASHFREE_APP_ID.value(),
          'x-client-secret': CASHFREE_SECRET_KEY.value(),
          'x-api-version': '2023-08-01'
        },
        body: JSON.stringify(orderPayload)
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Cashfree order creation failed:', result);
        throw new Error(result.message || 'Order creation failed');
      }

      // Store order in Firestore
      await db.collection('paymentOrders').doc(orderId).set({
        orderId,
        recruiterId,
        amount: PAYMENT_AMOUNT,
        currency: CURRENCY,
        customerEmail,
        customerPhone,
        status: 'CREATED',
        cashfreeOrderId: result.cf_order_id,
        paymentSessionId: result.payment_session_id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        orderId,
        paymentSessionId: result.payment_session_id,
        cfOrderId: result.cf_order_id,
        orderAmount: PAYMENT_AMOUNT
      };

    } catch (error) {
      console.error('Payment order error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Failed to create payment order');
    }
  });

/**
 * Verify payment status after completion
 */
exports.verifyPayment = functions
  .runWith({
    secrets: [CASHFREE_APP_ID, CASHFREE_SECRET_KEY],
    memory: '256MB',
    timeoutSeconds: 30
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { orderId } = data;

    if (!orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Order ID required');
    }

    const db = admin.firestore();

    try {
      const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

      const response = await fetch(`${CASHFREE_API_URL}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'x-client-id': CASHFREE_APP_ID.value(),
          'x-client-secret': CASHFREE_SECRET_KEY.value(),
          'x-api-version': '2023-08-01'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Verification failed');
      }

      const isPaid = result.order_status === 'PAID';

      // Update payment order
      await db.collection('paymentOrders').doc(orderId).update({
        status: result.order_status,
        paymentMethod: result.payment_method || null,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // If paid, update recruiter status
      if (isPaid) {
        const orderDoc = await db.collection('paymentOrders').doc(orderId).get();
        const orderData = orderDoc.data();

        if (orderData && orderData.recruiterId) {
          await db.collection('recruiters').doc(orderData.recruiterId).update({
            paymentStatus: 'completed',
            paymentOrderId: orderId,
            paymentAmount: PAYMENT_AMOUNT,
            paymentVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Log the payment
          await db.collection('paymentLogs').add({
            recruiterId: orderData.recruiterId,
            email: orderData.customerEmail,
            amount: PAYMENT_AMOUNT,
            method: 'cashfree',
            orderId,
            status: 'completed',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      return {
        success: true,
        orderStatus: result.order_status,
        isPaid,
        orderId
      };

    } catch (error) {
      console.error('Payment verification error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'Payment verification failed');
    }
  });

/**
 * Cashfree Webhook - receives payment status updates
 */
exports.cashfreeWebhook = functions
  .runWith({
    secrets: [CASHFREE_SECRET_KEY],
    memory: '256MB',
    timeoutSeconds: 30
  })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      // Verify webhook signature
      const signature = req.headers['x-webhook-signature'];
      const timestamp = req.headers['x-webhook-timestamp'];
      const rawBody = JSON.stringify(req.body);

      if (signature && timestamp) {
        const signedPayload = timestamp + rawBody;
        const expectedSignature = crypto
          .createHmac('sha256', CASHFREE_SECRET_KEY.value())
          .update(signedPayload)
          .digest('base64');

        if (signature !== expectedSignature) {
          console.error('Invalid webhook signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      const { data } = req.body;
      if (!data || !data.order || !data.order.order_id) {
        res.status(400).json({ error: 'Invalid webhook payload' });
        return;
      }

      const orderId = data.order.order_id;
      const orderStatus = data.order.order_status;
      const paymentMethod = data.payment?.payment_group || null;

      const db = admin.firestore();

      // Update payment order
      const orderRef = db.collection('paymentOrders').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        console.error('Order not found:', orderId);
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      await orderRef.update({
        status: orderStatus,
        paymentMethod,
        webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
        webhookData: {
          eventType: req.body.type,
          paymentId: data.payment?.cf_payment_id || null
        }
      });

      // If payment successful, auto-approve recruiter
      if (orderStatus === 'PAID') {
        const orderData = orderDoc.data();

        await db.collection('recruiters').doc(orderData.recruiterId).update({
          paymentStatus: 'completed',
          paymentOrderId: orderId,
          paymentAmount: PAYMENT_AMOUNT,
          paymentVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('paymentLogs').add({
          recruiterId: orderData.recruiterId,
          email: orderData.customerEmail,
          amount: PAYMENT_AMOUNT,
          method: 'cashfree',
          orderId,
          paymentId: data.payment?.cf_payment_id || null,
          status: 'completed',
          source: 'webhook',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Payment confirmed for recruiter: ${orderData.recruiterId}`);
      }

      res.status(200).json({ success: true });

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

/**
 * Get payment status for a recruiter
 */
exports.getPaymentStatus = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { recruiterId } = data;
    const db = admin.firestore();

    const ordersSnap = await db.collection('paymentOrders')
      .where('recruiterId', '==', recruiterId || context.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const orders = ordersSnap.docs.map(doc => ({
      orderId: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    return { success: true, orders };
  });
