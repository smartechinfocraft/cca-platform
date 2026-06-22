// ============================================================
//  models/Program.js — Training programs (Super Admin creates)
//  ISSUE 4: Added coverImagePath + coverImageUrl fields
// ============================================================
const mongoose = require('mongoose');

const toSlug = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const toSKU = (title) =>
  'CCA-' + title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 36);

const programSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
    },

    title: { type: String, required: true, trim: true },
    slug:  { type: String, unique: true, lowercase: true },
    sku:   { type: String, unique: true, uppercase: true },

    batchType: {
      type: String,
      enum: ['REGULAR_WITH_MONTH', 'REGULAR_WITHOUT_MONTH', 'WEEKLY', 'FIXED_DAYS', 'SPECIAL_CAMP'],
      default: 'REGULAR_WITH_MONTH',
    },

    ageGroups:   [{ type: String }],
    skillLevels: [{ type: String }],

    basePrice:       { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, min: 0 },

    startDate:            { type: Date },
    endDate:              { type: Date },
    registrationDeadline: { type: Date },

    maxCapacity:         { type: Number, min: 0 },
    shortDescription:    { type: String },
    detailedDescription: { type: String },
    specialNote:         { type: String },

    // ── ISSUE 4: Cover image stored as uploaded file, NOT url ──
    // coverImagePath = disk path  (used internally / to serve file)
    // coverImageUrl  = full URL   (returned to frontend / public API)
    coverImagePath: { type: String }, // e.g. "uploads/programs/1718000000-abc.jpg"
    coverImageUrl:  { type: String }, // e.g. "https://yourdomain.com/uploads/programs/..."

    isFeatured: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate slug and SKU from title before every save
programSchema.pre('save', async function (next) {
  if (!this.slug || this.isModified('title')) {
    let base = toSlug(this.title);
    let slug  = base;
    const existing = await mongoose.model('Program').findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${base}-${Date.now()}`;
    this.slug = slug;
  }

  if (!this.sku || this.isModified('title')) {
    let sku = toSKU(this.title);
    const existing = await mongoose.model('Program').findOne({ sku, _id: { $ne: this._id } });
    if (existing) sku = `${sku}-${Date.now()}`.substring(0, 40);
    this.sku = sku;
  }

  next();
});

module.exports = mongoose.model('Program', programSchema);
