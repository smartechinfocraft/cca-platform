// ============================================================
//  models/User.js — Admin user accounts (Super Admin & Admin)
//  Maps to: users table in the DB dictionary
// ============================================================
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // Login username (e.g. superadminwork.01)
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Login email
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Hashed password — NEVER store plain text
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      // select: false means password won't be returned in queries by default
      select: false,
    },

    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },

    // SUPER_ADMIN can manage programs, locations, levels, age groups
    // ADMIN can manage everything else (batches, registrations, coaches, etc.)
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN'],
      default: 'ADMIN',
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },

    // Store last login time for dashboard display
    lastLogin: { type: Date },
  },
  {
    // Mongoose automatically adds createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// ─── Pre-save hook ────────────────────────────────────────────────────────────
// Hash the password whenever it changes (new user or password update)
userSchema.pre('save', async function (next) {
  // Only hash if password field was modified
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method ──────────────────────────────────────────────────────────
// Compare plain-text password with stored hash (used in login controller)
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
