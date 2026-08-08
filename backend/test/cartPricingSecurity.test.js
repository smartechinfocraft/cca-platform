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
    if (name === 'Program') return { findOne: () => queryResult(overrides.program || { _id: 'program-1', isActive: true, basePrice: 430, monthOptions: [] }) };
    if (name === 'Batch') return { findOne: () => queryResult(overrides.batch ?? null) };
    if (name === 'Coupon') return {};
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

test('cart pricing rejects a cart line without its own billable students', async () => {
  await withPricingModels(async () => {
    await assert.rejects(
      computeCartTotal({ cartItems: [{ programId: 'program-1', batchId: 'program-1', fee: 430, students: [] }] }),
      error => error.code === 'CART_STUDENTS_REQUIRED'
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
