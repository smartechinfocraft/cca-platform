// ============================================================
//  utils/allowlist.js — Payload Allowlisting helper
//  ------------------------------------------------------------
//  Central choke point for Mass Assignment protection. Every
//  controller/route that writes data coming from req.body must
//  run it through pickAllowedFields() before handing it to
//  Mongoose (new Model(), Model.create(), Object.assign(doc, ...),
//  findByIdAndUpdate(), etc).
//
//  Rules enforced here:
//   1. Only fields explicitly listed in an endpoint's own
//      `allowedFields` array are copied out of req.body — every
//      other key on the incoming payload is silently ignored.
//   2. A hard-coded blocklist of sensitive/internal fields is
//      stripped even if a route's allowlist accidentally includes
//      one of them (defense in depth — one mistake in one route
//      shouldn't create a privilege-escalation hole).
//   3. `undefined` values are never copied, so "field not sent"
//      and "field explicitly cleared" stay distinguishable for
//      callers that want to check `!== undefined`.
// ============================================================

// Fields that must NEVER be settable directly from a request body,
// anywhere in the app, regardless of which allowlist a route defines.
// This is the last line of defense for the fields the spec calls out
// explicitly: role/permissions, password internals, verification/
// admin flags, timestamps, payment fields, tokens, and internal ids.
const ALWAYS_PROTECTED_FIELDS = [
  '_id', 'id', '__v',
  'role', 'roles', 'permissions', 'isAdmin',
  'password', 'passwordHash',
  'isVerified',
  'status', // account ACTIVE/INACTIVE toggles go through dedicated endpoints, not generic body updates
  'createdAt', 'updatedAt',
  'paymentStatus', 'paymentAmount', 'paymentId', 'transactionId',
  'refreshToken', 'refreshTokenHash',
  'accessToken', 'token', 'jwt',
  'createdBy', 'updatedBy', 'markedBy',
];

/**
 * Returns a brand-new object containing ONLY the keys that are:
 *   (a) present in `allowedFields`, AND
 *   (b) not on the ALWAYS_PROTECTED_FIELDS blocklist, AND
 *   (c) actually present (and not undefined) on `source`.
 *
 * Any other property on `source` (unknown fields, protected fields,
 * prototype-pollution attempts like `__proto__`/`constructor`, etc.)
 * is dropped silently.
 *
 * @param {object} source        Usually req.body
 * @param {string[]} allowedFields  Explicit allowlist for this endpoint
 * @returns {object} sanitized payload safe to pass to Mongoose
 */
function pickAllowedFields(source, allowedFields = []) {
  const result = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;

  for (const field of allowedFields) {
    if (ALWAYS_PROTECTED_FIELDS.includes(field)) continue; // defense in depth
    if (field === '__proto__' || field === 'constructor' || field === 'prototype') continue;

    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      result[field] = source[field];
    }
  }

  return result;
}

module.exports = { pickAllowedFields, ALWAYS_PROTECTED_FIELDS };
