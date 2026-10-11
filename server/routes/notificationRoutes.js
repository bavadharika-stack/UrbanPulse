const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);

module.exports = router;
