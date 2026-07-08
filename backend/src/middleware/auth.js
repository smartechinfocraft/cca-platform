// ============================================================
//  middleware/auth.js — JWT verification & role-based guards
// ============================================================
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokenService');

// ─── protect ─────────────────────────────────────────────────────────────────
// Verifies the short-lived Access Token Bearer header on every protected
// route. Attaches req.user so downstream controllers know who's logged in.
const protect = async (req, res, next) => {
  let token;

  // Access token is sent as: "Authorization: Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  try {
    // verifyAccessToken throws if the token is expired, tampered, or the
    // wrong type (e.g. someone trying to use a refresh token here)
    const decoded = verifyAccessToken(token);

    if (decoded.type !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    // Fetch user from DB so we get live role/status (not stale token data)
    // +password is excluded by default (select:false in schema)
    req.user = await User.findById(decoded.id);

    if (!req.user || req.user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Account inactive or not found' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// ─── superAdminOnly ───────────────────────────────────────────────────────────
// Use AFTER protect(). Blocks normal admins from super-admin routes.
const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied — Super Admin only',
  });
};

// ─── adminOrSuperAdmin ────────────────────────────────────────────────────────
// Both ADMIN and SUPER_ADMIN can access
const adminOrSuperAdmin = (req, res, next) => {
  if (req.user && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied' });
};

module.exports = { protect, superAdminOnly, adminOrSuperAdmin };
