// ============================================================
//  middleware/coachAuth.js
//  Verifies the JWT issued at coach login and loads req.coach.
//  Kept separate from middleware/auth.js (admin Users) so a
//  coach token can never be used to hit admin-only routes and
//  vice-versa — the JWT payload includes `type: 'coach'`.
// ============================================================
const mongoose = require('mongoose');
const { verifyAccessToken } = require('../utils/tokenService');

const coachAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyAccessToken(token);

    if (decoded.type !== 'coach') {
      return res.status(403).json({ success: false, message: 'Invalid token type' });
    }

    const Coach = mongoose.model('Coach');
    const coach = await Coach.findById(decoded.id);

    if (!coach || coach.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Coach account not found or inactive' });
    }

    req.coach = coach;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = coachAuth;
