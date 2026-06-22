// ============================================================
//  utils/californiaTime.js
//  Every attendance record's "day" must be calculated in
//  America/Los_Angeles time, regardless of what timezone the
//  server itself happens to be running in (Render/Railway/etc.
//  servers are usually UTC). Without this, a scan at 11:30pm
//  Pacific could get filed under the wrong calendar day, or a
//  student could accidentally be allowed to scan in "twice" for
//  what is the same Pacific day if server-UTC midnight doesn't
//  line up with Pacific midnight.
// ============================================================

const CA_TIMEZONE = 'America/Los_Angeles';

/**
 * Returns the start-of-day (00:00:00.000) instant for "today" in
 * America/Los_Angeles, expressed as a JS Date (which is always UTC
 * internally — Date has no timezone of its own — but the moment in
 * time it represents is the correct Pacific midnight).
 */
function startOfTodayCalifornia(referenceDate = new Date()) {
  return startOfDayCalifornia(referenceDate);
}

/**
 * Returns the start-of-day instant for ANY given date, as observed
 * in America/Los_Angeles.
 */
function startOfDayCalifornia(date) {
  // Get the Y-M-D as seen in Los Angeles for the given instant.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });

  // Build an ISO string for midnight on that Y-M-D, then ask what UTC
  // offset Los Angeles has on that date (handles PST/PDT automatically),
  // and apply it to get the true UTC instant of Pacific midnight.
  const y = map.year, m = map.month, d = map.day;

  // Find the UTC offset for this date by comparing a known UTC instant
  // to its LA wall-clock rendering.
  const utcNoon = new Date(`${y}-${m}-${d}T12:00:00.000Z`);
  const laAtUtcNoon = new Intl.DateTimeFormat('en-US', {
    timeZone: CA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(utcNoon);
  const [laHour, laMinute] = laAtUtcNoon.split(':').map(Number);

  // Offset in hours behind UTC (7 during PDT, 8 during PST), derived
  // from the difference between UTC noon and LA's clock at that instant.
  const offsetHours = 12 - laHour - (laMinute > 0 ? laMinute / 60 : 0);

  // Pacific midnight = UTC midnight + offsetHours, on the same Y-M-D.
  const utcMillis = Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0) + offsetHours * 60 * 60 * 1000;
  return new Date(utcMillis);
}

/**
 * Returns the current date/time formatted for display purposes in
 * California time, e.g. for email timestamps or admin UI.
 */
function nowCaliforniaDisplay() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CA_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
}

module.exports = { CA_TIMEZONE, startOfTodayCalifornia, startOfDayCalifornia, nowCaliforniaDisplay };
