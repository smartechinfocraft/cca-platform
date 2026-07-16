function splitParentName(parentName) {
  const parts = String(parentName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Guest',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePassword(password) {
  return typeof password === 'string' ? password.trim() : '';
}

function validateOptionalAccountPassword(password) {
  const normalized = normalizePassword(password);
  if (!normalized) return { password: '', error: null };
  if (normalized.length < 6) {
    return { password: normalized, error: 'Password must be at least 6 characters.' };
  }
  return { password: normalized, error: null };
}

function isPortalAccount(parent) {
  return Boolean(parent && parent.accountStatus === 'ACTIVE' && parent.password);
}

function deriveRegistrationMode({ authenticatedParentId, accountPassword }) {
  return authenticatedParentId || normalizePassword(accountPassword) ? 'REGISTERED' : 'GUEST';
}

module.exports = {
  splitParentName,
  normalizeEmail,
  normalizePassword,
  validateOptionalAccountPassword,
  isPortalAccount,
  deriveRegistrationMode,
};
