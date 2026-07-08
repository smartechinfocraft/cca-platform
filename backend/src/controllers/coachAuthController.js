// ============================================================
//  controllers/coachAuthController.js
//  Login endpoint for the Coach Portal.
//  Coaches log in with the username + password that were
//  auto-generated when admin created their profile (and which
//  were emailed to them).
// ============================================================
const mongoose = require('mongoose');
const { sendForgotPasswordEmail } = require('../services/emailService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
  clearCookieOptions,
} = require('../utils/tokenService');

const REFRESH_COOKIE_NAME = 'cca_coach_rt';
const REFRESH_COOKIE_PATH = '/api/coach-auth';

const signCoachAccessToken = (coachId) => signAccessToken({ id: coachId, type: 'coach' });

const toSafeCoach = (coach) => ({
  id: coach._id,
  firstName: coach.firstName,
  lastName: coach.lastName,
  email: coach.email,
  username: coach.username,
  coachUid: coach.coachUid,
  photoUrl: coach.photoUrl,
});

// Issues a fresh access + refresh token pair, persists the refresh token's
// hash (rotate-on-use), and sets the HttpOnly cookie.
const issueCoachTokens = async (res, coach) => {
  const accessToken  = signCoachAccessToken(coach._id);
  const refreshToken = signRefreshToken({ id: coach._id, type: 'coach' });

  coach.refreshTokenHash = hashToken(refreshToken);
  await coach.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(REFRESH_COOKIE_PATH));
  return accessToken;
};

// ─── POST /api/coach-auth/login ───────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const Coach = mongoose.model('Coach');

    // Allow login with either the username or the coachUid, mirroring
    // how flexible admin login is — coaches may type either one.
    const coach = await Coach.findOne({
      $or: [{ username: username.toLowerCase().trim() }, { coachUid: username.trim().toUpperCase() }],
    }).select('+password');

    if (!coach) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    if (coach.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact the academy admin.' });
    }

    const isMatch = await coach.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const accessToken = await issueCoachTokens(res, coach);

    res.json({
      success: true,
      token: accessToken,
      coach: toSafeCoach(coach),
    });
  } catch (err) {
    console.error('Coach login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// ─── POST /api/coach-auth/refresh ──────────────────────────────
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

    if (decoded.type !== 'coach') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const Coach = mongoose.model('Coach');
    const coach = await Coach.findById(decoded.id).select('+refreshTokenHash');

    if (!coach || coach.status !== 'ACTIVE' || !coach.refreshTokenHash || coach.refreshTokenHash !== hashToken(token)) {
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
      return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
    }

    const accessToken = await issueCoachTokens(res, coach);

    res.json({ success: true, token: accessToken, coach: toSafeCoach(coach) });
  } catch (err) {
    console.error('Coach refresh error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/coach-auth/logout ───────────────────────────────
exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        if (decoded?.id) {
          const Coach = mongoose.model('Coach');
          await Coach.findByIdAndUpdate(decoded.id, { refreshTokenHash: null });
        }
      } catch {
        // Already invalid/expired — nothing to revoke
      }
    }
    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Coach logout error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/coach-auth/forgot-password ─────────────────────
// Finds a coach by their registered email and sends them a new temporary password.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const Coach = mongoose.model('Coach');
    const coach = await Coach.findOne({ email: email.toLowerCase().trim() }).select('+password');

    // Always respond with same message to prevent email enumeration
    if (!coach) {
      return res.json({ success: true, message: 'If that email is registered, you will receive a password reset email shortly.' });
    }

    if (coach.status !== 'ACTIVE') {
      return res.json({ success: true, message: 'If that email is registered, you will receive a password reset email shortly.' });
    }

    // Generate a new temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

    // Save new hashed password (pre-save hook hashes it)
    coach.password = tempPassword;
    await coach.save();

    await sendForgotPasswordEmail({
      to: coach.email,
      firstName: coach.firstName,
      tempPassword,
      role: 'Coach',
      loginUrl: `${process.env.FRONTEND_URL || 'https://calcricket.org'}/login`,
    });

    res.json({ success: true, message: 'If that email is registered, you will receive a password reset email shortly.' });
  } catch (err) {
    console.error('Coach forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/coach-auth/me ────────────────────────────────────
// Returns the currently logged-in coach's own profile (req.coach set by coachAuth middleware)
exports.me = async (req, res) => {
  res.json({
    success: true,
    coach: {
      id: req.coach._id,
      firstName: req.coach.firstName,
      lastName: req.coach.lastName,
      email: req.coach.email,
      phone: req.coach.phone,
      bio: req.coach.bio,
      experience: req.coach.experience,
      speciality: req.coach.speciality,
      photoUrl: req.coach.photoUrl,
      username: req.coach.username,
      coachUid: req.coach.coachUid,
      location: req.coach.location,
    },
  });
};
