const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStripeIntent } = require('../src/utils/stripeRegistrationValidation');

const registration = { _id: 'registration-1', totalAmount: 125.5 };

test('accepts a successful Stripe intent bound to the pending registration', () => {
  const result = validateStripeIntent(registration, {
    status: 'succeeded',
    amount_received: 12550,
    currency: 'usd',
    metadata: { registrationId: 'registration-1' },
  });
  assert.equal(result.valid, true);
});

test('rejects a Stripe intent for a different registration', () => {
  const result = validateStripeIntent(registration, {
    status: 'succeeded',
    amount_received: 12550,
    currency: 'usd',
    metadata: { registrationId: 'registration-2' },
  });
  assert.equal(result.valid, false);
  assert.equal(result.metadataMatches, false);
});

test('rejects an underpaid or unfinished Stripe intent', () => {
  assert.equal(validateStripeIntent(registration, {
    status: 'succeeded',
    amount_received: 100,
    currency: 'usd',
    metadata: { registrationId: 'registration-1' },
  }).valid, false);
  assert.equal(validateStripeIntent(registration, {
    status: 'processing',
    amount_received: 12550,
    currency: 'usd',
    metadata: { registrationId: 'registration-1' },
  }).valid, false);
});
