import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestCategory } from './categorySuggestion.mjs';

test('suggests the matching existing category from plain report language', () => {
  assert.equal(suggestCategory('The street light beside the park is dark.'), 'Lighting');
  assert.equal(suggestCategory('A pothole has damaged the road near the crosswalk.'), 'Road & Infrastructure');
  assert.equal(suggestCategory('There is an exposed wire near the bus stop.'), 'Electricity');
});

test('does not suggest a category when the description has no known issue keyword', () => {
  assert.equal(suggestCategory('Please inspect this public space soon.'), '');
});
