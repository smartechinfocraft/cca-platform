// ============================================================
//  controllers/programController.js
//  CRUD for Programs — Super Admin only
//  ISSUE 4: cover image file upload (jpg/jpeg/png), not URL
// ============================================================
const mongoose = require('mongoose');
const Program  = require('../models/Program');
const { fileUrl } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const toSlug = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const toSKU = (category, title) => {
  const parts = [category, title].join('-').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return `CCA-${parts}`.substring(0, 40);
};

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
      .populate('location', 'title address city');

    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    const Batch = mongoose.model('Batch');
    const batches = await Batch.find({ program: program._id })
      .populate('coach', 'firstName lastName')
      .populate('location', 'title city');

    res.json({ success: true, data: { ...program.toObject(), batches } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/programs ── Super Admin only ───────────────────────────────────
// Expects multipart/form-data with optional field: coverImage (jpg/jpeg/png)
exports.create = async (req, res) => {
  try {
    const body = { ...req.body };

    // If a cover image was uploaded, save its server path
    if (req.file) {
      body.coverImagePath = req.file.path.replace(/\\/g, '/');
      body.coverImageUrl  = fileUrl(req, req.file.path);
    }

    body.slug      = body.slug || toSlug(body.title);
    body.sku       = body.sku  || toSKU(body.category, body.title);
    body.createdBy = req.user._id;

    // Parse JSON arrays sent as strings from FormData
    if (typeof body.ageGroups   === 'string') body.ageGroups   = JSON.parse(body.ageGroups   || '[]');
    if (typeof body.skillLevels === 'string') body.skillLevels = JSON.parse(body.skillLevels || '[]');

    const program = new Program(body);
    await program.save();

    res.status(201).json({ success: true, data: program });
  } catch (err) {
    // If upload succeeded but DB failed — delete the orphaned file
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Program with this title/SKU already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /api/programs/:id ── Super Admin only ────────────────────────────────
exports.update = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    const body = { ...req.body };

    // New image uploaded — replace old one
    if (req.file) {
      // Delete old file from disk if it exists
      if (program.coverImagePath) {
        const oldPath = path.resolve(program.coverImagePath);
        fs.unlink(oldPath, () => {}); // silent fail if already deleted
      }
      body.coverImagePath = req.file.path.replace(/\\/g, '/');
      body.coverImageUrl  = fileUrl(req, req.file.path);
    }

    // Parse JSON arrays sent as strings from FormData
    if (typeof body.ageGroups   === 'string') body.ageGroups   = JSON.parse(body.ageGroups   || '[]');
    if (typeof body.skillLevels === 'string') body.skillLevels = JSON.parse(body.skillLevels || '[]');

    body.updatedBy = req.user._id;
    Object.assign(program, body);
    await program.save();

    res.json({ success: true, data: program });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
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

// PERMANENT delete — only allowed when no Batch or Registration references
// this program. Programs with real-world history (anyone ever registered,
// or any batch ever created under it) must be deactivated instead, so
// parents' purchase history and attendance records always still resolve
// to a real program rather than a dangling/missing reference.
exports.hardRemove = async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Batch = mongoose.model('Batch');

    const [regCount, batchCount] = await Promise.all([
      Registration.countDocuments({ programId: req.params.id }),
      Batch.countDocuments({ program: req.params.id }),
    ]);

    if (regCount > 0 || batchCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot permanently delete this program — it has ${batchCount} batch(es) and ${regCount} registration(s) attached. Deactivate it instead to hide it from new registrations while keeping history intact.`,
      });
    }

    const program = await Program.findByIdAndDelete(req.params.id);
    if (!program) return res.status(404).json({ success: false, message: 'Program not found' });

    // Clean up the uploaded cover image file, if any, since nothing
    // references this program anymore.
    if (program.coverImageUrl) {
      try {
        const filename = program.coverImageUrl.split('/').pop();
        const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Non-fatal — the DB record is already gone, a leftover file isn't worth failing the request over.
      }
    }

    res.json({ success: true, message: 'Program permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
