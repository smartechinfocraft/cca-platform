// ============================================================
//  utils/pricing.js
//  SINGLE SOURCE OF TRUTH for what a registration costs.
// ============================================================
const mongoose = require('mongoose');

/**
 * Compute the authoritative price for a registration.
 * Optionally apply a validated coupon code.
 *
 * @param {Object} opts
 * @param {String} opts.programId
 * @param {String} [opts.batchId]
 * @param {Number} opts.studentCount
 * @param {Number} [opts.sessionsPerWeek]
 * @param {String} [opts.couponCode]       - optional coupon to apply
 * @returns {Promise<{
 *   unitPrice: number, subtotal: number, discount: number,
 *   total: number, currency: string,
 *   program: Object, batch: Object|null,
 *   coupon: Object|null
 * }>}
 */
async function computeRegistrationTotal({ programId, batchId, studentCount = 1, sessionsPerWeek, couponCode }) {
  const Program = mongoose.model('Program');
  const Batch   = mongoose.model('Batch');
  const Coupon  = mongoose.model('Coupon');

  if (!programId) {
    const err = new Error('programId is required to compute price');
    err.status = 400;
    throw err;
  }

  const program = await Program.findOne({ _id: programId, isActive: true }).lean();
  if (!program) {
    const err = new Error('Program not found or is no longer active');
    err.status = 404;
    throw err;
  }

  let batch = null;
  if (batchId) {
    // Skip batch lookup when batchId === programId — this happens when the
    // registration page generates a synthetic batch from scheduleDays (no
    // separate Batch document exists). Pricing falls back to program price.
    const batchIdStr   = String(batchId);
    const programIdStr = String(programId);
    if (batchIdStr !== programIdStr) {
      batch = await Batch.findOne({ _id: batchId, program: programId, isActive: true }).lean();
      // If batch not found, don't throw — fall back to program-level pricing
      // so a bad batchId doesn't block registration. Price priority below
      // naturally falls through to program.discountedPrice / basePrice.
    }
  }

  // Price priority (most specific wins):
  //   1. Batch per-session price × sessions/week
  //   2. Batch flat price override
  //   3. Program discountedPrice
  //   4. Program basePrice
  let unitPrice;
  if (batch?.pricePerSession && sessionsPerWeek && Number(sessionsPerWeek) > 0) {
    unitPrice = batch.pricePerSession * Number(sessionsPerWeek);
  } else if (batch?.price != null) {
    unitPrice = batch.price;
  } else if (program.discountedPrice != null) {
    unitPrice = program.discountedPrice;
  } else {
    unitPrice = program.basePrice;
  }

  const safeStudentCount = Math.max(1, parseInt(studentCount, 10) || 1);
  const subtotal = round2(unitPrice * safeStudentCount);

  // ── Coupon logic ──────────────────────────────────────────
  let discount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.trim().toUpperCase(),
      isActive: true,
    }).lean();

    if (coupon) {
      // Check expiry
      const now = new Date();
      if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        const err = new Error('Coupon has expired');
        err.status = 400;
        throw err;
      }

      // Check usage limit (null = unlimited)
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        const err = new Error('Coupon usage limit has been reached');
        err.status = 400;
        throw err;
      }

      // Check minimum amount
      if (subtotal < coupon.minAmount) {
        const err = new Error(`Coupon requires a minimum order of $${coupon.minAmount}`);
        err.status = 400;
        throw err;
      }

      if (coupon.type === 'PERCENTAGE') {
        discount = round2(subtotal * (coupon.value / 100));
      } else {
        // FIXED — never exceed subtotal
        discount = round2(Math.min(coupon.value, subtotal));
      }

      appliedCoupon = coupon;
    } else {
      const err = new Error('Invalid or inactive coupon code');
      err.status = 400;
      throw err;
    }
  }

  const total = round2(subtotal - discount);

  return {
    unitPrice: round2(unitPrice),
    subtotal,
    discount,
    total,
    currency: 'USD',
    program,
    batch,
    coupon: appliedCoupon,
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = { computeRegistrationTotal, round2 };