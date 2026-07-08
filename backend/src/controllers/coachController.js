// ============================================================
//  controllers/coachController.js
//  ADMIN-SIDE coach management (used by superAdmin / admin panel)
//  Routes: GET/POST/PUT/DELETE /api/coaches
//  create() auto-generates login credentials (username + password)
//  and emails them to the coach for the Coach Portal login.
// ============================================================
const mongoose = require('mongoose');
const { generateCoachCredentials } = require('../utils/coachCredentials');
const { sendCoachWelcomeEmail } = require('../services/emailService');

const getModels = () => ({
  Coach: mongoose.model('Coach'),
});

// ── Helpers ──────────────────────────────────────────────────

// Sends the coach welcome email via Resend (backend/src/services/emailService.js).
// Never throws — returns true/false so create()/resendCredentials() can still
// succeed (and hand the credentials back to the admin) even if email delivery
// fails, e.g. missing RESEND_API_KEY.
async function sendCredentialsEmail({ to, firstName, lastName, username, coachUid, password }) {
  try {
    await sendCoachWelcomeEmail({
      to,
      firstName,
      lastName,
      username,
      password,
      coachUid,
      loginUrl: `${process.env.FRONTEND_URL || 'https://calcricket.org'}/login`,
    });
    return true;
  } catch (e) {
    console.warn('⚠️  sendCredentialsEmail: failed to send via emailService, logging instead:', e.message);
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

    const { username, coachUid, password: plainPassword } =
      await generateCoachCredentials(firstName, lastName);

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

    const emailSent = await sendCredentialsEmail({
      to: coach.email,
      firstName: coach.firstName,
      lastName: coach.lastName,
      username,
      coachUid,
      password: plainPassword,
    });

    const coachSafe = coach.toObject();
    delete coachSafe.password;

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Coach created and login credentials emailed'
        : 'Coach created, but the credentials email could not be sent — copy them from this screen instead',
      data: coachSafe,
      // Returned once, right after creation, so the admin panel can show the
      // one-time credentials modal (Coaches.jsx reads res.data.credentials).
      credentials: { username, coachUid, password: plainPassword },
      emailSent,
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

    // Reuse the shared generator so username/coachUid follow the same
    // firstname.lastname / NAME#### format everywhere. Only fill in
    // username/coachUid if this coach doesn't already have them.
    const generated = await generateCoachCredentials(coach.firstName, coach.lastName);
    const plainPassword = generated.password;
    coach.password = plainPassword; // pre-save hook re-hashes it
    if (!coach.username) coach.username = generated.username;
    if (!coach.coachUid) coach.coachUid = generated.coachUid;
    await coach.save();

    const emailSent = await sendCredentialsEmail({
      to: coach.email,
      firstName: coach.firstName,
      lastName: coach.lastName,
      username: coach.username,
      coachUid: coach.coachUid,
      password: plainPassword,
    });

    res.json({
      success: true,
      message: emailSent
        ? 'Login credentials resent to coach\'s email'
        : 'Could not email the coach — copy the credentials below instead',
      credentials: { username: coach.username, coachUid: coach.coachUid, password: plainPassword },
      emailSent,
    });
  } catch (e) {
    console.error('coach resendCredentials error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};
