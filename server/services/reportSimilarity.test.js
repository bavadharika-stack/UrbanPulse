const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTextSimilarity, isLikelyDuplicate } = require('./reportSimilarity');

test('detects reports that share several meaningful words despite small wording changes', () => {
  const existing = {
    title: 'Broken streetlight near school',
    description: 'The streetlight is not working and the road is dark at night.',
  };
  const submitted = {
    title: 'Streetlight not working',
    description: 'The road near school stays dark at night.',
  };

  assert.ok(calculateTextSimilarity(existing, submitted) >= 0.5);
  assert.equal(isLikelyDuplicate(existing, submitted), true);
});

test('does not group unrelated reports or reports with only generic words in common', () => {
  assert.equal(isLikelyDuplicate(
    { title: 'Overflowing rubbish bin', description: 'Waste blocks the footpath.' },
    { title: 'Broken streetlight', description: 'The road is dark at night.' },
  ), false);
  assert.equal(isLikelyDuplicate(
    { title: 'Road issue', description: 'There is a problem.' },
    { title: 'Road problem', description: 'There is an issue.' },
  ), false);
});
