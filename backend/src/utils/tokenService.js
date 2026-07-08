// ============================================================
//  utils/tokenService.js
//  Shared helpers for the Access-Token / Refresh-Token auth flow
//  used by all three portals (Admin, Coach, Parent).
//
//  Design:
//   • Access token  — short-lived (15m default), returned in the
//     JSON response body only. The frontend keeps it in memory
//     (never localStorage) and sends it as "Authorization: Bearer".
//   • Refresh token — long-lived (7d default), sent ONLY as an
//     HttpOnly + Secure + SameSite cookie, scoped to the specific
//     refresh/logout route path for that portal. It is never
//     readable by JavaScript (mitigates XSS token theft) and a
//     hash of it is stored server-side so it can be revoked
//     (mitigates replay after logout / theft).
// ============================================================
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

// Fallbacks keep this backward-compatible with deployments that only
// have JWT_SECRET set — no .env changes are required for this to work,
// though setting the two secrets below separately is recommended.
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_refresh`;

const ACCESS_EXPIRES_IN  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Used to set the cookie's Max-Age / Expires in ms (kept in sync with
// REFRESH_EXPIRES_IN above; only 'Nd' / 'Nh' / 'Nm' formats are parsed,
// falls back to 7 days).
const parseDurationMs = (str, fallbackMs) => {
  const m = /^(\d+)\s*(d|h|m|s)$/.exec(String(str).trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * mult[unit];
};
const REFRESH_EXPIRES_MS = parseDurationMs(REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);

// ─── Signing / verifying ───────────────────────────────────────────────────
const signAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

const signRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

// ─── Refresh-token hashing ──────────────────────────────────────────────────
// We never store the raw refresh token — only a SHA-256 hash of it — so a
// database leak alone can't be used to forge sessions.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ─── Cookie options ─────────────────────────────────────────────────────────
// path: scopes the cookie so the browser only ever sends it to that
// portal's own refresh/logout endpoints (never to unrelated API routes).
const refreshCookieOptions = (path) => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,                       // HTTPS only in production
    sameSite: isProd ? 'none' : 'lax',    // 'none' needed for cross-site prod domains (e.g. onrender.com <-> calcricket.org); 'lax' is fine for same-site localhost dev
    path,
    maxAge: REFRESH_EXPIRES_MS,
  };
};

// Options used when clearing a cookie must exactly mirror the ones used to
// set it (minus maxAge/expires), otherwise the browser won't remove it.
const clearCookieOptions = (path) => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path,
  };
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
  clearCookieOptions,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
};
