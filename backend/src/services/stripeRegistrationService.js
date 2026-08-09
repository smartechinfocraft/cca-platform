const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('./emailService');
const { logPaymentSuccess } = require('../utils/paymentLogger');
const { validateStripeIntent } = require('../utils/stripeRegistrationValidation');

function registrationEmailPayload(reg) {
  const parent = reg.parentId || {};
  const students = Array.isArray(reg.students) ? reg.students : [];
  const program = reg.programId || {};
  const batches = Array.isArray(reg.batches) ? reg.batches : [];
  return {
    to: parent.email,
    registrationNumber: reg.registrationNumber,
    studentName: students.map(s => `${s.firstName || ''} ${s.lastName || ''}`.trim()).filter(Boolean).join(', '),
    programName: program.title || 'CCA Program',
    batchInfo: batches.map(b => b.title || b.name).filter(Boolean).join(', '),
    parentName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || parent.email,
    parentEmail: parent.email,
    parentPhone: parent.phone,
    paymentMethod: 'Stripe',
    subtotal: reg.subtotal,
    discountAmount: reg.discountAmount,
    couponCode: reg.couponCode,
    totalAmount: reg.totalAmount,
    transactionId: reg.transactionId,
    orderItems: reg.orderItems || [],
  };
}

async function sendStripeConfirmationOnce(registrationId) {
  const Registration = mongoose.model('Registration');
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const claimed = await Registration.findOneAndUpdate(
    {
      _id: registrationId,
      paymentMethod: 'STRIPE',
      paymentStatus: 'SUCCESS',
      confirmationEmailSentAt: { $exists: false },
      $or: [
        { confirmationEmailSendingAt: { $exists: false } },
        { confirmationEmailSendingAt: { $lt: staleBefore } },
      ],
    },
    { $set: { confirmationEmailSendingAt: new Date() }, $unset: { confirmationEmailError: 1 } },
    { new: true }
  )
    .populate('parentId', 'firstName lastName email phone')
    .populate('programId', 'title')
    .populate('students', 'firstName lastName')
    .populate('batches', 'title');

  if (!claimed) return false;
  try {
    await sendRegistrationEmail(registrationEmailPayload(claimed));
    await Registration.updateOne(
      { _id: claimed._id },
      { $set: { confirmationEmailSentAt: new Date() }, $unset: { confirmationEmailSendingAt: 1, confirmationEmailError: 1 } }
    );
    return true;
  } catch (err) {
    await Registration.updateOne(
      { _id: claimed._id },
      { $set: { confirmationEmailError: err.message }, $unset: { confirmationEmailSendingAt: 1 } }
    );
    throw err;
  }
}

async function confirmStripeRegistration({ registrationId, intent, auditEvent, auditNote }) {
  const Registration = mongoose.model('Registration');
  const reg = await Registration.findOne({
    _id: registrationId,
    paymentMethod: 'STRIPE',
    transactionId: intent.id,
  });
  if (!reg) throw Object.assign(new Error('Matching Stripe registration was not found.'), { status: 404 });

  if (!validateStripeIntent(reg, intent).valid) {
    throw Object.assign(new Error('Stripe payment verification failed.'), { status: 400 });
  }

  if (reg.paymentStatus !== 'SUCCESS') {
    reg.paymentStatus = 'SUCCESS';
    reg.status = 'CONFIRMED';
    reg.paymentAuditLog.push({ event: auditEvent, note: auditNote });
    await reg.save();
    logPaymentSuccess({
      gateway: 'STRIPE',
      paymentIntentId: intent.id,
      registrationNumber: reg.registrationNumber,
      amount: reg.totalAmount,
    });
  }

  if (reg.couponCode && !reg.couponUsageRecordedAt) {
    const claimedCouponUsage = await Registration.findOneAndUpdate(
      {
        _id: reg._id,
        couponUsageRecordedAt: { $exists: false },
        couponUsageRecordingAt: { $exists: false },
      },
      { $set: { couponUsageRecordingAt: new Date() } },
      { new: true }
    );
    if (claimedCouponUsage) {
      const Coupon = mongoose.model('Coupon');
      const incremented = await Coupon.findOneAndUpdate(
        {
          code: reg.couponCode,
          isActive: true,
          $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );
      await Registration.updateOne(
        { _id: reg._id },
        incremented
          ? { $set: { couponUsageRecordedAt: new Date() }, $unset: { couponUsageRecordingAt: 1 } }
          : { $set: { adminNote: 'Coupon usage limit was reached during Stripe confirmation.' }, $unset: { couponUsageRecordingAt: 1 } }
      );
    }
  }

  try {
    await sendStripeConfirmationOnce(reg._id);
  } catch (err) {
    console.error('Stripe confirmation email failed:', err);
  }
  return reg;
}

module.exports = { confirmStripeRegistration, sendStripeConfirmationOnce };
