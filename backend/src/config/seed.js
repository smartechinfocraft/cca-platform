// ============================================================
//  seed.js — Seeds the database with initial admin accounts
//  Run: node src/config/seed.js
//
//  SECURITY: credentials come from your .env file (or are
//  randomly generated if you don't set them) — never hardcoded
//  in this script. A hardcoded admin password in source code
//  means anyone who gets a copy of this repo has the real login.
//
//  Set these in your .env to control what gets seeded:
//    SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_EMAIL
//  If you don't set SUPER_ADMIN_PASSWORD, a random one is generated
//  and printed ONCE — write it down, it isn't stored anywhere else.
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const crypto = require('mongoose').mongo ? require('crypto') : require('crypto');
const mongoose = require('mongoose');

console.log('📌 MONGODB_URI loaded:', process.env.MONGODB_URI ? '✅ Yes' : '❌ No — check .env file');

const connectDB = require('./db');
const User = require('../models/User'); // full model — pre-save hook hashes password

function randomPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

const seed = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to MongoDB\n');

    const deleted = await User.deleteMany({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } });
    console.log(`🗑  Cleared ${deleted.deletedCount} existing admin user(s)`);

    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || randomPassword();
    const admin1Password = process.env.SEED_ADMIN1_PASSWORD || randomPassword();
    const admin2Password = process.env.SEED_ADMIN2_PASSWORD || randomPassword();

    const admins = [
      {
        username:  process.env.SUPER_ADMIN_USERNAME || 'superadmin',
        email:     process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com',
        password:  superAdminPassword,
        firstName: 'Super',
        lastName:  'Admin',
        role:      'SUPER_ADMIN',
        status:    'ACTIVE',
      },
      {
        username:  process.env.SEED_ADMIN1_USERNAME || 'admin.one',
        email:     process.env.SEED_ADMIN1_EMAIL || 'admin1@example.com',
        password:  admin1Password,
        firstName: 'Admin',
        lastName:  'One',
        role:      'ADMIN',
        status:    'ACTIVE',
      },
      {
        username:  process.env.SEED_ADMIN2_USERNAME || 'admin.two',
        email:     process.env.SEED_ADMIN2_EMAIL || 'admin2@example.com',
        password:  admin2Password,
        firstName: 'Admin',
        lastName:  'Two',
        role:      'ADMIN',
        status:    'ACTIVE',
      },
    ];

    // ✅ User.create() triggers the pre-save hook → bcrypt hashes the password
    // insertMany() skips the hook → passwords stored as plain text → login fails
    for (const adminData of admins) {
      await User.create(adminData);
    }

    console.log('\n✅ Seeded admin accounts successfully!\n');
    console.log('⚠️  WRITE THESE DOWN NOW — they are only shown this one time:\n');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log(`│  SUPER ADMIN  │ username: ${admins[0].username.padEnd(34)}│`);
    console.log(`│               │ password: ${superAdminPassword.padEnd(34)}│`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  ADMIN 1      │ username: ${admins[1].username.padEnd(34)}│`);
    console.log(`│               │ password: ${admin1Password.padEnd(34)}│`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  ADMIN 2      │ username: ${admins[2].username.padEnd(34)}│`);
    console.log(`│               │ password: ${admin2Password.padEnd(34)}│`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected. Seed complete! Now run: npm run dev');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seed();