// ============================================================
//  models/Student.js — Children registered under a Parent
//  Maps to: students table
//  Created automatically during the public registration flow,
//  and reused (by name+dob match) when a parent registers the
//  same child for a new program.
// ============================================================
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true, index: true },

    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    dob:       { type: Date },
    gender:    { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },

    schoolName:   { type: String, trim: true },
    medicalNotes: { type: String, trim: true },

    // Auto-generated human readable student / member code, e.g. CCA-STU-000123
    // Used as the ID card number.
    studentCode: { type: String, unique: true },

    // Profile / ID-card photo (uploaded file), stored same pattern as other models
    photoPath: { type: String },
    photoUrl:  { type: String },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate studentCode before saving
studentSchema.pre('save', async function (next) {
  if (!this.studentCode) {
    const count = await mongoose.model('Student').countDocuments();
    this.studentCode = `CCA-STU-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

studentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
