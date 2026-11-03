const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Program = require('../src/models/Program');
const programController = require('../src/controllers/programController');
const { UPLOAD_BASE } = require('../src/middleware/upload');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('program duplication copies program details, generates fresh identifiers, and stays inactive', async () => {
  const sourceId = new mongoose.Types.ObjectId();
  const sourceCreatorId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const sourceData = {
    _id: sourceId,
    __v: 3,
    slug: 'original-program',
    sku: 'CCA-ORIGINAL-PROGRAM',
    category: new mongoose.Types.ObjectId(),
    location: new mongoose.Types.ObjectId(),
    coachId: new mongoose.Types.ObjectId(),
    title: 'Original Program',
    batchType: 'REGULAR_WITH_MONTH',
    ageGroups: ['U10'],
    skillLevels: ['Beginner'],
    cities: ['Cupertino'],
    basePrice: 430,
    discountedPrice: 400,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-10-31'),
    registrationDeadline: new Date('2026-07-25'),
    maxCapacity: 30,
    shortDescription: 'Short details',
    detailedDescription: 'Full details',
    specialNote: 'Bring water',
    isFeatured: true,
    isActive: true,
    showEndDate: true,
    coverImagePath: undefined,
    coverImageUrl: 'https://example.test/original.png',
    sessionsPerWeek: 2,
    monthOptions: [{ _id: new mongoose.Types.ObjectId(), label: 'August', weeks: 4, price: 860, isEnabled: true }],
    weekOptions: [{ _id: new mongoose.Types.ObjectId(), label: 'Week 1', startDate: '2026-08-01', endDate: '2026-08-07' }],
    weeklyBatches: [{
      _id: new mongoose.Types.ObjectId(),
      label: 'Week one',
      startDate: '2026-08-01',
      startTime: '09:00',
      endDate: '2026-08-07',
      endTime: '10:00',
      groundAddress: 'CCA Ground',
      ageGroups: ['U10'],
      skillLevels: ['Beginner'],
      isActive: true,
      isSubWeek: false,
    }],
    scheduleDays: [{
      _id: new mongoose.Types.ObjectId(),
      day: 'SAT',
      startTime: '09:00',
      endTime: '10:00',
      groundAddress: 'CCA Ground',
    }],
    createdBy: sourceCreatorId,
    updatedBy: sourceCreatorId,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
  };
  const source = {
    toObject: () => sourceData,
  };

  const originalFindById = Program.findById;
  const originalSave = Program.prototype.save;
  Program.findById = async () => source;
  Program.prototype.save = async function save() { return this; };

  try {
    const response = createResponse();
    await programController.duplicate({
      params: { id: String(sourceId) },
      user: { _id: adminId },
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.success, true);
    const duplicate = response.body.data;
    assert.notEqual(String(duplicate._id), String(sourceId));
    assert.equal(duplicate.title, 'Original Program');
    assert.equal(String(duplicate.category), String(sourceData.category));
    assert.equal(String(duplicate.location), String(sourceData.location));
    assert.equal(String(duplicate.coachId), String(sourceData.coachId));
    assert.equal(duplicate.batchType, 'REGULAR_WITH_MONTH');
    assert.deepEqual(duplicate.ageGroups, ['U10']);
    assert.deepEqual(duplicate.skillLevels, ['Beginner']);
    assert.deepEqual(duplicate.cities, ['Cupertino']);
    assert.equal(duplicate.basePrice, 430);
    assert.equal(duplicate.discountedPrice, 400);
    assert.equal(duplicate.maxCapacity, 30);
    assert.equal(duplicate.shortDescription, 'Short details');
    assert.equal(duplicate.detailedDescription, 'Full details');
    assert.equal(duplicate.specialNote, 'Bring water');
    assert.equal(duplicate.isFeatured, true);
    assert.equal(duplicate.isActive, false);
    assert.equal(duplicate.showEndDate, true);
    assert.equal(duplicate.coverImageUrl, 'https://example.test/original.png');
    assert.equal(duplicate.sessionsPerWeek, 2);
    assert.equal(duplicate.monthOptions[0].label, 'August');
    assert.equal(duplicate.monthOptions[0].price, 860);
    assert.equal(duplicate.weekOptions[0].label, 'Week 1');
    assert.equal(duplicate.weeklyBatches[0].label, 'Week one');
    assert.equal(duplicate.scheduleDays[0].day, 'SAT');
    assert.notEqual(String(duplicate.monthOptions[0]._id), String(sourceData.monthOptions[0]._id));
    assert.notEqual(String(duplicate.weeklyBatches[0]._id), String(sourceData.weeklyBatches[0]._id));
    assert.notEqual(String(duplicate.scheduleDays[0]._id), String(sourceData.scheduleDays[0]._id));
    assert.equal(String(duplicate.createdBy), String(adminId));
    assert.equal(duplicate.updatedBy, undefined);
    assert.equal(duplicate.slug, undefined);
    assert.equal(duplicate.sku, undefined);
    assert.equal(duplicate.createdAt, undefined);
    assert.equal(duplicate.updatedAt, undefined);
  } finally {
    Program.findById = originalFindById;
    Program.prototype.save = originalSave;
  }
});

test('program duplication makes an independent copy of the cover image', async () => {
  const programsDirectory = path.join(UPLOAD_BASE, 'programs');
  const tempDirectory = fs.mkdtempSync(path.join(programsDirectory, 'duplicate-test-'));
  const sourceCoverPath = path.join(tempDirectory, 'source.png');
  const imageContent = Buffer.from('program cover image test data');
  fs.writeFileSync(sourceCoverPath, imageContent);

  const source = {
    coverImagePath: sourceCoverPath,
    toObject: () => ({
      _id: new mongoose.Types.ObjectId(),
      title: 'Program with image',
      category: new mongoose.Types.ObjectId(),
      basePrice: 100,
      scheduleDays: [],
    }),
  };
  const originalFindById = Program.findById;
  const originalSave = Program.prototype.save;
  Program.findById = async () => source;
  Program.prototype.save = async function save() { return this; };
  let duplicateCoverPath;

  try {
    const response = createResponse();
    await programController.duplicate({
      params: { id: String(source.toObject()._id) },
      user: { _id: new mongoose.Types.ObjectId() },
      protocol: 'https',
      get: () => 'admin.example.test',
    }, response);

    assert.equal(response.statusCode, 201);
    duplicateCoverPath = response.body.data.coverImagePath;
    assert.notEqual(duplicateCoverPath, sourceCoverPath);
    assert.deepEqual(fs.readFileSync(duplicateCoverPath), imageContent);
    assert.match(response.body.data.coverImageUrl, /\/uploads\/programs\//);
  } finally {
    Program.findById = originalFindById;
    Program.prototype.save = originalSave;
    if (duplicateCoverPath && fs.existsSync(duplicateCoverPath)) fs.unlinkSync(duplicateCoverPath);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
