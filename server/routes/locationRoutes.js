const express = require('express');
const locationController = require('../controllers/locationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', locationController.list);
router.get(
  '/moderation',
  authenticateToken,
  authorizeRoles('authority'),
  locationController.listForModeration,
);
router.post(
  '/',
  authenticateToken,
  authorizeRoles('citizen'),
  locationController.createPlace,
);
router.get('/:id/scores', locationController.getLocationScores);
router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('authority'),
  locationController.updatePlaceStatus,
);

module.exports = router;
