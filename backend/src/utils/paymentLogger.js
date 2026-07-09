// ============================================================
//  utils/paymentLogger.js
//  Centralized logging for all payment-security-relevant events.
//
//  RULE: never pass card numbers, CVVs, UPI PINs, tokens, secrets, API
//  keys, or passwords into these functions. They are not redacted here —
//  callers are responsible for only ever logging IDs, amounts, statuses,
//  and other non-sensitive metadata.
// ============================================================

function base(level, event, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  const line = `[PAYMENT:${event}] ${JSON.stringify(entry)}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

module.exports = {
  logPaymentSuccess:        (details) => base('info',  'SUCCESS', details),
  logPaymentFailure:        (details) => base('error', 'FAILURE', details),
  logVerificationFailure:   (details) => base('error', 'VERIFICATION_FAILURE', details),
  logDuplicatePayment:      (details) => base('error', 'DUPLICATE_PAYMENT', details),
  logWebhookFailure:        (details) => base('error', 'WEBHOOK_FAILURE', details),
  logReplayAttack:          (details) => base('error', 'REPLAY_ATTACK', details),
  logCouponAbuse:           (details) => base('error', 'COUPON_ABUSE', details),
  logCheckApproval:         (details) => base('info',  'CHECK_APPROVED', details),
  logCheckRejection:        (details) => base('info',  'CHECK_REJECTED', details),
  logRefund:                (details) => base('info',  'REFUND_ISSUED', details),
  logUnauthorizedAttempt:   (details) => base('error', 'UNAUTHORIZED_ATTEMPT', details),
};

