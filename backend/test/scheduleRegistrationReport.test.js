const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScheduleRegistrationReport, parseSchedule, splitSchedules } = require('../src/services/scheduleRegistrationReportService');

test('splits multiple schedules without splitting address commas', () => {
  assert.deepEqual(splitSchedules('Wednesday - 4:30 PM - 6:00 PM - Cupertino, CA + Saturday - 9:00 AM - 10:30 AM - Dublin, CA'), [
    'Wednesday - 4:30 PM - 6:00 PM - Cupertino, CA', 'Saturday - 9:00 AM - 10:30 AM - Dublin, CA',
  ]);
});

test('normalizes a schedule for stable grouping', () => {
  const schedule = parseSchedule('Wed - 6:00 PM - 7:30 PM - 47100 Fernald Street, Fremont');
  assert.equal(schedule.day, 'Wednesday');
  assert.equal(schedule.startMinutes, 1080);
  assert.equal(schedule.location, '47100 Fernald Street, Fremont');
});

test('puts each student in each selected day and groups peers together', () => {
  const program = { _id: 'p1', title: 'U8 Beginners', ageGroups: ['U8'], category: { _id: 'c1', title: 'Fall 2026' } };
  const registration = { _id: 'r1', registrationNumber: 'CCA-1', status: 'CONFIRMED', paymentMethod: 'STRIPE', programId: program,
    parentId: { firstName: 'Pat', lastName: 'Parent' }, orderItems: [{ programId: 'p1', programTitle: program.title,
      selectedDays: 'Wednesday - 6:00 PM - 7:30 PM - Fremont + Sunday - 10:30 AM - 12:00 PM - Fremont',
      students: [{ firstName: 'Sam', lastName: 'One' }, { firstName: 'Jo', lastName: 'Two' }],
    }],
  };
  const report = buildScheduleRegistrationReport([registration], new Map([['p1', program]]));
  assert.equal(report.length, 2);
  assert.deepEqual(report.map(group => group.studentCount), [2, 2]);
});
