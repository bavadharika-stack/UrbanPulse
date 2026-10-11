const { z } = require('zod');
const engagementRepository = require('../db/engagement');

exports.list = (req, res, next) => {
  const query = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ success: false, message: 'Invalid notification pagination.' });
  try {
    return res.json({ success: true, ...engagementRepository.getNotifications({ userId: req.user.id, ...query.data }) });
  } catch (error) {
    return next(error);
  }
};

exports.markRead = (req, res, next) => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer.' });
  try {
    if (!engagementRepository.markNotificationRead({ userId: req.user.id, notificationId: id.data })) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.json({
      success: true,
      unreadCount: engagementRepository.getNotifications({ userId: req.user.id, page: 1, pageSize: 1 }).unreadCount,
    });
  } catch (error) {
    return next(error);
  }
};
