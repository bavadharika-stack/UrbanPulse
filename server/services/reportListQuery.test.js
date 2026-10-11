const test = require('node:test');
const assert = require('node:assert/strict');
const { reportListQuerySchema } = require('./reportListQuery');

test('applies safe pagination defaults and accepts bounded pagination/filter inputs', () => {
  assert.deepEqual(reportListQuerySchema.parse({}), {
    page: 1,
    pageSize: 20,
    q: '',
    category: '',
    status: '',
    department: '',
    priority: '',
  });
  assert.equal(reportListQuerySchema.safeParse({
    page: '4',
    pageSize: '50',
    q: 'street light',
    status: 'pending,in_progress',
    from: '2025-01-01',
    to: '2025-02-01',
  }).success, true);
  assert.equal(reportListQuerySchema.safeParse({ scope: 'community' }).success, true);
});

test('rejects invalid page sizes, status filters, and date ranges', () => {
  assert.equal(reportListQuerySchema.safeParse({ pageSize: '101' }).success, false);
  assert.equal(reportListQuerySchema.safeParse({ page: '0' }).success, false);
  assert.equal(reportListQuerySchema.safeParse({ status: 'removed' }).success, false);
  assert.equal(reportListQuerySchema.safeParse({ from: '2025-02-01', to: '2025-01-01' }).success, false);
  assert.equal(reportListQuerySchema.safeParse({ from: '2025-02-30' }).success, false);
});
