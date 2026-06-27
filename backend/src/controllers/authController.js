// ============================================================
//  controllers/authController.js — Login, get current user
//  NOTE: forgot-password is intentionally removed for Admin.
//        Only Coach (/api/coach-auth/forgot-password) and
//        Parent (/api/public/auth/forgot-password) support it.
// ============================================================
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Helper: generate a signed JWT containing the user's _id
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Find by username OR email (flexible login)
    // We need +password because it's select:false in the schema
    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    // bcrypt compare plain text against stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login time
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const token = generateToken(user._id);

    // Return user info (no password!) + token
    res.json({
      success: true,
      token,
      user: {
        id:        user._id,
        username:  user.username,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,       // SUPER_ADMIN or ADMIN — frontend uses this for UI
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns the currently logged-in user's profile
exports.getMe = async (req, res) => {
  // req.user is set by the protect middleware
  res.json({ success: true, user: req.user });
};

// ─── GET /api/auth/admins — Super Admin only ──────────────────────────────────
// List all admin users (for super admin to manage)
exports.listAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/auth/admins — Super Admin only ─────────────────────────────────
// Create a new normal admin
exports.createAdmin = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    // Super admin can only create ADMIN (not another SUPER_ADMIN)
    if (role === 'SUPER_ADMIN') {
  return res.status(403).json({ success: false, message: 'Cannot create a Super Admin account via this endpoint.' });
}
const safeRole = role || 'ADMIN';

    const user = await User.create({ username, email, password, firstName, lastName, role: safeRole });

    res.status(201).json({
      success: true,
      data: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    // Handle duplicate key error (username/email already exists)
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/auth/admins/:id/status — Super Admin only ────────────────────
// Activate or deactivate an admin account
exports.toggleAdminStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin not found' });

    // Prevent deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    user.status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await user.save();

    res.json({ success: true, data: { status: user.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};