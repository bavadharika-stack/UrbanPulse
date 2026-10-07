const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { uploadReportImage } = require('../middleware/reportUpload');

const router = express.Router();

router.use(authenticateToken);
router.post(
  '/',
  authorizeRoles('citizen'),
  uploadReportImage,
  reportController.create,
);
router.get('/', authorizeRoles('citizen', 'ngo', 'authority'), reportController.list);
router.get('/:id', authorizeRoles('citizen', 'ngo', 'authority'), reportController.getById);
router.patch('/:id/verify', authorizeRoles('ngo'), reportController.verify);
router.post('/:id/accept', authorizeRoles('ngo'), reportController.accept);
router.patch('/:id/status', authorizeRoles('ngo'), reportController.updateStatus);

module.exports = router;
