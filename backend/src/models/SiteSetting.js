const mongoose = require('mongoose');

const siteSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true, default: 'public-site' },
  maintenanceEnabled: { type: Boolean, default: false },
  maintenanceTitle: { type: String, trim: true, maxlength: 120, default: 'We are improving your experience' },
  maintenanceMessage: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: 'Our website is temporarily unavailable while we make a few improvements. Please check back shortly.',
  },
  maintenanceContactEmail: { type: String, trim: true, maxlength: 254, default: 'calcricket_academy@yahoo.com' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.models.SiteSetting || mongoose.model('SiteSetting', siteSettingSchema);
