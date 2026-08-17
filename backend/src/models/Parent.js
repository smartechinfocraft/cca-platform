// ============================================================
//  models/Parent.js — Registered parent accounts
// ============================================================
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const parentSchema = new mongoose.Schema({
  firstName:  { type: String, required: true, trim: true },
  lastName:   { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:      { type: String, required: true },
  password:   { type: String, select: false },
  accountStatus: {
    type: String,
    enum: ['GUEST', 'PENDING_VERIFICATION', 'ACTIVE', 'DISABLED'],
    default: 'ACTIVE',
    index: true,
  },
  address:    { type: String },
  city:       { type: String },
  state:      { type: String },
  zip:        { type: String },
  photoPath:  { type: String },
  photoUrl:   { type: String },
  isVerified: { type: Boolean, default: false },
  emailVerificationTokenHash: { type: String, select: false, index: true },
  emailVerificationExpiresAt: { type: Date, select: false, index: true },
  emailVerificationSentAt: { type: Date },
  emailVerifiedAt: { type: Date },
  isActive:   { type: Boolean, default: true },

  // SHA-256 hash of the current valid refresh token (rotate-on-use).
  refreshTokenHash: { type: String, select: false, default: null },
}, { timestamps: true });

parentSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

parentSchema.methods.comparePassword = function(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Parent', parentSchema);
