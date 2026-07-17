const test = require('node:test');
const assert = require('node:assert/strict');

const { isMonthOptionAvailable, isSameCalendarMonth } = require('../src/utils/pricing');

test('month option is available by default for legacy records', () => {
  assert.equal(isMonthOptionAvailable({ label: 'August', startDate: '2026-08-01' }), true);
});

test('disabled month option is not available', () => {
  assert.equal(isMonthOptionAvailable({ label: 'August', isEnabled: false, startDate: '2026-08-01' }), false);
  assert.equal(isMonthOptionAvailable({ label: 'August', isEnabled: 'false', startDate: '2026-08-01' }), false);
});

test('start-month-only option is available only during matching calendar month and year', () => {
  const now = new Date('2026-07-17T12:00:00Z');

  assert.equal(isSameCalendarMonth('2026-07-01', now), true);
  assert.equal(isMonthOptionAvailable({ label: 'July', startDate: '2026-07-01', showInStartMonthOnly: true }, now), true);
  assert.equal(isMonthOptionAvailable({ label: 'July', startDate: '2026-07-01', showInStartMonthOnly: 'true' }, now), true);
  assert.equal(isMonthOptionAvailable({ label: 'August', startDate: '2026-08-01', showInStartMonthOnly: true }, now), false);
  assert.equal(isMonthOptionAvailable({ label: 'Old July', startDate: '2025-07-01', showInStartMonthOnly: true }, now), false);
});
