const mongoose = require('mongoose');
const connectDB = require('./db');

const round2 = value => Math.round((Number(value) || 0) * 100) / 100;
const countCorrect = value => Math.max(1, String(value || '').split(/\s*(?:\+|\||\n)\s*/).map(v => v.trim()).filter(Boolean).length);
const countBuggy = value => Math.max(1, String(value || '').split(/\s*(?:\+|\||,|\n)\s*/).map(v => v.trim()).filter(Boolean).length);

async function run() {
  await connectDB();
  require('../models/index');
  const Registration = mongoose.model('Registration');
  const from = new Date(process.env.AUDIT_FROM || '2026-07-11T00:00:00+05:30');
  if (Number.isNaN(from.getTime())) throw new Error('AUDIT_FROM must be a valid date.');
  const registrations = await Registration.find({ createdAt: { $gte: from } })
    .select('registrationNumber createdAt paymentMethod paymentStatus status subtotal discountAmount totalAmount orderItems')
    .sort({ createdAt: 1 })
    .lean();

  const flagged = [];
  for (const registration of registrations) {
    const items = Array.isArray(registration.orderItems) ? registration.orderItems : [];
    let correctedSubtotal = 0;
    let hasTrigger = false;
    let highConfidence = items.length > 0;
    const itemAudit = items.map(item => {
      const correctCount = countCorrect(item.selectedDays);
      const buggyCount = countBuggy(item.selectedDays);
      const baseMonthPrice = Number(item.selectedMonth?.price);
      const students = Number(item.studentCount) || item.students?.length || 1;
      const storedFee = Number(item.feePerStudent) || 0;
      const expectedFee = baseMonthPrice > 0 ? round2(baseMonthPrice * correctCount) : 0;
      const trigger = buggyCount > correctCount;
      hasTrigger ||= trigger;
      if (!(baseMonthPrice > 0)) highConfidence = false;
      correctedSubtotal += expectedFee > 0 ? expectedFee * students : Number(item.itemTotal) || storedFee * students;
      return {
        program: item.programTitle,
        correctSelections: correctCount,
        legacyParsedSelections: buggyCount,
        storedSessionsPerWeek: Number(item.sessionsPerWeek) || 0,
        baseMonthPrice: round2(baseMonthPrice),
        storedFeePerStudent: round2(storedFee),
        expectedFeePerStudent: round2(expectedFee),
        students,
        trigger,
      };
    });
    if (!hasTrigger) continue;
    correctedSubtotal = round2(correctedSubtotal);
    const correctedTotal = round2(Math.max(0, correctedSubtotal - (Number(registration.discountAmount) || 0)));
    const potentialOvercharge = round2((Number(registration.totalAmount) || 0) - correctedTotal);
    flagged.push({
      registrationNumber: registration.registrationNumber,
      createdAt: registration.createdAt,
      paymentMethod: registration.paymentMethod,
      paymentStatus: registration.paymentStatus,
      registrationStatus: registration.status,
      storedSubtotal: round2(registration.subtotal),
      storedDiscount: round2(registration.discountAmount),
      storedTotal: round2(registration.totalAmount),
      correctedSubtotal,
      correctedTotal,
      potentialOvercharge,
      confidence: highConfidence && potentialOvercharge > 0 ? 'HIGH' : 'REVIEW',
      items: itemAudit,
    });
  }

  const summary = {
    auditFrom: from.toISOString(),
    scanned: registrations.length,
    flagged: flagged.length,
    highConfidence: flagged.filter(row => row.confidence === 'HIGH').length,
    successfullyPaidFlagged: flagged.filter(row => row.paymentStatus === 'SUCCESS').length,
    unpaidFlagged: flagged.filter(row => row.paymentStatus !== 'SUCCESS').length,
    potentialOverchargeTotal: round2(flagged.filter(row => row.confidence === 'HIGH').reduce((sum, row) => sum + Math.max(0, row.potentialOvercharge), 0)),
  };
  console.log(JSON.stringify({ summary, registrations: flagged }, null, 2));
  await mongoose.disconnect();
}

run().catch(async error => {
  console.error(JSON.stringify({ auditError: error.message }));
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
