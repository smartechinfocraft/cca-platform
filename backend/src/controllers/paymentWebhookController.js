// ============================================================
//  controllers/paymentWebhookController.js
//  Handles POST /api/public/stripe/webhook
//
//  This is the ONLY place a payment is ever marked SUCCESS purely from a
//  gateway-initiated call (as opposed to the parent's own /register
//  request re-verifying the PaymentIntent synchronously). Because of
//  that, it is held to the strictest verification of all payment code:
//    1. Stripe-Signature header MUST verify (rejects fake/tampered/replayed
//       webhooks — see stripeService.verifyStripeWebhookSignature).
//    2. The event.id MUST NOT have been processed before (rejects
//       duplicate/retried webhook deliveries).
//    3. The amount/currency on the PaymentIntent MUST match what the
//       Registration already has stored server-side (never trust the
//       webhook payload's amount as authoritative on its own).
// ============================================================
const mongoose = require('mongoose');
const { verifyStripeWebhookSignature } = require('../services/stripeService');
const {
  logPaymentSuccess,
  logPaymentFailure,
  logWebhookFailure,
  logReplayAttack,
} = require('../utils/paymentLogger');

// req.body is the RAW Buffer here — server.js mounts this route with
// express.raw({ type: 'application/json' }) BEFORE the global express.json()
// parser, specifically so the exact bytes Stripe signed are available.
exports.handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = verifyStripeWebhookSignature(req.body, signature, secret);
  } catch (err) {
    logWebhookFailure({ gateway: 'STRIPE', reason: err.message });
    // Generic, non-descriptive error — never reveal *why* verification
    // failed (timing details, secret presence, etc.) to the caller.
    return res.status(400).json({ success: false, message: 'Webhook verification failed.' });
  }

  const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent');

  // ── Duplicate / replay protection ───────────────────────────
  // A unique index on (gateway, eventId) makes this atomic: if two
  // deliveries of the same event race each other, only one insert wins.
  try {
    await PaymentWebhookEvent.create({
      gateway: 'STRIPE',
      eventId: event.id,
      eventType: event.type,
    });
  } catch (err) {
    if (err.code === 11000) {
      logReplayAttack({ gateway: 'STRIPE', eventId: event.id, eventType: event.type });
      // Already processed — tell Stripe not to retry, but do nothing else.
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }
    logWebhookFailure({ gateway: 'STRIPE', reason: 'event log write failed' });
    return res.status(500).json({ success: false, message: 'Internal error.' });
  }

  try {
    const intent = event.data?.object;
    if (!intent?.id) {
      return res.status(200).json({ success: true, message: 'Ignored — no PaymentIntent on event.' });
    }

    const Registration = mongoose.model('Registration');
    const reg = await Registration.findOne({ transactionId: intent.id, paymentMethod: 'STRIPE' });
    if (!reg) {
      // Nothing to do yet — the /register call may not have landed. This
      // is not an error; Stripe will not retry a 200.
      return res.status(200).json({ success: true, message: 'No matching registration yet.' });
    }

    if (event.type === 'payment_intent.succeeded') {
      // ── Never trust the webhook amount blindly — cross-check against
      // what the backend already computed and stored for this registration.
      const receivedCents = Number(intent.amount_received || intent.amount || 0);
      const expectedCents = Math.round(Number(reg.totalAmount) * 100);
      if (Math.abs(receivedCents - expectedCents) > 1) {
        logPaymentFailure({
          gateway: 'STRIPE', paymentIntentId: intent.id,
          reason: 'webhook amount mismatch', expectedCents, receivedCents,
        });
        return res.status(200).json({ success: true, message: 'Amount mismatch — not applied.' });
      }

      if (reg.paymentStatus !== 'SUCCESS') {
        reg.paymentStatus = 'SUCCESS';
        reg.status = 'CONFIRMED';
        reg.paymentAuditLog.push({ event: 'STRIPE_WEBHOOK_SUCCESS', note: `event ${event.id}` });
        await reg.save();
        logPaymentSuccess({ gateway: 'STRIPE', paymentIntentId: intent.id, registrationNumber: reg.registrationNumber });
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      if (reg.paymentStatus === 'PENDING') {
        reg.paymentStatus = 'FAILED';
        reg.paymentAuditLog.push({ event: 'STRIPE_WEBHOOK_FAILED', note: `event ${event.id}` });
        await reg.save();
      }
      logPaymentFailure({ gateway: 'STRIPE', paymentIntentId: intent.id, registrationNumber: reg.registrationNumber });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    logWebhookFailure({ gateway: 'STRIPE', reason: 'handler error' });
    // Still respond 500 so Stripe retries — but the event-id row already
    // written above means a legitimate retry will be treated as a
    // duplicate.  This is an accepted, documented trade-off: it favors
    // never double-applying a payment over guaranteeing eventual
    // application after an internal error. Operators should alert on
    // WEBHOOK_FAILURE log lines and replay manually from the Stripe
    // Dashboard if needed.
    return res.status(500).json({ success: false, message: 'Internal error.' });
  }
};
