const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('./emailService');
const { logPaymentSuccess } = require('../utils/paymentLogger');
const { validatePayPalCapture } = require('../utils/paypalRegistrationValidation');

async function sendPayPalConfirmationOnce(registrationId) {
  const Registration = mongoose.model('Registration');
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const reg = await Registration.findOneAndUpdate(
    {
      _id: registrationId,
      paymentMethod: 'PAYPAL',
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
  if (!reg) return false;

  const parent = reg.parentId || {};
  try {
    await sendRegistrationEmail({
      to: parent.email,
      registrationNumber: reg.registrationNumber,
      studentName: (reg.students || []).map(s => `${s.firstName} ${s.lastName}`).join(', '),
      programName: reg.programId?.title || 'CCA Program',
      batchInfo: (reg.batches || []).map(b => b.title).filter(Boolean).join(', '),
      parentName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || parent.email,
      parentEmail: parent.email,
      parentPhone: parent.phone,
      paymentMethod: 'PayPal',
      subtotal: reg.subtotal,
      discountAmount: reg.discountAmount,
      couponCode: reg.couponCode,
      totalAmount: reg.totalAmount,
      transactionId: reg.transactionId,
      orderItems: reg.orderItems || [],
    });
    await Registration.updateOne(
      { _id: reg._id },
      { $set: { confirmationEmailSentAt: new Date() }, $unset: { confirmationEmailSendingAt: 1, confirmationEmailError: 1 } }
    );
    return true;
  } catch (err) {
    await Registration.updateOne(
      { _id: reg._id },
      { $set: { confirmationEmailError: err.message }, $unset: { confirmationEmailSendingAt: 1 } }
    );
    throw err;
  }
}

async function confirmPayPalRegistration({ registrationId, capture, auditEvent, auditNote }) {
  const Registration = mongoose.model('Registration');
  const reg = await Registration.findOne({ _id: registrationId, paymentMethod: 'PAYPAL' });
  if (!reg) throw Object.assign(new Error('Matching PayPal registration was not found.'), { status: 404 });
  if (!validatePayPalCapture(reg, capture).valid) {
    throw Object.assign(new Error('PayPal payment verification failed.'), { status: 400 });
  }
  if (reg.transactionId && reg.transactionId !== capture.id) {
    throw Object.assign(new Error('A different PayPal capture is already attached.'), { status: 409 });
  }
  const duplicate = await Registration.exists({ _id: { $ne: reg._id }, transactionId: capture.id });
  if (duplicate) throw Object.assign(new Error('This PayPal capture is already used.'), { status: 409 });

  if (reg.paymentStatus !== 'SUCCESS') {
    reg.transactionId = capture.id;
    reg.paymentStatus = 'SUCCESS';
    reg.status = 'CONFIRMED';
    reg.paymentAuditLog.push({ event: auditEvent, note: auditNote });
    await reg.save();
    logPaymentSuccess({ gateway: 'PAYPAL', transactionId: capture.id, registrationNumber: reg.registrationNumber, amount: reg.totalAmount });
  }
  if (reg.couponCode && !reg.couponUsageRecordedAt) {
    const claimed = await Registration.findOneAndUpdate(
      { _id: reg._id, couponUsageRecordedAt: { $exists: false }, couponUsageRecordingAt: { $exists: false } },
      { $set: { couponUsageRecordingAt: new Date() } },
      { new: true }
    );
    if (claimed) {
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
          : { $set: { adminNote: 'Coupon usage limit was reached during PayPal confirmation.' }, $unset: { couponUsageRecordingAt: 1 } }
      );
    }
  }
  try { await sendPayPalConfirmationOnce(reg._id); }
  catch (err) { console.error('PayPal confirmation email failed:', err); }
  return reg;
}

module.exports = { validatePayPalCapture, confirmPayPalRegistration, sendPayPalConfirmationOnce };
