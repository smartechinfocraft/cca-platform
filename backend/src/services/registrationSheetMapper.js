const HEADERS = [
  'Sync Key', 'Registration ID', 'Registration #', 'Registration Date', 'Last Updated',
  'Status', 'Payment Status', 'Payment Method', 'Check #', 'Transaction ID',
  'Student ID', 'Student Name', 'DOB', 'Age', 'Gender',
  'Parent Name', 'Parent Email', 'Parent Phone', 'Program', 'Batch',
  'Selected Batch Schedule(s)', 'Selected Month', 'Sessions / Week', 'Location',
  'Fee Per Student', 'Registration Total', 'Coupon', 'Synced At',
];

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function sanitizeSheetName(value, fallback = 'Registrations') {
  const sanitized = text(value).replace(/[\\/?*\[\]:]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
  return sanitized || fallback;
}

function fullName(person) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
}

function splitSchedules(value) {
  return text(value)
    .split(/\s*(?:\n|;|\s+\|\s+|\s+\+\s+|,\s*(?=[A-Z][a-z]+day\b))\s*/i)
    .map(item => item.trim())
    .filter(Boolean);
}

function scheduleText(value) {
  return splitSchedules(value).map(schedule => `• ${schedule}`).join('\n');
}

function ageFromDob(dob) {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age--;
  return age >= 0 ? age : '';
}

function dateValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text(value) : date.toISOString();
}

function monthText(item, registration) {
  return text(item?.selectedMonthLabel || item?.selectedMonth?.label || registration.selectedMonth?.label);
}

function topLevelStudents(registration) {
  return (registration.students || []).filter(student => student?.firstName || student?.lastName || student?.studentCode);
}

function fallbackOrderItem(registration) {
  const batches = registration.batches || [];
  const schedules = batches.map(batch => {
    const day = batch.dayOfWeek === 'MULTI' ? (batch.multiDays || []).join('/') : batch.dayOfWeek;
    const timing = [batch.startTime, batch.endTime].filter(Boolean).join(' - ');
    const location = batch.location?.title || batch.location?.city || batch.location?.address;
    return [day, timing, location].filter(Boolean).join(' - ');
  }).filter(Boolean).join(' + ');
  return {
    programTitle: registration.programId?.title,
    batchName: batches.map(batch => batch.title).filter(Boolean).join(', '),
    selectedDays: schedules,
    selectedMonth: registration.selectedMonth,
    studentCount: topLevelStudents(registration).length || 1,
    feePerStudent: topLevelStudents(registration).length
      ? Number(registration.totalAmount || 0) / topLevelStudents(registration).length
      : Number(registration.totalAmount || 0),
    students: topLevelStudents(registration),
  };
}

function mapRegistrationToSheetRows(registration, syncedAt = new Date(), programById = new Map()) {
  const registrationId = text(registration._id);
  const parent = registration.parentId || {};
  const items = registration.orderItems?.length ? registration.orderItems : [fallbackOrderItem(registration)];

  return items.flatMap((item, itemIndex) => {
    const itemProgram = programById.get(String(item.programId || '')) || registration.programId || {};
    const categoryName = sanitizeSheetName(
      itemProgram.category?.title || registration.programId?.category?.title,
      process.env.GOOGLE_SHEETS_TAB_NAME || 'Registrations'
    );
    const students = item.students?.length ? item.students : topLevelStudents(registration);
    const displayStudents = students.length ? students : [{}];
    return displayStudents.map((student, studentIndex) => {
      const syncKey = `${registrationId}:${itemIndex}:${studentIndex}`;
      const location = registration.programId?.location?.title
        || registration.programId?.location?.city
        || registration.programId?.location?.address
        || '';
      return {
        key: syncKey,
        sheetName: categoryName,
        values: [
          syncKey,
          registrationId,
          text(registration.registrationNumber),
          dateValue(registration.createdAt),
          dateValue(registration.updatedAt),
          text(registration.status),
          text(registration.paymentStatus),
          text(registration.paymentMethod),
          text(registration.checkNumber),
          text(registration.transactionId),
          text(student.studentCode),
          fullName(student),
          dateValue(student.dob),
          ageFromDob(student.dob),
          text(student.gender),
          fullName(parent),
          text(parent.email),
          text(parent.phone),
          text(item.programTitle || itemProgram.title || registration.programId?.title),
          text(item.batchName),
          scheduleText(item.selectedDays),
          monthText(item, registration),
          item.sessionsPerWeek || '',
          location,
          Number(item.feePerStudent || 0),
          Number(registration.totalAmount || 0),
          text(registration.couponCode),
          syncedAt.toISOString(),
        ],
      };
    });
  });
}

function isSheetSyncEligible(registration) {
  return registration.status === 'CONFIRMED'
    || (registration.status === 'AWAITING_PAYMENT' && registration.paymentMethod === 'CHECK');
}

module.exports = { HEADERS, isSheetSyncEligible, mapRegistrationToSheetRows, sanitizeSheetName, splitSchedules };
