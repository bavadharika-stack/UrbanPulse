const CACHE_DURATION_MS = 10 * 60 * 1000;
const USER_WINDOW_MS = 60 * 1000;
const USER_REQUEST_LIMIT = 20;
const UPSTREAM_INTERVAL_MS = 1000;
const config = require('../config');

const cache = new Map();
const userRequests = new Map();
let nextUpstreamRequestAt = 0;
let upstreamQueue = Promise.resolve();
const inFlight = new Map();

class GeocoderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'GeocoderError';
    this.status = status;
  }
}

const enforceUserLimit = (userId, now = Date.now()) => {
  const requests = (userRequests.get(userId) || []).filter((time) => now - time < USER_WINDOW_MS);
  if (requests.length >= USER_REQUEST_LIMIT) {
    userRequests.set(userId, requests);
    throw new GeocoderError('Search limit reached. Please wait a minute before searching again.', 429);
  }
  requests.push(now);
  userRequests.set(userId, requests);
};

const requestUpstream = async (url, fetchImpl = fetch) => {
  const request = upstreamQueue.then(async () => {
    const waitMs = Math.max(0, nextUpstreamRequestAt - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nextUpstreamRequestAt = Date.now() + UPSTREAM_INTERVAL_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetchImpl(url, {
        headers: {
          'User-Agent': config.geocoderUserAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  });
  upstreamQueue = request.catch(() => {});
  return request;
};

const normalizeResults = (results) => results.map((result) => {
  const address = typeof result.display_name === 'string' ? result.display_name : '';
  return {
    name: typeof result.name === 'string' && result.name.trim()
      ? result.name
      : address.split(',')[0],
    address,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  };
});

const searchPlaces = async ({ query, userId, fetchImpl = fetch }) => {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  enforceUserLimit(String(userId));
  const cacheKey = normalizedQuery.toLocaleLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  if (cached) cache.delete(cacheKey);

  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
  const search = (async () => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', normalizedQuery);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('addressdetails', '1');
    let response;
    try {
      response = await requestUpstream(url, fetchImpl);
    } catch (error) {
      throw new GeocoderError(
        error.name === 'AbortError'
          ? 'Place search timed out. Please try again shortly.'
          : 'Could not reach OpenStreetMap place search. Please try again shortly.',
      );
    }
    if (!response.ok) {
      throw new GeocoderError(`OpenStreetMap place search is temporarily unavailable (HTTP ${response.status}).`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new GeocoderError('OpenStreetMap returned an unreadable search response.');
    }
    if (!Array.isArray(payload)) {
      throw new GeocoderError('OpenStreetMap returned an invalid search response.');
    }
    const results = normalizeResults(payload).filter((result) => (
      Number.isFinite(result.latitude) && Number.isFinite(result.longitude)
    ));
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_DURATION_MS });
    return results;
  })();
  inFlight.set(cacheKey, search);
  try {
    return await search;
  } finally {
    inFlight.delete(cacheKey);
  }
};

module.exports = { GeocoderError, searchPlaces };
