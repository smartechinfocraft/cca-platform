// ============================================================
//  routes/index.js — Mounts all route groups
//  Includes /api/public/* endpoints for the CCA Home Frontend
// ============================================================
const express = require('express');
const router  = express.Router();

// Public registration (from Home Frontend)
const publicRegistrationRouter = require('./public_registration');
router.use('/public', publicRegistrationRouter);

// Import all controllers
const authCtrl    = require('../controllers/authController');
const dashCtrl    = require('../controllers/dashboardController');
const progCtrl    = require('../controllers/programController');
const batchCtrl   = require('../controllers/batchController');
const regCtrl     = require('../controllers/registrationController');
const reportCtrl  = require('../controllers/reportController');
const coachCtrl       = require('../controllers/coachController');
const coachAuthCtrl   = require('../controllers/coachAuthController');
const coachPortalCtrl = require('../controllers/coachPortalController');

// Import auth middleware
const { protect, superAdminOnly, adminOrSuperAdmin } = require('../middleware/auth');
const coachAuth = require('../middleware/coachAuth');

// ISSUE 4, 5, 6, 7: File upload middleware (multer)
const { uploadCoverImage, uploadGallery, uploadMediaWithPdf, fileUrl } = require('../middleware/upload');

// Generic CRUD helpers for models that don't need complex logic
const mongoose = require('mongoose');
const { startOfTodayCalifornia, startOfDayCalifornia } = require('../utils/californiaTime');
const { computeRegistrationTotal } = require('../utils/pricing');

const makeCRUD = (modelName) => ({
  getAll: async (req, res) => {
    try {
      const data = await mongoose.model(modelName).find().sort({ createdAt: -1 });
      res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },
  getOne: async (req, res) => {
    try {
      const doc = await mongoose.model(modelName).findById(req.params.id);
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: doc });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },
  // Use new Model().save() so pre-save hooks (slug auto-generation) always fire
  create: async (req, res) => {
    try {
      const Model = mongoose.model(modelName);
      const doc   = new Model({ ...req.body, createdBy: req.user._id });
      await doc.save();
      res.status(201).json({ success: true, data: doc });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ success: false, message: 'A record with this title already exists.' });
      }
      res.status(500).json({ success: false, message: e.message });
    }
  },
  // Use findById + save so pre-save hooks fire on update too
  update: async (req, res) => {
    try {
      const doc = await mongoose.model(modelName).findById(req.params.id);
      if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
      Object.assign(doc, req.body);
      await doc.save();
      res.json({ success: true, data: doc });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ success: false, message: 'A record with this title already exists.' });
      }
      res.status(500).json({ success: false, message: e.message });
    }
  },
  remove: async (req, res) => {
    try {
      // Category and Location are referenced by Program via real ObjectId
      // refs (not copied as plain strings), so deleting one out from under
      // an existing Program would leave that Program's category/location
      // pointing at nothing. AgeGroup/Level/Coupon are stored on Program/
      // Registration as plain label strings, not references, so deleting
      // those documents doesn't orphan anything and needs no check here.
      if (modelName === 'Category' || modelName === 'Location') {
        const Program = mongoose.model('Program');
        const field = modelName === 'Category' ? 'category' : 'location';
        const count = await Program.countDocuments({ [field]: req.params.id });
        if (count > 0) {
          return res.status(409).json({
            success: false,
            message: `Cannot delete — ${count} program(s) still use this ${modelName.toLowerCase()}. Update or remove those programs first.`,
          });
        }
      }
      await mongoose.model(modelName).findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Deleted' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },
});

// ═══════════════════════════════════════════════════════════
//  PUBLIC API — /api/public/*
//  No auth required — for your friend's website to fetch data
// ═══════════════════════════════════════════════════════════

// GET /api/public/programs
// Returns all active programs with category, location, ageGroups, skillLevels
router.get('/public/programs', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.isFeatured = true;

    const data = await mongoose.model('Program')
      .find(filter)
      .populate('category', 'title slug')
      .populate('location', 'title city address')
      .sort({ createdAt: -1 });

    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/programs/:id
// Returns one active program by ID (with its batches)
router.get('/public/programs/:id', async (req, res) => {
  try {
    const program = await mongoose.model('Program')
      .findOne({ _id: req.params.id, isActive: true })
      .populate('category', 'title slug')
      .populate('location', 'title city address');

    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    // Also attach active batches for this program
    const batches = await mongoose.model('Batch')
      .find({ program: req.params.id, isActive: true })
      .populate('coach', 'firstName lastName')
      .populate('location', 'title city')
      .sort({ dayOfWeek: 1 });

    res.json({ success: true, data: { ...program.toObject(), batches } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/batches
// Returns all active batches — optionally filtered by ?program=<id>
router.get('/public/batches', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.program) filter.program = req.query.program;

    const data = await mongoose.model('Batch')
      .find(filter)
      .populate('program', 'title basePrice discountedPrice coverImagePath')
      .populate('coach', 'firstName lastName')
      .populate('location', 'title city address')
      .sort({ dayOfWeek: 1, startTime: 1 });

    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/categories
// Returns all active categories (seasons)
router.get('/public/categories', async (req, res) => {
  try {
    const data = await mongoose.model('Category')
      .find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/content/faqs
// Returns active FAQs for the public site
router.get('/public/content/faqs', async (req, res) => {
  try {
    const data = await mongoose.model('FAQ')
      .find({ isActive: true })
      .sort({ sortOrder: 1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/content/sponsors
// Returns active sponsors for the public site
router.get('/public/content/sponsors', async (req, res) => {
  try {
    const data = await mongoose.model('Sponsor')
      .find({ isActive: true })
      .sort({ sortOrder: 1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/content/media?type=GALLERY|MAGAZINE|NEWSLETTER
// Returns active media items for the public site
router.get('/public/content/media', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    const data = await mongoose.model('Media')
      .find(filter)
      .sort({ sortOrder: 1, publishDate: -1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/public/coaches
// Returns active coaches for the public site
router.get('/public/coaches', async (req, res) => {
  try {
    const data = await mongoose.model('Coach')
      .find({ isActive: true })
      .sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});


// GET /api/public/locations
// Returns all active locations (title, city, address, lat, lng, googleMapUrl)
router.get('/public/locations', async (req, res) => {
  try {
    const data = await mongoose.model('Location')
      .find({ isActive: { $ne: false } })
      .select('title city address state zipCode latitude longitude googleMapUrl')
      .sort({ city: 1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});


// ═══════════════════════════════════════════════════════════
//  AUTH routes — /api/auth/*
// ═══════════════════════════════════════════════════════════
router.post('/auth/login', authCtrl.login);
router.get( '/auth/me',    protect, authCtrl.getMe);

// Admin management (Super Admin only)
router.get(  '/auth/admins',          protect, superAdminOnly, authCtrl.listAdmins);
router.post( '/auth/admins',          protect, superAdminOnly, authCtrl.createAdmin);
router.patch('/auth/admins/:id/status',protect, superAdminOnly, authCtrl.toggleAdminStatus);

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — /api/dashboard/*
// ═══════════════════════════════════════════════════════════
router.get('/dashboard/stats', protect, dashCtrl.getStats);

// ═══════════════════════════════════════════════════════════
//  PROGRAMS — /api/programs/* — SUPER ADMIN only
// ═══════════════════════════════════════════════════════════
router.get(   '/programs',     protect, progCtrl.getAll);
router.get(   '/programs/:id', protect, progCtrl.getOne);
// ISSUE 4: uploadCoverImage handles the file, then controller saves path to DB
router.post(  '/programs',     protect, superAdminOnly, uploadCoverImage, progCtrl.create);
router.put(   '/programs/:id', protect, superAdminOnly, uploadCoverImage, progCtrl.update);
router.delete('/programs/:id', protect, superAdminOnly, progCtrl.remove);
router.delete('/programs/:id/permanent', protect, superAdminOnly, progCtrl.hardRemove);

// ═══════════════════════════════════════════════════════════
//  CATEGORIES (Seasons) — Super Admin only for CUD
// ═══════════════════════════════════════════════════════════
const catCRUD = makeCRUD('Category');
router.get(   '/categories',     protect, catCRUD.getAll);
router.get(   '/categories/:id', protect, catCRUD.getOne);
router.post(  '/categories',     protect, superAdminOnly, catCRUD.create);
router.put(   '/categories/:id', protect, superAdminOnly, catCRUD.update);
router.delete('/categories/:id', protect, superAdminOnly, catCRUD.remove);

// ═══════════════════════════════════════════════════════════
//  LOCATIONS — Super Admin creates; Normal Admin can view
// ═══════════════════════════════════════════════════════════
const locCRUD = makeCRUD('Location');
router.get(   '/locations',     protect, locCRUD.getAll);
router.get(   '/locations/:id', protect, locCRUD.getOne);
router.post(  '/locations',     protect, superAdminOnly, locCRUD.create);
router.put(   '/locations/:id', protect, superAdminOnly, locCRUD.update);
router.delete('/locations/:id', protect, superAdminOnly, locCRUD.remove);

// ═══════════════════════════════════════════════════════════
//  AGE GROUPS
// ═══════════════════════════════════════════════════════════
const ageGroupCRUD = makeCRUD('AgeGroup');
router.get(   '/age-groups',     protect, ageGroupCRUD.getAll);
router.get(   '/age-groups/:id', protect, ageGroupCRUD.getOne);
router.post(  '/age-groups',     protect, superAdminOnly, ageGroupCRUD.create);
router.put(   '/age-groups/:id', protect, superAdminOnly, ageGroupCRUD.update);
router.delete('/age-groups/:id', protect, superAdminOnly, ageGroupCRUD.remove);

// ═══════════════════════════════════════════════════════════
//  LEVELS
// ═══════════════════════════════════════════════════════════
const levelCRUD = makeCRUD('Level');
router.get(   '/levels',     protect, levelCRUD.getAll);
router.get(   '/levels/:id', protect, levelCRUD.getOne);
router.post(  '/levels',     protect, superAdminOnly, levelCRUD.create);
router.put(   '/levels/:id', protect, superAdminOnly, levelCRUD.update);
router.delete('/levels/:id', protect, superAdminOnly, levelCRUD.remove);

// ═══════════════════════════════════════════════════════════
//  BATCHES — Normal Admin manages
// ═══════════════════════════════════════════════════════════
router.get(   '/batches',     protect, batchCtrl.getAll);
router.get(   '/batches/:id', protect, batchCtrl.getOne);
router.post(  '/batches',     protect, adminOrSuperAdmin, batchCtrl.create);
router.put(   '/batches/:id', protect, adminOrSuperAdmin, batchCtrl.update);
router.delete('/batches/:id', protect, adminOrSuperAdmin, batchCtrl.remove);

// Permanent delete — super admin only, since this is irreversible and
// should require the highest level of authorization in the system.
router.delete('/batches/:id/permanent', protect, superAdminOnly, batchCtrl.hardRemove);

// ═══════════════════════════════════════════════════════════
//  REGISTRATIONS — Normal Admin manages
// ═══════════════════════════════════════════════════════════
router.get(  '/registrations',              protect, regCtrl.getAll);
router.get(  '/registrations/:id',          protect, regCtrl.getOne);
router.patch('/registrations/:id/status',   protect, regCtrl.updateStatus);

router.patch('/registrations/:id/whatsapp', protect, regCtrl.toggleWhatsapp);
// Super admin only — batch reassignment + student field corrections,
// with automatic diff email to the parent. Higher bar than the regular
// status/whatsapp toggles above since this can change what a parent
// actually registered for.
router.patch('/registrations/:id/edit',     protect, superAdminOnly, regCtrl.superAdminEdit);

// ═══════════════════════════════════════════════════════════
//  MESSAGING (Admin side) — Both admin roles see every thread;
//  unlike the coach inbox, admins aren't restricted to specific
//  batches since they oversee the whole academy.
// ═══════════════════════════════════════════════════════════
router.get('/messages', protect, async (req, res) => {
  try {
    const MessageThread = mongoose.model('MessageThread');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.batch) filter.batchId = req.query.batch;

    const threads = await MessageThread.find(filter)
      .populate('batchId', 'title dayOfWeek startTime endTime')
      .populate('parentId', 'firstName lastName email phone')
      .sort({ lastMessageAt: -1 })
      .lean();

    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/messages/:threadId/reply', protect, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, message: 'Message body is required.' });

    const MessageThread = mongoose.model('MessageThread');
    const thread = await MessageThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

    thread.messages.push({
      senderRole: 'ADMIN',
      senderId: req.user._id,
      senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      body: body.trim(),
      readByStaff: true,
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/messages/:threadId/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['OPEN', 'RESOLVED'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const MessageThread = mongoose.model('MessageThread');
    const thread = await MessageThread.findByIdAndUpdate(req.params.threadId, { status }, { new: true });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  STUDENTS — Both admins (view); created via public registration
// ═══════════════════════════════════════════════════════════
router.get('/students', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.parent) filter.parentId = req.query.parent;
    const data = await mongoose.model('Student')
      .find(filter)
      .populate('parentId', 'firstName lastName email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/students/:id', protect, async (req, res) => {
  try {
    const doc = await mongoose.model('Student').findById(req.params.id)
      .populate('parentId', 'firstName lastName email phone');
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ═══════════════════════════════════════════════════════════
//  ATTENDANCE — Normal Admin / Coach marks attendance
// ═══════════════════════════════════════════════════════════

// GET /api/attendance?student=&batch=&program=&date=&from=&to=
router.get('/attendance', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.student) filter.studentId = req.query.student;
    if (req.query.batch)   filter.batchId   = req.query.batch;
    if (req.query.program) filter.programId = req.query.program;
    if (req.query.date) {
      const start = startOfDayCalifornia(new Date(req.query.date));
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      filter.date = { $gte: start, $lte: end };
    } else if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }

    const data = await mongoose.model('Attendance')
      .find(filter)
      .populate('studentId', 'firstName lastName studentCode')
      .populate('batchId', 'title dayOfWeek startTime endTime')
      .populate('programId', 'title')
      .sort({ date: -1 });

    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/attendance — mark a single attendance record
router.post('/attendance', protect, adminOrSuperAdmin, async (req, res) => {
  try {
    const { studentId, registrationId, batchId, programId, date, status, note } = req.body;
    if (!studentId || !date) {
      return res.status(400).json({ success: false, message: 'studentId and date are required.' });
    }

    const day = startOfDayCalifornia(new Date(date));
    const doc = await mongoose.model('Attendance').findOneAndUpdate(
      { studentId, batchId: batchId || null, date: day },
      { studentId, registrationId, batchId, programId, date: day, status: status || 'PRESENT', note, markedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/attendance/bulk — mark attendance for a whole batch on one date
// body: { batchId, programId, date, records: [{ studentId, registrationId, status, note }] }
router.post('/attendance/bulk', protect, adminOrSuperAdmin, async (req, res) => {
  try {
    const { batchId, programId, date, records } = req.body;
    if (!date || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ success: false, message: 'date and records[] are required.' });
    }

    const day = startOfDayCalifornia(new Date(date));
    const Attendance = mongoose.model('Attendance');
    const results = await Promise.all(records.map(r =>
      Attendance.findOneAndUpdate(
        { studentId: r.studentId, batchId: batchId || null, date: day },
        {
          studentId: r.studentId,
          registrationId: r.registrationId,
          batchId, programId, date: day,
          status: r.status || 'PRESENT',
          note: r.note,
          markedBy: req.user._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ));

    res.status(201).json({ success: true, data: results });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/attendance/:id', protect, adminOrSuperAdmin, async (req, res) => {
  try {
    const doc = await mongoose.model('Attendance').findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(doc, req.body, { markedBy: req.user._id });
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/attendance/:id', protect, adminOrSuperAdmin, async (req, res) => {
  try {
    await mongoose.model('Attendance').findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ═══════════════════════════════════════════════════════════
//  COACHES — Both admins
//  create() auto-generates login credentials and emails them
// ═══════════════════════════════════════════════════════════
router.get(   '/coaches',     protect, coachCtrl.getAll);
router.get(   '/coaches/:id', protect, coachCtrl.getOne);
router.post(  '/coaches',     protect, adminOrSuperAdmin, uploadCoverImage, coachCtrl.create);
router.put(   '/coaches/:id', protect, adminOrSuperAdmin, uploadCoverImage, coachCtrl.update);
router.delete('/coaches/:id', protect, adminOrSuperAdmin, coachCtrl.remove);
router.post(  '/coaches/:id/resend-credentials', protect, adminOrSuperAdmin, coachCtrl.resendCredentials);

// ═══════════════════════════════════════════════════════════
//  COACH AUTH — /api/coach-auth/*  (separate Coach Portal app)
// ═══════════════════════════════════════════════════════════
router.post('/coach-auth/login', coachAuthCtrl.login);
router.get( '/coach-auth/me',    coachAuth, coachAuthCtrl.me);

// ═══════════════════════════════════════════════════════════
//  COACH PORTAL — /api/coach-portal/*  (logged-in coach only)
// ═══════════════════════════════════════════════════════════
router.get( '/coach-portal/dashboard',          coachAuth, coachPortalCtrl.getDashboard);
router.get( '/coach-portal/profile',            coachAuth, coachPortalCtrl.getProfile);
router.put( '/coach-portal/profile',            coachAuth, uploadCoverImage, coachPortalCtrl.updateProfile);
router.put( '/coach-portal/profile/password',   coachAuth, coachPortalCtrl.changePassword);
router.get( '/coach-portal/batches',            coachAuth, coachPortalCtrl.getMyBatches);
router.get( '/coach-portal/batches/:batchId',   coachAuth, coachPortalCtrl.getBatchDetail);
router.get( '/coach-portal/students',           coachAuth, coachPortalCtrl.getMyStudents);
router.get( '/coach-portal/students/:studentId',coachAuth, coachPortalCtrl.getStudentDetail);
router.post('/coach-portal/attendance/scan',    coachAuth, coachPortalCtrl.scanAttendance);
router.get( '/coach-portal/attendance',         coachAuth, coachPortalCtrl.getAttendance);

// ── Coach messaging — only threads for batches THIS coach is
//    actually assigned to, never every thread in the system. ──
router.get('/coach-portal/messages', coachAuth, async (req, res) => {
  try {
    const Batch = mongoose.model('Batch');
    const MessageThread = mongoose.model('MessageThread');

    const myBatchIds = await Batch.find({ coach: req.coach._id }).select('_id');
    const threads = await MessageThread.find({ batchId: { $in: myBatchIds.map(b => b._id) } })
      .populate('batchId', 'title dayOfWeek startTime endTime')
      .populate('parentId', 'firstName lastName email')
      .sort({ lastMessageAt: -1 })
      .lean();

    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/coach-portal/messages/:threadId/reply', coachAuth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, message: 'Message body is required.' });

    const Batch = mongoose.model('Batch');
    const MessageThread = mongoose.model('MessageThread');

    const thread = await MessageThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

    // A coach can only reply to threads for batches they're assigned to —
    // mirrors the same "verify entitlement, don't trust the id alone"
    // principle used for parent thread creation above.
    const batch = await Batch.findOne({ _id: thread.batchId, coach: req.coach._id });
    if (!batch) return res.status(403).json({ success: false, message: "You're not assigned to this batch." });

    thread.messages.push({
      senderRole: 'COACH',
      senderId: req.coach._id,
      senderName: `${req.coach.firstName} ${req.coach.lastName}`,
      body: body.trim(),
      readByStaff: true,
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  COUPONS — Both admins
// ═══════════════════════════════════════════════════════════
const couponCRUD = makeCRUD('Coupon');
router.get(   '/coupons',     protect, couponCRUD.getAll);
router.get(   '/coupons/:id', protect, couponCRUD.getOne);
router.post(  '/coupons',     protect, adminOrSuperAdmin, couponCRUD.create);
router.put(   '/coupons/:id', protect, adminOrSuperAdmin, couponCRUD.update);
router.delete('/coupons/:id', protect, adminOrSuperAdmin, couponCRUD.remove);

// ═══════════════════════════════════════════════════════════
//  REPORTS — Both admins
// ═══════════════════════════════════════════════════════════
router.get( '/reports/revenue', protect, reportCtrl.getRevenueSummary);
router.post('/reports/custom',  protect, reportCtrl.buildCustomReport);
router.get( '/reports/export',  protect, reportCtrl.exportCSV);

// ═══════════════════════════════════════════════════════════
//  CONTENT (FAQs, Sponsors, Media) — Both admins
// ═══════════════════════════════════════════════════════════
const faqSchema = new mongoose.Schema({
  question: String, answer: String, category: String,
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const mediaSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  type:         { type: String, enum: ['MAGAZINE', 'GALLERY', 'NEWSLETTER'], required: true },
  // Cover image — stored as uploaded file path (not URL)
  imagePath:    { type: String }, // e.g. "uploads/media/abc123.jpg"
  // Gallery can hold up to 100 images
  galleryImages:[{ path: String, isCover: Boolean }],
  // PDF file path for magazine / newsletter
  filePath:     { type: String }, // e.g. "uploads/media/issue12.pdf"
  album:        { type: String },
  description:  { type: String },
  publishDate:  { type: Date },
  sortOrder:    { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

if (!mongoose.modelNames().includes('Media'))   mongoose.model('Media', mediaSchema);
if (!mongoose.modelNames().includes('FAQ'))     mongoose.model('FAQ', faqSchema);

const mediaCRUD   = makeCRUD('Media');
const faqCRUD     = makeCRUD('FAQ');

router.get('/content/media', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const data = await mongoose.model('Media').find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ISSUE 6 & 7: media create — gallery uses uploadGallery, mag/newsletter use uploadMediaWithPdf
router.post('/content/media', protect, adminOrSuperAdmin, (req, res, next) => {
  // Pick the right multer based on type in body
  const type = req.body?.type || req.query?.type || '';
  if (type === 'GALLERY') return uploadGallery(req, res, next);
  return uploadMediaWithPdf(req, res, next);
}, async (req, res) => {
  try {
    const body = { ...req.body, createdBy: req.user._id };
    // Cover image (single)
    if (req.files?.coverImage?.[0]) {
      body.coverImagePath = req.files.coverImage[0].path.replace(/\\/g, '/');
      body.coverImageUrl  = fileUrl(req, req.files.coverImage[0].path);
    }
    // PDF file (magazine / newsletter)
    if (req.files?.pdfFile?.[0]) {
      body.filePath = req.files.pdfFile[0].path.replace(/\\/g, '/');
      body.fileUrl  = fileUrl(req, req.files.pdfFile[0].path);
    }
    // Gallery images (up to 100)
    if (req.files?.galleryImages) {
      const coverIdx = parseInt(req.body.galleryCoverIndex) || 0;
      body.galleryImages = req.files.galleryImages.map((f, i) => ({
        path:    f.path.replace(/\\/g, '/'),
        url:     fileUrl(req, f.path),
        isCover: i === coverIdx,
      }));
      // Also set coverImageUrl to the selected cover for easy access
      if (req.files.galleryImages[coverIdx]) {
        body.coverImageUrl = fileUrl(req, req.files.galleryImages[coverIdx].path);
      }
    }
    const doc = new (mongoose.model('Media'))(body);
    await doc.save();
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/content/media/:id', protect, adminOrSuperAdmin, (req, res, next) => {
  const type = req.body?.type || '';
  if (type === 'GALLERY') return uploadGallery(req, res, next);
  return uploadMediaWithPdf(req, res, next);
}, async (req, res) => {
  try {
    const doc = await mongoose.model('Media').findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(doc, req.body);
    if (req.files?.coverImage?.[0]) {
      doc.coverImagePath = req.files.coverImage[0].path.replace(/\\/g, '/');
      doc.coverImageUrl  = fileUrl(req, req.files.coverImage[0].path);
    }
    if (req.files?.pdfFile?.[0]) {
      doc.filePath = req.files.pdfFile[0].path.replace(/\\/g, '/');
      doc.fileUrl  = fileUrl(req, req.files.pdfFile[0].path);
    }
    if (req.files?.galleryImages) {
      // New images uploaded — replace gallery
      const coverIdx = parseInt(req.body.galleryCoverIndex) || 0;
      doc.galleryImages = req.files.galleryImages.map((f, i) => ({
        path:    f.path.replace(/\\/g, '/'),
        url:     fileUrl(req, f.path),
        isCover: i === coverIdx,
      }));
      if (req.files.galleryImages[coverIdx]) {
        doc.coverImageUrl = fileUrl(req, req.files.galleryImages[coverIdx].path);
      }
    } else if (req.body.existingCoverIndex !== undefined && doc.galleryImages?.length) {
      // No new images — just update which existing image is the cover
      const ci = parseInt(req.body.existingCoverIndex) || 0;
      doc.galleryImages = doc.galleryImages.map((img, i) => ({
        ...img.toObject ? img.toObject() : img,
        isCover: i === ci,
      }));
      if (doc.galleryImages[ci]) {
        doc.coverImageUrl = doc.galleryImages[ci].url;
      }
    }
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/content/media/:id', protect, adminOrSuperAdmin, mediaCRUD.remove);

router.get(   '/content/faqs',     protect, faqCRUD.getAll);
router.post(  '/content/faqs',     protect, adminOrSuperAdmin, faqCRUD.create);
router.put(   '/content/faqs/:id', protect, adminOrSuperAdmin, faqCRUD.update);
router.delete('/content/faqs/:id', protect, adminOrSuperAdmin, faqCRUD.remove);

const sponsorSchema = new mongoose.Schema({
  name: String,
  // ISSUE 7: logo stored as uploaded file, not URL
  coverImagePath: { type: String }, // disk path
  coverImageUrl:  { type: String }, // full URL served by /uploads
  websiteUrl: String,
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

if (!mongoose.modelNames().includes('Sponsor')) mongoose.model('Sponsor', sponsorSchema);
const sponsorCRUD = makeCRUD('Sponsor');
router.get(   '/content/sponsors',     protect, sponsorCRUD.getAll);
// ISSUE 7: sponsor logo is a file upload, not URL
router.post(  '/content/sponsors',     protect, adminOrSuperAdmin, uploadCoverImage, async (req, res) => {
  try {
    const body = { ...req.body, createdBy: req.user._id };
    if (req.file) {
      body.coverImagePath = req.file.path.replace(/\\/g, '/');
      body.coverImageUrl  = fileUrl(req, req.file.path);
    }
    const doc = new (mongoose.model('Sponsor'))(body);
    await doc.save();
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.put(   '/content/sponsors/:id', protect, adminOrSuperAdmin, uploadCoverImage, async (req, res) => {
  try {
    const doc = await mongoose.model('Sponsor').findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(doc, req.body);
    if (req.file) {
      doc.coverImagePath = req.file.path.replace(/\\/g, '/');
      doc.coverImageUrl  = fileUrl(req, req.file.path);
    }
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.delete('/content/sponsors/:id', protect, adminOrSuperAdmin, sponsorCRUD.remove);

module.exports = router;