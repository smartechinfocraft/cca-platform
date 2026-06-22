// ============================================================
//  db.js — MongoDB connection using Mongoose
//  Called from server.js and seed.js
//
//  FIX: Uses path.resolve so it works whether you call
//  `node src/config/seed.js` from backend/ OR from any dir.
// ============================================================
const path     = require('path');
const mongoose = require('mongoose');

// Load .env using absolute path — works from any working directory
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        'MONGODB_URI is not defined.\n' +
        '  → Make sure .env exists in the backend/ folder\n' +
        '  → It should contain: MONGODB_URI=mongodb+srv://...'
      );
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10s timeout
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
