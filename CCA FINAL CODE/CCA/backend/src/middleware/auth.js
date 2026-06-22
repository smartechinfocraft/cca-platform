// ============================================================
//  middleware/auth.js — JWT verification & role-based guards
// ============================================================
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ─── protect ─────────────────────────────────────────────────────────────────
// Verifies the Bearer token on every protected route.
// Attaches req.user so downstream controllers know who's logged in.
const protect = async (req, res, next) => {
  let token;

  // JWT is sent as: "Authorization: Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  try {
    // jwt.verify throws if token is expired or tampered
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
