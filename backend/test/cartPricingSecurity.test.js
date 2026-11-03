const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { computeCartTotal } = require('../src/utils/pricing');

function queryResult(value) {
  return { lean: async () => value };
}

async function withPricingModels(run, overrides = {}) {
  const originalModel = mongoose.model;
  mongoose.model = function model(name) {
    if (name === 'Program') return { findOne: query => queryResult(overrides.programs?.[query._id] || overrides.program || { _id: 'program-1', isActive: true, basePrice: 430, monthOptions: [] }) };
    if (name === 'Batch') return { findOne: () => queryResult(overrides.batch ?? null) };
    if (name === 'Coupon') return { findOne: () => queryResult(overrides.coupon || null) };
    if (name === 'Registration') return { find: () => ({ select: () => ({ limit: () => ({ lean: async () => [] }) }) }) };
    return originalModel.apply(this, arguments);
  };
  try { await run(); } finally { mongoose.model = originalModel; }
}

test('cart pricing uses the database price and multiplies only by actual students', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({
      cartItems: [{
        programId: 'program-1', batchId: 'program-1', fee: 430,
        selectedDays: 'Sunday - 9:00 AM - 10:30 AM', sessionsPerWeek: 1,
        students: [{ firstName: 'One' }, { firstName: 'Two' }],
      }],
    });
    assert.equal(result.lineItems[0].unitPrice, 430);
    assert.equal(result.lineItems[0].subtotal, 860);
    assert.equal(result.subtotal, 860);
  });
});

test('category-scoped coupon discounts only matching cart categories', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({
      cartItems: [
        { programId: 'program-a', batchId: 'program-a', fee: 100, students: [{}] },
        { programId: 'program-b', batchId: 'program-b', fee: 200, students: [{}] },
      ],
      couponCode: 'CATEGORY10',
    });
    assert.equal(result.subtotal, 300);
    assert.equal(result.discount, 10);
    assert.equal(result.total, 290);
  }, {
    programs: {
      'program-a': { _id: 'program-a', category: 'category-a', isActive: true, basePrice: 100, monthOptions: [] },
      'program-b': { _id: 'program-b', category: 'category-b', isActive: true, basePrice: 200, monthOptions: [] },
    },
    coupon: { code: 'CATEGORY10', isActive: true, type: 'PERCENTAGE', value: 10, minAmount: 0, usedCount: 0, maxUses: null, categoryIds: ['category-a'] },
  });
});

test('category-scoped coupon is rejected when no cart item matches', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{ programId: 'program-1', batchId: 'program-1', fee: 430, students: [{}] }], couponCode: 'CATEGORY10' }),
      error => error.status === 400 && error.message.includes('does not apply')
    );
  }, {
    program: { _id: 'program-1', category: 'category-b', isActive: true, basePrice: 430, monthOptions: [] },
    coupon: { code: 'CATEGORY10', isActive: true, type: 'PERCENTAGE', value: 10, minAmount: 0, usedCount: 0, maxUses: null, categoryIds: ['category-a'] },
  });
});

test('fixed category-scoped coupon is capped at the matching category subtotal', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({
      cartItems: [
        { programId: 'program-a', batchId: 'program-a', fee: 100, students: [{}] },
        { programId: 'program-b', batchId: 'program-b', fee: 200, students: [{}] },
      ],
      couponCode: 'CATEGORY150',
    });
    assert.equal(result.discount, 100);
    assert.equal(result.total, 200);
  }, {
    programs: {
      'program-a': { _id: 'program-a', category: 'category-a', isActive: true, basePrice: 100, monthOptions: [] },
      'program-b': { _id: 'program-b', category: 'category-b', isActive: true, basePrice: 200, monthOptions: [] },
    },
    coupon: { code: 'CATEGORY150', isActive: true, type: 'FIXED', value: 150, minAmount: 0, usedCount: 0, maxUses: null, categoryIds: ['category-a'] },
  });
});

test('cart pricing rejects a cart line without its own billable students', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{ programId: 'program-1', batchId: 'program-1', fee: 430, students: [] }] }),
      error => error.code === 'CART_STUDENTS_REQUIRED'
    );
  });
});

test('cart pricing rejects the same student in the same program and batch/day twice', async () => {
  await withPricingModels(async () => {
    const duplicateLine = {
      programId: 'program-1', batchId: 'program-1', fee: 430,
      selectedDays: 'Friday - 4:30 PM - 6:00 PM - Cupertino', sessionsPerWeek: 1,
      students: [{ firstName: ' Dhairya ', lastName: 'Mistry', dob: '2015-05-01' }],
    };
    await assert.rejects(
      computeCartTotal({ cartItems: [duplicateLine, {
        ...duplicateLine,
        selectedDays: 'friday   - 4:30 PM - 6:00 PM - Cupertino',
        students: [{ firstName: 'dhairya', lastName: 'mistry ', dob: '2015-05-01' }],
      }] }),
      error => error.code === 'DUPLICATE_CART_ENROLLMENT' && error.status === 409
    );
  });
});

test('cart pricing permits the same student for a different selected day', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [
      { programId: 'program-1', batchId: 'program-1', fee: 430, selectedDays: 'Friday', students: [{ firstName: 'Dhairya', lastName: 'Mistry', dob: '2015-05-01' }] },
      { programId: 'program-1', batchId: 'program-1', fee: 430, selectedDays: 'Sunday', students: [{ firstName: 'Dhairya', lastName: 'Mistry', dob: '2015-05-01' }] },
    ] });
    assert.equal(result.subtotal, 860);
  });
});

test('cart pricing rejects overlapping day selections for the same student', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [
        { programId: 'program-1', batchId: 'program-1', fee: 430, selectedDays: 'Friday', students: [{ firstName: 'Dhairya', lastName: 'Mistry', dob: '2015-05-01' }] },
        { programId: 'program-1', batchId: 'program-1', fee: 860, selectedDays: 'Sunday + Friday', sessionsPerWeek: 2, students: [{ firstName: 'Dhairya', lastName: 'Mistry', dob: '2015-05-01' }] },
      ] }),
      error => error.code === 'DUPLICATE_CART_ENROLLMENT'
    );
  });
});

test('pricing rejects a non-synthetic batch that does not belong to the program', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{ programId: 'program-1', batchId: 'unknown-batch', fee: 430, students: [{}] }] }),
      error => error.code === 'INVALID_BATCH'
    );
  });
});

test('pricing rejects an unknown month option instead of inferring it from client price', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{ programId: 'program-1', batchId: 'program-1', fee: 430, selectedMonth: 'Fake month', students: [{}] }] }),
      error => error.code === 'INVALID_MONTH_OPTION'
    );
  }, { program: { _id: 'program-1', isActive: true, basePrice: 430, monthOptions: [{ label: 'August', price: 430, isEnabled: true }] } });
});

test('pricing rejects schedule text that is not one of the stored program days', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{
        programId: 'program-1', batchId: 'program-1', fee: 430,
        selectedDays: 'Monday - 9:00 AM - 10:30 AM - Another Ground', sessionsPerWeek: 1, students: [{}],
      }] }),
      error => error.code === 'INVALID_SCHEDULE'
    );
  }, { program: {
    _id: 'program-1', isActive: true, basePrice: 430, monthOptions: [], batchType: 'FIXED_DAYS',
    scheduleDays: [{ day: 'SUN', startTime: '09:00', endTime: '10:30', groundAddress: 'CCA Ground' }],
  } });
});

test('pricing accepts exact stored schedule entries and preserves day x student multiplication', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [{
      programId: 'program-1', batchId: 'program-1', fee: 860,
      selectedMonth: { label: 'August' },
      selectedDays: 'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino + Thursday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
      sessionsPerWeek: 2,
      students: [{}, {}],
    }] });
    assert.equal(result.lineItems[0].unitPrice, 860);
    assert.equal(result.subtotal, 1720);
  }, { program: {
    _id: 'program-1', isActive: true, basePrice: 430, batchType: 'REGULAR_WITH_MONTH',
    monthOptions: [{ label: 'August', price: 430, isEnabled: true }],
    scheduleDays: [
      { day: 'TUE', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
      { day: 'THU', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
    ],
  } });
});

test('regular programs without month options multiply the per-session price by selected days', async () => {
  const program = {
    _id: 'program-1', isActive: true, basePrice: 430, batchType: 'REGULAR_WITHOUT_MONTH',
    monthOptions: [],
    scheduleDays: [
      { day: 'TUE', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
      { day: 'THU', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
    ],
  };
  const selectedDays = [
    'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
    'Thursday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
  ].join(' + ');

  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [{
      programId: 'program-1', batchId: 'program-1', fee: 860,
      selectedDays, sessionsPerWeek: 2, students: [{}],
    }] });
    assert.equal(result.lineItems[0].unitPrice, 860);
    assert.equal(result.subtotal, 860);
  }, { program });
});

test('two time slots on the same weekday count as two sessions and multiply price by two', async () => {
  const program = {
    _id: 'program-1', isActive: true, basePrice: 430, batchType: 'REGULAR_WITHOUT_MONTH',
    monthOptions: [],
    scheduleDays: [
      { day: 'SAT', startTime: '09:30', endTime: '11:00', groundAddress: 'CCA Ground' },
      { day: 'SAT', startTime: '15:00', endTime: '16:30', groundAddress: 'CCA Ground' },
    ],
  };
  const selectedDays = [
    'Saturday - 9:30 AM - 11:00 AM - CCA Ground',
    'Saturday - 3:00 PM - 4:30 PM - CCA Ground',
  ].join(' + ');

  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [{
      programId: 'program-1', batchId: 'program-1', fee: 860,
      selectedDays, sessionsPerWeek: 2, students: [{}],
    }] });
    assert.equal(result.lineItems[0].unitPrice, 860);
    assert.equal(result.subtotal, 860);
  }, { program });
});

test('pricing rejects selecting the exact same schedule slot more than once', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{
        programId: 'program-1', batchId: 'program-1', fee: 860,
        selectedDays: 'Saturday - 9:30 AM - 11:00 AM - CCA Ground + Saturday - 9:30 AM - 11:00 AM - CCA Ground',
        sessionsPerWeek: 2, students: [{}],
      }] }),
      error => error.code === 'INVALID_SCHEDULE'
    );
  }, { program: {
    _id: 'program-1', isActive: true, basePrice: 430, batchType: 'REGULAR_WITHOUT_MONTH',
    monthOptions: [],
    scheduleDays: [
      { day: 'SAT', startTime: '09:30', endTime: '11:00', groundAddress: 'CCA Ground' },
      { day: 'SAT', startTime: '15:00', endTime: '16:30', groundAddress: 'CCA Ground' },
    ],
  } });
});

test('regular programs without month options retain the one-day price', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [{
      programId: 'program-1', batchId: 'program-1', fee: 430,
      selectedDays: 'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
      sessionsPerWeek: 1, students: [{}],
    }] });
    assert.equal(result.lineItems[0].unitPrice, 430);
    assert.equal(result.subtotal, 430);
  }, { program: {
    _id: 'program-1', isActive: true, basePrice: 430, batchType: 'REGULAR_WITHOUT_MONTH',
    monthOptions: [],
    scheduleDays: [{ day: 'TUE', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' }],
  } });
});

test('regular programs without month options use the batch price displayed during registration', async () => {
  const selectedDays = [
    'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
    'Thursday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
  ].join(' + ');

  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [{
      programId: 'program-1', batchId: 'batch-1', fee: 860,
      selectedDays, sessionsPerWeek: 2, students: [{}],
    }] });
    assert.equal(result.lineItems[0].unitPrice, 860);
    assert.equal(result.subtotal, 860);
  }, {
    program: {
      _id: 'program-1', isActive: true, basePrice: 430, batchType: 'REGULAR_WITHOUT_MONTH',
      monthOptions: [],
      scheduleDays: [
        { day: 'TUE', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
        { day: 'THU', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
      ],
    },
    batch: { price: 430, pricePerSession: 500, monthOptions: [] },
  });
});

test('fixed-day and special-camp programs without month options multiply batch price by selected days', async () => {
  const selectedDays = [
    'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
    'Thursday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino',
  ].join(' + ');

  for (const batchType of ['FIXED_DAYS', 'SPECIAL_CAMP']) {
    await withPricingModels(async () => {
      const result = await computeCartTotal({ cartItems: [{
        programId: 'program-1', batchId: 'batch-1', fee: 860,
        selectedDays, sessionsPerWeek: 2, students: [{}],
      }] });
      assert.equal(result.lineItems[0].unitPrice, 860, `${batchType} unit price`);
      assert.equal(result.subtotal, 860, `${batchType} subtotal`);
    }, {
      program: {
        _id: 'program-1', isActive: true, basePrice: 430, batchType,
        monthOptions: [],
        scheduleDays: [
          { day: 'TUE', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
          { day: 'THU', startTime: '16:00', endTime: '17:30', groundAddress: '10800 Torre Avenue, Cupertino' },
        ],
      },
      batch: { price: 430, monthOptions: [] },
    });
  }
});

test('weekly programs keep pricing by selected weekly batches', async () => {
  await withPricingModels(async () => {
    const result = await computeCartTotal({ cartItems: [{
      programId: 'program-1', batchId: 'program-1', fee: 600,
      weeklyBatchIds: ['week-1', 'week-2'], students: [{}],
    }] });
    assert.equal(result.lineItems[0].unitPrice, 600);
    assert.equal(result.subtotal, 600);
  }, {
    program: {
      _id: 'program-1', isActive: true, basePrice: 300, batchType: 'WEEKLY',
      weeklyBatches: [{ _id: 'week-1' }, { _id: 'week-2' }],
    },
  });
});

test('cart pricing rejects a client-tampered fee', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({
        cartItems: [{
          programId: 'program-1', batchId: 'program-1', fee: 1,
          selectedDays: 'Sunday - 9:00 AM - 10:30 AM', sessionsPerWeek: 1,
          students: [{ firstName: 'One' }],
        }],
      }),
      error => error.code === 'PRICE_CHANGED' && error.status === 409
    );
  });
});
