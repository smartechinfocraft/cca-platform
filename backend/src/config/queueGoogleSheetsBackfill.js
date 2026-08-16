const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const connectDB = require('./db');
require('../models/Parent');
require('../models/Program');
require('../models/Student');
require('../models/index');

async function run() {
  await connectDB();
  const Registration = require('mongoose').model('Registration');
  const result = await Registration.updateMany(
    {
      $or: [
        { status: 'CONFIRMED' },
        { status: 'AWAITING_PAYMENT', paymentMethod: 'CHECK' },
      ],
    },
    {
      $set: {
        'googleSheetSync.state': 'PENDING',
        'googleSheetSync.requestedAt': new Date(),
        'googleSheetSync.attempts': 0,
      },
      $unset: {
        'googleSheetSync.lastError': 1,
        'googleSheetSync.nextRetryAt': 1,
        'googleSheetSync.lockedAt': 1,
      },
    }
  );
  console.log(`Queued ${result.modifiedCount} eligible registration(s) for Google Sheets backfill.`);
  process.exit(0);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
