const { z } = require('zod');
const adminRepository = require('../db/admin');
const engagementRepository = require('../db/engagement');
const { db } = require('../db');

const idSchema = z.coerce.number().int().positive();

exports.listUsers = (req, res, next) => {
  const query = z.object({
    role: z.enum(['', 'citizen', 'ngo', 'authority', 'admin']).default(''),
    status: z.enum(['', 'pending', 'active', 'rejected', 'deactivated']).default(''),
  }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ success: false, message: 'Invalid user filters.' });
  try {
    return res.json({ success: true, users: adminRepository.listUsers(query.data) });
  } catch (error) {
    return next(error);
  }
};

exports.updateUserStatus = (req, res, next) => {
  const id = idSchema.safeParse(req.params.id);
  const body = z.object({ status: z.enum(['active', 'rejected', 'deactivated']) }).safeParse(req.body);
  if (!id.success || !body.success) {
    return res.status(400).json({ success: false, message: 'Provide a valid user ID and status.' });
  }
  try {
    const user = adminRepository.updateUserStatus({
      actorId: req.user.id,
      userId: id.data,
      status: body.data.status,
    });
    if (!user) return res.status(404).json({ success: false, message: 'User was not found or cannot be modified.' });
    return res.json({ success: true, user });
  } catch (error) {
    return next(error);
  }
};

exports.listAudit = (req, res, next) => {
  const query = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
    action: z.string().trim().max(80).default(''),
    recordType: z.string().trim().max(40).default(''),
    q: z.string().trim().max(120).default(''),
  }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ success: false, message: 'Invalid audit log filters.' });
  try {
    return res.json({ success: true, ...engagementRepository.getAuditLog(query.data) });
  } catch (error) {
    return next(error);
  }
};

exports.deactivateUser = (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'User ID must be a positive integer.' });
  const user = adminRepository.updateUserStatus({ actorId: req.user.id, userId: id.data, status: 'deactivated' });
  if (!user) return res.status(404).json({ success: false, message: 'User was not found or cannot be deactivated.' });
  return res.json({ success: true, user });
};

exports.locations = (req, res) => {
  const locations = db.prepare(`
    SELECT id, name, status, is_user_added AS isUserAdded, address
    FROM locations ORDER BY is_user_added DESC, name
  `).all();
  return res.json({ success: true, locations });
};
