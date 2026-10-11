const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRoles, requireApprovedNgo } = require('../middleware/auth');
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
router.get('/:id/history', authorizeRoles('citizen', 'ngo', 'authority', 'admin'), reportController.history);
router.get('/:id', authorizeRoles('citizen', 'ngo', 'authority'), reportController.getById);
router.patch('/:id/verify', authorizeRoles('ngo'), requireApprovedNgo, reportController.verify);
router.post('/:id/accept', authorizeRoles('ngo'), requireApprovedNgo, reportController.accept);
router.patch('/:id/status', authorizeRoles('ngo'), requireApprovedNgo, reportController.updateStatus);
router.patch('/:id/department', authorizeRoles('authority'), reportController.assignDepartment);
router.patch('/:id/priority', authorizeRoles('authority'), reportController.changePriority);
router.post('/:id/response', authorizeRoles('authority'), reportController.publicResponse);
router.post('/:id/resolve', authorizeRoles('authority'), reportController.resolveByAuthority);
router.post('/:id/flag-fake', authorizeRoles('ngo', 'authority'), requireApprovedNgo, reportController.flagAsFake);

module.exports = router;
