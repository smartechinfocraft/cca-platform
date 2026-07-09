// ============================================================
//  controllers/registrationController.js
//  View, update status, add notes — Normal Admin
// ============================================================
const mongoose = require('mongoose');
const { logCheckApproval, logCheckRejection, logRefund } = require('../utils/paymentLogger');

const getReg = () => mongoose.model('Registration');

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
        .populate('programId', 'title sku')
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
      .populate('programId', 'title sku basePrice')
      .populate('students', 'firstName lastName studentCode dob gender photoUrl')
      .populate({
        path: 'batches',
        select: 'title dayOfWeek multiDays startTime endTime location coach monthOptions groundLocationNote sessionsPerWeek startDate endDate price pricePerSession',
        populate: { path: 'location', select: 'title city address' },
      })
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

    const update = { status, updatedBy: req.user._id };
    if (adminNote !== undefined) update.adminNote = adminNote;

    const reg = await getReg().findByIdAndUpdate(req.params.id, update, { new: true });
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

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
    const { batches, students, adminNote } = req.body;
    const Batch = mongoose.model('Batch');
    const Parent = mongoose.model('Parent');

    const reg = await getReg().findById(req.params.id).populate('programId', 'title');
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    const changes = [];

    // ── Batch reassignment ──
    if (Array.isArray(batches)) {
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

    await reg.save();

    // ── Auto-email the parent with exactly what changed ──
    let emailSent = false;
    try {
      const parent = await Parent.findById(reg.parentId).select('firstName lastName email');
      if (parent?.email) {
        const { sendRegistrationUpdateEmail } = require('../services/emailService');
        const studentName = reg.students?.[0]
          ? `${reg.students[0].firstName} ${reg.students[0].lastName}`
          : 'your child';
        await sendRegistrationUpdateEmail({
          to: parent.email,
          parentName: `${parent.firstName} ${parent.lastName}`,
          registrationNumber: reg.registrationNumber,
          studentName,
          programName: reg.programId?.title || 'CCA Program',
          changes,
        });
        emailSent = true;
      }
    } catch (emailErr) {
      console.error('Failed to send registration-update email:', emailErr.message);
    }

    res.json({ success: true, message: 'Registration updated.', data: reg, changes, emailSent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/registrations/:id/confirm-check ──────────────────────────────
// Admin-only (see routes/index.js). Moves a CHECK payment from
// SUBMITTED/UNDER_REVIEW to APPROVED. Checks are NEVER auto-approved —
// this is the only code path that can mark one SUCCESS.
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
