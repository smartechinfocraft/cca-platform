// ============================================================
//  models/Program.js — Training programs (Super Admin creates)
//  REPLACE: backend/src/models/Program.js
//  Added: cities, scheduleDays, monthOptions, coachId, sessionsPerWeek
// ============================================================
const mongoose = require('mongoose');

const toSlug = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const toSKU = (title) =>
  'CCA-' + title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 60);

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
        isEnabled: { type: Boolean, default: true },
      },
    ],

    // DEPRECATED — kept only so old documents don't break on read.
    // Replaced by `weeklyBatches` below. Do not write to this field anymore.
    weekOptions: [
      {
        label:     { type: String },
        startDate: { type: String },
        endDate:   { type: String },
      },
    ],

    // ── Weekly Batches (batchType = 'WEEKLY' only) ───────────────────────
    // Each batch is one selectable slot a parent can pick during
    // registration: a date range + time + ground, restricted to a subset
    // of the program's top-level ageGroups / skillLevels.
    // Parents may select MULTIPLE batches — price = basePrice × number
    // of batches selected. Admin adds as many batches as needed via "+ Add
    // Batch" in the admin panel.
    // Example:
    // { startDate: "2026-07-20", startTime: "16:00", endDate: "2026-07-24",
    //   endTime: "17:30", groundAddress: "10800 Torre Avenue, Cupertino",
    //   ageGroups: ["U8","U9"], skillLevels: ["Beginner"],
    //   label: "July 20 - July 24 (4:00 PM - 5:30 PM)" }
    weeklyBatches: [
      {
        startDate:     { type: String, required: true },  // "2026-07-20"
        startTime:     { type: String, required: true },  // "16:00"
        endDate:       { type: String, required: true },  // "2026-07-24"
        endTime:       { type: String, required: true },  // "17:30"
        groundAddress: { type: String, required: true },
        // Must be a subset of the Program's own ageGroups / skillLevels
        // (enforced in the admin UI — chips are filtered to those chosen
        // in the program title section above).
        ageGroups:     [{ type: String }],
        skillLevels:   [{ type: String }],
        // Auto-generated display label, e.g. "July 20 - July 24"
        label:         { type: String },
        isActive:      { type: Boolean, default: true },
        // true = this entry is a compact "Week N" row nested under a root
        // batch in the admin UI (shares ageGroups/skillLevels/groundAddress
        // with its root). Still a fully independent selectable batch for
        // registration/pricing purposes — this flag only affects admin UI grouping.
        isSubWeek:     { type: Boolean, default: false },
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
    const base = toSKU(this.title);
    let sku = base;
    let attempt = 0;

    // Keep trying until we find a SKU that's truly free.
    // IMPORTANT: never truncate AFTER appending the disambiguating suffix —
    // that was the old bug (it silently chopped the suffix back off,
    // leaving every colliding SKU identical to the one it collided with).
    // eslint-disable-next-line no-await-in-loop
    while (await mongoose.model('Program').findOne({ sku, _id: { $ne: this._id } })) {
      attempt += 1;
      sku = `${base}-${attempt}`;
    }

    this.sku = sku;
  }

  next();
});

module.exports = mongoose.model('Program', programSchema);
