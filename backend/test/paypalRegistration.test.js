const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePayPalCapture } = require('../src/utils/paypalRegistrationValidation');

const registration = { _id: 'registration-1', totalAmount: 85.25 };

test('accepts a completed PayPal capture bound to the registration', () => {
  assert.equal(validatePayPalCapture(registration, {
    status: 'COMPLETED',
    id: 'capture-1',
    custom_id: 'registration-1',
    amount: { value: '85.25', currency_code: 'USD' },
  }).valid, true);
});

test('rejects mismatched, underpaid, or incomplete PayPal captures', () => {
  assert.equal(validatePayPalCapture(registration, {
    status: 'COMPLETED',
    custom_id: 'registration-2',
    amount: { value: '85.25', currency_code: 'USD' },
  }).valid, false);
  assert.equal(validatePayPalCapture(registration, {
    status: 'COMPLETED',
    custom_id: 'registration-1',
    amount: { value: '10.00', currency_code: 'USD' },
  }).valid, false);
  assert.equal(validatePayPalCapture(registration, {
    status: 'PENDING',
    custom_id: 'registration-1',
    amount: { value: '85.25', currency_code: 'USD' },
  }).valid, false);
});
