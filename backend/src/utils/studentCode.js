function buildStudentCode(objectId) {
  const hex = String(objectId || '').replace(/[^a-fA-F0-9]/g, '');
  if (!hex) throw new Error('A valid student ObjectId is required to generate studentCode.');
  return `CCA-STU-${BigInt(`0x${hex}`).toString(36).toUpperCase()}`;
}

module.exports = { buildStudentCode };
