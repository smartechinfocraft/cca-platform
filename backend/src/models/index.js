// ============================================================
//  models/Batch.js — Schedules within a program (Normal Admin)
//  Maps to: batches table
// ============================================================
const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    program:  { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    coach:    { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },

    title: { type: String, trim: true }, // e.g. "Mon/Wed 5 PM"

    // Day(s) of week — can be single (MON) or multi (SAT+SUN)
    dayOfWeek: {
      type: String,
      enum: ['MON','TUE','WED','THU','FRI','SAT','SUN','MULTI'],
      required: true,
    },

    // Store as "HH:mm" strings for simplicity
    startTime: { type: String, required: true }, // e.g. "17:00"
    endTime:   { type: String, required: true }, // e.g. "18:30"

    groundLocationNote: { type: String }, // e.g. "Ground 2"

    maxCapacity:     { type: Number, required: true, min: 0, default: 20 },
    // currentCapacity is auto-calculated from registrations; stored for quick reads
    currentCapacity: { type: Number, default: 0, min: 0 },

    startDate: { type: Date },
    endDate:   { type: Date },

    // Price can differ from program base price (batch-level override)
    price: { type: Number, min: 0 },

    // Price per single session/week — registration multiplies by selected frequency
    // e.g. pricePerSession=400 → Once=400, Twice=800, Thrice=1200
    pricePerSession: { type: Number, min: 0 },

    // Month/duration options shown as radio buttons on the registration page
    // e.g. [{ label: "May to June (5 Weeks)", startDate: Date, endDate: Date, weeks: 5 }]
    monthOptions: [{
      label:     { type: String },
      startDate: { type: String },
      endDate:   { type: String },
      weeks:     { type: Number },
      price:     { type: Number },
    }],

    // Which specific days are selected when dayOfWeek = 'MULTI'
    multiDays: [{ type: String, enum: ['MON','TUE','WED','THU','FRI','SAT','SUN'] }],

    // How often per week — shown on website e.g. "Twice a week", "Once a week"
    sessionsPerWeek: {
      type: Number,
      min: 1,
      max: 7,
      default: null,
    },

    // Multiple time slots per day: [{ startTime: '09:00', endTime: '10:30' }, ...]
    timeSlots: [{ startTime: String, endTime: String }],

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

mongoose.model('Batch', batchSchema);


// ============================================================
//  models/Category.js — Seasons (e.g. Summer 2026, Winter 2027)
//  Maps to: categories table
// ============================================================

// Helper: "Summer 2026" → "summer-2026"
const toSlug = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const categorySchema = new mongoose.Schema(
  {
    title:              { type: String, required: true, trim: true },
    // slug is auto-generated from title — NOT required from the frontend
    slug:               { type: String, unique: true, lowercase: true },
    shortDescription:   { type: String },
    detailedDescription:{ type: String },
    holidayNotes:       { type: String },
    whatsappGroupLink:  { type: String },
    whatsappQrCodeUrl:  { type: String },
    bannerImageUrl:     { type: String },
    isActive:           { type: Boolean, default: true },
    sortOrder:          { type: Number, default: 0 },
    createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate slug from title before every save
// If two categories have the same title, append a timestamp to keep slug unique
categorySchema.pre('save', async function (next) {
  if (!this.slug || this.isModified('title')) {
    let base = toSlug(this.title);
    let slug  = base;

    // Check if slug already exists (for a DIFFERENT document)
    const existing = await mongoose.model('Category').findOne({ slug, _id: { $ne: this._id } });
    if (existing) {
      // e.g. "summer-2026-1718000000000"
      slug = `${base}-${Date.now()}`;
    }
    this.slug = slug;
  }
  next();
});

mongoose.model('Category', categorySchema);


// ============================================================
//  models/Location.js — Practice grounds / facilities
//  Maps to: locations table
// ============================================================
const locationSchema = new mongoose.Schema(
  {
    title:         { type: String, required: true, trim: true },
    address:       { type: String },
    city:          { type: String },
    state:         { type: String, default: 'CA' },
    zipCode:       { type: String },
    latitude:      { type: Number },
    longitude:     { type: Number },
    googleMapUrl:  { type: String },
    isActive:      { type: Boolean, default: true },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

mongoose.model('Location', locationSchema);

// ============================================================
//  models/AgeGroup.js — Standalone age group master data
//  Maps to: age_groups table (Super Admin manages)
//  Examples: U8, U9, U10, U11, U12, U13, U14
// ============================================================
const ageGroupSchema = new mongoose.Schema(
  {
    title:     { type: String, required: true, trim: true, unique: true }, // e.g. "U10"
    label:     { type: String, trim: true }, // optional display label e.g. "Under 10"
    sortOrder: { type: Number, default: 0 },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

mongoose.model('AgeGroup', ageGroupSchema);


// ============================================================
//  models/Level.js — Standalone skill level master data
//  Maps to: levels table (Super Admin manages)
//  Examples: Beginner Level 1, Beginner Level 2, Intermediate, Junior, Juniors
// ============================================================
const levelSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true, unique: true }, // e.g. "Beginner Level 1"
    description: { type: String },
    sortOrder:   { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

mongoose.model('Level', levelSchema);

// ============================================================
//  models/Coupon.js — Discount codes / scholarship vouchers
//  Maps to: coupons table (Phase 2 in DB dict, but adding now)
// ============================================================
const couponSchema = new mongoose.Schema(
  {
    code:       { type: String, required: true, unique: true, uppercase: true },
    type:       { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
    value:      { type: Number, required: true, min: 0 },   // % or $ amount
    minAmount:  { type: Number, default: 0 },               // Min cart value to apply
    maxUses:    { type: Number, default: null },             // null = unlimited
    usedCount:  { type: Number, default: 0 },
    expiresAt:  { type: Date },
    description:{ type: String },
    isActive:   { type: Boolean, default: true },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

mongoose.model('Coupon', couponSchema);


// ============================================================
//  models/Coach.js — Coach profiles
//  Maps to: coaches table
// ============================================================
const coachSchema = new mongoose.Schema(
  {
    // Links to a User account for login
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    firstName:  { type: String, required: true },
    lastName:   { type: String, required: true },
    email:      { type: String, required: true, unique: true, lowercase: true },
    phone:      { type: String },
    bio:        { type: String },
    experience: { type: String },
    photoUrl:   { type: String },
    speciality: { type: String }, // e.g. "Batting, Fielding"
    location:   { type: mongoose.Schema.Types.ObjectId, ref: 'Location' }, // primary ground/location they work at
    status:     { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },

    // ── Auto-generated login credentials ──────────────────────
    // coachUid:  short unique code, also used inside the auto password
    //            (e.g. "RAVI4821")
    // username:  what the coach types to log in (e.g. "ravi.sharma")
    // password:  hashed; the PLAIN password is only ever shown once —
    //            inside the welcome email sent right after creation.
    coachUid: { type: String, unique: true, sparse: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, select: false },

    credentialsSentAt: { type: Date },

    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Hash password whenever it changes (mirrors User.js pattern)
coachSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

coachSchema.methods.comparePassword = async function (entered) {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(entered, this.password);
};

mongoose.model('Coach', coachSchema);


// ============================================================
//  models/Registration.js — Parent registrations (orders)
//  Maps to: registrations table
// ============================================================
const registrationSchema = new mongoose.Schema(
  {
    // Auto-generated human-readable order number (CCA-2026-0001)
    registrationNumber: { type: String, unique: true },

    // Parent who registered
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true },

    // Selected program
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },

    // Students registered under this order.
    // Stored as ObjectId refs to the Student collection (with embedded snapshot fields
    // for firstName, lastName, dob, gender, studentCode so data is readable even if
    // the Student doc is later modified). Use populate('students') to hydrate.
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],

    // Batches selected
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],

    // Weekly batches selected (only set when the program's batchType is
    // WEEKLY). Stored as a snapshot array (not refs) since Program.weeklyBatches
    // are subdocuments — this keeps the record readable even if the admin
    // later edits/removes those batches from the program, and supports the
    // parent selecting MULTIPLE batches ("weeks") in one registration.
    selectedWeeklyBatches: [
      {
        batchId:       { type: String },
        label:         { type: String },
        startDate:     { type: String },
        startTime:     { type: String },
        endDate:       { type: String },
        endTime:       { type: String },
        groundAddress: { type: String },
        ageGroups:     [{ type: String }],
        skillLevels:   [{ type: String }],
      },
    ],

    status: {
      type: String,
      enum: ['PENDING','AWAITING_PAYMENT','PAID','CONFIRMED','CANCELLED','REFUNDED','WAITLISTED'],
      default: 'PENDING',
    },

    subtotal:       { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount:    { type: Number, default: 0 },

    couponCode:   { type: String },
    customerNote: { type: String },
    adminNote:    { type: String },

    // Consent checkboxes (captured during registration flow)
    waiverAccepted:  { type: Boolean, default: false },
    waiverSignature: { type: String },
    waiverDrawnSignature: { type: String },
    waiverAcceptedAt:{ type: Date },
    waiverAgreementVersion: { type: String },
    mediaConsent:    { type: Boolean, default: false },
    medicalConsent:  { type: Boolean, default: false },
    whatsappOptIn:   { type: Boolean, default: false },
    isWhatsappJoined:{ type: Boolean, default: false },

    // Payment info (no card data stored)
    paymentMethod: { type: String, enum: ['PAYPAL', 'CHECK', 'PENDING'], default: 'PENDING' },
    paymentStatus: { type: String, enum: ['PENDING','SUCCESS','FAILED','REFUNDED'], default: 'PENDING' },
    transactionId: { type: String },
    checkNumber:   { type: String },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate registration number before saving
registrationSchema.pre('save', async function (next) {
  if (!this.registrationNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Registration').countDocuments();
    this.registrationNumber = `CCA-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

mongoose.model('Registration', registrationSchema);


// Pull in Student + Attendance (defined in their own files, like User.js)
// Requiring here ensures they're registered whenever models/index.js is required.
const Student    = require('./Student');
const Attendance = require('./Attendance');

// Export all models by requiring this one file
module.exports = {
  Batch:        mongoose.model('Batch'),
  Category:     mongoose.model('Category'),
  Location:     mongoose.model('Location'),
  Coupon:       mongoose.model('Coupon'),
  Coach:        mongoose.model('Coach'),
  Registration: mongoose.model('Registration'),
  AgeGroup:     mongoose.model('AgeGroup'),   
  Level:        mongoose.model('Level'),  
  Student,
  Attendance,
};