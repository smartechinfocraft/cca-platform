const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
      unique: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true, index: true },
    parentName: { type: String, required: true, trim: true, maxlength: 160 },
    parentEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    registrationNumber: { type: String, required: true, trim: true, maxlength: 80, index: true },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
