import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMetres, findNearestPlace } from './nearestPlace.mjs';

test('finds the closest mapped place and reports its distance', () => {
  const places = [
    { id: 1, name: 'Nearby', latitude: 13.05, longitude: 80.22 },
    { id: 2, name: 'Farther', latitude: 13.1, longitude: 80.3 },
  ];
  const nearest = findNearestPlace({ latitude: 13.051, longitude: 80.221 }, places);
  assert.equal(nearest.place.id, 1);
  assert.ok(nearest.distanceMetres > 0 && nearest.distanceMetres < 200);
});

test('honors the maximum distance and ignores invalid coordinates', () => {
  const places = [
    { id: 1, name: 'Invalid', latitude: NaN, longitude: 80 },
    { id: 2, name: 'Far', latitude: 13.1, longitude: 80.3 },
  ];
  assert.equal(findNearestPlace({ latitude: 13.05, longitude: 80.22 }, places, 100), null);
  assert.ok(distanceMetres(
    { latitude: 13, longitude: 80 },
    { latitude: 13, longitude: 80.001 },
  ) > 100);
});
