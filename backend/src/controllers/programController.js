// ============================================================
//  controllers/programController.js
//  CRUD for Programs — Super Admin only
//  REPLACE: backend/src/controllers/programController.js
//  Added: cities, scheduleDays, monthOptions, coachId, sessionsPerWeek
// ============================================================
const mongoose = require('mongoose');
const Program  = require('../models/Program');
const { fileUrl } = require('../middleware/upload');
const { pickAllowedFields } = require('../utils/allowlist');
const fs = require('fs');
const path = require('path');

const toSlug = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const toSKU = (category, title) => {
  const parts = [category, title].join('-').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return `CCA-${parts}`.substring(0, 60);
};

const isDisabledFlag = (value) => value === false || value === 'false' || value === 0 || value === '0';

const normalizeMonthOptions = (monthOptions) => (
  Array.isArray(monthOptions)
    ? monthOptions.map((m) => ({
        ...m,
        isEnabled: !isDisabledFlag(m.isEnabled),
      }))
    : []
);

// ── Payload Allowlisting ─────────────────────────────────────
// Only these fields may ever be written to a Program document from
// a request body. Notably excluded: coverImagePath/coverImageUrl
// (only ever set from a verified multer upload, never trusted from
// the body directly), createdBy/updatedBy (server-assigned from the
// authenticated admin), and any Mongo internal fields.
const PROGRAM_ALLOWED_FIELDS = [
  'category', 'location', 'title', 'slug', 'sku', 'batchType',
  'ageGroups', 'skillLevels', 'cities',
  'basePrice', 'discountedPrice',
  'startDate', 'endDate', 'registrationDeadline',
  'maxCapacity', 'shortDescription', 'detailedDescription', 'specialNote',
  'isFeatured', 'isActive', 'coachId', 'sessionsPerWeek',
  'monthOptions', 'weekOptions', 'weeklyBatches', 'scheduleDays',
];

// ─── GET /api/programs ────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.location) filter.location = req.query.location;
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';

    const programs = await Program.find(filter)
      .populate('category', 'title slug')
      .populate('location', 'title city')
      .populate('coachId', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: programs.length, data: programs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/programs/:id ────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id)
      .populate('category', 'title slug')
      .populate('location', 'title address city')
      .populate('coachId', 'firstName lastName profileImageUrl');

    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    res.json({ success: true, data: program.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/programs ── Super Admin only ───────────────────────────────────
exports.create = async (req, res) => {
  try {
    const body = pickAllowedFields(req.body, PROGRAM_ALLOWED_FIELDS);

    if (req.file) {
      body.coverImagePath = req.file.path.replace(/\\/g, '/');
      body.coverImageUrl  = fileUrl(req, req.file.path);
    }

    body.slug      = body.slug || toSlug(body.title);
    body.sku       = body.sku  || toSKU(body.category, body.title);
    body.createdBy = req.user._id;

    // Parse JSON arrays/objects sent as strings from FormData
    if (typeof body.ageGroups    === 'string') body.ageGroups    = JSON.parse(body.ageGroups    || '[]');
    if (typeof body.skillLevels  === 'string') body.skillLevels  = JSON.parse(body.skillLevels  || '[]');
    if (typeof body.cities       === 'string') body.cities       = JSON.parse(body.cities       || '[]');
    if (typeof body.monthOptions === 'string') body.monthOptions = JSON.parse(body.monthOptions || '[]');
    if (typeof body.weekOptions  === 'string') body.weekOptions  = JSON.parse(body.weekOptions  || '[]');
    if (typeof body.weeklyBatches === 'string') body.weeklyBatches = JSON.parse(body.weeklyBatches || '[]');
    if (typeof body.scheduleDays === 'string') body.scheduleDays = JSON.parse(body.scheduleDays || '[]');
    if (Array.isArray(body.monthOptions)) body.monthOptions = normalizeMonthOptions(body.monthOptions);

    // Auto-calculate sessionsPerWeek from scheduleDays
    if (Array.isArray(body.scheduleDays)) {
      body.sessionsPerWeek = body.scheduleDays.length;
    }

    console.log(`[programs] create "${body.title}" — batchType=${body.batchType} — weeklyBatches received: ${Array.isArray(body.weeklyBatches) ? body.weeklyBatches.length : 'N/A'}`);

    const program = new Program(body);
    await program.save();

    console.log(`[programs] create "${program.title}" saved — weeklyBatches persisted: ${program.weeklyBatches.length}`);

    res.status(201).json({ success: true, data: program });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Program with this title/SKU already exists' });
    }
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors).map(e => e.message);
      console.error('[programs] create ValidationError:', details);
      return res.status(400).json({ success: false, message: details.join(' | ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /api/programs/:id ── Super Admin only ────────────────────────────────
exports.update = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    const body = pickAllowedFields(req.body, PROGRAM_ALLOWED_FIELDS);

    if (req.file) {
      if (program.coverImagePath) {
        const oldPath = path.resolve(program.coverImagePath);
        fs.unlink(oldPath, () => {});
      }
      body.coverImagePath = req.file.path.replace(/\\/g, '/');
      body.coverImageUrl  = fileUrl(req, req.file.path);
    }

    // Parse JSON arrays/objects sent as strings from FormData
    if (typeof body.ageGroups    === 'string') body.ageGroups    = JSON.parse(body.ageGroups    || '[]');
    if (typeof body.skillLevels  === 'string') body.skillLevels  = JSON.parse(body.skillLevels  || '[]');
    if (typeof body.cities       === 'string') body.cities       = JSON.parse(body.cities       || '[]');
    if (typeof body.monthOptions === 'string') body.monthOptions = JSON.parse(body.monthOptions || '[]');
    if (typeof body.weekOptions  === 'string') body.weekOptions  = JSON.parse(body.weekOptions  || '[]');
    if (typeof body.weeklyBatches === 'string') body.weeklyBatches = JSON.parse(body.weeklyBatches || '[]');
    if (typeof body.scheduleDays === 'string') body.scheduleDays = JSON.parse(body.scheduleDays || '[]');
    if (Array.isArray(body.monthOptions)) body.monthOptions = normalizeMonthOptions(body.monthOptions);

    // Auto-calculate sessionsPerWeek from scheduleDays
    if (Array.isArray(body.scheduleDays)) {
      body.sessionsPerWeek = body.scheduleDays.length;
    }

    console.log(`[programs] update "${program.title}" — batchType=${body.batchType} — weeklyBatches received: ${Array.isArray(body.weeklyBatches) ? body.weeklyBatches.length : 'N/A'}`);

    body.updatedBy = req.user._id;
    Object.assign(program, body);

    // Defensive: guarantee Mongoose treats these nested arrays as changed
    // even in edge cases where Object.assign's array replacement isn't
    // picked up (e.g. same array length/reference quirks).
    program.markModified('weeklyBatches');
    program.markModified('scheduleDays');
    program.markModified('monthOptions');

    await program.save();

    console.log(`[programs] update "${program.title}" saved — weeklyBatches persisted: ${program.weeklyBatches.length}`);

    res.json({ success: true, data: program });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors).map(e => e.message);
      console.error('[programs] update ValidationError:', details);
      return res.status(400).json({ success: false, message: details.join(' | ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─── DELETE /api/programs/:id ── Soft delete ──────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const program = await Program.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedBy: req.user._id },
      { new: true }
    );
    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });
    res.json({ success: true, message: 'Program deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/programs/bulk ── Super Admin only ─────────────────────────────
// Body: { programs: [ { category, startDate, endDate, ageGroups, skillLevels,
//   cities, locationCity, batchType, price, maxCapacity, registrationDeadline,
//   discountedPrice, shortDescription, detailedDescription, specialNote,
//   coachName, isFeatured, isActive,
//   scheduleDays: [{ day, startTime, endTime, groundAddress }, ...],
//   monthOptions: [{ label, startDate, endDate, weeks, price }, ...] } ] }
exports.bulkCreate = async (req, res) => {
  try {
    const { programs } = req.body;
    if (!Array.isArray(programs) || programs.length === 0) {
      return res.status(400).json({ success: false, message: 'No programs provided' });
    }

    // Pre-load lookup tables
    const Category = mongoose.model('Category');
    const Location = mongoose.model('Location');
    const Coach    = mongoose.model('Coach');

    const [allCategories, allLocations, allCoaches] = await Promise.all([
      Category.find({ isActive: { $ne: false } }).lean(),
      Location.find({ isActive: { $ne: false } }).lean(),
      Coach.find({ status: 'ACTIVE' }).lean(),
    ]);

    const catMap = {};
    allCategories.forEach(c => { catMap[c.title.toLowerCase().trim()] = c._id; });

    const locMap = {};
    allLocations.forEach(l => {
      if (l.city) locMap[l.city.toLowerCase().trim()] = l._id;
    });

    const coachMap = {};
    allCoaches.forEach(c => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase().trim();
      coachMap[name] = c._id;
    });

    const DAY_MAP = {
      monday: 'MON', tuesday: 'TUE', wednesday: 'WED',
      thursday: 'THU', friday: 'FRI', saturday: 'SAT', sunday: 'SUN',
    };

    const created = [];
    const errors  = [];

    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      const rowNum = i + 1;
      try {
        // Resolve category (required)
        const catId = catMap[String(p.category || '').toLowerCase().trim()];
        if (!catId) {
          errors.push({ row: rowNum, field: 'category', message: `Category not found: "${p.category}"` });
          continue;
        }

        // Validate required fields
        if (!p.startDate) { errors.push({ row: rowNum, field: 'startDate', message: 'Start date is required' }); continue; }
        if (!p.price)     { errors.push({ row: rowNum, field: 'price',     message: 'Price is required' });      continue; }
        if (!Array.isArray(p.scheduleDays) || p.scheduleDays.length === 0) {
          errors.push({ row: rowNum, field: 'scheduleDays', message: 'At least one schedule day (DAY row) is required' });
          continue;
        }

        // Resolve optional lookups
        const locId   = locMap[String(p.locationCity || '').toLowerCase().trim()] || null;
        const coachId = p.coachName ? (coachMap[p.coachName.toLowerCase().trim()] || null) : null;

        // Build auto title
        const agePart   = (p.ageGroups   || []).join('/');
        const levelPart = (p.skillLevels || []).join('/');
        const cityPart  = (p.cities      || []).join('/');
        const title     = [agePart, levelPart, cityPart].filter(Boolean).join(' - ');

        // Map every scheduleDays entry's day name -> 3-letter code, drop any that fail to map
        const scheduleDays = [];
        const badDays = [];
        for (const sd of p.scheduleDays) {
          const dayKey = DAY_MAP[String(sd.day || '').toLowerCase().trim()];
          if (!dayKey) { badDays.push(sd.day); continue; }
          scheduleDays.push({
            day:           dayKey,
            startTime:     sd.startTime     || '',
            endTime:       sd.endTime       || '',
            groundAddress: sd.groundAddress || '',
          });
        }
        if (scheduleDays.length === 0) {
          errors.push({ row: rowNum, field: 'classDay', message: `No valid Class Day values found (got: ${badDays.join(', ') || 'none'})` });
          continue;
        }

        // Pass monthOptions straight through (already computed/validated on the frontend)
        const monthOptions = Array.isArray(p.monthOptions)
          ? p.monthOptions.map(m => ({
              label:     m.label     || '',
              startDate: m.startDate || '',
              endDate:   m.endDate   || '',
              weeks:     m.weeks     || null,
              price:     m.price     || null,
              isEnabled: !isDisabledFlag(m.isEnabled),
            }))
          : [];

        const slug = toSlug(title);
        const sku  = toSKU(catId.toString(), title);

        const doc = new Program({
          title,
          slug,
          sku,
          category:             catId,
          location:             locId,
          coachId:              coachId,
          batchType:            p.batchType || 'REGULAR_WITH_MONTH',
          ageGroups:            p.ageGroups   || [],
          skillLevels:          p.skillLevels || [],
          cities:               p.cities      || [],
          basePrice:            parseFloat(p.price) || 0,
          discountedPrice:      p.discountedPrice  || null,
          maxCapacity:          parseInt(p.maxCapacity) || 99,
          startDate:            p.startDate || null,
          endDate:              p.endDate   || null,
          registrationDeadline: p.registrationDeadline || null,
          scheduleDays,
          sessionsPerWeek:      scheduleDays.length,
          monthOptions,
          shortDescription:     p.shortDescription   || '',
          detailedDescription:  p.detailedDescription || '',
          specialNote:          p.specialNote  || '',
          isFeatured:           Boolean(p.isFeatured),
          isActive:             p.isActive !== false,
          createdBy:            req.user._id,
        });

        await doc.save();
        created.push(doc._id);
      } catch (err) {
        errors.push({ row: rowNum, message: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      created: created.length,
      errors,
      message: `${created.length} program(s) created${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
    });
  } catch (err) {
    console.error('Bulk program create error:', err);
    res.status(500).json({ success: false, message: 'Server error during bulk upload' });
  }
};

// ─── HARD DELETE /api/programs/:id/hard ──────────────────────────────────────
exports.hardRemove = async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');

    const regCount = await Registration.countDocuments({ programId: req.params.id });

    if (regCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot permanently delete this program — it has ${regCount} registration(s) attached. Deactivate it instead.`,
      });
    }

    const program = await Program.findByIdAndDelete(req.params.id);
    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    if (program.coverImageUrl) {
      try {
        const filename = program.coverImageUrl.split('/').pop();
        const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Non-fatal
      }
    }

    res.json({ success: true, message: 'Program permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
