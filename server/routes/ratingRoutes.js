const express = require('express');
const locationController = require('../controllers/locationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.post('/', authenticateToken, authorizeRoles('citizen'), locationController.createRating);

module.exports = router;
