// ============================================================
//  controllers/authController.js — Login, get current user
//  NOTE: forgot-password is intentionally removed for Admin.
//        Only Coach (/api/coach-auth/forgot-password) and
//        Parent (/api/public/auth/forgot-password) support it.
// ============================================================
const User = require('../models/User');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
  clearCookieOptions,
} = require('../utils/tokenService');

// Cookie carrying the refresh token is scoped to /api/auth/* only, so it's
// never sent to unrelated routes (batches, registrations, etc.)
const REFRESH_COOKIE_NAME = 'cca_admin_rt';
const REFRESH_COOKIE_PATH = '/api/auth';

// Helper: sign an access token for a given admin user
const generateAccessToken = (userId) => signAccessToken({ id: userId, type: 'admin' });

// Helper: build the safe (no password) user object returned to the client
const toSafeUser = (user) => ({
  id:        user._id,
  username:  user.username,
  email:     user.email,
  firstName: user.firstName,
  lastName:  user.lastName,
  role:      user.role,       // SUPER_ADMIN or ADMIN — frontend uses this for UI
});

// Issues a fresh access + refresh token pair for a user, persists the
// refresh token's hash (rotate-on-use), and sets the HttpOnly cookie.
const issueTokens = async (res, user) => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = signRefreshToken({ id: user._id, type: 'admin' });

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(REFRESH_COOKIE_PATH));
  return accessToken;
};

// Escapes regex special characters in user input before it's used inside a
// RegExp — prevents a crafted "username" from being interpreted as regex
// syntax (ReDoS / unintended matches).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Normalize the identifier: trim stray whitespace (easy to introduce via
    // copy-paste) and match case-insensitively. This matters because
    // username/email are only auto-lowercased by Mongoose's `lowercase: true`
    // when a document is saved THROUGH the model (register/seed/createAdmin).
    // A document inserted directly in MongoDB Compass/Atlas UI, or imported
    // from a JSON dump, bypasses that transform and can keep its original
    // casing — an exact-match query would then never find a perfectly valid,
    // active account and login would incorrectly report "Invalid credentials".
    const identifier = username.trim();
    const identifierRegex = new RegExp(`^${escapeRegex(identifier)}$`, 'i');

    // We need +password because it's select:false in the schema
    const user = await User.findOne({
      $or: [{ username: identifierRegex }, { email: identifierRegex }],
    }).select('+password');

    if (!user) {
      console.warn(`[auth/login] No admin user matched identifier "${identifier}"`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status && user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    // bcrypt compare plain text against stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.warn(`[auth/login] Password mismatch for user "${user.username}"`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login time
    user.lastLogin = new Date();

    const accessToken = await issueTokens(res, user);

    // Return user info (no password!) + short-lived access token.
    // The refresh token was set as an HttpOnly cookie above — it is
    // never present in this JSON body.
    res.json({
      success: true,
      token: accessToken,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────
// Reads the HttpOnly refresh-token cookie, verifies it against the hash
// stored on the user, and — if valid — rotates it (issues a brand new
// access + refresh token pair). This is what lets the frontend silently
// restore a session on page load without ever persisting a token in
// localStorage.
exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
      return res.status(401).json({ success: false, message: 'Refresh token invalid or expired' });
    }

    if (decoded.type !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokenHash');
    if (!user || user.status !== 'ACTIVE' || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
      // Hash mismatch = token was already rotated/used, or session was
      // revoked (logout) — treat as a stolen/replayed token and deny.
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
      return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
    }

    const accessToken = await issueTokens(res, user);

    res.json({ success: true, token: accessToken, user: toSafeUser(user) });
  } catch (err) {
    console.error('Admin refresh error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
// Clears the refresh cookie AND revokes it server-side so it can't be
// replayed even if it was already captured.
exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        if (decoded?.id) {
          await User.findByIdAndUpdate(decoded.id, { refreshTokenHash: null });
        }
      } catch {
        // Token already invalid/expired — nothing to revoke, just clear the cookie
      }
    }
    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Admin logout error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns the currently logged-in user's profile
exports.getMe = async (req, res) => {
  // req.user is set by the protect middleware
  res.json({ success: true, user: req.user });
};

// ─── GET /api/auth/admins — Super Admin only ──────────────────────────────────
// List all admin users (for super admin to manage)
exports.listAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/auth/admins — Super Admin only ─────────────────────────────────
// Create a new normal admin
exports.createAdmin = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    // Super admin can only create ADMIN (not another SUPER_ADMIN)
    if (role === 'SUPER_ADMIN') {
  return res.status(403).json({ success: false, message: 'Cannot create a Super Admin account via this endpoint.' });
}
const safeRole = role || 'ADMIN';

    const user = await User.create({ username, email, password, firstName, lastName, role: safeRole });

    res.status(201).json({
      success: true,
      data: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    // Handle duplicate key error (username/email already exists)
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/auth/admins/:id/status — Super Admin only ────────────────────
// Activate or deactivate an admin account
exports.toggleAdminStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin not found' });

    // Prevent deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    user.status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await user.save();

    res.json({ success: true, data: { status: user.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
