const test = require('node:test');
const assert = require('node:assert/strict');
const { average, colorBand, scoreLocation } = require('./scoreEngine');

const location = { id: 1, name: 'Test Place', latitude: 13, longitude: 80 };
const rating = (values = {}) => ({
  cleanliness: 5,
  safety: 5,
  lighting: 5,
  accessibility: 5,
  seating: 5,
  shade: 5,
  water_availability: 5,
  ...values,
});

test('maps average 1-5 ratings to 0-100 metric scores and averages available scores', () => {
  const result = scoreLocation({ location, ratings: [rating()] });
  assert.deepEqual(result.scores, {
    accessibility: 100,
    walkability: 100,
    safety: 100,
    cleanliness: 100,
    heatComfort: 100,
    overall: 100,
  });
});

test('applies open report penalties and an additional penalty for verified safety reports', () => {
  const reports = [
    { category: 'Accessibility', status: 'pending' },
    { category: 'Road & Infrastructure', status: 'accepted' },
    { category: 'Public Safety', status: 'pending', verified: 0 },
    { category: 'Public Safety', status: 'in_progress', verified: 1 },
    { category: 'Waste Management', status: 'resolved' },
    { category: 'Sanitation & Cleanliness', status: 'pending' },
  ];
  const result = scoreLocation({ location, ratings: [rating()], reports });
  assert.equal(result.scores.accessibility, 90);
  assert.equal(result.scores.walkability, 90);
  assert.equal(result.scores.safety, 75);
  assert.equal(result.scores.cleanliness, 90);
  assert.equal(result.openReportCount, 5);
});

test('ignores unresolved rating dimensions and returns null where there is no data', () => {
  const result = scoreLocation({
    location,
    ratings: [{ ...rating(), shade: null, water_availability: null }],
  });
  assert.equal(result.scores.heatComfort, null);
  assert.equal(result.scores.overall, 100);
  assert.equal(scoreLocation({ location }).scores.overall, null);
  assert.equal(scoreLocation({ location }).colorBand, null);
});

test('applies red, yellow, and green color bands at the required boundaries', () => {
  assert.equal(colorBand(49.99), 'red');
  assert.equal(colorBand(50), 'yellow');
  assert.equal(colorBand(74.99), 'yellow');
  assert.equal(colorBand(75), 'green');
  assert.equal(colorBand(null), null);
});

test('weights optional shade and water dimensions equally when some entries are missing', () => {
  const result = scoreLocation({
    location,
    ratings: [
      rating({ shade: 5, water_availability: null }),
      rating({ shade: 5, water_availability: null }),
      rating({ shade: null, water_availability: 1 }),
    ],
  });
  assert.equal(result.scores.heatComfort, 60);
});

test('labels the weakest score and a short issue summary', () => {
  const result = scoreLocation({
    location,
    ratings: [rating({ cleanliness: 1 })],
  });
  assert.equal(result.weakestScore.label, 'Cleanliness');
  assert.equal(result.mainIssue, 'Cleanliness needs improvement');
  assert.equal(average([null, undefined]), null);
});

test('returns a contributing rating count and flags scores with fewer than three ratings', () => {
  const result = scoreLocation({
    location,
    ratings: [
      rating({ shade: null, water_availability: null }),
      rating({ shade: 4, water_availability: null }),
    ],
  });
  assert.deepEqual(result.scoreCounts, {
    accessibility: 2,
    walkability: 2,
    safety: 2,
    cleanliness: 2,
    heatComfort: 1,
    overall: 2,
  });
  assert.equal(result.confidence.safety, 'low');
  assert.equal(result.confidence.heatComfort, 'low');
  assert.equal(result.confidence.overall, 'low');
  const wellRated = scoreLocation({ location, ratings: [rating(), rating(), rating()] });
  assert.equal(wellRated.confidence.safety, 'normal');
  assert.equal(wellRated.confidence.overall, 'normal');
});
