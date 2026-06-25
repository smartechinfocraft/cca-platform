// ============================================================
//  models/Program.js — Training programs (Super Admin creates)
//  REPLACE: backend/src/models/Program.js
//  Added: cities, scheduleDays, monthOptions, coachId, sessionsPerWeek
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

    // Cities used in title only (multi-city e.g. Dublin/Fremont)
    cities: [{ type: String }],

    basePrice:       { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, min: 0 },

    startDate:            { type: Date },
    endDate:              { type: Date },
    registrationDeadline: { type: Date },

    maxCapacity:         { type: Number, min: 0, default: 99 },
    shortDescription:    { type: String },
    detailedDescription: { type: String },
    specialNote:         { type: String },

    // Cover image stored as uploaded file
    coverImagePath: { type: String },
    coverImageUrl:  { type: String },

    isFeatured: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true },

    // Coach assigned to this program
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coach',
    },

    // Sessions per week (auto-calculated from scheduleDays.length)
    sessionsPerWeek: { type: Number, default: 0 },

    // Month selection options (shown to user on registration when batchType = REGULAR_WITH_MONTH)
    // Example: [{label: "May to June (5 Weeks)", startDate: "2026-05-01", endDate: "2026-06-05", weeks: 5}]
    monthOptions: [
      {
        label:     { type: String },
        startDate: { type: String },
        endDate:   { type: String },
        weeks:     { type: Number },
        price:     { type: Number },   // manually set by admin — no auto-calc
      },
    ],

    // Schedule: per-day time slots and ground address
    // Shown on program card and used for price calculation (price × days user picks)
    scheduleDays: [
      {
        day:           { type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
        startTime:     { type: String },  // "16:00"
        endTime:       { type: String },  // "17:30"
        groundAddress: { type: String },  // "10800 Torre Avenue, Cupertino"
      },
    ],

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