const express = require('express');
const geocodeController = require('../controllers/geocodeController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.get('/search', authenticateToken, authorizeRoles('citizen'), geocodeController.search);

module.exports = router;
