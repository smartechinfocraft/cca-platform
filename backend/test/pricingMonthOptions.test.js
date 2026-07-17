const test = require('node:test');
const assert = require('node:assert/strict');

const { isMonthOptionAvailable } = require('../src/utils/pricing');

test('month option is available by default for legacy records', () => {
  assert.equal(isMonthOptionAvailable({ label: 'August', startDate: '2026-08-01' }), true);
});

test('disabled month option is not available', () => {
  assert.equal(isMonthOptionAvailable({ label: 'August', isEnabled: false, startDate: '2026-08-01' }), false);
  assert.equal(isMonthOptionAvailable({ label: 'August', isEnabled: 'false', startDate: '2026-08-01' }), false);
});

test('month option availability ignores start month and only checks enabled flag', () => {
  assert.equal(isMonthOptionAvailable({ label: 'Future', startDate: '2099-08-01', isEnabled: true }), true);
  assert.equal(isMonthOptionAvailable({ label: 'Past', startDate: '2001-08-01', isEnabled: true }), true);
});
