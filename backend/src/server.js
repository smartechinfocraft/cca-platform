// ============================================================
//  server.js — CCA Admin API + Public API for Home Frontend
//  PORT: 5001 (Admin Backend)
//  Admin Frontend:  http://localhost:3000
//  Home Frontend:   http://localhost:5173
// ============================================================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const routes    = require('./routes/index');

require('./models/User');
require('./models/Program');
require('./models/Parent');
require('./models/Student');
require('./models/Attendance');
require('./models/index'); // Batch, Category, Location, Coupon, Coach, Registration
require('./models/MessageThread');

const app  = express();
const PORT = process.env.PORT || 5001;

// ─── Security ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — allow Admin frontend, Home frontend, and local dev
const allowedOrigins = [
  process.env.FRONTEND_URL  || 'http://localhost:3000',
  process.env.HOME_FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://cca-app-g0pe.onrender.com',
  // Real production domain — hardcoded as a safety net so CORS never
  // silently blocks it if an env var is ever missing/misconfigured.
  // (This matters more than it looks: <img> tags load cross-origin
  // fine with no CORS headers at all, but JS-initiated fetch/XHR — like
  // pdf.js fetching a magazine PDF to parse it — is blocked by the
  // browser unless the origin is explicitly allowed here.)
  'https://calcricket.org',
  'https://www.calcricket.org',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Rate limiting — protects login endpoints on all three portals from
// brute-force / credential-stuffing attacks.
const loginLimiter = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
};
app.use('/api/auth/login',           rateLimit(loginLimiter));
app.use('/api/coach-auth/login',     rateLimit(loginLimiter));
app.use('/api/public/auth/login',    rateLimit(loginLimiter));
app.use('/api/public/auth/register', rateLimit(loginLimiter));
// Refresh-token rotation endpoints get their own (slightly higher) limit —
// a legitimate SPA calls these more often than a human types a password.
app.use(['/api/auth/refresh', '/api/coach-auth/refresh', '/api/public/auth/refresh'], rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many refresh attempts. Please log in again.' },
}));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ─── Request parsing ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Static uploads ──────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), port: PORT });
});

// ─── API routes ───────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ─── Start ────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 CCA Admin API  →  http://localhost:${PORT}`);
    console.log(`   Public API      →  http://localhost:${PORT}/api/public/*`);
    console.log(`   Uploads         →  http://localhost:${PORT}/uploads`);
    console.log(`   Health          →  http://localhost:${PORT}/health\n`);
    console.log(`   Admin Frontend  →  http://localhost:3000`);
    console.log(`   Home Frontend   →  http://localhost:5173\n`);
  });
};

start();
