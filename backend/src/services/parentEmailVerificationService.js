const crypto = require('crypto');
const { sendParentVerificationEmail } = require('./emailService');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');

async function sendParentVerification(parent) {
  if (!parent?.password) throw new Error('A guest record without a password cannot activate a parent portal account.');
  const rawToken = crypto.randomBytes(32).toString('hex');
  parent.accountStatus = 'PENDING_VERIFICATION';
  parent.isVerified = false;
  parent.emailVerificationTokenHash = tokenHash(rawToken);
  parent.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
  parent.emailVerificationSentAt = new Date();
  parent.refreshTokenHash = null;
  await parent.save({ validateBeforeSave: false });

  const publicBaseUrl = (process.env.HOME_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verificationUrl = `${publicBaseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await sendParentVerificationEmail({ to: parent.email, firstName: parent.firstName, verificationUrl });
  return { expiresAt: parent.emailVerificationExpiresAt };
}

async function verifyParentEmail(rawToken) {
  const Parent = require('../models/Parent');
  if (!rawToken) return null;
  const parent = await Parent.findOne({
    emailVerificationTokenHash: tokenHash(rawToken),
    emailVerificationExpiresAt: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt +password');
  if (!parent) return null;
  parent.isVerified = true;
  parent.accountStatus = 'ACTIVE';
  parent.emailVerifiedAt = new Date();
  parent.emailVerificationTokenHash = undefined;
  parent.emailVerificationExpiresAt = undefined;
  await parent.save({ validateBeforeSave: false });
  return parent;
}

module.exports = { sendParentVerification, tokenHash, verifyParentEmail };
