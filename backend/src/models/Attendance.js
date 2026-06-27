// ============================================================
//  models/Attendance.js — Per-session attendance for a student
//  Maps to: attendance table
//  One record per student per calendar date per batch.
//  Marked by coaches/admins from the Admin Panel (Batches/
//  Registrations area); read-only for parents on their dashboard.
// ============================================================
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    batchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    programId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },

    date: { type: Date, required: true },

    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      default: 'PRESENT',
    },

    note: { type: String, trim: true },

    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// A student can only have one attendance record per date per batch
attendanceSchema.index({ studentId: 1, batchId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
