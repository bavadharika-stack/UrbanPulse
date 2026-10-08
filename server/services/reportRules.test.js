const test = require('node:test');
const assert = require('node:assert/strict');
const reportCategories = require('../../shared/reportCategories.json');
const { getCategorySeverity, getDepartment } = require('./reportRules');

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
