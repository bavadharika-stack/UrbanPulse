const express = require('express');
const adminController = require('../controllers/adminController');
const locationController = require('../controllers/locationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, authorizeRoles('admin'));
router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.post('/users/:id/deactivate', adminController.deactivateUser);
router.get('/locations', adminController.locations);
router.patch('/locations/:id/status', locationController.updatePlaceStatus);
router.get('/audit', adminController.listAudit);

module.exports = router;
