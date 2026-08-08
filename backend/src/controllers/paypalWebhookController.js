const mongoose = require('mongoose');
const { verifyWebhookSignature } = require('../services/paypalService');
const { confirmPayPalRegistration } = require('../services/paypalRegistrationService');
const { markPaymentFailed } = require('../services/paymentFailureService');
const { logWebhookFailure, logReplayAttack } = require('../utils/paymentLogger');

exports.handlePayPalWebhook = async (req, res) => {
  try {
    if (!await verifyWebhookSignature(req.headers, req.body)) {
      return res.status(400).json({ success: false, message: 'Webhook verification failed.' });
    }
    const event = req.body;
    const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent');
    if (await PaymentWebhookEvent.exists({ gateway: 'PAYPAL', eventId: event.id })) {
      logReplayAttack({ gateway: 'PAYPAL', eventId: event.id, eventType: event.event_type });
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      const Registration = mongoose.model('Registration');
      const orderId = capture?.supplementary_data?.related_ids?.order_id;
      const registrationId = capture?.custom_id;
      const reg = registrationId
        ? await Registration.findOne({ _id: registrationId, paymentMethod: 'PAYPAL' })
        : await Registration.findOne({ paypalOrderId: orderId, paymentMethod: 'PAYPAL' });
      if (!reg) return res.status(500).json({ success: false, message: 'Matching registration is not ready.' });
      await confirmPayPalRegistration({
        registrationId: reg._id,
        capture,
        auditEvent: 'PAYPAL_WEBHOOK_SUCCESS',
        auditNote: `event ${event.id}`,
      });
    } else if (['PAYMENT.CAPTURE.DENIED', 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'].includes(event.event_type)) {
      const resource = event.resource || {};
      const Registration = mongoose.model('Registration');
      const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.id;
      const registrationId = resource?.custom_id;
      const reg = registrationId
        ? await Registration.findOne({ _id: registrationId, paymentMethod: 'PAYPAL' })
        : await Registration.findOne({ paypalOrderId: orderId, paymentMethod: 'PAYPAL' });
      if (reg) await markPaymentFailed({
        registrationId: reg._id,
        gateway: 'PAYPAL',
        failureKey: `paypal-${orderId || resource.id}`,
        reason: resource?.status_details?.reason || 'PayPal denied or reversed the payment attempt.',
        auditEvent: 'PAYPAL_WEBHOOK_FAILED',
      });
    }

    try {
      await PaymentWebhookEvent.create({
        gateway: 'PAYPAL',
        eventId: event.id,
        eventType: event.event_type,
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    logWebhookFailure({ gateway: 'PAYPAL', reason: err.message });
    return res.status(500).json({ success: false, message: 'Internal error.' });
  }
};
