// ============================================================
//  controllers/coachAuthController.js
//  Login endpoint for the Coach Portal.
//  Coaches log in with the username + password that were
//  auto-generated when admin created their profile (and which
//  were emailed to them).
// ============================================================
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const signCoachToken = (coachId) =>
  jwt.sign({ id: coachId, type: 'coach' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

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

    const token = signCoachToken(coach._id);

    res.json({
      success: true,
      token,
      coach: {
        id: coach._id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        email: coach.email,
        username: coach.username,
        coachUid: coach.coachUid,
        photoUrl: coach.photoUrl,
      },
    });
  } catch (err) {
    console.error('Coach login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
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
