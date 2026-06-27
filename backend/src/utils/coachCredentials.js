// ============================================================
//  utils/coachCredentials.js
//  Generates the auto username / unique id / password for a
//  newly-created coach.
//
//  Format requested:
//    username : firstname.lastname  (lowercase, deduped with a
//               number suffix if it's already taken)
//    coachUid : short unique code, e.g. "RAVI4821"
//    password : <coachname>@<coachUniqueId>
//               e.g.  ravisharma@RAVI4821
// ============================================================
const mongoose = require('mongoose');

const slugifyName = (str) =>
  (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ''); // strip spaces/punctuation entirely for the password's "coachname" part

// "Ravi Sharma" -> "ravi.sharma"
const baseUsername = (firstName, lastName) =>
  `${(firstName || '').toLowerCase().trim()}.${(lastName || '').toLowerCase().trim()}`
    .replace(/[^a-z.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/(^\.|\.$)/g, '');

// Random 4-digit suffix appended to first name for the uid, e.g. RAVI4821
const makeUidCandidate = (firstName) => {
  const namePart = (firstName || 'COACH').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'COACH';
  const numPart  = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return `${namePart}${numPart}`;
};

/**
 * Generates a guaranteed-unique username + coachUid, and builds the
 * plain-text password from them. Call BEFORE creating the Coach doc.
 */
async function generateCoachCredentials(firstName, lastName) {
  const Coach = mongoose.model('Coach');

  // ── Unique username ──────────────────────────────────────
  let username = baseUsername(firstName, lastName) || 'coach';
  let suffix = 0;
  let candidate = username;
  // eslint-disable-next-line no-await-in-loop
  while (await Coach.findOne({ username: candidate })) {
    suffix += 1;
    candidate = `${username}${suffix}`;
  }
  username = candidate;

  // ── Unique coachUid ──────────────────────────────────────
  let coachUid = makeUidCandidate(firstName);
  // eslint-disable-next-line no-await-in-loop
  while (await Coach.findOne({ coachUid })) {
    coachUid = makeUidCandidate(firstName);
  }

  // ── Password : <coachname>@<coachUniqueId> ───────────────
  const coachNamePart = slugifyName(`${firstName}${lastName}`);
  const password = `${coachNamePart}@${coachUid}`;

  return { username, coachUid, password };
}

module.exports = { generateCoachCredentials };
