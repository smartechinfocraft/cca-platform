// ============================================================
//  controllers/coachPortalController.js
//  FIXED: Now supports BOTH real Batch documents (legacy)
//  AND Programs with scheduleDays where coachId = coach._id
//  (new merged model where batch is embedded in program).
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
//  VIRTUAL BATCH ID CONVENTION
//  When a Program has scheduleDays instead of a real Batch document, we create
//  a virtual batch ID as the string:  "prog:<programId>"
//  This lets the rest of the code treat programs and real batches uniformly.
// ─────────────────────────────────────────────────────────────────────────────

function isValidObjectId(val) {
  return mongoose.Types.ObjectId.isValid(val) && String(val).length === 24;
}

function isVirtualBatchId(id) {
  return String(id).startsWith('prog:');
}

function programIdFromVirtual(virtualId) {
  return String(virtualId).replace(/^prog:/, '');
}

// ─── Build unified batch list for a coach ────────────────────────────────────
//  Returns an array of batch-shaped objects combining:
//    1. Real Batch documents where Batch.coach = coachId
//    2. Virtual "batches" from Program.scheduleDays where Program.coachId = coachId
//
//  Virtual batch shape mirrors a real Batch toObject() so downstream code is uniform.
//
async function getCoachBatchList(coachId) {
  const { Batch, Program, Location } = getModels();

  // 1. Real batches
  const realBatches = await Batch.find({ coach: coachId })
    .populate('location', 'title city address')
    .populate('program',  'title basePrice discountedPrice')
    .sort({ dayOfWeek: 1, startTime: 1 });

  // 2. Programs with coachId set — each scheduleDays entry becomes one virtual batch
  const programs = await Program.find({ coachId, isActive: true })
    .populate('location', 'title city address')
    .sort({ title: 1 });

  const virtualBatches = [];
  for (const prog of programs) {
    // Skip if the coach already has real batches for this program
    const hasRealBatch = realBatches.some(
      (b) => b.program && String(b.program._id || b.program) === String(prog._id)
    );
    if (hasRealBatch) continue;

    if (prog.scheduleDays && prog.scheduleDays.length > 0) {
      // One virtual batch per scheduleDays entry
      prog.scheduleDays.forEach((sd, idx) => {
        virtualBatches.push({
          _id:        `prog:${prog._id}:${idx}`,   // unique virtual id per day
          _programId: String(prog._id),             // raw programId for DB queries
          _isVirtual: true,
          title:      `${prog.title} — ${sd.day}`,
          dayOfWeek:  sd.day,
          startTime:  sd.startTime || '',
          endTime:    sd.endTime   || '',
          location:   prog.location || null,
          program:    { _id: prog._id, title: prog.title, basePrice: prog.basePrice, discountedPrice: prog.discountedPrice },
          coach:      coachId,
          isActive:   true,
          studentCount: 0, // filled in later
        });
      });
    } else {
      // Program has no scheduleDays — treat whole program as one virtual batch
      virtualBatches.push({
        _id:        `prog:${prog._id}`,
        _programId: String(prog._id),
        _isVirtual: true,
        title:      prog.title,
        dayOfWeek:  'MULTI',
        startTime:  '',
        endTime:    '',
        location:   prog.location || null,
        program:    { _id: prog._id, title: prog.title, basePrice: prog.basePrice, discountedPrice: prog.discountedPrice },
        coach:      coachId,
        isActive:   true,
        studentCount: 0,
      });
    }
  }

  return { realBatches, virtualBatches };
}

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

// Returns { batchId(string) => Set(studentId string) } for REAL batch IDs
async function buildBatchStudentMap(batchIds) {
  const { Registration, Student } = getModels();

  if (!batchIds || batchIds.length === 0) return {};

  const regs = await Registration.find({
    batches: { $in: batchIds },
    status:  { $in: ACTIVE_REG_STATUSES },
  }).select('students batches').lean();

  const map = {};
  batchIds.forEach((id) => { map[String(id)] = new Set(); });

  const directIds   = [];
  const codeEntries = [];

  regs.forEach((reg) => {
    const bids = (reg.batches || []).map(String);

    (reg.students || []).forEach((s) => {
      if (!s) return;

      if (s.studentCode) {
        codeEntries.push({ code: String(s.studentCode).trim().toUpperCase(), bids });
      } else if (s._id && isValidObjectId(String(s._id))) {
        directIds.push({ sid: String(s._id), bids });
      }
    });
  });

  directIds.forEach(({ sid, bids }) => {
    bids.forEach((bid) => { if (map[bid]) map[bid].add(sid); });
  });

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

// Returns Set(studentId string) for a VIRTUAL program-based batch
async function getStudentIdsForProgram(programId) {
  const { Registration, Student } = getModels();

  // ── KEY INSIGHT ──────────────────────────────────────────────────────────
  // When a program has NO real Batch documents, the public route at
  // GET /api/public/programs/:id builds a SYNTHETIC batch where:
  //   syntheticBatch._id = program._id   ← same ObjectId!
  //
  // So public_registration.js saves:
  //   Registration.programId = program._id   ✅
  //   Registration.batches   = [program._id] ← programId stored as a batchId!
  //
  // We must search BOTH ways:
  //   1. programId field = programId           (standard)
  //   2. batches array contains programId      (synthetic batch case)
  // ─────────────────────────────────────────────────────────────────────────
  const regs = await Registration.find({
    $or: [
      { programId: programId, status: { $in: ACTIVE_REG_STATUSES } },
      { batches: programId,   status: { $in: ACTIVE_REG_STATUSES } },
    ],
  }).select('students').lean();

  const studentSet = new Set();
  const directIds   = [];
  const codeEntries = [];

  regs.forEach((reg) => {
    (reg.students || []).forEach((s) => {
      if (!s) return;
      if (s.studentCode) {
        codeEntries.push(String(s.studentCode).trim().toUpperCase());
      } else if (s._id && isValidObjectId(String(s._id))) {
        directIds.push(String(s._id));
      }
    });
  });

  directIds.forEach((sid) => studentSet.add(sid));

  if (codeEntries.length > 0) {
    const uniqueCodes = [...new Set(codeEntries)];
    const found = await Student.find(
      { studentCode: { $in: uniqueCodes } },
      { _id: 1 }
    ).lean();
    found.forEach((st) => studentSet.add(String(st._id)));
  }

  return studentSet;
}

async function getStudentIdsForBatch(batchId) {
  if (isVirtualBatchId(batchId)) {
    // Strip the ":idx" suffix if present (prog:<programId>:<idx>)
    const parts = String(batchId).split(':');
    const programId = parts[1];
    const set = await getStudentIdsForProgram(programId);
    return Array.from(set);
  }
  const map = await buildBatchStudentMap([batchId]);
  return Array.from(map[String(batchId)] || []);
}

// ─── GET /api/coach-portal/dashboard ───────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const { Location } = getModels();
    const coachId = req.coach._id;

    const { realBatches, virtualBatches } = await getCoachBatchList(coachId);
    const allBatches = [...realBatches, ...virtualBatches];

    // Student counts
    const realBatchIds = realBatches.map((b) => b._id);
    const batchStudentMap = await buildBatchStudentMap(realBatchIds);

    // Collect unique program IDs for virtual batches (group by program)
    const virtualProgramIds = [...new Set(virtualBatches.map((b) => b._programId))];
    const virtualProgramStudentSets = {};
    for (const pid of virtualProgramIds) {
      virtualProgramStudentSets[pid] = await getStudentIdsForProgram(pid);
    }

    const allStudentIds = new Set();
    realBatches.forEach((b) => {
      (batchStudentMap[String(b._id)] || new Set()).forEach((sid) => allStudentIds.add(sid));
    });
    virtualProgramIds.forEach((pid) => {
      (virtualProgramStudentSets[pid] || new Set()).forEach((sid) => allStudentIds.add(sid));
    });

    const batchChartData = allBatches.map((b) => {
      let count;
      if (b._isVirtual) {
        count = (virtualProgramStudentSets[b._programId] || new Set()).size;
      } else {
        count = batchStudentMap[String(b._id)]?.size || 0;
      }
      return {
        batchId:  b._id,
        label:    b.title || `${b.dayOfWeek} ${b.startTime}-${b.endTime}`,
        program:  b.program?.title || '',
        students: count,
      };
    });

    const locationIdSet = new Set();
    allBatches.forEach((b) => { if (b.location?._id) locationIdSet.add(b.location._id.toString()); });
    if (req.coach.location) locationIdSet.add(req.coach.location.toString());

    const locations = await Location.find({ _id: { $in: Array.from(locationIdSet) } })
      .select('title city address');

    res.json({
      success: true,
      data: { totalStudents: allStudentIds.size, totalBatches: allBatches.length, batchChartData, locations },
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
    const coachId = req.coach._id;
    const { realBatches, virtualBatches } = await getCoachBatchList(coachId);

    // Real batch student counts
    const realBatchIds = realBatches.map((b) => b._id);
    const batchStudentMap = await buildBatchStudentMap(realBatchIds);

    const realWithCounts = realBatches.map((b) => ({
      ...b.toObject(),
      studentCount: batchStudentMap[String(b._id)]?.size || 0,
    }));

    // Virtual batch student counts (per program — all days share the same pool)
    const virtualProgramIds = [...new Set(virtualBatches.map((b) => b._programId))];
    const virtualProgramStudentSets = {};
    for (const pid of virtualProgramIds) {
      virtualProgramStudentSets[pid] = await getStudentIdsForProgram(pid);
    }

    const virtualWithCounts = virtualBatches.map((b) => ({
      ...b,
      studentCount: (virtualProgramStudentSets[b._programId] || new Set()).size,
    }));

    res.json({ success: true, data: [...realWithCounts, ...virtualWithCounts] });
  } catch (e) {
    console.error('getMyBatches error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/batches/:batchId ────────────────────
exports.getBatchDetail = async (req, res) => {
  try {
    const { Batch, Student, Program } = getModels();
    const batchId = req.params.batchId;

    let batchObj, students;

    if (isVirtualBatchId(batchId)) {
      // Virtual batch from a Program.scheduleDays entry
      const parts = batchId.split(':');
      const programId = parts[1];
      const dayIdx    = parts[2] !== undefined ? parseInt(parts[2], 10) : null;

      const program = await Program.findOne({ _id: programId, coachId: req.coach._id })
        .populate('location', 'title city address');

      if (!program)
        return res.status(404).json({ success: false, message: 'Program not found or not assigned to you' });

      const sd = dayIdx !== null && program.scheduleDays[dayIdx]
        ? program.scheduleDays[dayIdx]
        : null;

      batchObj = {
        _id:       batchId,
        title:     sd ? `${program.title} — ${sd.day}` : program.title,
        dayOfWeek: sd ? sd.day : 'MULTI',
        startTime: sd ? sd.startTime : '',
        endTime:   sd ? sd.endTime   : '',
        location:  program.location,
        program:   { _id: program._id, title: program.title },
        _isVirtual: true,
        _programId: String(programId),
      };

      const studentIds = Array.from(await getStudentIdsForProgram(programId));
      const validIds   = studentIds.filter(isValidObjectId);
      students = validIds.length > 0
        ? await Student.find({ _id: { $in: validIds }, isActive: { $ne: false } },
            'firstName lastName studentCode photoUrl').sort({ firstName: 1 })
        : [];

    } else {
      // Real Batch document
      const batch = await Batch.findById(batchId)
        .populate('location', 'title city address')
        .populate('program',  'title');

      if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

      if (String(batch.coach) !== String(req.coach._id))
        return res.status(403).json({ success: false, message: 'This batch is not assigned to you' });

      batchObj = batch;

      const studentIds = await getStudentIdsForBatch(batch._id);
      const validIds   = studentIds.filter(isValidObjectId);
      students = validIds.length > 0
        ? await Student.find({ _id: { $in: validIds }, isActive: { $ne: false } },
            'firstName lastName studentCode photoUrl').sort({ firstName: 1 })
        : [];
    }

    res.json({ success: true, data: { batch: batchObj, students } });
  } catch (e) {
    console.error('getBatchDetail error:', e.message, e.stack);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GET /api/coach-portal/students ────────────────────────────
exports.getMyStudents = async (req, res) => {
  try {
    const { Batch, Student, Program } = getModels();
    const coachId = req.coach._id;

    // Real batches
    const myRealBatches = await Batch.find({ coach: coachId })
      .select('_id title dayOfWeek startTime endTime program');
    const myRealBatchIds = myRealBatches.map((b) => b._id);

    // Virtual batches from programs
    const myPrograms = await Program.find({ coachId, isActive: true })
      .select('_id title scheduleDays');

    // Filter: if the program already has a real batch, don't double-count
    const programsWithRealBatch = new Set(
      myRealBatches.map((b) => b.program ? String(b.program) : null).filter(Boolean)
    );
    const virtualPrograms = myPrograms.filter((p) => !programsWithRealBatch.has(String(p._id)));

    // If filtering by batchId
    if (req.query.batchId) {
      const batchId = req.query.batchId;
      const studentIds = await getStudentIdsForBatch(batchId);
      const validIds   = studentIds.filter(isValidObjectId);

      // Determine which batch/program this batchId belongs to for batch label
      let batchLabel = null;
      if (isVirtualBatchId(batchId)) {
        const parts = batchId.split(':');
        const prog  = myPrograms.find((p) => String(p._id) === parts[1]);
        if (prog) {
          const dayIdx = parts[2] !== undefined ? parseInt(parts[2], 10) : null;
          const sd = dayIdx !== null ? prog.scheduleDays[dayIdx] : null;
          batchLabel = { _id: batchId, title: sd ? `${prog.title} — ${sd.day}` : prog.title, dayOfWeek: sd?.day || 'MULTI', startTime: sd?.startTime || '', endTime: sd?.endTime || '' };
        }
      } else {
        const b = myRealBatches.find((b) => String(b._id) === batchId);
        if (b) batchLabel = b;
      }

      const students = validIds.length > 0
        ? await Student.find({ _id: { $in: validIds }, isActive: { $ne: false } })
            .populate('parentId', 'firstName lastName phone email')
            .sort({ firstName: 1 })
        : [];

      const withBatches = students.map((s) => ({
        ...s.toObject(),
        batches: batchLabel ? [batchLabel] : [],
      }));

      return res.json({ success: true, data: withBatches });
    }

    // All students across real batches
    const batchStudentMap = await buildBatchStudentMap(myRealBatchIds);
    const studentBatchesMap = {};

    myRealBatches.forEach((b) => {
      (batchStudentMap[String(b._id)] || new Set()).forEach((sid) => {
        if (!studentBatchesMap[sid]) studentBatchesMap[sid] = [];
        studentBatchesMap[sid].push({
          _id: b._id, title: b.title, dayOfWeek: b.dayOfWeek,
          startTime: b.startTime, endTime: b.endTime,
        });
      });
    });

    // All students across virtual programs
    const allStudentIds = new Set(Object.keys(studentBatchesMap));
    for (const prog of virtualPrograms) {
      const progStudentIds = await getStudentIdsForProgram(prog._id);
      progStudentIds.forEach((sid) => {
        allStudentIds.add(sid);
        if (!studentBatchesMap[sid]) studentBatchesMap[sid] = [];
        // Avoid duplicate program entries
        const alreadyHas = studentBatchesMap[sid].some((b) => String(b._id) === `prog:${prog._id}`);
        if (!alreadyHas) {
          studentBatchesMap[sid].push({
            _id: `prog:${prog._id}`,
            title: prog.title,
            dayOfWeek: 'MULTI',
            startTime: '', endTime: '',
          });
        }
      });
    }

    const allValidIds = Array.from(allStudentIds).filter(isValidObjectId);
    const students = allValidIds.length > 0
      ? await Student.find({ _id: { $in: allValidIds }, isActive: { $ne: false } })
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
    const { Batch, Student, Program } = getModels();
    const coachId   = req.coach._id;
    const studentId = req.params.studentId;

    const myRealBatches = await Batch.find({ coach: coachId })
      .select('_id title dayOfWeek startTime endTime');
    const myRealBatchIds = myRealBatches.map((b) => b._id);

    const batchStudentMap = await buildBatchStudentMap(myRealBatchIds);

    const matchingRealBatches = myRealBatches.filter((b) =>
      (batchStudentMap[String(b._id)] || new Set()).has(studentId)
    );

    // Check virtual programs too
    const myPrograms = await Program.find({ coachId, isActive: true })
      .select('_id title scheduleDays');

    const matchingVirtualBatches = [];
    for (const prog of myPrograms) {
      const progStudentIds = await getStudentIdsForProgram(prog._id);
      if (progStudentIds.has(studentId)) {
        matchingVirtualBatches.push({
          _id: `prog:${prog._id}`,
          title: prog.title,
          dayOfWeek: 'MULTI',
          startTime: '', endTime: '',
        });
      }
    }

    const allMatchingBatches = [
      ...matchingRealBatches.map((b) => ({ _id: b._id, title: b.title, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
      ...matchingVirtualBatches,
    ];

    if (!allMatchingBatches.length)
      return res.status(403).json({ success: false, message: 'This student is not assigned to you' });

    const student = await Student.findById(studentId)
      .populate('parentId', 'firstName lastName phone email');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    res.json({
      success: true,
      data: { ...student.toObject(), batches: allMatchingBatches },
    });
  } catch (e) {
    console.error('getStudentDetail error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Helper: assert student is in coach's batch ─────────────────
async function assertStudentBelongsToCoach(studentId, batchId, coachId) {
  const { Batch, Program } = getModels();

  if (isVirtualBatchId(batchId)) {
    const parts = batchId.split(':');
    const programId = parts[1];
    const program = await Program.findOne({ _id: programId, coachId });
    if (!program) return { ok: false, message: 'Program not found or not assigned to you' };

    const studentIds = await getStudentIdsForProgram(programId);
    if (!studentIds.has(String(studentId)))
      return { ok: false, message: 'Student not found in this program' };

    // Return a batch-like object so downstream code can access batch.program
    return {
      ok: true,
      batch: {
        _id:     batchId,
        program: program._id,
        _isVirtual: true,
      },
    };
  }

  // Real batch
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

    // For virtual batches use programId as batchId in attendance (null real batchId)
    const realBatchId  = isVirtualBatchId(batchId) ? null : batchId;
    const realProgramId = isVirtualBatchId(batchId)
      ? batchId.split(':')[1]
      : check.batch.program;

    const existing = await Attendance.findOne({
      studentId: student._id,
      ...(realBatchId ? { batchId: realBatchId } : { programId: realProgramId }),
      date: today,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `${student.firstName} ${student.lastName} was already marked present today.`,
        data: existing,
      });
    }

    const attendance = await Attendance.create({
      studentId: student._id,
      batchId:   realBatchId || undefined,
      programId: realProgramId || undefined,
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
    const { Attendance, Batch, Program } = getModels();
    const { batchId } = req.query;
    if (!batchId) return res.status(400).json({ success: false, message: 'batchId is required' });

    const date = req.query.date
      ? startOfDayCalifornia(new Date(req.query.date))
      : startOfTodayCalifornia();

    if (isVirtualBatchId(batchId)) {
      const programId = batchId.split(':')[1];
      const program = await Program.findOne({ _id: programId, coachId: req.coach._id });
      if (!program)
        return res.status(404).json({ success: false, message: 'Program not found or not assigned to you' });

      const records = await Attendance.find({ programId, date })
        .populate('studentId', 'firstName lastName studentCode photoUrl')
        .sort({ createdAt: -1 });

      return res.json({ success: true, data: records });
    }

    // Real batch
    const batch = await Batch.findOne({ _id: batchId, coach: req.coach._id });
    if (!batch)
      return res.status(404).json({ success: false, message: 'Batch not found or not assigned to you' });

    const records = await Attendance.find({ batchId, date })
      .populate('studentId', 'firstName lastName studentCode photoUrl')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: records });
  } catch (e) {
    console.error('getAttendance error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};