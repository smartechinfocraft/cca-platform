// ============================================================
//  controllers/coachController.js
//  Admin-side coach management.
//
//  create(): on top of normal Coach creation, this also:
//    1. Auto-generates a unique username, coachUid, and password
//       (format: <coachname>@<coachUniqueId>)
//    2. Saves the (hashed) password on the Coach document
//    3. Emails the PLAIN username/password to the coach so they
//       can log in to the Coach Portal directly.
// ============================================================
const mongoose = require('mongoose');
const { generateCoachCredentials } = require('../utils/coachCredentials');
const { sendCoachWelcomeEmail } = require('../services/emailService');

// ─── GET /api/coaches ──────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const Coach = mongoose.model('Coach');
    const data = await Coach.find().populate('location', 'title city').sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coaches/:id ──────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const Coach = mongoose.model('Coach');
    const doc = await Coach.findById(req.params.id).populate('location', 'title city');
    if (!doc) return res.status(404).json({ success: false, message: 'Coach not found' });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /api/coaches ──────────────────────────────────────────
// Creates the coach AND auto-generates + emails their login credentials.
exports.create = async (req, res) => {
  try {
    const Coach = mongoose.model('Coach');
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'First name, last name and email are required' });
    }

    // 1. Generate unique username / coachUid / plain password
    const { username, coachUid, password } = await generateCoachCredentials(firstName, lastName);

    // 2. Build and save the coach (password gets hashed by the pre-save hook)
    const coach = new Coach({
      ...req.body,
      username,
      coachUid,
      password, // plain here; hashed automatically on save
      createdBy: req.user._id,
    });

    if (req.file) {
      coach.photoUrl = req.file.path.replace(/\\/g, '/');
    }

    await coach.save();

    // 3. Email the plain password to the coach (best-effort — don't fail the request if email fails)
    let emailSent = false;
    try {
      const loginUrl = process.env.COACH_FRONTEND_URL || 'http://localhost:3002/login';
      await sendCoachWelcomeEmail({
        to: coach.email,
        firstName: coach.firstName,
        lastName: coach.lastName,
        username,
        password, // plain text, only ever sent this once
        coachUid,
        loginUrl,
      });
      emailSent = true;
      // IMPORTANT: use updateOne (touches ONLY this one field at the DB
      // level) instead of coach.credentialsSentAt = ...; await coach.save().
      // A second full .save() on the same in-memory document re-runs every
      // pre-save hook, including the password-hashing one — and depending
      // on Mongoose's modified-path tracking at that point, this risks
      // hashing the ALREADY-HASHED password a second time, which would
      // permanently lock the coach out with the exact password they were
      // just shown. updateOne never touches the password field at all,
      // so this failure mode is structurally impossible.
      await Coach.updateOne({ _id: coach._id }, { $set: { credentialsSentAt: new Date() } });
    } catch (mailErr) {
      console.error('⚠️  Coach created but welcome email failed to send:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      data: coach,
      credentials: { username, coachUid, password }, // shown once to the admin in the UI too
      emailSent,
    });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ success: false, message: 'A coach with this email already exists.' });
    }
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── PUT /api/coaches/:id ──────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const Coach = mongoose.model('Coach');
    const doc = await Coach.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Coach not found' });

    // Never allow username/password/coachUid to be silently overwritten through
    // the generic update form — those are managed via dedicated actions only.
    const { username, password, coachUid, ...safeBody } = req.body;
    Object.assign(doc, safeBody);

    if (req.file) {
      doc.photoUrl = req.file.path.replace(/\\/g, '/');
    }

    await doc.save();
    res.json({ success: true, data: doc });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ success: false, message: 'A coach with this email already exists.' });
    }
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── DELETE /api/coaches/:id ────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const Coach = mongoose.model('Coach');
    const Batch = mongoose.model('Batch');

    // A coach assigned to one or more batches must be reassigned (or have
    // those batches updated to a different coach) before they can be
    // deleted — otherwise every one of those batches would silently end
    // up with a coach reference pointing at a document that no longer
    // exists, and the coach portal/attendance scan logic for that batch
    // would break with no clear error message to whoever hits it next.
    const batchCount = await Batch.countDocuments({ coach: req.params.id });
    if (batchCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete this coach — they are assigned to ${batchCount} batch(es). Reassign those batches to a different coach first.`,
      });
    }

    await Coach.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Coach deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── POST /api/coaches/:id/resend-credentials ───────────────────
// Generates a brand-new password for the coach (keeps username/coachUid)
// and re-sends the welcome email. Useful if the coach forgets their password.
exports.resendCredentials = async (req, res) => {
  try {
    const Coach = mongoose.model('Coach');
    const coach = await Coach.findById(req.params.id);
    if (!coach) return res.status(404).json({ success: false, message: 'Coach not found' });

    // Keep the same coachUid, regenerate password = name@coachUid (deterministic),
    // unless admin wants a fresh random one — here we keep it simple and reset
    // to the original formula so it's easy for the coach to remember/reset.
    const namePart = `${coach.firstName}${coach.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newPassword = `${namePart}@${coach.coachUid}`;
    coach.password = newPassword; // re-hashed by pre-save hook
    await coach.save();

    const loginUrl = process.env.COACH_FRONTEND_URL || 'http://localhost:3002/login';
    await sendCoachWelcomeEmail({
      to: coach.email,
      firstName: coach.firstName,
      lastName: coach.lastName,
      username: coach.username,
      password: newPassword,
      coachUid: coach.coachUid,
      loginUrl,
    });

    // Same fix as in create(): updateOne touches ONLY credentialsSentAt
    // at the DB level, never re-running the password pre-save hook on
    // an already-hashed value. See the long comment in exports.create
    // above for the full explanation of why a second .save() here is
    // risky.
    await Coach.updateOne({ _id: coach._id }, { $set: { credentialsSentAt: new Date() } });

    res.json({ success: true, message: 'Credentials regenerated and emailed to the coach.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};