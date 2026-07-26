const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStudentCode } = require('../src/utils/studentCode');

test('student codes are deterministic and unique for different ObjectIds', () => {
  const first = buildStudentCode('507f1f77bcf86cd799439011');
  const second = buildStudentCode('507f1f77bcf86cd799439012');
  assert.match(first, /^CCA-STU-[0-9A-Z]+$/);
  assert.notEqual(first, second);
  assert.equal(first, buildStudentCode('507f1f77bcf86cd799439011'));
});
