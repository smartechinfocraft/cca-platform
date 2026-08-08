const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'receipt-token-test-secret';

const {
  signReceiptToken,
  verifyReceiptToken,
  verifyAccessToken,
} = require('../src/utils/tokenService');

test('receipt tokens authorize only their canonical registration id', () => {
  const token = signReceiptToken({ id: 'registration-123' });
  assert.equal(verifyReceiptToken(token).id, 'registration-123');
});

test('a receipt token cannot be used as an access token', () => {
  const token = signReceiptToken({ id: 'registration-123' });
  assert.throws(() => verifyAccessToken(token));
});
