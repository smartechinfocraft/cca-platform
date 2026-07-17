// ============================================================
//  controllers/batchController.js
//  Normal Admin manages batches: days, time, price, capacity
// ============================================================
const mongoose = require('mongoose');
const { pickAllowedFields } = require('../utils/allowlist');

const getBatch = () => mongoose.model('Batch');

const isTruthyFlag = (value) => value === true || value === 'true' || value === 1 || value === '1';
const isDisabledFlag = (value) => value === false || value === 'false' || value === 0 || value === '0';

const normalizeMonthOptions = (monthOptions) => (
  Array.isArray(monthOptions)
    ? monthOptions.map((m) => ({
        ...m,
        isEnabled: !isDisabledFlag(m.isEnabled),
        showInStartMonthOnly: isTruthyFlag(m.showInStartMonthOnly),
      }))
    : []
);

// ── Payload Allowlisting ─────────────────────────────────────
// Only these fields may ever be written to a Batch document from
// a request body. Notably excluded: currentCapacity (auto-derived
// from real registrations, never client-settable), createdBy
// (server-assigned from the authenticated admin), and any Mongo
// internal fields (_id, __v, timestamps).
const BATCH_ALLOWED_FIELDS = [
  'program', 'location', 'coach',
  'title', 'dayOfWeek', 'startTime', 'endTime', 'groundLocationNote',
  'maxCapacity', 'startDate', 'endDate',
  'price', 'pricePerSession', 'monthOptions',
  'multiDays', 'sessionsPerWeek', 'timeSlots', 'isActive',
];

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.program) filter.program = req.query.program;
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';

    const batches = await getBatch().find(filter)
      .populate('program',  'title sku')
      .populate('location', 'title city')
      .populate('coach',    'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: batches.length, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const batch = await getBatch().findById(req.params.id)
      .populate('program',  'title sku basePrice')
      .populate('location', 'title address city')
      .populate('coach',    'firstName lastName email');

    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, data: batch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = pickAllowedFields(req.body, BATCH_ALLOWED_FIELDS);
    if (Array.isArray(payload.monthOptions)) payload.monthOptions = normalizeMonthOptions(payload.monthOptions);
    const batch = await getBatch().create({ ...payload, createdBy: req.user._id });
    res.status(201).json({ success: true, data: batch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const payload = pickAllowedFields(req.body, BATCH_ALLOWED_FIELDS);
    if (Array.isArray(payload.monthOptions)) payload.monthOptions = normalizeMonthOptions(payload.monthOptions);
    const batch = await getBatch().findByIdAndUpdate(req.params.id, payload, {
      new: true, runValidators: true,
    });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, data: batch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await getBatch().findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Batch deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PERMANENT delete — only allowed when nothing real-world references this
// batch. A batch with registrations or attendance history must never be
// hard-deleted: that would silently sever a parent's record of what their
// child registered for, and a coach's attendance history, with no trace
// left behind. Use the soft-delete (remove, above) for batches that have
// ever been used; hardRemove is for cleaning up batches created by mistake
// and never actually used.
exports.hardRemove = async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Attendance = mongoose.model('Attendance');

    const [regCount, attCount] = await Promise.all([
      Registration.countDocuments({ batches: req.params.id }),
      Attendance.countDocuments({ batchId: req.params.id }),
    ]);

    if (regCount > 0 || attCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot permanently delete this batch — it has ${regCount} registration(s) and ${attCount} attendance record(s) attached. Deactivate it instead to hide it from new registrations while keeping history intact.`,
      });
    }

    const batch = await getBatch().findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    res.json({ success: true, message: 'Batch permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
