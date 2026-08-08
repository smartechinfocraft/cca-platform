const mongoose = require('mongoose');
const connectDB = require('./db');

async function run() {
  await connectDB();
  require('../models/index');
  const Registration = mongoose.model('Registration');
  const filter = {
    paymentMethod: { $in: ['STRIPE', 'PAYPAL'] },
    paymentStatus: 'FAILED',
    status: { $in: ['PENDING', 'AWAITING_PAYMENT'] },
  };
  const candidates = await Registration.countDocuments(filter);
  const result = await Registration.updateMany(filter, {
    $set: { status: 'PAYMENT_FAILED' },
    $push: { paymentAuditLog: { event: 'PAYMENT_FAILED_STATUS_MIGRATED', note: 'Historical failed online payment status corrected.' } },
  });
  console.log(`Payment-failure migration: ${candidates} candidate(s), ${result.modifiedCount} updated.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Payment-failure migration failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
