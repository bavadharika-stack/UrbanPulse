const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeImpact } = require('./impactRules');

test('calculates impact counts and average resolution duration', () => {
  const summary = summarizeImpact([
    {
      status: 'resolved',
      acceptedByNgoId: 2,
      verified: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      resolvedAt: '2026-01-01T12:00:00.000Z',
    },
    {
      status: 'pending',
      acceptedByNgoId: null,
      verified: 0,
      createdAt: '2026-01-02T00:00:00.000Z',
      resolvedAt: null,
    },
    {
      status: 'in_progress',
      acceptedByNgoId: 2,
      verified: 0,
      createdAt: '2026-01-03T00:00:00.000Z',
      resolvedAt: null,
    },
  ]);
  assert.deepEqual(summary, {
    found: 3,
    accepted: 2,
    verified: 1,
    resolved: 1,
    pending: 1,
    averageResolutionHours: 12,
  });
});

test('returns null resolution duration when no reports are resolved', () => {
  assert.equal(summarizeImpact([{ status: 'pending' }]).averageResolutionHours, null);
});
