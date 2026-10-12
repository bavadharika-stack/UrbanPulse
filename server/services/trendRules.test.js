const test = require('node:test');
const assert = require('node:assert/strict');
const { getTrendSummary } = require('./trendRules');

test('summarizes upward, downward, stable, and unavailable score history', () => {
  const snapshots = [
    { createdAt: '2026-01-01', overall: 50 },
    { createdAt: '2026-01-20', overall: 58 },
  ];
  assert.deepEqual(getTrendSummary(snapshots, 30), { direction: 'Improving', change: 8, days: 30 });
  assert.equal(getTrendSummary([{ createdAt: '2026-01-01', overall: 65 }, { createdAt: '2026-01-02', overall: 60 }], 30).direction, 'Declining');
  assert.equal(getTrendSummary([{ createdAt: '2026-01-01', overall: 60 }], 30).direction, 'Stable');
  assert.equal(getTrendSummary([{ createdAt: '2026-01-01', overall: null }], 30).direction, 'Not enough score data');
  assert.equal(getTrendSummary([], 30).direction, 'No history yet');
});
