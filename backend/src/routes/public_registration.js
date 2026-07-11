// ============================================================
//  Public Registration + Auth Endpoints
//  /api/public/*
// ============================================================
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('../services/emailService');
const { createOrder, captureOrder, getCaptureDetails } = require('../services/paypalService');
const { createPaymentIntent, getPaymentIntent, toMinorUnits } = require('../services/stripeService');
const { uploadStudentPhoto, fileUrl } = require('../middleware/upload');
const { computeRegistrationTotal, computeCartTotal, round2 } = require('../utils/pricing');

// Formats a month option's start/end dates + weeks as "Jul 5 - Aug 10 ( 5 week )"
function fmtMonthDateRange(startDate, endDate, weeks) {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  const opts = { month: 'short', day: 'numeric' };
  const range = `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
  return weeks ? `${range} ( ${weeks} week )` : range;
}

function normalizeOrderMonth(month, fallbackLabel) {
  if (!month && !fallbackLabel) return undefined;
  if (typeof month === 'string') return { label: month };
  return {
    label: month?.label || fallbackLabel || '',
    startDate: month?.startDate,
    endDate: month?.endDate,
    weeks: month?.weeks != null ? String(month.weeks) : undefined,
    price: month?.price != null ? Number(month.price) : undefined,
  };
}

function normalizeOrderStudent(student) {
  return {
    firstName: String(student?.firstName || '').trim(),
    lastName: String(student?.lastName || '').trim(),
    dob: student?.dob ? String(student.dob) : '',
    gender: student?.gender || '',
    schoolName: student?.schoolName || '',
    medicalNotes: student?.medicalNotes || '',
  };
}

function buildRegistrationOrderItems({ cartItems, selectedProgram, selectedBatch, selectedMonth, selectedDays, sessionsPerWeek, students, priced }) {
  if (Array.isArray(cartItems) && cartItems.length > 0) {
    return cartItems.map((item, index) => {
      const itemStudents = Array.isArray(item.students) && item.students.length ? item.students : [];
      const studentCount = Number(item.studentCount) || itemStudents.length || 1;
      const feePerStudent = round2(Number(item.fee) || Number(priced?.lineItems?.[index]?.unitPrice) || 0);
      return {
        programId: item.programId ? String(item.programId) : '',
        programTitle: item.programTitle
          || item.programName
          || priced?.lineItems?.[index]?.program?.title
          || selectedProgram?.title
          || 'CCA Program',
        batchId: item.batchId ? String(item.batchId) : '',
        batchName: item.batchName
          || item.batchTitle
          || priced?.lineItems?.[index]?.batch?.title
          || priced?.lineItems?.[index]?.batch?.name
          || '',
        selectedMonth: normalizeOrderMonth(item.selectedMonth, item.selectedMonthLabel),
        selectedMonthLabel: item.selectedMonthLabel || item.selectedMonth?.label || (typeof item.selectedMonth === 'string' ? item.selectedMonth : ''),
        selectedDays: item.selectedDays || '',
        sessionsPerWeek: Number(item.sessionsPerWeek) || undefined,
        feePerStudent,
        studentCount,
        itemTotal: round2(feePerStudent * studentCount),
        students: itemStudents.map(normalizeOrderStudent),
      };
    });
  }

  const studentCount = students.length || 1;
  const feePerStudent = round2(Number(priced?.unitPrice) || (studentCount ? Number(priced?.subtotal || 0) / studentCount : 0));
  return [{
    programId: selectedProgram?._id ? String(selectedProgram._id) : '',
    programTitle: selectedProgram?.title || 'CCA Program',
    batchId: selectedBatch?._id ? String(selectedBatch._id) : '',
    batchName: selectedBatch?.title || selectedBatch?.name || '',
    selectedMonth: normalizeOrderMonth(selectedMonth),
    selectedMonthLabel: selectedMonth?.label || '',
    selectedDays: selectedDays || selectedBatch?.days || selectedBatch?.timing || '',
    sessionsPerWeek: Number(selectedBatch?.sessionsPerWeek ?? sessionsPerWeek) || undefined,
    feePerStudent,
    studentCount,
    itemTotal: round2(feePerStudent * studentCount),
    students: students.map(normalizeOrderStudent),
  }];
}

const {
  logPaymentSuccess,
  logDuplicatePayment,
  logUnauthorizedAttempt,
} = require('../utils/paymentLogger');

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
  clearCookieOptions,
} = require('../utils/tokenService');

const REFRESH_COOKIE_NAME = 'cca_parent_rt';
const REFRESH_COOKIE_PATH = '/api/public/auth';

// ── Parent Auth Middleware ────────────────────────────────────
// Verifies the short-lived Access Token sent as "Authorization: Bearer".
async function parentAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'parent') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    // Re-check live account status on every request (rather than trusting
    // the JWT payload alone) so a deactivated parent account is denied
    // immediately, matching the same pattern used by protect() (admin)
    // and coachAuth() (coach).
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(decoded.id).select('isActive');
    if (!parent || parent.isActive === false) {
      return res.status(401).json({ success: false, message: 'Account inactive or not found' });
    }

    req.parent = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// ── Optional (soft) parent identity resolution ────────────────
// Used by endpoints that support BOTH guest and logged-in checkout
// (coupon validation, PayPal/Stripe intent creation, /register). Never
// throws — an absent/invalid token just means "guest", exactly like
// before. The important security property is the other direction: if a
// token IS present and valid, its subject is the ONLY parent identity we
// will ever trust for that request — a parentId typed into the request
// body is never authoritative once an Authorization header is present.
function resolveOptionalParentId(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'parent') return null;
    return decoded.id;
  } catch {
    return null;
  }
}

// ── Generic, secure error responder for payment endpoints ────
// Only ever surfaces err.message to the client when this code base itself
// set err.status (i.e. a deliberate, descriptive validation error like
// "Coupon has expired"). Anything else — a thrown Stripe/PayPal SDK
// error, a DB error, a bug — is logged in full server-side and replaced
// with a generic message, so internal errors, stack traces, and gateway
// secrets never reach the browser.
function sendPaymentError(res, err, fallbackMessage, context) {
  console.error(`Payment error${context ? ` [${context}]` : ''}:`, err);
  const status = err.status || 500;
  const message = err.status ? err.message : (fallbackMessage || 'We could not process this payment request. Please try again.');
  return res.status(status).json({ success: false, message });
}

const toSafeParent = (parent) => ({
  id: parent._id,
  firstName: parent.firstName,
  lastName: parent.lastName,
  email: parent.email,
  phone: parent.phone,
});

// Issues a fresh access + refresh token pair, persists the refresh token's
// hash (rotate-on-use), and sets the HttpOnly cookie.
const issueParentTokens = async (res, parent) => {
  const accessToken  = signAccessToken({ id: parent._id, email: parent.email, type: 'parent' });
  const refreshToken = signRefreshToken({ id: parent._id, type: 'parent' });

  parent.refreshTokenHash = hashToken(refreshToken);
  await parent.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(REFRESH_COOKIE_PATH));
  return accessToken;
};

// ── POST /api/public/auth/register ───────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { firstName, lastName, email, phone, password, address, city, state, zip } = req.body;

    if (!firstName || !lastName || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });

    const exists = await Parent.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });

    const parent = new Parent({ firstName, lastName, email, phone, password, address, city, state, zip });
    await parent.save();

    const accessToken = await issueParentTokens(res, parent);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token: accessToken,
      parent: toSafeParent(parent),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/auth/login ──────────────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required.' });

    const parent = await Parent.findOne({ email: email.toLowerCase() }).select('+password');
    if (!parent || !(await parent.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const accessToken = await issueParentTokens(res, parent);

    res.json({
      success: true,
      token: accessToken,
      parent: toSafeParent(parent),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/auth/refresh ────────────────────────────
router.post('/auth/refresh', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
      return res.status(401).json({ success: false, message: 'Refresh token invalid or expired' });
    }

    if (decoded.type !== 'parent') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const parent = await Parent.findById(decoded.id).select('+refreshTokenHash');
    if (!parent || !parent.isActive || !parent.refreshTokenHash || parent.refreshTokenHash !== hashToken(token)) {
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
      return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
    }

    const accessToken = await issueParentTokens(res, parent);

    res.json({ success: true, token: accessToken, parent: toSafeParent(parent) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/auth/logout ─────────────────────────────
router.post('/auth/logout', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        if (decoded?.id) {
          await Parent.findByIdAndUpdate(decoded.id, { refreshTokenHash: null });
        }
      } catch {
        // Already invalid/expired — nothing to revoke
      }
    }
    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions(REFRESH_COOKIE_PATH));
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/auth/me ───────────────────────────────────
router.get('/auth/me', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);
    if (!parent) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/auth/forgot-password ────────────────────
// Finds a parent by registered email and emails a temporary password.
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { sendForgotPasswordEmail } = require('../services/emailService');
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ success: false, message: 'Email is required.' });

    const parent = await Parent.findOne({ email: email.toLowerCase().trim() }).select('+password');

    // Always return the same response to prevent email enumeration
    if (!parent || !parent.isActive) {
      return res.json({ success: true, message: 'If that email is registered, you will receive a password reset email shortly.' });
    }

    // Generate a new temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

    // Save new hashed password (pre-save hook hashes it)
    parent.password = tempPassword;
    await parent.save();

    await sendForgotPasswordEmail({
      to: parent.email,
      firstName: parent.firstName,
      tempPassword,
      role: 'Parent',
      loginUrl: `${process.env.FRONTEND_URL || 'https://calcricket.org'}/login`,
    });

    res.json({ success: true, message: 'If that email is registered, you will receive a password reset email shortly.' });
  } catch (err) {
    console.error('Parent forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/public/validate-coupon ─────────────────────────
// Validate a coupon code and preview the discount — does NOT
// consume the coupon. The coupon is only decremented when the
// registration is actually saved (in POST /register below).
router.post('/validate-coupon', async (req, res) => {
  try {
    const { couponCode, programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, cartItems, checkoutMode } = req.body;
    if (checkoutMode === 'cart' && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'Cart checkout requires cartItems.' });

    if (!couponCode || (!programId && (!Array.isArray(cartItems) || cartItems.length === 0)))
      return res.status(400).json({ success: false, message: 'couponCode and programId are required.' });

    // computeRegistrationTotal will throw a descriptive error if the
    // coupon is invalid, expired, over-limit, or below minimum amount.
    const parentId = resolveOptionalParentId(req);
    const priced = Array.isArray(cartItems) && cartItems.length > 0
      ? await computeCartTotal({
          cartItems,
          couponCode: couponCode.trim().toUpperCase(),
          parentId,
        })
      : await computeRegistrationTotal({
          programId,
          batchId,
          studentCount: studentCount || 1,
          sessionsPerWeek,
          selectedDays,
          selectedMonth,
          expectedUnitPrice,
          weeklyBatchIds,
          couponCode: couponCode.trim().toUpperCase(),
          parentId,
        });

    res.json({
      success: true,
      message: `Coupon applied! You save $${priced.discount.toFixed(2)}.`,
      subtotal: priced.subtotal,
      discount: priced.discount,
      total: priced.total,
      coupon: {
        code: priced.coupon.code,
        type: priced.coupon.type,
        value: priced.coupon.value,
        description: priced.coupon.description || '',
        // Show remaining uses only if a limit exists
        usedCount: priced.coupon.usedCount,
        maxUses: priced.coupon.maxUses,
      },
    });
  } catch (err) {
    sendPaymentError(res, err, 'Could not validate this coupon.', 'validate-coupon');
  }
});

// ── POST /api/public/paypal/create-order ─────────────────────
// SECURITY: amount is NEVER taken from the request body. It is
// always recomputed from the Program/Batch stored in the database,
// so a tampered client request cannot create a PayPal order for
// less than the real price (or for $0).
router.post('/paypal/create-order', async (req, res) => {
  try {
    const { programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, couponCode, cartItems, checkoutMode } = req.body;
    if (checkoutMode === 'cart' && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'Cart checkout requires cartItems.' });

    if (!programId && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'programId is required.' });

    const parentId = resolveOptionalParentId(req);
    const priced = Array.isArray(cartItems) && cartItems.length > 0
      ? await computeCartTotal({
          cartItems,
          couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
          parentId,
        })
      : await computeRegistrationTotal({
          programId,
          batchId,
          studentCount,
          sessionsPerWeek,
          selectedDays,
          selectedMonth,
          expectedUnitPrice,
          weeklyBatchIds,
          couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
          parentId,
        });

    if (!priced.total || priced.total <= 0)
      return res.status(400).json({ success: false, message: 'This program has no payable price configured.' });

    const order = await createOrder(priced.total, priced.currency);
    if (!order.id) {
      console.error('Failed to create PayPal order:', order);
      return res.status(502).json({ success: false, message: 'Could not start the PayPal payment. Please try again.' });
    }

    res.json({
      success: true,
      orderID: order.id,
      amount: priced.total,
      discount: priced.discount,
      currency: priced.currency,
    });
  } catch (err) {
    sendPaymentError(res, err, 'Could not start the PayPal payment.', 'paypal/create-order');
  }
});

// ── POST /api/public/paypal/capture-order ────────────────────
router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { orderID, programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, couponCode, cartItems, checkoutMode } = req.body;
    if (checkoutMode === 'cart' && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'Cart checkout requires cartItems.' });
    if (!orderID)
      return res.status(400).json({ success: false, message: 'orderID required.' });

    const capture = await captureOrder(orderID);
    if (capture.status !== 'COMPLETED') {
      console.error('PayPal capture not completed:', capture?.status, orderID);
      return res.status(400).json({ success: false, message: 'Payment not completed.' });
    }

    const txnId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const capturedValue = parseFloat(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );

    // ── Duplicate/replay protection ──────────────────────────
    // A capture ID can only ever be attached to ONE registration. If it's
    // already on file, this is a replayed or duplicated capture request —
    // never honor it twice.
    if (txnId) {
      const Registration = mongoose.model('Registration');
      const existing = await Registration.findOne({ transactionId: txnId }).select('_id').lean();
      if (existing) {
        console.error(`Duplicate PayPal capture reuse attempt: ${txnId}`);
        return res.status(409).json({ success: false, message: 'This transaction has already been used.' });
      }
    }

    if (programId || (Array.isArray(cartItems) && cartItems.length > 0)) {
      const parentId = resolveOptionalParentId(req);
      const priced = Array.isArray(cartItems) && cartItems.length > 0
        ? await computeCartTotal({
            cartItems,
            couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
            parentId,
          })
        : await computeRegistrationTotal({
            programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds,
            couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
            parentId,
          });
      if (Math.abs(capturedValue - priced.total) > 0.01) {
        console.error(
          `PayPal capture amount mismatch: captured $${capturedValue}, expected $${priced.total} for program ${programId}`
        );
        return res.status(400).json({
          success: false,
          message: 'Payment amount does not match the program price. This transaction will not be honored.',
        });
      }
    }

    res.json({ success: true, transactionId: txnId, capturedAmount: capturedValue });
  } catch (err) {
    sendPaymentError(res, err, 'Could not verify the PayPal payment.', 'paypal/capture-order');
  }
});

// ── POST /api/public/stripe/create-payment-intent ─────────────
// SECURITY: same pattern as PayPal. The client sends program context,
// never a trusted amount. The server recomputes the payable total.
router.post('/stripe/create-payment-intent', async (req, res) => {
  try {
    const { programId, batchId, studentCount, sessionsPerWeek, selectedDays, selectedMonth, expectedUnitPrice, weeklyBatchIds, couponCode, cartItems, checkoutMode } = req.body;
    if (checkoutMode === 'cart' && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'Cart checkout requires cartItems.' });

    if (!programId && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'programId is required.' });

    const parentId = resolveOptionalParentId(req);
    const priced = Array.isArray(cartItems) && cartItems.length > 0
      ? await computeCartTotal({
          cartItems,
          couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
          parentId,
        })
      : await computeRegistrationTotal({
          programId,
          batchId,
          studentCount,
          sessionsPerWeek,
          selectedDays,
          selectedMonth,
          expectedUnitPrice,
          weeklyBatchIds,
          couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
          parentId,
        });

    if (!priced.total || priced.total <= 0)
      return res.status(400).json({ success: false, message: 'This program has no payable price configured.' });

    const intent = await createPaymentIntent(priced.total, priced.currency, {
      programId,
      batchId,
      studentCount: studentCount || 1,
      weeklyBatchIds: Array.isArray(weeklyBatchIds) ? weeklyBatchIds.join(',') : '',
      couponCode: couponCode ? couponCode.trim().toUpperCase() : '',
    });

    res.json({
      success: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: priced.total,
      discount: priced.discount,
      currency: priced.currency,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    });
  } catch (err) {
    sendPaymentError(res, err, 'Could not start the card payment.', 'stripe/create-payment-intent');
  }
});

// ── POST /api/public/donate/create-order ──────────────────────
// Donations are donor-chosen amounts, so — unlike program payments
// above — there's no Program/Batch price to recompute the amount
// from. We still guard against bad input: amount must be a finite
// number, at least $1, and capped at $100,000 per transaction.
router.post('/donate/create-order', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);

    if (!Number.isFinite(amount) || amount < 1 || amount > 100000)
      return res.status(400).json({ success: false, message: 'Enter a valid donation amount between $1 and $100,000.' });

    const rounded = round2(amount);
    const order = await createOrder(rounded, 'USD');
    if (!order.id) {
      console.error('Failed to create PayPal donation order:', order);
      return res.status(502).json({ success: false, message: 'Could not start the donation payment. Please try again.' });
    }

    res.json({ success: true, orderID: order.id, amount: rounded, currency: 'USD' });
  } catch (err) {
    sendPaymentError(res, err, 'Could not start the donation payment.', 'donate/create-order');
  }
});

// ── POST /api/public/donate/capture-order ─────────────────────
router.post('/donate/capture-order', async (req, res) => {
  try {
    const { orderID, donor } = req.body;
    if (!orderID)
      return res.status(400).json({ success: false, message: 'orderID required.' });

    const capture = await captureOrder(orderID);
    if (capture.status !== 'COMPLETED') {
      console.error('PayPal donation capture not completed:', capture?.status, orderID);
      return res.status(400).json({ success: false, message: 'Payment not completed.' });
    }

    const txnId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const capturedValue = parseFloat(
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );

    console.log(`Donation captured: $${capturedValue} — txn ${txnId}${donor?.email ? ` — ${donor.email}` : ''}`);

    res.json({ success: true, transactionId: txnId, capturedAmount: capturedValue });
  } catch (err) {
    sendPaymentError(res, err, 'Could not verify the donation payment.', 'donate/capture-order');
  }
});

// ── POST /api/public/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      selectedProgram, selectedBatch, selectedWeeklyBatches, students, cartItems,
      parent: parentInfo, parentId,
      paymentMethod,
      transactionId, checkNumber,
      cartCheckoutMode,
      sessionsPerWeek,
      couponCode,   // NEW — optional coupon applied at checkout
    } = req.body;

    const waiverConsent = req.body.waiverConsent;
    const waiverSignature = typeof waiverConsent?.signature === 'string'
      ? waiverConsent.signature.trim()
      : '';
    const waiverDrawnSignature = typeof waiverConsent?.drawnSignature === 'string'
      ? waiverConsent.drawnSignature.trim()
      : '';

    if (!selectedProgram?._id)
      return res.status(400).json({ success: false, message: 'Program is required.' });

    if (cartCheckoutMode === 'cart' && (!Array.isArray(cartItems) || cartItems.length === 0))
      return res.status(400).json({ success: false, message: 'Cart checkout requires cartItems.' });

    // ── SECURITY: never trust req.body.parentId ─────────────────────
    // The frontend sends parentId for logged-in checkouts, but a client
    // can put ANY id there. The only parentId this endpoint will ever
    // act on is the one recovered from a verified Bearer access token —
    // "Parent can pay only their own registrations." If the body claims
    // an identity that the token doesn't back (missing token, wrong
    // token, or a mismatched id), the request is rejected outright
    // rather than silently downgraded to a guest registration.
    const authenticatedParentId = resolveOptionalParentId(req);
    if (parentId && !authenticatedParentId) {
      logUnauthorizedAttempt({ reason: 'parentId in body with no valid session', claimedParentId: String(parentId) });
      return res.status(401).json({ success: false, message: 'Your session has expired. Please log in again to complete this registration.' });
    }
    if (parentId && authenticatedParentId && String(parentId) !== String(authenticatedParentId)) {
      logUnauthorizedAttempt({ reason: 'parentId mismatch', claimedParentId: String(parentId), authenticatedParentId: String(authenticatedParentId) });
      return res.status(403).json({ success: false, message: 'You are not authorized to register under that account.' });
    }

    // ── SECURITY: duplicate / replayed payment protection ───────────
    // A transactionId is a real-world gateway payment that can only ever
    // be attached to one registration. Reject early if it's already on
    // file (also enforced at the DB layer via a unique index, but this
    // gives a clean 409 instead of a generic 500 for the common case).
    if (transactionId && (paymentMethod === 'Stripe' || paymentMethod === 'PayPal')) {
      const existing = await mongoose.model('Registration')
        .findOne({ transactionId }).select('_id').lean();
      if (existing) {
        logDuplicatePayment({ transactionId, paymentMethod });
        return res.status(409).json({ success: false, message: 'This transaction has already been used for a registration.' });
      }
    }

    // ── Weekly batch selection (multi-select) ──────────────────
    // batchType is always re-checked from the DB — never trust the client
    // for this, since it decides whether picking at least one batch is
    // mandatory, and it decides how many "weeks" get billed.
    const programForWeekCheck = await mongoose.model('Program')
      .findById(selectedProgram._id)
      .select('batchType weeklyBatches')
      .lean();

    if (!programForWeekCheck)
      return res.status(404).json({ success: false, message: 'Program not found.' });

    // Client may send selectedWeeklyBatches as an array of full objects
    // ({_id, ...}) or as an array of ids embedded on selectedBatch — accept
    // either shape, but always re-validate against the DB below.
    const requestedWeeklyBatchIds = (
      Array.isArray(selectedWeeklyBatches) ? selectedWeeklyBatches :
      Array.isArray(selectedBatch?.selectedWeeklyBatches) ? selectedBatch.selectedWeeklyBatches :
      []
    ).map(b => (typeof b === 'string' ? b : b?._id)).filter(Boolean);

    let matchedWeeklyBatches = [];
    if (programForWeekCheck.batchType === 'WEEKLY') {
      if (requestedWeeklyBatchIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Please select at least one batch for this program.' });
      }
      const allBatches = programForWeekCheck.weeklyBatches || [];
      const uniqueIds = [...new Set(requestedWeeklyBatchIds.map(String))];
      matchedWeeklyBatches = allBatches.filter(
        b => b.isActive !== false && uniqueIds.includes(String(b._id))
      );
      if (matchedWeeklyBatches.length !== uniqueIds.length) {
        return res.status(400).json({ success: false, message: 'One or more selected batches are not valid for this program.' });
      }
    }

    if (waiverConsent?.accepted !== true || !waiverSignature || !waiverDrawnSignature) {
      return res.status(400).json({
        success: false,
        message: 'Waiver consent, typed e-signature, and drawn digital signature are required before registration.',
      });
    }

    const studentInputs = Array.isArray(students) && students.length
      ? students
      : (req.body.student ? [req.body.student] : []);

    if (!studentInputs.length)
      return res.status(400).json({ success: false, message: 'At least one student is required.' });

    const studentName = `${studentInputs[0].firstName} ${studentInputs[0].lastName}`;

    if (!parentInfo?.email)
      return res.status(400).json({ success: false, message: 'Parent email is required.' });

    if (!parentInfo?.address || !parentInfo?.city || !parentInfo?.state || !parentInfo?.zip)
      return res.status(400).json({ success: false, message: 'A complete billing address (street, city, state, ZIP) is required.' });

    // ── SECURITY: server-computed price, coupon also re-validated here ──
    // Students may each have their own batch (multi-child with different batches).
    // If all students share the same batch, use the fast single computeRegistrationTotal path.
    // If they differ, price each student individually and sum, then apply the coupon on top.
    const studentBatchIds = studentInputs.map(s => s.selectedBatch?._id ?? selectedBatch?._id);
    const studentPriceKeys = studentInputs.map((s, index) => {
      const month = s.selectedBatch?.selectedMonth ?? selectedBatch?.selectedMonth;
      const monthLabel = typeof month === 'string' ? month : (month?.label || '');
      return `${studentBatchIds[index] || ''}:${monthLabel}`;
    });
    const allSameBatch = studentPriceKeys.every(key => key === studentPriceKeys[0]);
    const weeklyBatchIdsForPricing = matchedWeeklyBatches.map(b => String(b._id));

    let priced;
    if (Array.isArray(cartItems) && cartItems.length > 0) {
      priced = await computeCartTotal({
        cartItems,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
        parentId: authenticatedParentId,
      });
    } else if (allSameBatch) {
      const firstStudentBatch = studentInputs[0]?.selectedBatch || selectedBatch;
      priced = await computeRegistrationTotal({
        programId: selectedProgram._id,
        batchId: studentBatchIds[0],
        studentCount: studentInputs.length,
        sessionsPerWeek: firstStudentBatch?.sessionsPerWeek ?? sessionsPerWeek,
        selectedDays: firstStudentBatch?.days ?? firstStudentBatch?.timing,
        selectedMonth: firstStudentBatch?.selectedMonth,
        expectedUnitPrice: firstStudentBatch?.fee,
        weeklyBatchIds: weeklyBatchIdsForPricing,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
        parentId: authenticatedParentId,
      });
    } else {
      // Price each student's batch individually, then sum
      const { round2 } = require('../utils/pricing');
      const perStudentPriced = await Promise.all(
        studentBatchIds.map((batchId, index) =>
          computeRegistrationTotal({
            programId: selectedProgram._id,
            batchId,
            studentCount: 1,
            sessionsPerWeek: studentInputs[index]?.selectedBatch?.sessionsPerWeek ?? sessionsPerWeek,
            selectedDays: studentInputs[index]?.selectedBatch?.days ?? studentInputs[index]?.selectedBatch?.timing,
            selectedMonth: studentInputs[index]?.selectedBatch?.selectedMonth ?? selectedBatch?.selectedMonth,
            expectedUnitPrice: studentInputs[index]?.selectedBatch?.fee ?? selectedBatch?.fee,
            weeklyBatchIds: weeklyBatchIdsForPricing,
            // Coupon applied once on total below, not per-student
          })
        )
      );
      const subtotal = round2(perStudentPriced.reduce((sum, p) => sum + p.unitPrice, 0));

      // Now compute coupon discount on the combined subtotal using the first student's batch
      const pricedWithCoupon = await computeRegistrationTotal({
        programId: selectedProgram._id,
        batchId: studentBatchIds[0],
        studentCount: studentInputs.length,
        sessionsPerWeek,
        selectedDays: selectedBatch?.days ?? selectedBatch?.timing,
        selectedMonth: selectedBatch?.selectedMonth,
        expectedUnitPrice: selectedBatch?.fee,
        weeklyBatchIds: weeklyBatchIdsForPricing,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
        parentId: authenticatedParentId,
      });

      // Use the real per-student sum but take discount from the coupon computation
      const discount = pricedWithCoupon.coupon
        ? (pricedWithCoupon.coupon.type === 'PERCENTAGE'
          ? round2(subtotal * (pricedWithCoupon.coupon.value / 100))
          : round2(Math.min(pricedWithCoupon.coupon.value, subtotal)))
        : 0;

      priced = {
        ...pricedWithCoupon,
        unitPrice: subtotal / studentInputs.length,
        subtotal,
        discount,
        total: round2(subtotal - discount),
      };
    }

    const Registration = mongoose.model('Registration');
    const Student = require('../models/Student');

    // Resolve or create parent ref
    const Parent = require('../models/Parent');
    let resolvedParentId;
    if (authenticatedParentId) {
      resolvedParentId = authenticatedParentId;
      // Logged-in parent — keep their profile address in sync with whatever
      // billing address they submitted here, so it's pre-filled by default
      // on future registrations (they can still edit it any time).
      if (parentInfo?.address || parentInfo?.city || parentInfo?.state || parentInfo?.zip) {
        await Parent.findByIdAndUpdate(resolvedParentId, {
          ...(parentInfo.address ? { address: parentInfo.address } : {}),
          ...(parentInfo.city ? { city: parentInfo.city } : {}),
          ...(parentInfo.state ? { state: parentInfo.state } : {}),
          ...(parentInfo.zip ? { zip: parentInfo.zip } : {}),
        });
      }
    } else {
      let parent = await Parent.findOne({ email: parentInfo.email.toLowerCase() });
      if (!parent) {
        const crypto = require('crypto');
        parent = new Parent({
          firstName: parentInfo.parentName?.split(' ')[0] || 'Guest',
          lastName: parentInfo.parentName?.split(' ').slice(1).join(' ') || 'User',
          email: parentInfo.email,
          phone: parentInfo.phone || '000-000-0000',
          password: crypto.randomBytes(16).toString('hex'),
          address: parentInfo.address,
          city: parentInfo.city,
          state: parentInfo.state,
          zip: parentInfo.zip,
        });
        await parent.save();
      } else if (parentInfo?.address || parentInfo?.city || parentInfo?.state || parentInfo?.zip) {
        // Existing guest-checkout parent found by email — keep their saved
        // address current too, same as the logged-in path above.
        if (parentInfo.address) parent.address = parentInfo.address;
        if (parentInfo.city) parent.city = parentInfo.city;
        if (parentInfo.state) parent.state = parentInfo.state;
        if (parentInfo.zip) parent.zip = parentInfo.zip;
        await parent.save();
      }
      resolvedParentId = parent._id;
    }

    const studentIds = [];
    for (const s of studentInputs) {
      if (!s?.firstName || !s?.lastName) continue;
      const dobDate = s.dob ? new Date(s.dob) : undefined;
      const query = {
        parentId: resolvedParentId,
        firstName: new RegExp(`^${s.firstName.trim()}$`, 'i'),
        lastName: new RegExp(`^${s.lastName.trim()}$`, 'i'),
      };
      if (dobDate && !isNaN(dobDate)) query.dob = dobDate;

      let studentDoc = await Student.findOne(query);
      if (!studentDoc) {
        studentDoc = new Student({
          parentId: resolvedParentId,
          firstName: s.firstName.trim(),
          lastName: s.lastName.trim(),
          dob: dobDate && !isNaN(dobDate) ? dobDate : undefined,
          gender: s.gender || '',
          schoolName: s.schoolName || '',
          medicalNotes: s.medicalNotes || '',
        });
        await studentDoc.save();
      } else {
        if (s.schoolName) studentDoc.schoolName = s.schoolName;
        if (s.medicalNotes) studentDoc.medicalNotes = s.medicalNotes;
        if (s.gender) studentDoc.gender = s.gender;
        await studentDoc.save();
      }
      studentIds.push({
        _id: studentDoc._id,
        firstName: studentDoc.firstName,
        lastName: studentDoc.lastName,
        dob: s.dob || '',
        gender: studentDoc.gender || '',
        studentCode: studentDoc.studentCode || '',
        photoUrl: studentDoc.photoUrl || '',
      });
    }

    const pmMethod = paymentMethod === 'PayPal' ? 'PAYPAL'
      : paymentMethod === 'Stripe' ? 'STRIPE'
      : paymentMethod === 'Check' ? 'CHECK' : 'PENDING';

    let pmStatus = 'PENDING';
    let verificationNote = '';
    if (paymentMethod === 'PayPal' && transactionId) {
      try {
        const captureDetails = await getCaptureDetails(transactionId);
        const capturedValue = parseFloat(captureDetails?.amount?.value || '0');
        const capturedCurrency = captureDetails?.amount?.currency_code;
        const isCompleted = captureDetails?.status === 'COMPLETED';
        const amountMatches = Math.abs(capturedValue - priced.total) <= 0.01;
        const currencyMatches = !capturedCurrency || capturedCurrency === priced.currency;

        if (isCompleted && amountMatches && currencyMatches) {
          pmStatus = 'SUCCESS';
        } else {
          verificationNote = `PayPal verification failed (status=${captureDetails?.status}, captured=$${capturedValue} ${capturedCurrency}, expected=$${priced.total} ${priced.currency}). Registration held as PENDING for staff review.`;
          console.error(verificationNote, '— transactionId:', transactionId);
        }
      } catch (verifyErr) {
        verificationNote = `Could not verify PayPal transaction ${transactionId} with PayPal: ${verifyErr.message}. Registration held as PENDING for staff review.`;
        console.error(verificationNote);
      }
    } else if (paymentMethod === 'Stripe' && transactionId) {
      try {
        const intent = await getPaymentIntent(transactionId);
        const capturedCents = Number(intent.amount_received || 0);
        const expectedCents = toMinorUnits(priced.total);
        const isCompleted = intent.status === 'succeeded';
        const amountMatches = Math.abs(capturedCents - expectedCents) <= 1;
        const currencyMatches = !intent.currency || intent.currency.toUpperCase() === priced.currency;
        // SECURITY: the PaymentIntent's own metadata.programId (set by our
        // server when the intent was created — see /stripe/create-payment-intent
        // above) must match the program actually being registered for here.
        // Without this check, a PaymentIntent created (and paid) for a cheap
        // program could be replayed against a /register call for an
        // expensive one, since amount/currency alone don't prove *what* was
        // being paid for.
        const metadataMatches = !intent.metadata?.programId
          || String(intent.metadata.programId) === String(selectedProgram._id);

        if (isCompleted && amountMatches && currencyMatches && metadataMatches) {
          pmStatus = 'SUCCESS';
        } else {
          verificationNote = `Stripe verification failed (status=${intent?.status}, captured=${capturedCents}, expected=${expectedCents}, metadataMatches=${metadataMatches}). Registration held as PENDING for staff review.`;
          console.error(verificationNote, '— paymentIntentId:', transactionId);
        }
      } catch (verifyErr) {
        verificationNote = `Could not verify Stripe PaymentIntent ${transactionId}: ${verifyErr.message}. Registration held as PENDING for staff review.`;
        console.error(verificationNote);
      }
    }

    // ── Decrement coupon usedCount AFTER payment is confirmed ──
    // Only do this when the registration has a coupon and the payment
    // was either successful (PayPal/Stripe) or submitted (Check). Uses an
    // ATOMIC conditional update (only increments if still under the
    // limit) rather than read-then-write, so two concurrent registrations
    // racing on the last remaining use of a maxUses coupon can't both
    // succeed — this closes the duplicate-usage race window.
    let couponHonored = !!priced.coupon;
    if (priced.coupon && (pmStatus === 'SUCCESS' || paymentMethod === 'Check')) {
      const Coupon = mongoose.model('Coupon');
      const incremented = await Coupon.findOneAndUpdate(
        {
          _id: priced.coupon._id,
          isActive: true,
          $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );
      if (!incremented) {
        couponHonored = false;
        console.error(`Coupon abuse/race detected — ${priced.coupon.code} was already at its usage limit at save time.`);
      }
    }

    const studentNote = studentInputs
      .map(s => `${s.firstName} ${s.lastName} | DOB: ${s.dob || 'N/A'} | Gender: ${s.gender || 'N/A'}`)
      .join('; ');

    const monthOpt = selectedBatch?.selectedMonth || null;
    const monthDateRange = monthOpt ? fmtMonthDateRange(monthOpt.startDate, monthOpt.endDate) : '';
    const batchTitle = [
      selectedBatch?.title || selectedBatch?.name || '',
      monthOpt?.label || '',
      monthDateRange,
    ].filter(Boolean).join(' — ');
    const batchIds = [...new Set(studentBatchIds.filter(Boolean).map(String))];
    const orderItems = buildRegistrationOrderItems({
      cartItems,
      selectedProgram,
      selectedBatch,
      selectedMonth: monthOpt,
      selectedDays: selectedBatch?.days || selectedBatch?.timing,
      sessionsPerWeek,
      students: studentInputs,
      priced,
    });

    const reg = new Registration({
      parentId: resolvedParentId,
      programId: selectedProgram._id,
      students: studentIds,
      batches: batchIds,
      selectedMonth: monthOpt ? {
        label:     monthOpt.label,
        startDate: monthOpt.startDate,
        endDate:   monthOpt.endDate,
        weeks:     monthOpt.weeks != null ? String(monthOpt.weeks) : undefined,
        price:     monthOpt.price != null ? Number(monthOpt.price) : undefined,
      } : undefined,
      selectedWeeklyBatches: matchedWeeklyBatches.length ? matchedWeeklyBatches.map(b => ({
        batchId:       String(b._id),
        label:         b.label,
        startDate:     b.startDate,
        startTime:     b.startTime,
        endDate:       b.endDate,
        endTime:       b.endTime,
        groundAddress: b.groundAddress,
        ageGroups:     b.ageGroups,
        skillLevels:   b.skillLevels,
      })) : undefined,
      subtotal: priced.subtotal,
      discountAmount: priced.discount,
      totalAmount: priced.total,
      orderItems,
      couponCode: couponHonored && priced.coupon ? priced.coupon.code : undefined,
      paymentMethod: pmMethod,
      paymentStatus: pmStatus,
      transactionId: transactionId || undefined,
      checkNumber: checkNumber || undefined,
      // Check payments are NEVER auto-approved — they start life as
      // SUBMITTED and can only move forward via the admin-only
      // confirm-check / reject-check endpoints.
      checkPaymentState: pmMethod === 'CHECK' ? 'SUBMITTED' : undefined,
      status: pmStatus === 'SUCCESS' ? 'CONFIRMED' : 'AWAITING_PAYMENT',
      customerNote: studentNote,
      adminNote: verificationNote || undefined,
      waiverAccepted: true,
      waiverSignature,
      waiverDrawnSignature,
      waiverAcceptedAt: new Date(),
      waiverAgreementVersion: waiverConsent.agreementVersion || 'CCA-WAIVER-2025-10-30',
      mediaConsent: true,
      medicalConsent: true,
      paymentAuditLog: [{
        event: pmStatus === 'SUCCESS' ? 'PAYMENT_VERIFIED' : (pmMethod === 'CHECK' ? 'CHECK_SUBMITTED' : 'PAYMENT_PENDING_REVIEW'),
        note: pmMethod,
      }],
    });

    try {
      await reg.save();
    } catch (saveErr) {
      // Unique index on transactionId is the last line of defense against
      // a duplicate/replayed payment slipping past the earlier check due
      // to a race between two near-simultaneous requests.
      if (saveErr.code === 11000 && saveErr.keyPattern?.transactionId) {
        logDuplicatePayment({ transactionId, paymentMethod, reason: 'unique index conflict at save time' });
        return res.status(409).json({ success: false, message: 'This transaction has already been used for a registration.' });
      }
      throw saveErr;
    }

    if (pmStatus === 'SUCCESS') {
      logPaymentSuccess({ gateway: pmMethod, transactionId, registrationNumber: reg.registrationNumber, amount: priced.total });
    }

    sendRegistrationEmail({
      to: parentInfo.email,
      registrationNumber: reg.registrationNumber,
      studentName,
      programName: selectedProgram.title || 'CCA Program',
      batchInfo: batchTitle,
      parentName: parentInfo.parentName || parentInfo.email,
      paymentMethod,
      totalAmount: priced.total,
      transactionId,
      orderItems,
    }).catch(err => console.error('Email send failed:', err));

    return res.status(201).json({
      success: true,
      message: pmStatus === 'SUCCESS'
        ? 'Registration successful!'
        : 'Registration received and is pending payment verification.',
      registrationNumber: reg.registrationNumber,
      studentName,
      programName: selectedProgram.title,
      paymentMethod,
      paymentStatus: pmStatus,
      subtotal: priced.subtotal,
      discount: priced.discount,
      totalAmount: priced.total,
      orderItems,
      couponCode: couponHonored && priced.coupon ? priced.coupon.code : undefined,
    });
  } catch (err) {
    sendPaymentError(res, err, 'We could not complete this registration. Please try again.', 'register');
  }
});

// ============================================================
//  PARENT DASHBOARD API  —  /api/public/parent/*
//  All routes below require parentAuth and are scoped server-side
//  to req.parent.id — a parent can only ever read their own data.
// ============================================================

// ── GET /api/public/parent/dashboard ──────────────────────────
// Overview cards shown at the top of the dashboard.
router.get('/parent/dashboard', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Student = require('../models/Student');
    const Attendance = require('../models/Attendance');

    const registrations = await Registration.find({ parentId: req.parent.id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('students', 'firstName lastName studentCode photoUrl dob gender')
      .populate('batches', 'title dayOfWeek startTime endTime')
      .sort({ createdAt: -1 })
      .lean();

    const students = await Student.find({ parentId: req.parent.id, isActive: true })
      .select('firstName lastName studentCode photoUrl dob gender')
      .lean();

    const studentIds = students.map((s) => s._id);
    const recentAttendance = studentIds.length
      ? await Attendance.find({ studentId: { $in: studentIds } })
        .populate('studentId', 'firstName lastName')
        .populate('programId', 'title')
        .populate('batchId', 'title dayOfWeek')
        .sort({ date: -1 })
        .limit(10)
        .lean()
      : [];

    const totalSpent = registrations
      .filter((r) => r.paymentStatus === 'SUCCESS')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    const pendingPayments = registrations.filter((r) => r.paymentStatus === 'PENDING').length;
    const activePrograms = registrations.filter((r) => ['PAID', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(r.status)).length;

    res.json({
      success: true,
      data: {
        stats: {
          totalPrograms: registrations.length,
          activePrograms,
          totalStudents: students.length,
          totalSpent,
          pendingPayments,
        },
        recentRegistrations: registrations.slice(0, 5),
        students,
        recentAttendance,
      },
    });
  } catch (err) {
    console.error('Parent dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/purchases ───────────────────────────
router.get('/parent/purchases', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const registrations = await Registration.find({ parentId: req.parent.id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('students', 'firstName lastName studentCode photoUrl dob gender')
      .populate('batches', 'title dayOfWeek startTime endTime')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: registrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/purchases/:id ───────────────────────
router.get('/parent/purchases/:id', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Parent = require('../models/Parent');

    const registration = await Registration.findOne({ _id: req.params.id, parentId: req.parent.id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('students', 'firstName lastName studentCode photoUrl dob gender')
      .populate('batches', 'title dayOfWeek startTime endTime')
      .lean();

    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found.' });

    const parent = await Parent.findById(req.parent.id).lean();

    res.json({ success: true, data: { registration, parent } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/students ─────────────────────────────
router.get('/parent/students', parentAuth, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const Registration = mongoose.model('Registration');
    const Attendance = require('../models/Attendance');

    const students = await Student.find({ parentId: req.parent.id, isActive: true }).lean();

    const data = await Promise.all(students.map(async (s) => {
      const registrations = await Registration.find({ students: s._id })
        .populate('programId', 'title')
        .select('registrationNumber status')
        .lean();

      const attendance = await Attendance.find({ studentId: s._id }).lean();
      const present = attendance.filter((a) => a.status === 'PRESENT').length;
      const absent = attendance.filter((a) => a.status === 'ABSENT').length;
      const late = attendance.filter((a) => a.status === 'LATE').length;
      const excused = attendance.filter((a) => a.status === 'EXCUSED').length;
      const total = attendance.length;

      return {
        ...s,
        attendanceSummary: {
          present, absent, late, excused, total,
          percentage: total > 0 ? Math.round((present / total) * 100) : null,
        },
        programs: registrations.map((r) => ({
          registrationId: r._id,
          registrationNumber: r.registrationNumber,
          status: r.status,
          programTitle: r.programId?.title,
        })),
      };
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('parent/students error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/students/:id ─────────────────────────
router.get('/parent/students/:id', parentAuth, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const Registration = mongoose.model('Registration');
    const Attendance = require('../models/Attendance');

    const student = await Student.findOne({ _id: req.params.id, parentId: req.parent.id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const registrations = await Registration.find({ students: student._id })
      .populate('programId', 'title coverImageUrl basePrice discountedPrice sku startDate endDate')
      .populate('batches', 'title dayOfWeek startTime endTime')
      .sort({ createdAt: -1 })
      .lean();

    const attendance = await Attendance.find({ studentId: student._id })
      .populate('programId', 'title')
      .populate('batchId', 'title dayOfWeek')
      .sort({ date: -1 })
      .lean();

    const present = attendance.filter((a) => a.status === 'PRESENT').length;
    const absent = attendance.filter((a) => a.status === 'ABSENT').length;
    const late = attendance.filter((a) => a.status === 'LATE').length;
    const excused = attendance.filter((a) => a.status === 'EXCUSED').length;
    const total = attendance.length;

    res.json({
      success: true,
      data: {
        student,
        registrations,
        attendance,
        attendanceSummary: {
          present, absent, late, excused, total,
          percentage: total > 0 ? Math.round((present / total) * 100) : null,
        },
      },
    });
  } catch (err) {
    console.error('parent/students/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/parent/students/:id/photo ──────────────────
router.post('/parent/students/:id/photo', parentAuth, uploadStudentPhoto, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const student = await Student.findOne({ _id: req.params.id, parentId: req.parent.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No photo uploaded.' });

    student.photoPath = req.file.path;
    student.photoUrl = fileUrl(req, req.file.path);
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/profile ──────────────────────────────
router.get('/parent/profile', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id).lean();
    if (!parent) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/public/parent/profile ───────────────────────────────
router.put('/parent/profile', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { firstName, lastName, email, phone, address, city, state, zip } = req.body;

    if (email) {
      const clash = await Parent.findOne({ email: email.toLowerCase(), _id: { $ne: req.parent.id } });
      if (clash) return res.status(400).json({ success: false, message: 'That email is already in use by another account.' });
    }

    const update = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (email !== undefined) update.email = email.toLowerCase();
    if (phone !== undefined) update.phone = phone;
    if (address !== undefined) update.address = address;
    if (city !== undefined) update.city = city;
    if (state !== undefined) update.state = state;
    if (zip !== undefined) update.zip = zip;

    const parent = await Parent.findByIdAndUpdate(req.parent.id, update, { new: true });
    res.json({ success: true, data: parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/public/parent/profile/password ──────────────────────
router.put('/parent/profile/password', parentAuth, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    const parent = await Parent.findById(req.parent.id).select('+password');
    if (!parent || !(await parent.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    parent.password = newPassword; // re-hashed by the pre('save') hook
    await parent.save();

    res.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/parent/profile/photo ─────────────────────────
router.post('/parent/profile/photo', parentAuth, uploadStudentPhoto, async (req, res) => {
  try {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id);
    if (!parent) return res.status(404).json({ success: false, message: 'Not found.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No photo uploaded.' });

    parent.photoPath = req.file.path;
    parent.photoUrl = fileUrl(req, req.file.path);
    await parent.save();

    res.json({ success: true, data: parent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
//  MESSAGING (Parent side) — /api/public/parent/messages/*
//  One thread per (parent, batch) pair, mirroring how the admin
//  and coach inboxes already read this same MessageThread model.
// ============================================================

// ── GET /api/public/parent/messages/batches ───────────────────
// Which batches this parent is actually enrolled in — only those
// can be picked when starting a new message thread.
router.get('/parent/messages/batches', parentAuth, async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const registrations = await Registration.find({
      parentId: req.parent.id,
      status: { $in: ['PAID', 'CONFIRMED', 'PENDING', 'AWAITING_PAYMENT'] },
    })
      .populate({ path: 'batches', select: 'title dayOfWeek startTime endTime' })
      .populate('programId', 'title')
      .populate('students', 'firstName lastName')
      .lean();

    const byBatch = new Map();
    for (const reg of registrations) {
      for (const batch of reg.batches || []) {
        if (!batch?._id) continue;
        const key = String(batch._id);
        if (!byBatch.has(key)) {
          byBatch.set(key, {
            _id: batch._id,
            title: batch.title,
            dayOfWeek: batch.dayOfWeek,
            startTime: batch.startTime,
            endTime: batch.endTime,
            programTitle: reg.programId?.title,
            studentNames: [],
          });
        }
        const entry = byBatch.get(key);
        for (const s of reg.students || []) {
          const name = `${s.firstName} ${s.lastName}`;
          if (!entry.studentNames.includes(name)) entry.studentNames.push(name);
        }
      }
    }

    res.json({ success: true, data: Array.from(byBatch.values()) });
  } catch (err) {
    console.error('parent/messages/batches error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/public/parent/messages ────────────────────────────
router.get('/parent/messages', parentAuth, async (req, res) => {
  try {
    const MessageThread = mongoose.model('MessageThread');
    const threads = await MessageThread.find({ parentId: req.parent.id })
      .populate('batchId', 'title dayOfWeek startTime endTime')
      .sort({ lastMessageAt: -1 })
      .lean();

    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/parent/messages ───────────────────────────
// Starts a new thread. SECURITY: batchId must be one the parent is
// actually enrolled in — otherwise anyone with a JWT could message
// staff about a batch they have nothing to do with.
router.post('/parent/messages', parentAuth, async (req, res) => {
  try {
    const { batchId, subject, body, studentName } = req.body;
    if (!batchId || !subject?.trim() || !body?.trim())
      return res.status(400).json({ success: false, message: 'batchId, subject, and body are required.' });

    const Registration = mongoose.model('Registration');
    const owns = await Registration.findOne({ parentId: req.parent.id, batches: batchId });
    if (!owns)
      return res.status(403).json({ success: false, message: "You're not enrolled in that batch." });

    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id).select('firstName lastName').lean();

    const MessageThread = mongoose.model('MessageThread');
    const thread = new MessageThread({
      parentId: req.parent.id,
      batchId,
      subject: subject.trim(),
      studentName,
      messages: [{
        senderRole: 'PARENT',
        senderId: req.parent.id,
        senderName: `${parent?.firstName || ''} ${parent?.lastName || ''}`.trim() || 'Parent',
        body: body.trim(),
        readByParent: true,
      }],
      lastMessageAt: new Date(),
    });
    await thread.save();
    await thread.populate('batchId', 'title dayOfWeek startTime endTime');

    res.status(201).json({ success: true, data: thread });
  } catch (err) {
    console.error('create message thread error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/public/parent/messages/:threadId/reply ────────────
router.post('/parent/messages/:threadId/reply', parentAuth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, message: 'Message body is required.' });

    const MessageThread = mongoose.model('MessageThread');
    const thread = await MessageThread.findOne({ _id: req.params.threadId, parentId: req.parent.id });
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

    const Parent = require('../models/Parent');
    const parent = await Parent.findById(req.parent.id).select('firstName lastName').lean();

    thread.messages.push({
      senderRole: 'PARENT',
      senderId: req.parent.id,
      senderName: `${parent?.firstName || ''} ${parent?.lastName || ''}`.trim() || 'Parent',
      body: body.trim(),
      readByParent: true,
    });
    thread.lastMessageAt = new Date();
    if (thread.status === 'RESOLVED') thread.status = 'OPEN'; // re-opens if parent follows up
    await thread.save();
    await thread.populate('batchId', 'title dayOfWeek startTime endTime');

    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
