const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { saveRegistrationWithCouponReservation } = require('../src/services/couponReservationService');

async function withCouponModels({ reserved }, run) {
  const originalModel = mongoose.model;
  const originalTransaction = mongoose.connection.transaction;
  const session = {
    withTransaction: async callback => callback(),
    endSession: async () => {},
  };
  mongoose.connection.transaction = async callback => callback(session);
  mongoose.model = name => {
    if (name === 'Registration') {
      return {
        countDocuments: () => ({ session: async () => 0 }),
        find: () => ({ select: () => ({ limit: () => ({ lean: async () => [] }) }) }),
      };
    }
    if (name === 'Coupon') {
      return { findOneAndUpdate: async () => reserved ? { _id: 'coupon-1' } : null };
    }
    return originalModel(name);
  };
  try { await run(session); } finally {
    mongoose.model = originalModel;
    mongoose.connection.transaction = originalTransaction;
  }
}

test('coupon reservation and registration save share one transaction session', async () => {
  await withCouponModels({ reserved: true }, async session => {
    let savedWith;
    const registration = {
      parentId: 'parent-1',
      save: async options => { savedWith = options; },
    };
    await saveRegistrationWithCouponReservation(registration, {
      _id: 'coupon-1', code: 'SAVE10', perUserLimit: null,
    });
    assert.equal(savedWith.session, session);
    assert.equal(registration.couponCode, 'SAVE10');
    assert.ok(registration.couponUsageRecordedAt instanceof Date);
  });
});

test('registration is not saved when the coupon limit reservation loses a race', async () => {
  await withCouponModels({ reserved: false }, async () => {
    let saveCalls = 0;
    const registration = { parentId: 'parent-1', save: async () => { saveCalls += 1; } };
    await assert.rejects(
      saveRegistrationWithCouponReservation(registration, {
        _id: 'coupon-1', code: 'LASTUSE', perUserLimit: null,
      }),
      error => error.code === 'COUPON_LIMIT_REACHED' && error.status === 409
    );
    assert.equal(saveCalls, 0);
  });
});
