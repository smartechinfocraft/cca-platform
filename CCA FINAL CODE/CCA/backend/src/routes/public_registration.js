// ============================================================
//  Public Registration + Auth Endpoints
//  /api/public/*
// ============================================================
const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { sendRegistrationEmail } = require('../services/emailService');
const { createOrder, captureOrder, getCaptureDetails } = require('../services/paypalService');
const { uploadStudentPhoto, fileUrl } = require('../middleware/upload');
const { computeRegistrationTotal, round2 } = require('../utils/pricing');

// ── Parent Auth Middleware ────────────────────────────────────
function parentAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    req.parent = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// ── POST /api/public/auth/register ───────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { firstName, lastName, email, phone, password, address, city, state, zip } = req.body;

    if (!firstName || !lastName || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });

    const exists = await Parent.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });

    const parent = new Parent({ firstName, lastName, email, phone, password, address, city, state, zip });
    await parent.save();

    const token = jwt.sign(
      { id: parent._id, email: parent.email, type: 'parent' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      parent: { id: parent._id, firstName, lastName, email, phone },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/auth/login ──────────────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required.' });

    const parent = await Parent.findOne({ email: email.toLowerCase() }).select('+password');
    if (!parent || !(await parent.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = jwt.sign(
      { id: parent._id, email: parent.email, type: 'parent' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      parent: { id: parent._id, firstName: parent.firstName, lastName: parent.lastName, email: parent.email, phone: parent.phone },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/auth/me ───────────────────────────────────
router.get('/auth/me', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);
    if (!parent) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/validate-coupon ─────────────────────────
// Validate a coupon code and preview the discount — does NOT
// consume the coupon. The coupon is only decremented when the
// registration is actually saved (in POST /register below).
router.post('/validate-coupon', async (req, res) => {
  try {
    const { couponCode, programId, batchId, studentCount, sessionsPerWeek } = req.body;

    if (!couponCode || !programId)
      return res.status(400).json({ success: false, message: 'couponCode and programId are required.' });

    // computeRegistrationTotal will throw a descriptive error if the
    // coupon is invalid, expired, over-limit, or below minimum amount.
    const priced = await computeRegistrationTotal({
      programId,
      batchId,
      studentCount: studentCount || 1,
      sessionsPerWeek,
      couponCode: couponCode.trim().toUpperCase(),
    });

    res.json({
      success: true,
      message: `Coupon applied! You save $${priced.discount.toFixed(2)}.`,
      subtotal:  priced.subtotal,
      discount:  priced.discount,
      total:     priced.total,
      coupon: {
        code:        priced.coupon.code,
        type:        priced.coupon.type,
        value:       priced.coupon.value,
        description: priced.coupon.description || '',
        // Show remaining uses only if a limit exists
        usedCount:   priced.coupon.usedCount,
        maxUses:     priced.coupon.maxUses,
      },
    });
  } catch (err) {
    console.error('Validate coupon error:', err);
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/paypal/create-order ─────────────────────
// SECURITY: amount is NEVER taken from the request body. It is
// always recomputed from the Program/Batch stored in the database,
// so a tampered client request cannot create a PayPal order for
// less than the real price (or for $0).
router.post('/paypal/create-order', async (req, res) => {
  try {
    const { programId, batchId, studentCount, sessionsPerWeek, couponCode } = req.body;

    if (!programId)
      return res.status(400).json({ success: false, message: 'programId is required.' });

    const priced = await computeRegistrationTotal({
      programId,
      batchId,
      studentCount,
      sessionsPerWeek,
      couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
    });

    if (!priced.total || priced.total <= 0)
      return res.status(400).json({ success: false, message: 'This program has no payable price configured.' });

    const order = await createOrder(priced.total, priced.currency);
    if (!order.id)
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order.', detail: order });

    res.json({
      success:  true,
      orderID:  order.id,
      amount:   priced.total,
      discount: priced.discount,
      currency: priced.currency,
    });
  } catch (err) {
    console.error('PayPal create order error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/paypal/capture-order ────────────────────
router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { orderID, programId, batchId, studentCount, sessionsPerWeek, couponCode } = req.body;
    if (!orderID)
      return res.status(400).json({ success: false, message: 'orderID required.' });

    const capture = await captureOrder(orderID);
    if (capture.status !== 'COMPLETED')
      return res.status(400).json({ success: false, message: 'Payment not completed.', detail: capture });

    const txnId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const capturedValue = parseFloat(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );

    if (programId) {
      const priced = await computeRegistrationTotal({
        programId, batchId, studentCount, sessionsPerWeek,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
      });
      if (Math.abs(capturedValue - priced.total) > 0.01) {
        console.error(
          `PayPal capture amount mismatch: captured $${capturedValue}, expected $${priced.total} for program ${programId}`
        );
        return res.status(400).json({
          success: false,
          message: 'Payment amount does not match the program price. This transaction will not be honored.',
        });
      }
    }

    res.json({ success: true, transactionId: txnId, capturedAmount: capturedValue, capture });
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/donate/create-order ──────────────────────
// Donations are donor-chosen amounts, so — unlike program payments
// above — there's no Program/Batch price to recompute the amount
// from. We still guard against bad input: amount must be a finite
// number, at least $1, and capped at $100,000 per transaction.
router.post('/donate/create-order', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);

    if (!Number.isFinite(amount) || amount < 1 || amount > 100000)
      return res.status(400).json({ success: false, message: 'Enter a valid donation amount between $1 and $100,000.' });

    const rounded = round2(amount);
    const order = await createOrder(rounded, 'USD');
    if (!order.id)
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order.', detail: order });

    res.json({ success: true, orderID: order.id, amount: rounded, currency: 'USD' });
  } catch (err) {
    console.error('PayPal donation create-order error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/donate/capture-order ─────────────────────
router.post('/donate/capture-order', async (req, res) => {
  try {
    const { orderID, donor } = req.body;
    if (!orderID)
      return res.status(400).json({ success: false, message: 'orderID required.' });

    const capture = await captureOrder(orderID);
    if (capture.status !== 'COMPLETED')
      return res.status(400).json({ success: false, message: 'Payment not completed.', detail: capture });

    const txnId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const capturedValue = parseFloat(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );

    console.log(`Donation captured: $${capturedValue} — txn ${txnId}${donor?.email ? ` — ${donor.email}` : ''}`);

    res.json({ success: true, transactionId: txnId, capturedAmount: capturedValue });
  } catch (err) {
    console.error('PayPal donation capture error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      selectedProgram, selectedBatch, students,
      parent: parentInfo, parentId,
      paymentMethod,
      transactionId, checkNumber,
      sessionsPerWeek,
      couponCode,   // NEW — optional coupon applied at checkout
    } = req.body;

    if (!selectedProgram?._id)
      return res.status(400).json({ success: false, message: 'Program is required.' });

    const studentInputs = Array.isArray(students) && students.length
      ? students
      : (req.body.student ? [req.body.student] : []);

    if (!studentInputs.length)
      return res.status(400).json({ success: false, message: 'At least one student is required.' });

    const studentName = `${studentInputs[0].firstName} ${studentInputs[0].lastName}`;

    if (!parentInfo?.email)
      return res.status(400).json({ success: false, message: 'Parent email is required.' });

    // ── SECURITY: server-computed price, coupon also re-validated here ──
    const batchIdForPricing = selectedBatch?._id;
    const priced = await computeRegistrationTotal({
      programId:    selectedProgram._id,
      batchId:      batchIdForPricing,
      studentCount: studentInputs.length,
      sessionsPerWeek,
      couponCode:   couponCode ? couponCode.trim().toUpperCase() : undefined,
    });

    const Registration = mongoose.model('Registration');
    const Student = require('../models/Student');

    // Resolve or create parent ref
    const Parent = require('../models/Parent');
    let resolvedParentId;
    if (parentId) {
      resolvedParentId = parentId;
    } else {
      let parent = await Parent.findOne({ email: parentInfo.email.toLowerCase() });
      if (!parent) {
        const crypto = require('crypto');
        parent = new Parent({
          firstName: parentInfo.parentName?.split(' ')[0] || 'Guest',
          lastName:  parentInfo.parentName?.split(' ').slice(1).join(' ') || 'User',
          email:     parentInfo.email,
          phone:     parentInfo.phone || '000-000-0000',
          password:  crypto.randomBytes(16).toString('hex'),
          address:   parentInfo.address,
          city:      parentInfo.city,
          state:     parentInfo.state,
          zip:       parentInfo.zip,
        });
        await parent.save();
      }
      resolvedParentId = parent._id;
    }

    const studentIds = [];
    for (const s of studentInputs) {
      if (!s?.firstName || !s?.lastName) continue;
      const dobDate = s.dob ? new Date(s.dob) : undefined;
      const query = {
        parentId: resolvedParentId,
        firstName: new RegExp(`^${s.firstName.trim()}$`, 'i'),
        lastName:  new RegExp(`^${s.lastName.trim()}$`, 'i'),
      };
      if (dobDate && !isNaN(dobDate)) query.dob = dobDate;

      let studentDoc = await Student.findOne(query);
      if (!studentDoc) {
        studentDoc = new Student({
          parentId:    resolvedParentId,
          firstName:   s.firstName.trim(),
          lastName:    s.lastName.trim(),
          dob:         dobDate && !isNaN(dobDate) ? dobDate : undefined,
          gender:      s.gender || '',
          schoolName:  s.schoolName || '',
          medicalNotes: s.medicalNotes || '',
        });
        await studentDoc.save();
      } else {
        if (s.schoolName)    studentDoc.schoolName    = s.schoolName;
        if (s.medicalNotes)  studentDoc.medicalNotes  = s.medicalNotes;
        if (s.gender)        studentDoc.gender        = s.gender;
        await studentDoc.save();
      }
      studentIds.push(studentDoc._id);
    }

    const pmMethod = paymentMethod === 'PayPal' ? 'PAYPAL'
      : paymentMethod === 'Check' ? 'CHECK' : 'PENDING';

    let pmStatus = 'PENDING';
    let verificationNote = '';
    if (paymentMethod === 'PayPal' && transactionId) {
      try {
        const captureDetails = await getCaptureDetails(transactionId);
        const capturedValue = parseFloat(captureDetails?.amount?.value || '0');
        const isCompleted   = captureDetails?.status === 'COMPLETED';
        const amountMatches = Math.abs(capturedValue - priced.total) <= 0.01;

        if (isCompleted && amountMatches) {
          pmStatus = 'SUCCESS';
        } else {
          verificationNote = `PayPal verification failed (status=${captureDetails?.status}, captured=$${capturedValue}, expected=$${priced.total}). Registration held as PENDING for staff review.`;
          console.error(verificationNote, '— transactionId:', transactionId);
        }
      } catch (verifyErr) {
        verificationNote = `Could not verify PayPal transaction ${transactionId} with PayPal: ${verifyErr.message}. Registration held as PENDING for staff review.`;
        console.error(verificationNote);
      }
    }

    // ── Decrement coupon usedCount AFTER payment is confirmed ──
    // Only do this when the registration has a coupon and the payment
    // was either successful (PayPal) or submitted (Check). This ensures
    // the counter only goes up for real completed/intended registrations.
    if (priced.coupon && (pmStatus === 'SUCCESS' || paymentMethod === 'Check')) {
      const Coupon = mongoose.model('Coupon');
      await Coupon.findByIdAndUpdate(priced.coupon._id, { $inc: { usedCount: 1 } });
    }

    const studentNote = studentInputs
      .map(s => `${s.firstName} ${s.lastName} | DOB: ${s.dob || 'N/A'} | Gender: ${s.gender || 'N/A'}`)
      .join('; ');

    const batchTitle  = selectedBatch?.title || selectedBatch?.name || '';
    const batchIds    = selectedBatch?._id ? [selectedBatch._id] : [];

    const reg = new Registration({
      parentId:      resolvedParentId,
      programId:     selectedProgram._id,
      students:      studentIds,
      batches:       batchIds,
      subtotal:      priced.subtotal,
      totalAmount:   priced.total,
      couponCode:    priced.coupon ? priced.coupon.code : undefined,
      paymentMethod: pmMethod,
      paymentStatus: pmStatus,
      transactionId: transactionId || undefined,
      checkNumber:   checkNumber   || undefined,
      status:        pmStatus === 'SUCCESS' ? 'CONFIRMED' : 'AWAITING_PAYMENT',
      customerNote:  studentNote,
      adminNote:     verificationNote || undefined,
      waiverAccepted: true,
      mediaConsent:   true,
    });

    await reg.save();

    sendRegistrationEmail({
      to:                 parentInfo.email,
      registrationNumber: reg.registrationNumber,
      studentName,
      programName:        selectedProgram.title || 'CCA Program',
      batchInfo:          batchTitle,
      parentName:         parentInfo.parentName || parentInfo.email,
      paymentMethod,
      totalAmount:        priced.total,
      transactionId,
    }).catch(err => console.error('Email send failed:', err));

    return res.status(201).json({
      success: true,
      message: pmStatus === 'SUCCESS'
        ? 'Registration successful!'
        : 'Registration received and is pending payment verification.',
      registrationNumber: reg.registrationNumber,
      studentName,
      programName:    selectedProgram.title,
      paymentMethod,
      paymentStatus:  pmStatus,
      subtotal:       priced.subtotal,
      discount:       priced.discount,
      totalAmount:    priced.total,
      couponCode:     priced.coupon ? priced.coupon.code : undefined,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ============================================================
//  PARENT DASHBOARD API  —  /api/public/parent/*
//  Every route below requires a valid parent JWT (parentAuth) and
//  is always scoped to req.parent.id — a parent can only ever see
//  their own registrations / students / profile / messages.
// ============================================================

const ACTIVE_REG_STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'CONFIRMED', 'WAITLISTED'];

function isValidObjectId(val) {
  return mongoose.Types.ObjectId.isValid(val) && String(val).length === 24;
}

// ── Resolve a registration's embedded `students` sub-docs back to real
//    Student documents.
//    Registration.students is saved as an array of raw Student ObjectIds
//    (see POST /register above), which Mongoose silently casts into
//    { _id: <that ObjectId> } sub-docs with no name data attached —
//    UNLESS a super-admin edit later filled in a studentCode on that
//    sub-doc, in which case we look the student up by code instead.
//    (Same rule used in coachPortalController.js — kept consistent here.)
// ──────────────────────────────────────────────────────────────────
async function resolveRegistrationStudents(registrations) {
  const Student = require('../models/Student');
  const idSet = new Set();
  const codeSet = new Set();

  registrations.forEach((reg) => {
    (reg.students || []).forEach((s) => {
      if (!s) return;
      if (s.studentCode) codeSet.add(String(s.studentCode).trim().toUpperCase());
      else if (s._id && isValidObjectId(s._id)) idSet.add(String(s._id));
    });
  });

  const [byId, byCode] = await Promise.all([
    idSet.size ? Student.find({ _id: { $in: [...idSet] } }) : [],
    codeSet.size ? Student.find({ studentCode: { $in: [...codeSet] } }) : [],
  ]);

  const idMap = {};   byId.forEach((s) => { idMap[String(s._id)] = s; });
  const codeMap = {}; byCode.forEach((s) => { codeMap[String(s.studentCode).toUpperCase()] = s; });

  return registrations.map((reg) => {
    const resolvedStudents = (reg.students || [])
      .map((s) => {
        if (!s) return null;
        if (s.studentCode) return codeMap[String(s.studentCode).toUpperCase()];
        if (s._id) return idMap[String(s._id)];
        return null;
      })
      .filter(Boolean);
    const obj = reg.toObject ? reg.toObject() : reg;
    return { ...obj, students: resolvedStudents };
  });
}

// ── Build { present, absent, late, excused, total, percentage } from a
//    list of Attendance docs ──
function summarizeAttendance(records) {
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: records.length, percentage: null };
  records.forEach((r) => {
    if (r.status === 'PRESENT') summary.present += 1;
    else if (r.status === 'ABSENT') summary.absent += 1;
    else if (r.status === 'LATE') summary.late += 1;
    else if (r.status === 'EXCUSED') summary.excused += 1;
  });
  if (summary.total > 0) {
    summary.percentage = Math.round(((summary.present + summary.late) / summary.total) * 100);
  }
  return summary;
}

// ── GET /api/public/parent/dashboard ──────────────────────────
router.get('/parent/dashboard', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Student = require('../models/Student');
    const Attendance = mongoose.model('Attendance');

    const [registrations, students] = await Promise.all([
      Registration.find({ parentId: req.parent.id })
        .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
        .populate('batches', 'title dayOfWeek startTime endTime')
        .sort({ createdAt: -1 }),
      Student.find({ parentId: req.parent.id }).sort({ createdAt: -1 }),
    ]);

    const resolvedRegs = await resolveRegistrationStudents(registrations);

    const stats = {
      totalPrograms:   registrations.length,
      activePrograms:  registrations.filter((r) => ['CONFIRMED', 'PAID'].includes(r.status)).length,
      totalStudents:   students.length,
      // Include all registrations except cancelled/refunded — Check payments
      // stay PENDING until admin confirms, so filtering only SUCCESS would
      // always show $0 for check-paying families.
      totalSpent:      round2(registrations
                          .filter((r) => !['CANCELLED', 'REFUNDED'].includes(r.status))
                          .reduce((sum, r) => sum + (r.totalAmount || 0), 0)),
      pendingPayments: registrations.filter((r) => r.status === 'AWAITING_PAYMENT' || r.paymentStatus === 'PENDING').length,
    };

    const studentIds = students.map((s) => s._id);
    const recentAttendance = studentIds.length
      ? await Attendance.find({ studentId: { $in: studentIds } })
          .populate('studentId', 'firstName lastName')
          .populate('programId', 'title')
          .sort({ date: -1 })
          .limit(8)
      : [];

    res.json({
      success: true,
      data: {
        stats,
        recentRegistrations: resolvedRegs.slice(0, 5),
        students,
        recentAttendance,
      },
    });
  } catch (err) {
    console.error('Parent dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/purchases ──────────────────────────
router.get('/parent/purchases', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const registrations = await Registration.find({ parentId: req.parent.id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('batches', 'title dayOfWeek startTime endTime')
      .sort({ createdAt: -1 });

    const resolved = await resolveRegistrationStudents(registrations);
    res.json({ success: true, data: resolved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/purchases/:id ──────────────────────
router.get('/parent/purchases/:id', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Parent = require('../models/Parent');

    const reg = await Registration.findOne({ _id: req.params.id, parentId: req.parent.id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('batches', 'title dayOfWeek startTime endTime');

    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    const [resolved] = await resolveRegistrationStudents([reg]);
    const parent = await Parent.findById(req.parent.id);

    res.json({ success: true, data: { registration: resolved, parent } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/students ───────────────────────────
router.get('/parent/students', parentAuth, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const Registration = mongoose.model('Registration');
    const Attendance = mongoose.model('Attendance');

    const students = await Student.find({ parentId: req.parent.id }).sort({ firstName: 1 });
    const registrations = await Registration.find({ parentId: req.parent.id })
      .populate('programId', 'title');
    const resolvedRegs = await resolveRegistrationStudents(registrations);

    const withSummary = await Promise.all(students.map(async (s) => {
      const attendance = await Attendance.find({ studentId: s._id });
      const programs = resolvedRegs
        .filter((r) => r.students.some((st) => String(st._id) === String(s._id)))
        .map((r) => ({
          registrationId:      r._id,
          registrationNumber:  r.registrationNumber,
          status:              r.status,
          programTitle:        r.programId?.title,
        }));
      return { ...s.toObject(), attendanceSummary: summarizeAttendance(attendance), programs };
    }));

    res.json({ success: true, data: withSummary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/students/:studentId ────────────────
router.get('/parent/students/:studentId', parentAuth, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const Registration = mongoose.model('Registration');
    const Attendance = mongoose.model('Attendance');

    const student = await Student.findOne({ _id: req.params.studentId, parentId: req.parent.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const registrations = await Registration.find({ parentId: req.parent.id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('batches', 'title dayOfWeek startTime endTime');
    const resolvedRegs = await resolveRegistrationStudents(registrations);
    const myRegs = resolvedRegs.filter((r) => r.students.some((st) => String(st._id) === String(student._id)));

    const attendance = await Attendance.find({ studentId: student._id })
      .populate('programId', 'title')
      .populate('batchId', 'title dayOfWeek startTime endTime')
      .sort({ date: -1 });

    res.json({
      success: true,
      data: {
        student,
        registrations: myRegs,
        attendance,
        attendanceSummary: summarizeAttendance(attendance),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/parent/students/:studentId/photo ─────────
router.post('/parent/students/:studentId/photo', parentAuth, uploadStudentPhoto, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const student = await Student.findOne({ _id: req.params.studentId, parentId: req.parent.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No photo uploaded' });

    student.photoPath = req.file.path.replace(/\\/g, '/');
    student.photoUrl  = fileUrl(req, req.file.path);
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/profile ────────────────────────────
router.get('/parent/profile', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);
    if (!parent) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/public/parent/profile ────────────────────────────
router.put('/parent/profile', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);
    if (!parent) return res.status(404).json({ success: false, message: 'Not found' });

    const { firstName, lastName, email, phone, address, city, state, zip } = req.body;
    if (email && email.toLowerCase() !== parent.email) {
      const exists = await Parent.findOne({ email: email.toLowerCase(), _id: { $ne: parent._id } });
      if (exists) return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
      parent.email = email.toLowerCase();
    }
    if (firstName !== undefined) parent.firstName = firstName;
    if (lastName  !== undefined) parent.lastName  = lastName;
    if (phone     !== undefined) parent.phone     = phone;
    if (address   !== undefined) parent.address   = address;
    if (city      !== undefined) parent.city      = city;
    if (state     !== undefined) parent.state     = state;
    if (zip       !== undefined) parent.zip       = zip;

    await parent.save();
    res.json({ success: true, data: parent, message: 'Profile updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/public/parent/profile/password ───────────────────
router.put('/parent/profile/password', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    const parent = await Parent.findById(req.parent.id).select('+password');
    if (!parent || !(await parent.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    parent.password = newPassword;
    await parent.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/parent/profile/photo ─────────────────────
router.post('/parent/profile/photo', parentAuth, uploadStudentPhoto, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);
    if (!parent) return res.status(404).json({ success: false, message: 'Not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No photo uploaded' });

    parent.photoPath = req.file.path.replace(/\\/g, '/');
    parent.photoUrl  = fileUrl(req, req.file.path);
    await parent.save();

    res.json({ success: true, data: parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Messaging — parent <-> admin/coach, scoped to a specific batch ──

// GET /api/public/parent/messages/batches
router.get('/parent/messages/batches', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const registrations = await Registration.find({ parentId: req.parent.id, status: { $in: ACTIVE_REG_STATUSES } })
      .populate('programId', 'title')
      .populate('batches', 'title dayOfWeek startTime endTime');
    const resolvedRegs = await resolveRegistrationStudents(registrations);

    const map = {};
    resolvedRegs.forEach((reg) => {
      (reg.batches || []).forEach((b) => {
        if (!b?._id) return;
        const key = String(b._id);
        if (!map[key]) {
          map[key] = {
            _id: b._id,
            title: b.title,
            dayOfWeek: b.dayOfWeek,
            startTime: b.startTime,
            endTime: b.endTime,
            programTitle: reg.programId?.title,
            studentNames: new Set(),
          };
        }
        (reg.students || []).forEach((s) => map[key].studentNames.add(`${s.firstName} ${s.lastName}`));
      });
    });

    const data = Object.values(map).map((b) => ({ ...b, studentNames: [...b.studentNames] }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/public/parent/messages
router.get('/parent/messages', parentAuth, async (req, res) => {
  try {
    const MessageThread = mongoose.model('MessageThread');
    const threads = await MessageThread.find({ parentId: req.parent.id })
      .populate('batchId', 'title dayOfWeek startTime endTime')
      .sort({ lastMessageAt: -1 });
    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/public/parent/messages
router.post('/parent/messages', parentAuth, async (req, res) => {
  try {
    const { batchId, subject, body, studentName } = req.body;
    if (!batchId || !subject?.trim() || !body?.trim())
      return res.status(400).json({ success: false, message: 'batchId, subject and body are required.' });

    // Verify the parent actually has an active registration in this batch —
    // never trust a batchId sent from the client alone.
    const Registration = mongoose.model('Registration');
    const owns = await Registration.exists({
      parentId: req.parent.id,
      batches: batchId,
      status: { $in: ACTIVE_REG_STATUSES },
    });
    if (!owns) return res.status(403).json({ success: false, message: "You don't have a registration in this batch." });

    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);

    const MessageThread = mongoose.model('MessageThread');
    const thread = new MessageThread({
      parentId: req.parent.id,
      batchId,
      subject: subject.trim(),
      studentName,
      messages: [{
        senderRole: 'PARENT',
        senderId: req.parent.id,
        senderName: `${parent.firstName} ${parent.lastName}`,
        body: body.trim(),
        readByParent: true,
      }],
      lastMessageAt: new Date(),
    });
    await thread.save();

    res.status(201).json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/public/parent/messages/:threadId/reply
router.post('/parent/messages/:threadId/reply', parentAuth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, message: 'Message body is required.' });

    const MessageThread = mongoose.model('MessageThread');
    const thread = await MessageThread.findOne({ _id: req.params.threadId, parentId: req.parent.id });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);

    thread.messages.push({
      senderRole: 'PARENT',
      senderId: req.parent.id,
      senderName: `${parent.firstName} ${parent.lastName}`,
      body: body.trim(),
      readByParent: true,
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;