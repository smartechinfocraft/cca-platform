const mongoose = require('mongoose');
const { sendPaymentFailedEmail } = require('./emailService');
const { logPaymentFailure } = require('../utils/paymentLogger');

async function markPaymentFailed({ registrationId, gateway, failureKey, reason, auditEvent = 'PAYMENT_FAILED' }) {
  const Registration = mongoose.model('Registration');
  const reg = await Registration.findOneAndUpdate(
    {
      _id: registrationId,
      paymentMethod: String(gateway).toUpperCase(),
      paymentStatus: { $ne: 'SUCCESS' },
      lastPaymentFailureKey: { $ne: failureKey },
    },
    {
      $set: { paymentStatus: 'FAILED', status: 'PAYMENT_FAILED', lastPaymentFailureKey: failureKey },
      $unset: { paymentFailureNotifiedAt: 1, paymentFailureNotificationError: 1 },
      $push: { paymentAuditLog: { event: auditEvent, note: String(reason || 'Payment attempt unsuccessful').slice(0, 1000) } },
    },
    { new: true }
  ).populate('parentId', 'firstName lastName email').populate('programId', 'title');

  if (!reg) return null;
  logPaymentFailure({ gateway, registrationNumber: reg.registrationNumber, reason });
  const parent = reg.parentId || {};
  try {
    if (parent.email) {
      await sendPaymentFailedEmail({
        to: parent.email,
        parentName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Parent',
        registrationNumber: reg.registrationNumber,
        programName: reg.programId?.title || reg.orderItems?.[0]?.programTitle || 'CCA Program',
        paymentMethod: gateway === 'STRIPE' ? 'Stripe/card' : 'PayPal',
        totalAmount: reg.totalAmount,
        reason,
      });
      await Registration.updateOne({ _id: reg._id, lastPaymentFailureKey: failureKey }, { $set: { paymentFailureNotifiedAt: new Date() } });
    }
  } catch (error) {
    await Registration.updateOne({ _id: reg._id, lastPaymentFailureKey: failureKey }, { $set: { paymentFailureNotificationError: error.message } });
    console.error('Payment failure notification failed:', error);
  }
  return reg;
}

module.exports = { markPaymentFailed };
