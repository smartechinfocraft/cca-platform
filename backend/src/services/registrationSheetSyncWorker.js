const mongoose = require('mongoose');
const { mapRegistrationToSheetRows } = require('./registrationSheetMapper');
const { syncRows, verifyConnection } = require('./googleSheetsService');

const DEFAULT_INTERVAL_MS = 30_000;
const LOCK_TIMEOUT_MS = 10 * 60_000;
let timer;
let running = false;

function retryDelay(attempts) {
  const delays = [30_000, 120_000, 600_000, 3_600_000];
  return delays[Math.min(Math.max(attempts - 1, 0), delays.length - 1)];
}

async function claimNextRegistration() {
  const Registration = mongoose.model('Registration');
  const now = new Date();
  const staleLock = new Date(Date.now() - LOCK_TIMEOUT_MS);
  return Registration.findOneAndUpdate(
    {
      $or: [
        { 'googleSheetSync.state': 'PENDING' },
        { 'googleSheetSync.state': 'FAILED', 'googleSheetSync.nextRetryAt': { $lte: now } },
        { 'googleSheetSync.state': 'PROCESSING', 'googleSheetSync.lockedAt': { $lt: staleLock } },
      ],
    },
    {
      $set: { 'googleSheetSync.state': 'PROCESSING', 'googleSheetSync.lockedAt': now },
      $inc: { 'googleSheetSync.attempts': 1 },
      $unset: { 'googleSheetSync.lastError': 1, 'googleSheetSync.nextRetryAt': 1 },
    },
    { new: true, sort: { 'googleSheetSync.requestedAt': 1 } }
  )
    .populate('parentId', 'firstName lastName email phone')
    .populate({
      path: 'programId',
      select: 'title location category',
      populate: [
        { path: 'location', select: 'title city address' },
        { path: 'category', select: 'title' },
      ],
    })
    .populate('students', 'firstName lastName studentCode dob gender')
    .populate({
      path: 'batches',
      select: 'title dayOfWeek multiDays startTime endTime location',
      populate: { path: 'location', select: 'title city address' },
    });
}

async function processOne() {
  const registration = await claimNextRegistration();
  if (!registration) return false;

  const Registration = mongoose.model('Registration');
  try {
    const syncedAt = new Date();
    const itemProgramIds = [...new Set((registration.orderItems || []).map(item => String(item.programId || '')).filter(Boolean))];
    const itemPrograms = itemProgramIds.length
      ? await mongoose.model('Program').find({ _id: { $in: itemProgramIds } })
        .select('title location category')
        .populate('category', 'title')
        .lean()
      : [];
    const programById = new Map(itemPrograms.map(program => [String(program._id), program]));
    const rows = mapRegistrationToSheetRows(registration, syncedAt, programById);
    await syncRows(rows, registration.googleSheetSync?.syncedKeys || []);
    await Registration.updateOne(
      { _id: registration._id, 'googleSheetSync.state': 'PROCESSING' },
      {
        $set: {
          'googleSheetSync.state': 'SYNCED',
          'googleSheetSync.syncedAt': syncedAt,
          'googleSheetSync.syncedKeys': rows.map(row => `${row.sheetName}::${row.key}`),
          'googleSheetSync.attempts': 0,
        },
        $unset: {
          'googleSheetSync.lockedAt': 1,
          'googleSheetSync.lastError': 1,
          'googleSheetSync.nextRetryAt': 1,
        },
      }
    );
    console.log(`✅ Google Sheets synced: ${registration.registrationNumber} (${rows.length} student row(s))`);
  } catch (error) {
    const attempts = registration.googleSheetSync?.attempts || 1;
    await Registration.updateOne(
      { _id: registration._id, 'googleSheetSync.state': 'PROCESSING' },
      {
        $set: {
          'googleSheetSync.state': 'FAILED',
          'googleSheetSync.lastError': String(error.message || error).slice(0, 1000),
          'googleSheetSync.nextRetryAt': new Date(Date.now() + retryDelay(attempts)),
        },
        $unset: { 'googleSheetSync.lockedAt': 1 },
      }
    );
    console.error(`❌ Google Sheets sync failed for ${registration.registrationNumber}:`, error.message);
  }
  return true;
}

async function runCycle() {
  if (running) return;
  running = true;
  try {
    // Drain a bounded number per cycle so a large queue cannot monopolize the process.
    for (let count = 0; count < 25; count++) {
      if (!await processOne()) break;
    }
  } catch (error) {
    console.error('❌ Google Sheets worker cycle failed:', error.message);
  } finally {
    running = false;
  }
}

function startRegistrationSheetSyncWorker() {
  if (String(process.env.GOOGLE_SHEETS_SYNC_ENABLED).toLowerCase() !== 'true') {
    console.log('ℹ️  Google Sheets registration sync is disabled.');
    return;
  }
  const interval = Math.max(Number(process.env.GOOGLE_SHEETS_SYNC_INTERVAL_MS) || DEFAULT_INTERVAL_MS, 5_000);
  console.log(`✅ Google Sheets registration sync enabled (every ${interval / 1000}s).`);
  verifyConnection()
    .then(({ tabName }) => console.log(`✅ Google Sheets connection verified: ${tabName}`))
    .catch(error => console.error('❌ Google Sheets connection verification failed:', error.message));
  setTimeout(runCycle, 1_000);
  timer = setInterval(runCycle, interval);
  timer.unref();
}

module.exports = { processOne, runCycle, startRegistrationSheetSyncWorker };
