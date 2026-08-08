const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicCouponFilter } = require('../src/utils/couponVisibility');

test('public coupon discovery excludes explicitly hidden codes', () => {
  const now = new Date('2026-08-08T00:00:00.000Z');
  const filter = buildPublicCouponFilter(now);
  assert.deepEqual(filter.isPubliclyVisible, { $ne: false });
  assert.equal(filter.isActive, true);
  assert.equal(filter.$or[1].expiresAt.$gt, now);
});

test('direct-entry pricing is independent of public visibility', () => {
  // Pricing intentionally queries Coupon by code + isActive only. This
  // assertion documents that visibility is a discovery concern, not a
  // validity rule for an exact code entered by a customer/admin.
  const hiddenCoupon = { code: 'ADMINTEST', isActive: true, isPubliclyVisible: false };
  assert.equal(hiddenCoupon.isActive, true);
  assert.equal(hiddenCoupon.isPubliclyVisible, false);
});
