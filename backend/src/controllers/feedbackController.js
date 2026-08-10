const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const { verifyReceiptToken } = require('../utils/tokenService');

const cleanPlainText = (value) => value
  .replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

exports.submit = async (req, res) => {
  try {
    const registrationId = req.params.registrationId;
    if (!mongoose.isValidObjectId(registrationId)) {
      return res.status(400).json({ success: false, message: 'Invalid registration.' });
    }

    const token = req.get('X-Receipt-Token');
    if (!token || typeof token !== 'string') {
      return res.status(401).json({ success: false, message: 'Receipt authorization is required.' });
    }
    const decoded = verifyReceiptToken(token);
    if (decoded.id !== registrationId) {
      return res.status(403).json({ success: false, message: 'Receipt authorization is invalid.' });
    }

    const rawRating = req.body?.rating;
    const rawFeedback = req.body?.feedback;
    if (rawRating !== undefined && rawRating !== null && !Number.isInteger(rawRating)) {
      return res.status(400).json({ success: false, message: 'Rating must be a whole number from 1 to 5.' });
    }
    if (rawRating !== undefined && rawRating !== null && (rawRating < 1 || rawRating > 5)) {
      return res.status(400).json({ success: false, message: 'Rating must be from 1 to 5.' });
    }
    if (rawFeedback !== undefined && rawFeedback !== null && typeof rawFeedback !== 'string') {
      return res.status(400).json({ success: false, message: 'Feedback must be plain text.' });
    }

    const feedback = typeof rawFeedback === 'string' ? cleanPlainText(rawFeedback) : '';
    if (feedback.length > 2000) {
      return res.status(400).json({ success: false, message: 'Feedback must be 2,000 characters or fewer.' });
    }
    if (rawRating == null && !feedback) {
      return res.status(400).json({ success: false, message: 'Choose a rating or enter feedback before submitting.' });
    }

    const Registration = mongoose.model('Registration');
    const registration = await Registration.findById(registrationId)
      .select('registrationNumber parentId')
      .populate('parentId', 'firstName lastName email')
      .lean();
    if (!registration?.parentId) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }

    const parent = registration.parentId;
    const record = await Feedback.create({
      registrationId: registration._id,
      parentId: parent._id,
      parentName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Parent',
      parentEmail: parent.email,
      registrationNumber: registration.registrationNumber,
      ...(rawRating == null ? {} : { rating: rawRating }),
      ...(feedback ? { feedback } : {}),
    });
    return res.status(201).json({ success: true, data: { id: record._id } });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Feedback has already been submitted for this order.' });
    }
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Receipt authorization has expired or is invalid.' });
    }
    console.error('Feedback submission error:', error);
    return res.status(500).json({ success: false, message: 'Feedback could not be saved. Please try again.' });
  }
};

exports.list = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [data, total] = await Promise.all([
      Feedback.find()
        .select('parentName parentEmail registrationNumber rating feedback createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Feedback.countDocuments(),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Feedback could not be loaded.' });
  }
};
