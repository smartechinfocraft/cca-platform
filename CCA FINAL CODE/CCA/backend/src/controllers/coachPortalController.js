// ============================================================
//  controllers/coachPortalController.js
// ============================================================
const mongoose = require('mongoose');
const { startOfTodayCalifornia, startOfDayCalifornia } = require('../utils/californiaTime');

const getModels = () => ({
  Coach:        mongoose.model('Coach'),
  Batch:        mongoose.model('Batch'),
  Student:      mongoose.model('Student'),
  Attendance:   mongoose.model('Attendance'),
  Location:     mongoose.model('Location'),
  Program:      mongoose.model('Program'),
  Registration: mongoose.model('Registration'),
});

const ACTIVE_REG_STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'CONFIRMED', 'WAITLISTED'];

// ─────────────────────────────────────────────────────────────────────────────
//  HOW STUDENTS ARE STORED IN REGISTRATIONS
//  ─────────────────────────────────────────────────────────────────────────────
//  The Registration schema defines students as EMBEDDED sub-documents:
//    students: [{ firstName, lastName, dob, gender, photoUrl, studentCode }]
//
//  When public_registration.js saves `students: [studentObjectId, ...]`,
//  Mongoose casts each ObjectId into an embedded sub-doc where:
//    - sub._id  = the original Student ObjectId  ← THIS IS WHAT WE NEED
//    - sub.firstName, sub.studentCode, etc. = undefined (not in schema cast)
//
//  When superAdminEdit updates students, it edits the embedded objects directly,
//  so sub.firstName etc. ARE populated, and sub._id is the auto-generated subdoc _id
//  (NOT a Student ObjectId).
//
//  RULE:
//    If sub.studentCode is present → use studentCode to look up the Student
//    Otherwise → sub._id IS the real Student ObjectId (from the original save)
// ─────────────────────────────────────────────────────────────────────────────

function isValidObjectId(val) {
  return mongoose.Types.ObjectId.isValid(val) && String(val).length === 24;
}

// Returns { batchId(string) => Set(studentId string) }
async function buildBatchStudentMap(batchIds) {
  const { Registration, Student } = getModels();

  if (!batchIds || batchIds.length === 0) return {};

  const regs = await Registration.find({
    batches: { $in: batchIds },
    status:  { $in: ACTIVE_REG_STATUSES },
  }).select('students batches').lean();

  const map = {};
  batchIds.forEach((id) => { map[String(id)] = new Set(); });

  const directIds   = []; // { sid, bids } — Student ObjectIds from schema cast
  const codeEntries = []; // { code, bids } — studentCodes from admin-edited embedded docs

  regs.forEach((reg) => {
    const bids = (reg.batches || []).map(String);

    (reg.students || []).forEach((s) => {
      if (!s) return;

      if (s.studentCode) {
        // Admin-edited embedded doc: has studentCode field → look up by code
        codeEntries.push({ code: String(s.studentCode).trim().toUpperCase(), bids });
      } else if (s._id && isValidObjectId(String(s._id))) {
        // Schema-cast ObjectId: sub._id = the original Student ObjectId passed in
        directIds.push({ sid: String(s._id), bids });
      }
    });
  });

  // Resolve direct ObjectId refs
  directIds.forEach(({ sid, bids }) => {
    bids.forEach((bid) => { if (map[bid]) map[bid].add(sid); });
  });

  // Resolve studentCode refs
  if (codeEntries.length > 0) {
    const uniqueCodes = [...new Set(codeEntries.map((e) => e.code))];
    const found = await Student.find(
      { studentCode: { $in: uniqueCodes } },
      { _id: 1, studentCode: 1 }
    ).lean();
    const codeToId = {};
    found.forEach((st) => { codeToId[String(st.studentCode).toUpperCase()] = String(st._id); });

    codeEntries.forEach(({ code, bids }) => {
      const sid = codeToId[code];
      if (!sid) return;
      bids.forEach((bid) => { if (map[bid]) map[bid].add(sid); });
    });
  }

  return map;
}

async function getStudentIdsForBatch(batchId) {
  const map = await buildBatchStudentMap([batchId]);
  return Array.from(map[String(batchId)] || []);
}

// ─── GET /api/coach-portal/dashboard ───────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const { Batch, Location } = getModels();
    const coachId = req.coach._id;

    const batches = await Batch.find({ coach: coachId })
      .populate('location', 'title city address')
      .populate('program',  'title')
      .sort({ dayOfWeek: 1, startTime: 1 });

    const batchIds = batches.map((b) => b._id);
    const batchStudentMap = await buildBatchStudentMap(batchIds);

    const allStudentIds = new Set();
    Object.values(batchStudentMap).forEach((set) => set.forEach((sid) => allStudentIds.add(sid)));

    const batchChartData = batches.map((b) => ({
      batchId:  b._id,
      label:    b.title || `${b.dayOfWeek} ${b.startTime}-${b.endTime}`,
      program:  b.program?.title || '',
      students: batchStudentMap[String(b._id)]?.size || 0,
    }));

    const locationIdsFromBatches = batches.map((b) => b.location?._id?.toString()).filter(Boolean);
    const locationIdSet = new Set(locationIdsFromBatches);
    if (req.coach.location) locationIdSet.add(req.coach.location.toString());

    const locations = await Location.find({ _id: { $in: Array.from(locationIdSet) } })
      .select('title city address');

    res.json({
      success: true,
      data: { totalStudents: allStudentIds.size, totalBatches: batches.length, batchChartData, locations },
    });
  } catch (e) {
    console.error('getDashboard error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/profile ─────────────────────────────
exports.getProfile = async (req, res) => {
  res.json({
    success: true,
    data: {
      id:         req.coach._id,
      firstName:  req.coach.firstName,
      lastName:   req.coach.lastName,
      email:      req.coach.email,
      phone:      req.coach.phone,
      bio:        req.coach.bio,
      experience: req.coach.experience,
      speciality: req.coach.speciality,
      photoUrl:   req.coach.photoUrl,
      username:   req.coach.username,
      coachUid:   req.coach.coachUid,
      location:   req.coach.location,
    },
  });
};

// ─── PUT /api/coach-portal/profile ─────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    ['phone', 'bio', 'experience', 'speciality'].forEach((f) => {
      if (req.body[f] !== undefined) req.coach[f] = req.body[f];
    });
    if (req.file) req.coach.photoUrl = req.file.path.replace(/\\/g, '/');
    await req.coach.save();
    res.json({ success: true, data: req.coach, message: 'Profile updated' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── PUT /api/coach-portal/profile/password ────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    const { Coach } = getModels();
    const coach = await Coach.findById(req.coach._id).select('+password');
    if (!await coach.comparePassword(currentPassword))
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    coach.password = newPassword;
    await coach.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/batches ─────────────────────────────
exports.getMyBatches = async (req, res) => {
  try {
    const { Batch } = getModels();
    const batches = await Batch.find({ coach: req.coach._id })
      .populate('location', 'title city address')
      .populate('program',  'title basePrice discountedPrice')
      .sort({ dayOfWeek: 1, startTime: 1 });

    const batchIds = batches.map((b) => b._id);
    const batchStudentMap = await buildBatchStudentMap(batchIds);

    const withCounts = batches.map((b) => ({
      ...b.toObject(),
      studentCount: batchStudentMap[String(b._id)]?.size || 0,
    }));

    res.json({ success: true, data: withCounts });
  } catch (e) {
    console.error('getMyBatches error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/batches/:batchId ────────────────────
exports.getBatchDetail = async (req, res) => {
  try {
    const { Batch, Student } = getModels();

    const batch = await Batch.findById(req.params.batchId)
      .populate('location', 'title city address')
      .populate('program',  'title');

    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    if (String(batch.coach) !== String(req.coach._id)) {
      return res.status(403).json({ success: false, message: 'This batch is not assigned to you' });
    }

    const studentIds = await getStudentIdsForBatch(batch._id);
    const validIds   = studentIds.filter(isValidObjectId);

    const students = validIds.length > 0
      ? await Student.find({ _id: { $in: validIds }, isActive: { $ne: false } }, 'firstName lastName studentCode photoUrl').sort({ firstName: 1 })
      : [];

    res.json({ success: true, data: { batch, students } });
  } catch (e) {
    console.error('getBatchDetail error:', e.message, e.stack);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/students ────────────────────────────
exports.getMyStudents = async (req, res) => {
  try {
    const { Batch, Student } = getModels();
    const myBatches = await Batch.find({ coach: req.coach._id })
      .select('_id title dayOfWeek startTime endTime');
    const myBatchIds = myBatches.map((b) => b._id);

    const batchStudentMap = await buildBatchStudentMap(myBatchIds);

    const studentBatchesMap = {};
    myBatches.forEach((b) => {
      (batchStudentMap[String(b._id)] || new Set()).forEach((sid) => {
        if (!studentBatchesMap[sid]) studentBatchesMap[sid] = [];
        studentBatchesMap[sid].push({ _id: b._id, title: b.title, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime });
      });
    });

    let studentIds;
    if (req.query.batchId) {
      studentIds = Array.from(batchStudentMap[String(req.query.batchId)] || []);
    } else {
      const all = new Set();
      Object.values(batchStudentMap).forEach((set) => set.forEach((sid) => all.add(sid)));
      studentIds = Array.from(all);
    }

    const validIds = studentIds.filter(isValidObjectId);

    const students = validIds.length > 0
      ? await Student.find({ _id: { $in: validIds }, isActive: { $ne: false } })
          .populate('parentId', 'firstName lastName phone email')
          .sort({ firstName: 1 })
      : [];

    const withBatches = students.map((s) => ({
      ...s.toObject(),
      batches: studentBatchesMap[String(s._id)] || [],
    }));

    res.json({ success: true, data: withBatches });
  } catch (e) {
    console.error('getMyStudents error:', e.message, e.stack);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/students/:studentId ─────────────────
exports.getStudentDetail = async (req, res) => {
  try {
    const { Batch, Student } = getModels();
    const myBatches = await Batch.find({ coach: req.coach._id })
      .select('_id title dayOfWeek startTime endTime');
    const myBatchIds = myBatches.map((b) => b._id);

    const batchStudentMap = await buildBatchStudentMap(myBatchIds);

    const matchingBatches = myBatches.filter((b) =>
      (batchStudentMap[String(b._id)] || new Set()).has(req.params.studentId)
    );
    if (!matchingBatches.length)
      return res.status(403).json({ success: false, message: 'This student is not assigned to you' });

    const student = await Student.findById(req.params.studentId)
      .populate('parentId', 'firstName lastName phone email');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    res.json({
      success: true,
      data: {
        ...student.toObject(),
        batches: matchingBatches.map((b) => ({ _id: b._id, title: b.title, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
      },
    });
  } catch (e) {
    console.error('getStudentDetail error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Helper: assert student is in coach's batch ─────────────────
async function assertStudentBelongsToCoach(studentId, batchId, coachId) {
  const { Batch } = getModels();
  const batch = await Batch.findOne({ _id: batchId, coach: coachId });
  if (!batch) return { ok: false, message: 'Batch not found or not assigned to you' };

  const studentIds = await getStudentIdsForBatch(batchId);
  const belongs = studentIds.some((sid) => String(sid) === String(studentId));
  if (!belongs) return { ok: false, message: 'Student not found in this batch' };

  return { ok: true, batch };
}

// ─── POST /api/coach-portal/attendance/scan ────────────────────
exports.scanAttendance = async (req, res) => {
  try {
    const { studentCode, batchId, method } = req.body;
    if (!studentCode || !batchId)
      return res.status(400).json({ success: false, message: 'studentCode and batchId are required' });

    const { Student, Attendance } = getModels();

    const student = await Student.findOne({ studentCode: studentCode.trim().toUpperCase() });
    if (!student)
      return res.status(404).json({ success: false, message: 'No student found with this ID card / code' });

    const check = await assertStudentBelongsToCoach(student._id, batchId, req.coach._id);
    if (!check.ok)
      return res.status(403).json({ success: false, message: check.message });

    const today = startOfTodayCalifornia();

    const existing = await Attendance.findOne({ studentId: student._id, batchId, date: today });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `${student.firstName} ${student.lastName} was already marked present today.`,
        data: existing,
      });
    }

    const attendance = await Attendance.create({
      studentId: student._id,
      batchId,
      programId: check.batch.program,
      date:      today,
      status:    'PRESENT',
      note:      method === 'MANUAL'
        ? `Marked manually by coach ${req.coach.firstName} ${req.coach.lastName}`
        : `Marked via QR scan by coach ${req.coach.firstName} ${req.coach.lastName}`,
    });

    res.status(201).json({
      success: true,
      message: `${student.firstName} ${student.lastName} marked present ✅`,
      data: {
        attendance,
        student: { id: student._id, firstName: student.firstName, lastName: student.lastName, photoUrl: student.photoUrl },
      },
    });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ success: false, message: 'Attendance already recorded for this student today.' });
    console.error('scanAttendance error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/attendance ──────────────────────────
exports.getAttendance = async (req, res) => {
  try {
    const { Attendance, Batch } = getModels();
    const { batchId } = req.query;
    if (!batchId) return res.status(400).json({ success: false, message: 'batchId is required' });

    const batch = await Batch.findOne({ _id: batchId, coach: req.coach._id });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found or not assigned to you' });

    const date = req.query.date
      ? startOfDayCalifornia(new Date(req.query.date))
      : startOfTodayCalifornia();

    const records = await Attendance.find({ batchId, date })
      .populate('studentId', 'firstName lastName studentCode photoUrl')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: records });
  } catch (e) {
    console.error('getAttendance error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};