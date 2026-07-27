// ============================================================
//  controllers/registrationController.js
//  View, update status, add notes — Normal Admin
// ============================================================
const mongoose = require('mongoose');
const { logCheckApproval, logCheckRejection, logRefund } = require('../utils/paymentLogger');

const getReg = () => mongoose.model('Registration');
const DAY_FULL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};
const formatScheduleTime = value => {
  if (!value) return '';
  const match = String(value).match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return String(value);
  if (match[3]) return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
};
const formatScheduleEntry = item => [
  DAY_FULL[item?.day] || item?.day,
  formatScheduleTime(item?.startTime),
  formatScheduleTime(item?.endTime),
  item?.groundAddress,
].filter(Boolean).join(' - ');

// ─── GET /api/registrations ───────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.program) filter.programId = req.query.program;
    if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 500;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      getReg().find(filter)
        .populate({
          path: 'programId',
          select: 'title sku category location ageGroups skillLevels batchType cities',
          populate: [
            { path: 'category', select: 'title slug' },
            { path: 'location', select: 'title city address' },
          ],
        })
        .populate('parentId', 'firstName lastName email phone')
        // Populate students from the Student collection (handles both ref & embedded _id cases)
        .populate('students', 'firstName lastName studentCode dob gender photoUrl')
        // Populate batches with ALL fields + nested location
        .populate({
          path: 'batches',
          select: 'title dayOfWeek multiDays startTime endTime location coach monthOptions groundLocationNote sessionsPerWeek startDate endDate price pricePerSession',
          populate: { path: 'location', select: 'title city address' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      getReg().countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/registrations/:id ──────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const reg = await getReg().findById(req.params.id)
      .populate({
        path: 'programId',
        select: 'title sku basePrice category location ageGroups skillLevels batchType cities',
        populate: [
          { path: 'category', select: 'title slug' },
          { path: 'location', select: 'title city address' },
        ],
      })
      .populate('students', 'firstName lastName studentCode dob gender photoUrl')
      .populate({
        path: 'batches',
        select: 'title dayOfWeek multiDays startTime endTime location coach monthOptions groundLocationNote sessionsPerWeek startDate endDate price pricePerSession',
        populate: { path: 'location', select: 'title city address' },
      })
      .populate('editAuditLog.performedBy', 'firstName lastName username role')
      .populate('editAuditLog.notificationSentBy', 'firstName lastName username role')
      .lean();

    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/registrations/:id/status ─────────────────────────────────────
// Change registration status + optional admin note
exports.updateStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    const validStatuses = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'WAITLISTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const reg = await getReg().findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    const changes = [];
    if (reg.status !== status) changes.push({ field: 'Status', from: reg.status, to: status });
    if (adminNote !== undefined && String(reg.adminNote || '') !== String(adminNote || '')) {
      changes.push({ field: 'Admin Note', from: reg.adminNote || '—', to: adminNote || '—' });
    }
    reg.status = status;
    if (adminNote !== undefined) reg.adminNote = adminNote;
    reg.updatedBy = req.user._id;
    if (changes.length) {
      reg.editAuditLog.push({
        action: 'STATUS_EDITED',
        changes,
        performedBy: req.user._id,
        performedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
        performedByRole: req.user.role,
      });
    }
    await reg.save();

    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/registrations/:id/whatsapp ───────────────────────────────────
// Toggle WhatsApp joined status
exports.toggleWhatsapp = async (req, res) => {
  try {
    const reg = await getReg().findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Not found' });

    reg.isWhatsappJoined = !reg.isWhatsappJoined;
    await reg.save();
    res.json({ success: true, data: { isWhatsappJoined: reg.isWhatsappJoined } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/registrations/:id/edit ───────────────────────────────────────
exports.superAdminEdit = async (req, res) => {
  try {
    const { batches, students, adminNote, orderSelection } = req.body;
    const Batch = mongoose.model('Batch');
    const Program = mongoose.model('Program');

    const reg = await getReg().findById(req.params.id).populate('programId', 'title');
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    const changes = [];

    // Program/month/schedule correction. This changes only the registration
    // snapshot; it never retries, captures, refunds, or changes the payment.
    if (orderSelection) {
      const program = await Program.findById(orderSelection.programId)
        .select('title scheduleDays monthOptions sessionsPerWeek').lean();
      if (!program) {
        return res.status(400).json({ success: false, message: 'Selected program was not found.' });
      }

      const requestedMonth = orderSelection.selectedMonth;
      const enabledMonths = (program.monthOptions || []).filter(option => option.isEnabled !== false);
      let selectedMonth = null;
      if (enabledMonths.length) {
        selectedMonth = enabledMonths.find(option =>
          String(option._id || '') === String(requestedMonth?._id || '') ||
          (option.label && option.label === requestedMonth?.label)
        );
        if (!selectedMonth) {
          return res.status(400).json({ success: false, message: 'Select a valid enabled month option.' });
        }
      }

      const requestedDays = Array.isArray(orderSelection.scheduleDays) ? orderSelection.scheduleDays : [];
      const programDays = program.scheduleDays || [];
      const scheduleKey = item => [
        item?.day || '', item?.startTime || '', item?.endTime || '', item?.groundAddress || '',
      ].join('|');
      const allowedDays = new Map(programDays.map(item => [scheduleKey(item), item]));
      const selectedDays = requestedDays.map(item => allowedDays.get(scheduleKey(item))).filter(Boolean);
      const sessionsPerWeek = Number(orderSelection.sessionsPerWeek) || selectedDays.length;
      if (programDays.length && (
        selectedDays.length !== requestedDays.length ||
        selectedDays.length !== sessionsPerWeek ||
        sessionsPerWeek < 1
      )) {
        return res.status(400).json({ success: false, message: 'Select a valid number of schedule days for this program.' });
      }

      let selectedBatch = null;
      if (orderSelection.batchId && String(orderSelection.batchId) !== String(program._id)) {
        selectedBatch = await Batch.findOne({ _id: orderSelection.batchId, program: program._id })
          .select('title dayOfWeek startTime endTime').lean();
        if (!selectedBatch) {
          return res.status(400).json({ success: false, message: 'Selected batch does not belong to the selected program.' });
        }
      }

      const oldItem = reg.orderItems?.[0];
      const oldProgram = reg.programId?.title || '—';
      const oldMonth = reg.selectedMonth?.label || oldItem?.selectedMonthLabel || '—';
      const oldSchedule = oldItem?.selectedDays || '—';
      const newMonth = selectedMonth?.label || '—';
      const newSchedule = selectedDays.map(formatScheduleEntry).filter(Boolean).join(' | ') || '—';

      if (oldProgram !== program.title) changes.push({ field: 'Program', from: oldProgram, to: program.title });
      if (oldMonth !== newMonth) changes.push({ field: 'Month', from: oldMonth, to: newMonth });
      if (oldSchedule !== newSchedule) changes.push({ field: 'Schedule', from: oldSchedule, to: newSchedule });
      if (Number(oldItem?.sessionsPerWeek || 0) !== sessionsPerWeek) {
        changes.push({ field: 'Sessions / Week', from: oldItem?.sessionsPerWeek || '—', to: sessionsPerWeek });
      }

      reg.programId = program._id;
      reg.batches = selectedBatch ? [selectedBatch._id] : [];
      reg.selectedMonth = selectedMonth ? {
        label: selectedMonth.label,
        startDate: selectedMonth.startDate,
        endDate: selectedMonth.endDate,
        weeks: selectedMonth.weeks,
        price: selectedMonth.price,
      } : undefined;
      reg.selectedWeeklyBatches = [];

      const batchName = selectedBatch?.title || `Program schedule (${programDays.length || 1} days available)`;
      if (reg.orderItems?.length) {
        reg.orderItems.forEach(item => {
          item.programId = String(program._id);
          item.programTitle = program.title;
          item.batchId = String(selectedBatch?._id || program._id);
          item.batchName = batchName;
          item.selectedMonth = reg.selectedMonth;
          item.selectedMonthLabel = selectedMonth?.label || '';
          item.selectedDays = newSchedule === '—' ? '' : newSchedule;
          item.sessionsPerWeek = sessionsPerWeek;
        });
      }
      reg.markModified('orderItems');
    }

    // ── Batch reassignment ──
    if (!orderSelection && Array.isArray(batches)) {
      const foundBatches = await Batch.find({ _id: { $in: batches } })
        .select('title dayOfWeek startTime endTime').lean();
      if (foundBatches.length !== batches.length) {
        return res.status(400).json({ success: false, message: 'One or more selected batches were not found.' });
      }

      const oldBatchDocs = await Batch.find({ _id: { $in: reg.batches } })
        .select('title dayOfWeek startTime endTime').lean();
      const oldLabel = oldBatchDocs
        .map(b => `${b.title || ''} ${b.dayOfWeek || ''} ${b.startTime || ''}-${b.endTime || ''}`.trim())
        .join(', ') || 'None';
      const newLabel = foundBatches
        .map(b => `${b.title || ''} ${b.dayOfWeek || ''} ${b.startTime || ''}-${b.endTime || ''}`.trim())
        .join(', ') || 'None';

      if (oldLabel !== newLabel) {
        changes.push({ field: 'Batch', from: oldLabel, to: newLabel });
        reg.batches = batches;
      }
    }

    // ── Per-student field corrections (matched by array index) ──
    if (Array.isArray(students)) {
      const Student = mongoose.model('Student');
      for (let i = 0; i < students.length; i++) {
        const incoming = students[i];
        const existing = reg.students[i];
        if (!existing) continue;

        const fieldLabels = {
          firstName: 'First Name',
          lastName: 'Last Name',
          dob: 'Date of Birth',
          gender: 'Gender',
        };

        const studentUpdates = {};
        for (const field of Object.keys(fieldLabels)) {
          if (incoming[field] !== undefined && incoming[field] !== String(existing[field] || '')) {
            changes.push({
              field: `Student ${i + 1} — ${fieldLabels[field]}`,
              from: existing[field] || '—',
              to: incoming[field] || '—',
            });
            studentUpdates[field] = incoming[field];
          }
        }

        if (Object.keys(studentUpdates).length > 0) {
          await Student.findByIdAndUpdate(existing._id || existing, studentUpdates);
        }
      }
    }
    if (adminNote !== undefined) reg.adminNote = adminNote;
    reg.updatedBy = req.user._id;

    if (changes.length === 0) {
      return res.json({ success: true, message: 'No changes detected.', data: reg, emailSent: false });
    }

    reg.editAuditLog.push({
      action: 'ORDER_EDITED',
      changes,
      note: adminNote,
      performedBy: req.user._id,
      performedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      performedByRole: req.user.role,
    });
    await reg.save();

    return res.json({
      success: true,
      message: 'Registration updated. No email was sent.',
      data: reg,
      changes,
      emailSent: false,
      notificationPending: true,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/registrations/:id/confirm-check ──────────────────────────────
// Admin-only (see routes/index.js). Moves a CHECK payment from
// SUBMITTED/UNDER_REVIEW to APPROVED. Checks are NEVER auto-approved —
// this is the only code path that can mark one SUCCESS.
// Explicit Super Admin action. Sends every order-edit audit entry that has
// not already been notified; saving an edit never invokes this function.
exports.sendUpdateEmail = async (req, res) => {
  try {
    const Parent = mongoose.model('Parent');
    const reg = await getReg().findById(req.params.id)
      .populate('programId', 'title')
      .populate('students', 'firstName lastName');
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    const pendingEntries = (reg.editAuditLog || []).filter(entry =>
      entry.action === 'ORDER_EDITED' && !entry.notificationSentAt
    );
    if (!pendingEntries.length) {
      return res.status(400).json({ success: false, message: 'There are no unsent order changes.' });
    }

    const parent = await Parent.findById(reg.parentId).select('firstName lastName email');
    if (!parent?.email) {
      return res.status(400).json({ success: false, message: 'The customer does not have an email address.' });
    }

    const changes = pendingEntries.flatMap(entry =>
      (entry.changes || []).map(change => ({
        field: change.field,
        from: change.from,
        to: change.to,
      }))
    );
    const student = reg.students?.[0];
    const { sendRegistrationUpdateEmail } = require('../services/emailService');
    await sendRegistrationUpdateEmail({
      to: parent.email,
      parentName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Parent',
      registrationNumber: reg.registrationNumber,
      studentName: student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : 'your child',
      programName: reg.programId?.title || 'CCA Program',
      changes,
    });

    const sentAt = new Date();
    pendingEntries.forEach(entry => {
      entry.notificationSentAt = sentAt;
      entry.notificationSentBy = req.user._id;
    });
    reg.editAuditLog.push({
      action: 'UPDATE_EMAIL_SENT',
      changes: [],
      note: `Customer and admin copies sent for ${pendingEntries.length} edit event(s).`,
      performedBy: req.user._id,
      performedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      performedByRole: req.user.role,
      at: sentAt,
    });
    reg.updatedBy = req.user._id;
    await reg.save();

    res.json({
      success: true,
      message: 'Update email sent to the customer and configured admin recipients.',
      sentAt,
      changeCount: changes.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.confirmCheck = async (req, res) => {
  try {
    const reg = await getReg().findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    if (reg.paymentMethod !== 'CHECK') {
      return res.status(400).json({ success: false, message: 'This registration was not paid by check.' });
    }

    if (reg.checkPaymentState === 'APPROVED' && reg.paymentStatus === 'SUCCESS') {
      return res.status(409).json({ success: false, message: 'Check already confirmed.' });
    }
    if (reg.checkPaymentState === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'This check was already rejected. Reverse the rejection before approving.' });
    }

    reg.paymentStatus = 'SUCCESS';
    reg.checkPaymentState = 'APPROVED';
    reg.status = 'CONFIRMED';
    reg.adminNote = reg.adminNote
      ? reg.adminNote + `\n[Check confirmed by admin on ${new Date().toLocaleString()}]`
      : `Check confirmed by admin on ${new Date().toLocaleString()}`;
    reg.updatedBy = req.user._id;
    reg.paymentAuditLog.push({ event: 'CHECK_APPROVED', performedBy: req.user._id, note: req.body?.note });

    await reg.save();
    logCheckApproval({ registrationId: reg._id.toString(), registrationNumber: reg.registrationNumber, admin: req.user._id.toString() });

    res.json({ success: true, message: 'Check confirmed. Registration marked as CONFIRMED.', data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not confirm this check payment.' });
  }
};

// ─── PATCH /api/registrations/:id/reject-check ───────────────────────────────
// Admin-only. Moves a CHECK payment to REJECTED — the counterpart to
// confirm-check. Also required so a bounced/invalid check can't linger
// as an indefinite PENDING registration.
exports.rejectCheck = async (req, res) => {
  try {
    const { reason } = req.body;
    const reg = await getReg().findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    if (reg.paymentMethod !== 'CHECK') {
      return res.status(400).json({ success: false, message: 'This registration was not paid by check.' });
    }
    if (reg.checkPaymentState === 'APPROVED' && reg.paymentStatus === 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'This check was already approved. Use the refund flow instead.' });
    }

    reg.paymentStatus = 'FAILED';
    reg.checkPaymentState = 'REJECTED';
    reg.status = 'CANCELLED';
    reg.adminNote = reg.adminNote
      ? reg.adminNote + `\n[Check rejected by admin on ${new Date().toLocaleString()}${reason ? `: ${reason}` : ''}]`
      : `Check rejected by admin on ${new Date().toLocaleString()}${reason ? `: ${reason}` : ''}`;
    reg.updatedBy = req.user._id;
    reg.paymentAuditLog.push({ event: 'CHECK_REJECTED', performedBy: req.user._id, note: reason });

    await reg.save();
    logCheckRejection({ registrationId: reg._id.toString(), registrationNumber: reg.registrationNumber, admin: req.user._id.toString(), reason });

    res.json({ success: true, message: 'Check rejected.', data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not reject this check payment.' });
  }
};

// ─── POST /api/registrations/:id/refund ──────────────────────────────────────
// Super Admin only (see routes/index.js). Refunds a SUCCESSFUL Stripe or
// PayPal payment. Never available for CHECK (no gateway to call — reverse
// those via reject-check / manual reconciliation) and never allows a
// second refund of the same registration.
exports.refundPayment = async (req, res) => {
  try {
    const reg = await getReg().findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    if (reg.paymentStatus !== 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'Only a successfully paid registration can be refunded.' });
    }
    if (reg.refundStatus === 'REFUNDED') {
      return res.status(409).json({ success: false, message: 'This registration has already been refunded.' });
    }
    if (!['STRIPE', 'PAYPAL'].includes(reg.paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Only Stripe or PayPal payments can be refunded here.' });
    }
    if (!reg.transactionId) {
      return res.status(400).json({ success: false, message: 'No transaction is on file for this registration.' });
    }

    let refundReference;
    if (reg.paymentMethod === 'STRIPE') {
      const { refundPaymentIntent } = require('../services/stripeService');
      const refund = await refundPaymentIntent(reg.transactionId);
      refundReference = refund.id;
    } else {
      const { refundCapture } = require('../services/paypalService');
      const refund = await refundCapture(reg.transactionId);
      if (refund.statusCode >= 400) {
        return res.status(502).json({ success: false, message: 'PayPal declined this refund. Please try again or refund manually in the PayPal dashboard.' });
      }
      refundReference = refund.id;
    }

    reg.paymentStatus = 'REFUNDED';
    reg.refundStatus = 'REFUNDED';
    reg.refundReference = refundReference;
    reg.refundAmount = reg.totalAmount;
    reg.refundedBy = req.user._id;
    reg.refundedAt = new Date();
    reg.status = 'REFUNDED';
    reg.paymentAuditLog.push({ event: 'REFUND_ISSUED', performedBy: req.user._id, note: refundReference });
    await reg.save();

    logRefund({
      registrationId: reg._id.toString(),
      registrationNumber: reg.registrationNumber,
      paymentMethod: reg.paymentMethod,
      admin: req.user._id.toString(),
      refundReference,
    });

    res.json({ success: true, message: 'Refund issued.', data: reg });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(err.status || 500).json({ success: false, message: 'Could not process this refund.' });
  }
};
