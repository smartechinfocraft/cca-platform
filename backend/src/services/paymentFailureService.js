const mongoose = require('mongoose');
const { sendPaymentFailedEmail } = require('./emailService');
const { logPaymentFailure } = require('../utils/paymentLogger');

async function markPaymentFailed({ registrationId, gateway, failureKey, reason, auditEvent = 'PAYMENT_FAILED' }) {
  if (!failureKey) throw new Error('A payment failure key is required.');
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
  ).populate('parentId', 'firstName lastName email phone').populate('programId', 'title').populate('students', 'firstName lastName');

  if (!reg) return null;
  logPaymentFailure({ gateway, registrationNumber: reg.registrationNumber, reason });
  const parent = reg.parentId || {};
  try {
    if (parent.email) {
      const frontendUrl = String(process.env.FRONTEND_URL || 'https://calcricket.org').replace(/\/+$/, '');
      await sendPaymentFailedEmail({
        to: parent.email,
        parentName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Parent',
        parentEmail: parent.email,
        parentPhone: parent.phone,
        registrationNumber: reg.registrationNumber,
        programName: reg.programId?.title || reg.orderItems?.[0]?.programTitle || 'CCA Program',
        paymentMethod: gateway === 'STRIPE' ? 'Stripe/card' : 'PayPal',
        totalAmount: reg.totalAmount,
        subtotal: reg.subtotal,
        discountAmount: reg.discountAmount,
        orderItems: reg.orderItems || [],
        studentName: (reg.students || []).map(student => `${student.firstName || ''} ${student.lastName || ''}`.trim()).filter(Boolean).join(', '),
        retryUrl: reg.registrationMode === 'REGISTERED'
          ? `${frontendUrl}/dashboard/purchases/${reg._id}/pay`
          : `${frontendUrl}/cart`,
        retryFromCart: reg.registrationMode !== 'REGISTERED',
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
