const test = require('node:test');
const assert = require('node:assert/strict');
const { countSelectedDays } = require('../src/utils/pricing');

test('a comma inside a ground address does not create a second selected day', () => {
  assert.equal(countSelectedDays('Sunday - 9:00 AM - 10:30 AM - 768 Portola Street, San Francisco'), 1);
});

test('explicit schedule separators still count multiple selected days', () => {
  assert.equal(countSelectedDays('Tuesday - 4:00 PM - 5:30 PM - Cupertino + Thursday - 4:00 PM - 5:30 PM - Cupertino'), 2);
  assert.equal(countSelectedDays('Saturday - 10:30 AM - Noon | Sunday - Noon - 1:30 PM'), 2);
});

test('two selected days with street, city, state addresses count as two, not six', () => {
  const selected = [
    'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino, CA',
    'Thursday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino, CA',
  ].join(' + ');
  assert.equal(countSelectedDays(selected), 2);
});

test('three selected days with comma-separated addresses count as three, not nine', () => {
  const selected = [
    'Tuesday - 4:00 PM - 5:30 PM - 10800 Torre Avenue, Cupertino, CA',
    'Saturday - 10:30 AM - 12:00 PM - 10253 North Portal Avenue, Cupertino, CA',
    'Sunday - 12:00 PM - 1:30 PM - 315 Woodhams Road, Santa Clara, CA',
  ].join(' + ');
  assert.equal(countSelectedDays(selected), 3);
});
