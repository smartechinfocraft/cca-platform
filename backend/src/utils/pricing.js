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
 * @param {String} [opts.selectedDays]         - selected schedule/day labels
 * @param {String|Object} [opts.selectedMonth] - selected month option label/object
 * @param {Number} [opts.expectedUnitPrice]    - client-displayed per-student line fee, validated against stored pricing
 * @param {String[]} [opts.weeklyBatchIds] - IDs of Program.weeklyBatches the
 *                                           parent selected (WEEKLY batchType
 *                                           only). Price = unit price × the
 *                                           number of batches selected.
 * @param {String} [opts.couponCode]       - optional coupon to apply
 * @returns {Promise<{
 *   unitPrice: number, subtotal: number, discount: number,
 *   total: number, currency: string,
 *   program: Object, batch: Object|null,
 *   weeklyBatches: Object[], weekCount: number,
 *   coupon: Object|null
 * }>}
 */
async function computeRegistrationTotal({ programId, batchId, studentCount = 1, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, couponCode, parentId }) {
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

  // ── WEEKLY batchType: validate the selected weekly batches server-side ──
  // NEVER trust weekCount from the client. Every ID in weeklyBatchIds must
  // exist in Program.weeklyBatches and be active, otherwise a tampered
  // request could inflate/deflate the number of "weeks" billed.
  let matchedWeeklyBatches = [];
  if (program.batchType === 'WEEKLY' && Array.isArray(weeklyBatchIds) && weeklyBatchIds.length > 0) {
    const allBatches = program.weeklyBatches || [];
    const requestedIds = [...new Set(weeklyBatchIds.map(String))];
    matchedWeeklyBatches = allBatches.filter(
      (b) => b.isActive !== false && requestedIds.includes(String(b._id))
    );
    if (matchedWeeklyBatches.length !== requestedIds.length) {
      const err = new Error('One or more selected batches are not valid for this program.');
      err.status = 400;
      throw err;
    }
  }
  const weekCount = matchedWeeklyBatches.length;

  const selectedMonthLabel =
    typeof selectedMonth === 'string'
      ? selectedMonth
      : (selectedMonth?.label || selectedMonth?.name || '');
  const monthOptions = Array.isArray(batch?.monthOptions) && batch.monthOptions.length > 0
    ? batch.monthOptions
    : (Array.isArray(program.monthOptions) ? program.monthOptions : []);
  const matchedMonthOption = selectedMonthLabel && monthOptions.length > 0
    ? monthOptions.find((m) => String(m.label || '').trim() === String(selectedMonthLabel).trim())
    : null;
  if (matchedMonthOption && !isMonthOptionAvailable(matchedMonthOption)) {
    const err = new Error('Selected month option is not currently available for registration.');
    err.status = 400;
    throw err;
  }
  const expectedUnit = Number(expectedUnitPrice);
  const selectedDayCount = countSelectedDays(selectedDays);
  const requestedFrequency = Math.max(Number(sessionsPerWeek) > 0 ? Number(sessionsPerWeek) : 1, selectedDayCount);
  const matchedMonthByPrice = !matchedMonthOption && expectedUnit > 0 && monthOptions.length > 0
    ? monthOptions.filter(isMonthOptionAvailable).find((m) => {
        const price = Number(m.price);
        return price > 0 && Math.abs(Math.round(expectedUnit / price) * price - expectedUnit) <= 0.01;
      })
    : null;
  const selectedMonthPrice =
    matchedMonthOption?.price != null
      ? Number(matchedMonthOption.price)
      : matchedMonthByPrice?.price != null
        ? Number(matchedMonthByPrice.price)
        : 0;
  const frequencyFromExpected = selectedMonthPrice > 0 && expectedUnit > 0
    ? Math.round(expectedUnit / selectedMonthPrice)
    : 0;
  const selectedFrequency = Math.max(requestedFrequency, frequencyFromExpected || 1);

  // Price priority (most specific wins):
  //   1. WEEKLY batchType with batches selected: (discountedPrice||basePrice) × weekCount
  //   2. Batch per-session price × sessions/week
  //   3. Batch flat price override
  //   4. Program discountedPrice
  //   5. Program basePrice
  let unitPrice;
  if (program.batchType === 'WEEKLY' && weekCount > 0) {
    const perWeekPrice = program.discountedPrice != null ? program.discountedPrice : program.basePrice;
    unitPrice = perWeekPrice * weekCount;
  } else if (selectedMonthPrice > 0) {
    unitPrice = selectedMonthPrice * selectedFrequency;
  } else if (batch?.pricePerSession && selectedFrequency > 0) {
    unitPrice = batch.pricePerSession * selectedFrequency;
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

      // Check per-parent redemption cap ("coupon ownership") — only
      // enforceable when we know who the parent is (logged-in checkout).
      // Guest checkouts can't be checked here; the final /register save
      // re-validates once a Parent record has been resolved.
      if (coupon.perUserLimit != null && parentId) {
        const Registration = mongoose.model('Registration');
        const priorUses = await Registration.countDocuments({
          parentId,
          couponCode: coupon.code,
          paymentStatus: { $ne: 'FAILED' },
        });
        if (priorUses >= coupon.perUserLimit) {
          const err = new Error('You have already used this coupon the maximum number of times.');
          err.status = 400;
          throw err;
        }
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
    weeklyBatches: matchedWeeklyBatches,
    weekCount,
    coupon: appliedCoupon,
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function countSelectedDays(selectedDays) {
  if (!selectedDays || typeof selectedDays !== 'string') return 1;
  const count = selectedDays
    .split(/\s*(?:\+|\||,|\n)\s*/)
    .map((day) => day.trim())
    .filter(Boolean)
    .length;
  return Math.max(1, count);
}

function isMonthOptionAvailable(option) {
  if (!option) return false;
  if (isDisabledFlag(option.isEnabled)) return false;
  return true;
}

function isDisabledFlag(value) {
  return value === false || value === 'false' || value === 0 || value === '0';
}

async function applyCouponToSubtotal({ subtotal, couponCode, parentId }) {
  const Coupon = mongoose.model('Coupon');
  const safeSubtotal = round2(subtotal);
  if (!couponCode) return { discount: 0, total: safeSubtotal, coupon: null };

  const coupon = await Coupon.findOne({
    code: couponCode.trim().toUpperCase(),
    isActive: true,
  }).lean();

  if (!coupon) {
    const err = new Error('Invalid or inactive coupon code');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    const err = new Error('Coupon has expired');
    err.status = 400;
    throw err;
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    const err = new Error('Coupon usage limit has been reached');
    err.status = 400;
    throw err;
  }

  if (safeSubtotal < coupon.minAmount) {
    const err = new Error(`Coupon requires a minimum order of $${coupon.minAmount}`);
    err.status = 400;
    throw err;
  }

  if (coupon.perUserLimit != null && parentId) {
    const Registration = mongoose.model('Registration');
    const priorUses = await Registration.countDocuments({
      parentId,
      couponCode: coupon.code,
      paymentStatus: { $ne: 'FAILED' },
    });
    if (priorUses >= coupon.perUserLimit) {
      const err = new Error('You have already used this coupon the maximum number of times.');
      err.status = 400;
      throw err;
    }
  }

  const discount = coupon.type === 'PERCENTAGE'
    ? round2(safeSubtotal * (coupon.value / 100))
    : round2(Math.min(coupon.value, safeSubtotal));

  return {
    discount,
    total: round2(safeSubtotal - discount),
    coupon,
  };
}

async function computeCartTotal({ cartItems, couponCode, parentId }) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    const err = new Error('cartItems are required to compute cart checkout price');
    err.status = 400;
    throw err;
  }

  const lineItems = await Promise.all(cartItems.map(async (item) => {
    const weeklyBatchIds = Array.isArray(item.weeklyBatchIds)
      ? item.weeklyBatchIds
      : Array.isArray(item.selectedWeeklyBatches)
        ? item.selectedWeeklyBatches.map((b) => (typeof b === 'string' ? b : b?._id)).filter(Boolean)
        : [];
    const studentCount = Array.isArray(item.students) && item.students.length ? item.students.length : (item.studentCount || 1);
    const unitPrice = round2(Number(item.fee));
    if (!item.programId || !item.batchId || !unitPrice || unitPrice <= 0) {
      const err = new Error('Each cart item must include programId, batchId, and a payable line fee.');
      err.status = 400;
      throw err;
    }

    const priced = await computeRegistrationTotal({
      programId: item.programId,
      batchId: item.batchId,
      studentCount,
      sessionsPerWeek: item.sessionsPerWeek,
      selectedDays: item.selectedDays,
      selectedMonth: item.selectedMonth,
      expectedUnitPrice: item.fee,
      weeklyBatchIds,
    });

    return {
      ...priced,
      unitPrice,
      subtotal: round2(unitPrice * studentCount),
    };
  }));

  const subtotal = round2(lineItems.reduce((sum, item) => sum + item.subtotal, 0));
  const couponResult = await applyCouponToSubtotal({
    subtotal,
    couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
    parentId,
  });

  return {
    unitPrice: subtotal,
    subtotal,
    discount: couponResult.discount,
    total: couponResult.total,
    currency: 'USD',
    lineItems,
    coupon: couponResult.coupon,
  };
}

module.exports = {
  computeRegistrationTotal,
  computeCartTotal,
  applyCouponToSubtotal,
  round2,
  isMonthOptionAvailable,
};
