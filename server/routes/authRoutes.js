const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get(
  '/me',
  authenticateToken,
  authorizeRoles('citizen', 'ngo', 'authority'),
  authController.me,
);

module.exports = router;
