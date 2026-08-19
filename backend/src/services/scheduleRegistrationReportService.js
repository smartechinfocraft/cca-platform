const DAY_NAMES = {
  MON: 'Monday', MONDAY: 'Monday', TUE: 'Tuesday', TUES: 'Tuesday', TUESDAY: 'Tuesday',
  WED: 'Wednesday', WEDNESDAY: 'Wednesday', THU: 'Thursday', THUR: 'Thursday', THURS: 'Thursday', THURSDAY: 'Thursday',
  FRI: 'Friday', FRIDAY: 'Friday', SAT: 'Saturday', SATURDAY: 'Saturday', SUN: 'Sunday', SUNDAY: 'Sunday',
};
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const text = value => value === null || value === undefined ? '' : String(value).trim();
const fullName = person => `${person?.firstName || ''} ${person?.lastName || ''}`.trim();

function splitSchedules(value) {
  return text(value)
    .split(/\s*(?:\n|;|\s+\|\s+|\s+\+\s+|,\s*(?=[A-Z][a-z]+day\b))\s*/i)
    .map(value => value.trim()).filter(Boolean);
}

function minutesAndLabel(rawHour, rawMinute, meridiem) {
  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (meridiem) {
    if (hour === 12) hour = 0;
    if (meridiem.toUpperCase() === 'PM') hour += 12;
  }
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return { minutes: hour * 60 + minute, label: `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}` };
}

function parseSchedule(value, fallbackLocation = '') {
  const raw = text(value);
  const dayMatch = raw.match(/\b(MON(?:DAY)?|TUE(?:S|SDAY)?|WED(?:NESDAY)?|THU(?:R|RS|RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/i);
  const day = dayMatch ? DAY_NAMES[dayMatch[1].toUpperCase()] : 'Unspecified day';
  const timePattern = /\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/gi;
  const matches = [...raw.matchAll(timePattern)];
  const start = matches[0] ? minutesAndLabel(matches[0][1], matches[0][2], matches[0][3]) : { minutes: 9999, label: '' };
  const end = matches[1] ? minutesAndLabel(matches[1][1], matches[1][2], matches[1][3] || matches[0]?.[3]) : { minutes: 9999, label: '' };
  const afterTime = matches[1] ? raw.slice((matches[1].index || 0) + matches[1][0].length) : '';
  const location = text(afterTime.replace(/^[\s\-–—@|]+/, '')) || text(fallbackLocation) || 'Unspecified location';
  const scheduleLabel = [day, start.label && `${start.label} - ${end.label}`, location].filter(Boolean).join(' - ');
  const normalizedLocation = location.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const dayIndex = DAY_ORDER.indexOf(day);
  return {
    day, dayOrder: dayIndex === -1 ? 99 : dayIndex, startTime: start.label, endTime: end.label,
    startMinutes: start.minutes, location, scheduleLabel: scheduleLabel || raw,
    key: `${day}|${start.minutes}|${end.minutes}|${normalizedLocation || raw.toUpperCase()}`,
  };
}

function batchSchedules(registration) {
  return (registration.batches || []).flatMap(batch => {
    const days = batch.dayOfWeek === 'MULTI' ? batch.multiDays || [] : [batch.dayOfWeek];
    const location = batch.location?.address || batch.location?.title || batch.location?.city || '';
    return days.filter(Boolean).map(day => `${DAY_NAMES[text(day).toUpperCase()] || day} - ${batch.startTime} - ${batch.endTime} - ${location}`);
  });
}

function resolveStudents(registration, item) {
  const students = item.students?.length ? item.students : registration.students || [];
  return students.length ? students : [{}];
}

function studentIdentity(student, registrationId) {
  return text(student._id || student.studentCode)
    || `${registrationId}:${fullName(student).toLowerCase()}:${text(student.dob).slice(0, 10)}`;
}

function buildScheduleRegistrationReport(registrations, programById = new Map()) {
  const groups = new Map();
  for (const registration of registrations) {
    const items = registration.orderItems?.length ? registration.orderItems : [{
      programId: registration.programId?._id || registration.programId,
      programTitle: registration.programId?.title,
      selectedDays: '', students: registration.students,
      feePerStudent: (registration.students?.length || 1) ? Number(registration.totalAmount || 0) / (registration.students?.length || 1) : 0,
    }];
    items.forEach((item, itemIndex) => {
      const program = programById.get(text(item.programId)) || registration.programId || {};
      const category = program.category || {};
      const ageGroup = (program.ageGroups || []).filter(Boolean).join(' / ') || 'Unspecified';
      const programTitle = text(item.programTitle || program.title) || 'Unspecified program';
      const fallbackLocation = program.location?.address || program.location?.title || program.location?.city || '';
      const schedules = splitSchedules(item.selectedDays);
      const sourceSchedules = schedules.length ? schedules : batchSchedules(registration);
      (sourceSchedules.length ? sourceSchedules : ['']).forEach(scheduleValue => {
        const schedule = parseSchedule(scheduleValue, fallbackLocation);
        const groupKey = `${schedule.key}|${ageGroup}|${text(program._id || item.programId) || programTitle}`;
        if (!groups.has(groupKey)) groups.set(groupKey, {
          key: groupKey, ...schedule, ageGroup, programId: text(program._id || item.programId), programTitle,
          categoryId: text(category._id), categoryTitle: text(category.title) || 'Uncategorized', students: [], _studentIds: new Set(),
        });
        const group = groups.get(groupKey);
        resolveStudents(registration, item).forEach((student, studentIndex) => {
          const identity = studentIdentity(student, text(registration._id));
          const detailKey = `${text(registration._id)}:${itemIndex}:${studentIndex}:${schedule.key}`;
          if (group.students.some(row => row.key === detailKey)) return;
          group._studentIds.add(identity);
          group.students.push({
            key: detailKey, studentId: text(student.studentCode || student._id), studentName: fullName(student) || 'Unknown student',
            dob: text(student.dob).slice(0, 10), gender: text(student.gender), registrationId: text(registration._id),
            registrationNumber: text(registration.registrationNumber), status: text(registration.status), paymentMethod: text(registration.paymentMethod),
            parentName: fullName(registration.parentId), parentEmail: text(registration.parentId?.email), parentPhone: text(registration.parentId?.phone),
            feePerStudent: Number(item.feePerStudent || 0), createdAt: registration.createdAt,
          });
        });
      });
    });
  }
  return [...groups.values()].map(group => {
    const { _studentIds, ...output } = group;
    return { ...output, studentCount: _studentIds.size };
  }).sort((a, b) => a.dayOrder - b.dayOrder || a.startMinutes - b.startMinutes || a.programTitle.localeCompare(b.programTitle));
}

module.exports = { buildScheduleRegistrationReport, parseSchedule, splitSchedules };
