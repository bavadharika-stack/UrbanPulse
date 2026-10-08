const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAddPlaceToday,
  createPlaceSchema,
  distanceMeters,
  findDuplicatePlace,
} = require('./placeRules');

test('validates location names and coordinate boundaries', () => {
  const validPlace = { name: 'Community Park', latitude: 90, longitude: -180 };
  assert.equal(createPlaceSchema.safeParse(validPlace).success, true);
  assert.equal(createPlaceSchema.safeParse({ ...validPlace, latitude: 90.01 }).success, false);
  assert.equal(createPlaceSchema.safeParse({ ...validPlace, longitude: -180.01 }).success, false);
  assert.equal(createPlaceSchema.safeParse({ ...validPlace, name: 'xy' }).success, false);
  assert.equal(createPlaceSchema.safeParse({ ...validPlace, latitude: NaN }).success, false);
});

test('measures distance and detects same-name or nearby active locations', () => {
  const existing = [
    { id: 1, name: 'Marina View', latitude: 13.05, longitude: 80.2824 },
    { id: 2, name: 'Besant Nagar Park', latitude: 13.0, longitude: 80.27 },
  ];
  assert.ok(distanceMeters(
    { latitude: 13.05, longitude: 80.2824 },
    { latitude: 13.0501, longitude: 80.2824 },
  ) < 50);
  assert.equal(findDuplicatePlace(
    { name: 'New Name', latitude: 13.0501, longitude: 80.2824 },
    existing,
  ).id, 1);
  assert.equal(findDuplicatePlace(
    { name: 'marina view', latitude: 12.9, longitude: 80.2 },
    existing,
  ).id, 1);
  assert.equal(findDuplicatePlace(
    { name: 'Existing place without coordinates', latitude: 12, longitude: 80 },
    [{ id: 3, name: 'Existing place without coordinates', latitude: null, longitude: null }],
  ).id, 3);
  assert.equal(findDuplicatePlace(
    { name: 'Remote Park', latitude: 12.8, longitude: 80.1 },
    existing,
  ), null);
});

test('allows at most five new places per citizen each day', () => {
  assert.equal(canAddPlaceToday(0), true);
  assert.equal(canAddPlaceToday(4), true);
  assert.equal(canAddPlaceToday(5), false);
  assert.equal(canAddPlaceToday(6), false);
});
