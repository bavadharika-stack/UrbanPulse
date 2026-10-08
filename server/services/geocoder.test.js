const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config');
const { GeocoderError, searchPlaces } = require('./geocoder');

test('searches India with Nominatim limits and caches results', async () => {
  let calls = 0;
  let requestedUrl;
  let requestedAgent;
  const fetchImpl = async (url, options) => {
    calls += 1;
    requestedUrl = new URL(url);
    requestedAgent = options.headers['User-Agent'];
    return {
      ok: true,
      json: async () => [{
        name: 'Marina Beach',
        display_name: 'Marina Beach, Chennai, Tamil Nadu, India',
        lat: '13.05',
        lon: '80.2824',
      }],
    };
  };
  const first = await searchPlaces({ query: '  Marina   Beach ', userId: 'cache-test-user', fetchImpl });
  const second = await searchPlaces({ query: 'marina beach', userId: 'cache-test-user', fetchImpl });
  assert.equal(calls, 1);
  assert.equal(requestedUrl.searchParams.get('countrycodes'), 'in');
  assert.equal(requestedUrl.searchParams.get('limit'), '5');
  assert.equal(requestedAgent, config.geocoderUserAgent);
  assert.deepEqual(first, second);
  assert.equal(first[0].latitude, 13.05);
});

test('enforces a per-user search request limit', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [] });
  const userId = 'limit-test-user';
  for (let index = 0; index < 20; index += 1) {
    await searchPlaces({ query: 'Cached limit test query', userId, fetchImpl });
  }
  await assert.rejects(
    searchPlaces({ query: 'Cached limit test query', userId, fetchImpl }),
    (error) => error instanceof GeocoderError && error.status === 429,
  );
});

test('returns a clear error when Nominatim is unavailable', async () => {
  await assert.rejects(
    searchPlaces({
      query: 'Unavailable geocoder test',
      userId: 'failure-test-user',
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /OpenStreetMap place search is temporarily unavailable/,
  );
});
