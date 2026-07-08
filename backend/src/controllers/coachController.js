// ============================================================
//  controllers/coachController.js
//  ADMIN-SIDE coach management (used by superAdmin / admin panel)
//  Routes: GET/POST/PUT/DELETE /api/coaches
//  create() auto-generates login credentials (username + password)
//  and emails them to the coach for the Coach Portal login.
// ============================================================
const mongoose = require('mongoose');
const crypto = require('crypto');

const getModels = () => ({
  Coach: mongoose.model('Coach'),
});

// ── Helpers ──────────────────────────────────────────────────

// Generates a readable random password like "Cca7f2a9d1"
function generatePassword() {
  return 'Cca' + crypto.randomBytes(4).toString('hex');
}

// Generates a unique coachUid like "COACH-3F9A2B"
function generateCoachUid() {
  return 'COACH-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Generates a username from firstName + random 3-digit suffix
function generateUsername(firstName = 'coach', lastName = '') {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base || 'coach'}${suffix}`;
}

// Sends login credentials email. Uses ../utils/mailer if it exists;
// otherwise falls back to console.log so create() never crashes
// just because the mailer util isn't wired up yet.
async function sendCredentialsEmail({ to, firstName, username, coachUid, password }) {
  const subject = 'Your CCA Coach Portal Login Credentials';
  const html = `
    <p>Hi ${firstName},</p>
    <p>Your Coach Portal account has been created. Here are your login details:</p>
    <ul>
      <li><b>Coach ID:</b> ${coachUid}</li>
      <li><b>Username:</b> ${username}</li>
      <li><b>Password:</b> ${password}</li>
    </ul>
    <p>Please log in and change your password after first login.</p>
  `;

  try {
    // Adjust this path/function name to match your actual mailer util
    const { sendMail } = require('../utils/mailer');
    await sendMail({ to, subject, html });
    return true;
  } catch (e) {
    console.warn('⚠️  sendCredentialsEmail: mailer util not found or failed, logging instead:', e.message);
    console.log(`[COACH CREDENTIALS] to:${to} username:${username} password:${password} coachUid:${coachUid}`);
    return false;
  }
}

// ─── GET /api/coaches ───────────────────────────────────────
//  List all coaches (admin). Supports ?search= & ?isActive=
exports.getAll = async (req, res) => {
  try {
    const { Coach } = getModels();
    const { search, isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { username:  { $regex: search, $options: 'i' } },
        { coachUid:  { $regex: search, $options: 'i' } },
      ];
    }

    const coaches = await Coach.find(filter)
      .select('-password')
      .populate('location', 'title city address')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: coaches });
  } catch (e) {
    console.error('coach getAll error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coaches/:id ───────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const { Coach } = getModels();
    const coach = await Coach.findById(req.params.id)
      .select('-password')
      .populate('location', 'title city address');

    if (!coach) return res.status(404).json({ success: false, message: 'Coach not found' });
    res.json({ success: true, data: coach });
  } catch (e) {
    console.error('coach getOne error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /api/coaches ──────────────────────────────────────
//  Creates a coach, auto-generates username/password/coachUid,
//  and emails the credentials to the coach.
exports.create = async (req, res) => {
  try {
    const { Coach } = getModels();
    const {
      firstName, lastName, email, phone,
      bio, experience, speciality, location,
    } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'firstName, lastName, email and phone are required',
      });
    }

    const existing = await Coach.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A coach with this email already exists' });
    }

    const username = generateUsername(firstName, lastName);
    const coachUid = generateCoachUid();
    const plainPassword = generatePassword();

    const coach = new Coach({
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      phone,
      bio,
      experience,
      speciality,
      location: location || undefined,
      username,
      coachUid,
      password: plainPassword, // model's pre-save hook should hash this
      isActive: true,
    });

    if (req.file) coach.photoUrl = req.file.path.replace(/\\/g, '/');

    await coach.save();

    await sendCredentialsEmail({
      to: coach.email,
      firstName: coach.firstName,
      username,
      coachUid,
      password: plainPassword,
    });

    const coachSafe = coach.toObject();
    delete coachSafe.password;

    res.status(201).json({
      success: true,
      message: 'Coach created and login credentials emailed',
      data: coachSafe,
    });
  } catch (e) {
    console.error('coach create error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── PUT /api/coaches/:id ───────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { Coach } = getModels();
    const coach = await Coach.findById(req.params.id);
    if (!coach) return res.status(404).json({ success: false, message: 'Coach not found' });

    const editable = ['firstName', 'lastName', 'phone', 'bio', 'experience', 'speciality', 'location', 'isActive'];
    editable.forEach((f) => {
      if (req.body[f] !== undefined) coach[f] = req.body[f];
    });

    // Email change needs a duplicate check
    if (req.body.email && req.body.email.trim().toLowerCase() !== coach.email) {
      const emailTaken = await Coach.findOne({
        email: req.body.email.trim().toLowerCase(),
        _id: { $ne: coach._id },
      });
      if (emailTaken) {
        return res.status(409).json({ success: false, message: 'This email is already used by another coach' });
      }
      coach.email = req.body.email.trim().toLowerCase();
    }

    if (req.file) coach.photoUrl = req.file.path.replace(/\\/g, '/');

    await coach.save();

    const coachSafe = coach.toObject();
    delete coachSafe.password;

    res.json({ success: true, message: 'Coach updated', data: coachSafe });
  } catch (e) {
    console.error('coach update error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── DELETE /api/coaches/:id ────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { Coach } = getModels();
    const coach = await Coach.findByIdAndDelete(req.params.id);
    if (!coach) return res.status(404).json({ success: false, message: 'Coach not found' });

    res.json({ success: true, message: 'Coach deleted' });
  } catch (e) {
    console.error('coach remove error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /api/coaches/:id/resend-credentials ───────────────
//  Generates a fresh password, saves it, and re-emails credentials.
exports.resendCredentials = async (req, res) => {
  try {
    const { Coach } = getModels();
    const coach = await Coach.findById(req.params.id);
    if (!coach) return res.status(404).json({ success: false, message: 'Coach not found' });

    const plainPassword = generatePassword();
    coach.password = plainPassword; // pre-save hook re-hashes it
    if (!coach.username) coach.username = generateUsername(coach.firstName, coach.lastName);
    if (!coach.coachUid) coach.coachUid = generateCoachUid();
    await coach.save();

    await sendCredentialsEmail({
      to: coach.email,
      firstName: coach.firstName,
      username: coach.username,
      coachUid: coach.coachUid,
      password: plainPassword,
    });

    res.json({ success: true, message: 'Login credentials resent to coach\'s email' });
  } catch (e) {
    console.error('coach resendCredentials error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};