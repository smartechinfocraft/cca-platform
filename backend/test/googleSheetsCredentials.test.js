const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { normalizePrivateKey } = require('../src/services/googleSheetsService');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();

test('normalizes a Render private key containing escaped newlines', () => {
  assert.equal(normalizePrivateKey(pem.replace(/\n/g, '\\n')), pem);
});

test('normalizes quoted and base64 private keys', () => {
  assert.equal(normalizePrivateKey(JSON.stringify(pem)), pem);
  assert.equal(normalizePrivateKey(Buffer.from(pem).toString('base64')), pem);
});

test('rejects malformed private keys with a configuration-specific message', () => {
  assert.throws(() => normalizePrivateKey('not-a-private-key'), /not a valid PEM private key/);
});
