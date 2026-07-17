// ============================================================
//  middleware/upload.js
//  Multer config for file uploads — images (jpg/jpeg/png) and PDFs
//  ISSUE 4 & 5: All image fields use file upload, not URL
// ============================================================
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Ensure upload folders exist ────────────────────────────
const DEFAULT_UPLOAD_BASE = path.join(__dirname, '../../uploads');
const folders = ['programs', 'coaches', 'sponsors', 'media', 'gallery', 'students'];

const ensureUploadFolders = (baseDir) => {
  fs.mkdirSync(baseDir, { recursive: true });
  folders.forEach(f => {
    const dir = path.join(baseDir, f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};

const resolveUploadBase = () => {
  const configured = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : DEFAULT_UPLOAD_BASE;

  try {
    ensureUploadFolders(configured);
    return configured;
  } catch (err) {
    if (!process.env.UPLOAD_DIR) throw err;
    console.warn(
      `[upload] UPLOAD_DIR "${configured}" is not writable (${err.code || err.message}). ` +
      `Falling back to "${DEFAULT_UPLOAD_BASE}".`
    );
    ensureUploadFolders(DEFAULT_UPLOAD_BASE);
    return DEFAULT_UPLOAD_BASE;
  }
};

const UPLOAD_BASE = resolveUploadBase();

// ── Storage engine ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Pick subfolder based on route prefix or fieldname
    let folder = 'programs';
    if (req.baseUrl?.includes('coaches') || req.path?.includes('coaches')) folder = 'coaches';
    else if (req.baseUrl?.includes('sponsors') || req.path?.includes('sponsors')) folder = 'sponsors';
    else if (file.fieldname === 'galleryImages') folder = 'gallery';
    else if (req.baseUrl?.includes('media') || req.path?.includes('media')) folder = 'media';
    else if (req.path?.includes('students') || file.fieldname === 'photo') folder = 'students';
    cb(null, path.join(UPLOAD_BASE, folder));
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

// ── File filter — images only ──────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, PNG images are allowed'), false);
  }
};

// ── File filter — PDF only ─────────────────────────────────
const pdfFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// ── File filter — images OR pdf ────────────────────────────
const imageOrPdfFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, PNG or PDF files are allowed'), false);
  }
};

// ── Multer instances ───────────────────────────────────────

// Single cover image (programs, coaches, sponsors)
const uploadCoverImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('coverImage');

// Single student / parent profile photo
const uploadStudentPhoto = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('photo');

// Gallery: coverImage (1) + galleryImages (up to 100)
const uploadGallery = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB per image
}).fields([
  { name: 'coverImage',    maxCount: 1   },
  { name: 'galleryImages', maxCount: 100 },
]);

// Magazine / Newsletter: coverImage + pdfFile
const uploadMediaWithPdf = multer({
  storage,
  fileFilter: imageOrPdfFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for PDFs
}).fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'pdfFile',    maxCount: 1 },
]);

// ── Error handler wrapper ──────────────────────────────────
// Wrap multer middleware so errors come back as JSON (not HTML crash)
const withUpload = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ── Helper: build public URL from saved path ───────────────
// Call this after upload to get the URL to store in DB
const fileUrl = (req, filePath) => {
  if (!filePath) return null;
  const absolutePath = path.resolve(filePath);
  const relative = path.relative(UPLOAD_BASE, absolutePath).replace(/\\/g, '/');
  const host = `${req.protocol}://${req.get('host')}`;
  return `${host}/uploads/${relative}`;
};

module.exports = {
  uploadCoverImage: withUpload(uploadCoverImage),
  uploadStudentPhoto: withUpload(uploadStudentPhoto),
  uploadGallery:    withUpload(uploadGallery),
  uploadMediaWithPdf: withUpload(uploadMediaWithPdf),
  fileUrl,
  UPLOAD_BASE,
};
