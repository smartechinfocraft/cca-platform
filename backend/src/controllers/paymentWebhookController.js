const mongoose = require('mongoose');
const { verifyStripeWebhookSignature } = require('../services/stripeService');
const { confirmStripeRegistration } = require('../services/stripeRegistrationService');
const { markPaymentFailed } = require('../services/paymentFailureService');
const {
  logPaymentFailure,
  logWebhookFailure,
  logReplayAttack,
} = require('../utils/paymentLogger');

exports.handleStripeWebhook = async (req, res) => {
  let event;
  try {
    event = verifyStripeWebhookSignature(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logWebhookFailure({ gateway: 'STRIPE', reason: err.message });
    return res.status(400).json({ success: false, message: 'Webhook verification failed.' });
  }

  const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent');
  if (await PaymentWebhookEvent.exists({ gateway: 'STRIPE', eventId: event.id })) {
    logReplayAttack({ gateway: 'STRIPE', eventId: event.id, eventType: event.type });
    return res.status(200).json({ success: true, message: 'Event already processed.' });
  }

  try {
    const intent = event.data?.object;
    if (!intent?.id) {
      await PaymentWebhookEvent.create({ gateway: 'STRIPE', eventId: event.id, eventType: event.type });
      return res.status(200).json({ success: true, message: 'Ignored - no PaymentIntent on event.' });
    }

    const Registration = mongoose.model('Registration');
    const reg = intent.metadata?.registrationId
      ? await Registration.findOne({
          _id: intent.metadata.registrationId,
          transactionId: intent.id,
          paymentMethod: 'STRIPE',
        })
      : await Registration.findOne({ transactionId: intent.id, paymentMethod: 'STRIPE' });

    // Returning 500 is intentional: Stripe retries instead of permanently
    // dropping a paid event if registration persistence is briefly delayed.
    if (!reg) {
      return res.status(500).json({ success: false, message: 'Matching registration is not ready.' });
    }

    if (event.type === 'payment_intent.succeeded') {
      await confirmStripeRegistration({
        registrationId: reg._id,
        intent,
        auditEvent: 'STRIPE_WEBHOOK_SUCCESS',
        auditNote: `event ${event.id}`,
      });
    } else if (event.type === 'payment_intent.payment_failed') {
      await markPaymentFailed({
        registrationId: reg._id,
        gateway: 'STRIPE',
        failureKey: event.id,
        reason: intent.last_payment_error?.message || intent.last_payment_error?.decline_code || 'Card payment was declined or could not be completed.',
        auditEvent: 'STRIPE_WEBHOOK_FAILED',
      });
    }

    try {
      await PaymentWebhookEvent.create({ gateway: 'STRIPE', eventId: event.id, eventType: event.type });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    logWebhookFailure({ gateway: 'STRIPE', reason: err.message || 'handler error' });
    return res.status(500).json({ success: false, message: 'Internal error.' });
  }
};
