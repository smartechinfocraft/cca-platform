const test = require('node:test');
const assert = require('node:assert/strict');

const {
  splitParentName,
  normalizeEmail,
  validateOptionalAccountPassword,
  isPortalAccount,
  deriveRegistrationMode,
} = require('../src/utils/parentAccount');

test('splitParentName keeps a first name and joins the remaining name parts', () => {
  assert.deepEqual(splitParentName('  Priya Anika Shah  '), {
    firstName: 'Priya',
    lastName: 'Anika Shah',
  });
});

test('splitParentName falls back for blank guest names', () => {
  assert.deepEqual(splitParentName(''), {
    firstName: 'Guest',
    lastName: 'User',
  });
});

test('normalizeEmail trims and lowercases email addresses', () => {
  assert.equal(normalizeEmail('  Parent@Example.COM '), 'parent@example.com');
});

test('validateOptionalAccountPassword allows blank password for guest checkout', () => {
  assert.deepEqual(validateOptionalAccountPassword(''), {
    password: '',
    error: null,
  });
});

test('validateOptionalAccountPassword rejects short account passwords', () => {
  assert.deepEqual(validateOptionalAccountPassword('abc'), {
    password: 'abc',
    error: 'Password must be at least 6 characters.',
  });
});

test('validateOptionalAccountPassword accepts valid account passwords', () => {
  assert.deepEqual(validateOptionalAccountPassword(' cricket123 '), {
    password: 'cricket123',
    error: null,
  });
});

test('isPortalAccount only treats active parents with a password as login accounts', () => {
  assert.equal(isPortalAccount(null), false);
  assert.equal(isPortalAccount({ accountStatus: 'GUEST', password: 'hash' }), false);
  assert.equal(isPortalAccount({ accountStatus: 'ACTIVE' }), false);
  assert.equal(isPortalAccount({ accountStatus: 'ACTIVE', password: 'hash' }), true);
});

test('deriveRegistrationMode tracks guest versus registered checkout', () => {
  assert.equal(deriveRegistrationMode({ authenticatedParentId: null, accountPassword: '' }), 'GUEST');
  assert.equal(deriveRegistrationMode({ authenticatedParentId: null, accountPassword: 'secret1' }), 'REGISTERED');
  assert.equal(deriveRegistrationMode({ authenticatedParentId: 'parent-id', accountPassword: '' }), 'REGISTERED');
});
