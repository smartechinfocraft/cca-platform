const mongoose = require('mongoose');

function couponUnavailableError() {
  const err = new Error('This coupon has just reached its usage limit. Please remove it and try again.');
  err.status = 409;
  err.code = 'COUPON_LIMIT_REACHED';
  return err;
}

/**
 * Saves a registration and reserves its coupon in the same MongoDB
 * transaction. A reservation is retained while an online payment remains
 * retryable, preventing a later successful retry from losing its quoted
 * amount. Terminal cancellation/rejection must call releaseCouponReservation.
 */
async function saveRegistrationWithCouponReservation(registration, coupon) {
  if (!coupon) {
    await registration.save();
    return registration;
  }

  await releaseExpiredUnstartedReservations();
  await mongoose.connection.transaction(async session => {
      const Registration = mongoose.model('Registration');
      const Coupon = mongoose.model('Coupon');

      if (coupon.perUserLimit != null) {
        const priorUses = await Registration.countDocuments({
          parentId: registration.parentId,
          couponCode: coupon.code,
          status: { $ne: 'CANCELLED' },
          $or: [
            { couponUsageRecordedAt: { $exists: true } },
            { paymentStatus: 'SUCCESS' },
            { paymentMethod: 'CHECK', paymentStatus: { $ne: 'FAILED' } },
          ],
        }).session(session);
        if (priorUses >= coupon.perUserLimit) throw couponUnavailableError();
      }

      const reserved = await Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          isActive: true,
          $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true, session }
      );
      if (!reserved) throw couponUnavailableError();

      registration.couponCode = coupon.code;
      registration.couponUsageRecordedAt = new Date();
      if (['STRIPE', 'PAYPAL'].includes(registration.paymentMethod)) {
        registration.couponReservationExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      }
      await registration.save({ session });
  });
  return registration;
}

async function releaseCouponReservation(registrationId, { session: externalSession } = {}) {
  const ownSession = !externalSession;
  const session = externalSession;
  let released = false;
  const execute = async () => {
    const Registration = mongoose.model('Registration');
    const Coupon = mongoose.model('Coupon');
    const registration = await Registration.findOneAndUpdate(
      { _id: registrationId, couponCode: { $exists: true }, couponUsageRecordedAt: { $exists: true } },
      { $unset: { couponUsageRecordedAt: 1, couponUsageRecordingAt: 1, couponReservationExpiresAt: 1 } },
      { new: false, session }
    );
    if (!registration) return;
    const result = await Coupon.updateOne(
      { code: registration.couponCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      { session }
    );
    if (result.modifiedCount !== 1) {
      const err = new Error('Coupon reservation could not be released consistently.');
      err.code = 'COUPON_RELEASE_INCONSISTENT';
      throw err;
    }
    released = true;
  };
  if (ownSession) {
    await mongoose.connection.transaction(async transactionSession => {
      released = await releaseCouponReservation(registrationId, { session: transactionSession });
    });
  } else {
    await execute();
  }
  return released;
}

async function releaseExpiredUnstartedReservations(now = new Date()) {
  const Registration = mongoose.model('Registration');
  const expiredIds = await Registration.find({
    couponReservationExpiresAt: { $lte: now },
    couponUsageRecordedAt: { $exists: true },
    paymentStatus: 'PENDING',
    transactionId: { $exists: false },
    paypalOrderId: { $exists: false },
  }).select('_id').limit(100).lean();
  for (const registration of expiredIds) {
    await releaseCouponReservation(registration._id);
  }
  return expiredIds.length;
}

module.exports = { saveRegistrationWithCouponReservation, releaseCouponReservation, releaseExpiredUnstartedReservations };
