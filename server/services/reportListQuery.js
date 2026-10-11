const { z } = require('zod');

const statuses = ['pending', 'accepted', 'in_progress', 'resolved'];

const isDate = (value) => {
  if (!value) return true;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).default(''),
  category: z.string().trim().max(100).default(''),
  status: z.string().trim().max(100).default('').refine(
    (value) => !value || value.split(',').every((status) => statuses.includes(status)),
    'Status must contain valid report statuses.',
  ),
  department: z.string().trim().max(100).default(''),
  priority: z.enum(['', 'low', 'medium', 'high', 'critical']).default(''),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scope: z.enum(['available', 'mine', 'community']).optional(),
}).superRefine((query, context) => {
  if (!isDate(query.from)) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'From date must be a valid calendar date.' });
  }
  if (!isDate(query.to)) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'To date must be a valid calendar date.' });
  }
  if (query.from && query.to && query.from > query.to) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'To date must be on or after the from date.' });
  }
});

module.exports = { reportListQuerySchema };
