const test = require('node:test');
const assert = require('node:assert/strict');
const reportCategories = require('../../shared/reportCategories.json');
const { calculatePriority, getCategorySeverity, getDepartment } = require('./reportRules');

test('every shared report category has a department and severity assignment', () => {
  for (const category of reportCategories) {
    assert.notEqual(getDepartment(category), 'Public Works Department', `${category} needs a department`);
    assert.ok(getCategorySeverity(category).label, `${category} needs a severity`);
  }
});

test('public safety and electricity route to their respective departments', () => {
  assert.equal(getDepartment('Public Safety'), 'Public Safety Department');
  assert.equal(getDepartment('Electricity'), 'Electrical Department');
});

test('confirmation counts escalate calculated priority without removing hazard mention weight', () => {
  const base = { category: 'Parks', sameLocationCount: 0, description: 'A damaged park bench.' };
  assert.equal(calculatePriority(base).priority, 'low');
  assert.equal(calculatePriority({ ...base, confirmationCount: 3 }).priority, 'medium');
  assert.equal(calculatePriority({ ...base, confirmationCount: 10 }).priority, 'high');
  assert.equal(calculatePriority({
    ...base,
    description: 'A damaged park bench near a school.',
    confirmationCount: 3,
  }).priority, 'high');
});
