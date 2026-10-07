const express = require('express');
const ngoController = require('../controllers/ngoController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, authorizeRoles('ngo'));
router.get('/availability', ngoController.getAvailability);
router.put('/availability', ngoController.setAvailability);

module.exports = router;
