const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HEADERS,
  isSheetSyncEligible,
  mapRegistrationToSheetRows,
  sanitizeSheetName,
  splitSchedules,
} = require('../src/services/registrationSheetMapper');

test('eligibility includes confirmed registrations and check awaiting payment only', () => {
  assert.equal(isSheetSyncEligible({ status: 'CONFIRMED', paymentMethod: 'STRIPE' }), true);
  assert.equal(isSheetSyncEligible({ status: 'AWAITING_PAYMENT', paymentMethod: 'CHECK' }), true);
  assert.equal(isSheetSyncEligible({ status: 'AWAITING_PAYMENT', paymentMethod: 'PAYPAL' }), false);
});

test('routes order items to sanitized category sheet names', () => {
  const registration = {
    _id: 'registration-id',
    status: 'CONFIRMED',
    paymentMethod: 'STRIPE',
    parentId: {},
    programId: { title: 'Fallback Program' },
    orderItems: [
      { programId: 'fall-program', programTitle: 'Fall Program', students: [{ firstName: 'Fall' }] },
      { programId: 'winter-program', programTitle: 'Winter Program', students: [{ firstName: 'Winter' }] },
    ],
  };
  const catalog = new Map([
    ['fall-program', { category: { title: 'Fall 2026' } }],
    ['winter-program', { category: { title: 'Winter/2027' } }],
  ]);
  const rows = mapRegistrationToSheetRows(registration, new Date(), catalog);
  assert.deepEqual(rows.map(row => row.sheetName), ['Fall 2026', 'Winter-2027']);
  assert.equal(sanitizeSheetName('Category: A/B?'), 'Category- A-B-');
});

test('multiple selected schedules are exported as separate bullet lines', () => {
  const schedules = splitSchedules(
    'Wednesday - 4:30 PM - 6:00 PM - Cupertino + Saturday - 9:00 AM - 10:30 AM - Cupertino'
  );
  assert.deepEqual(schedules, [
    'Wednesday - 4:30 PM - 6:00 PM - Cupertino',
    'Saturday - 9:00 AM - 10:30 AM - Cupertino',
  ]);

  const registration = {
    _id: 'registration-id',
    registrationNumber: 'CCA-2026-0001',
    createdAt: new Date('2026-08-16T00:00:00Z'),
    updatedAt: new Date('2026-08-16T01:00:00Z'),
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'PENDING',
    paymentMethod: 'CHECK',
    totalAmount: 500,
    parentId: { firstName: 'Parent', lastName: 'One', email: 'parent@example.com' },
    programId: { title: 'U10', location: { title: 'Cupertino' } },
    orderItems: [{
      programTitle: 'U10',
      selectedDays: schedules.join(' + '),
      feePerStudent: 250,
      students: [
        { firstName: 'Student', lastName: 'One' },
        { firstName: 'Student', lastName: 'Two' },
      ],
    }],
  };

  const rows = mapRegistrationToSheetRows(registration, new Date('2026-08-16T02:00:00Z'));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].values.length, HEADERS.length);
  assert.equal(rows[0].key, 'registration-id:0:0');
  assert.equal(rows[0].values[20], `• ${schedules[0]}\n• ${schedules[1]}`);
});
