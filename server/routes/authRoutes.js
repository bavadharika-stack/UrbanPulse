const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Module 1: Citizen Registration
router.post('/register', authController.register);

module.exports = router;
