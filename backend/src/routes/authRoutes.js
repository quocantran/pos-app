const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const roleCheck = require('../middlewares/roleCheck');

// Public routes
router.post('/login', authController.login);

// Protected routes
router.get('/me', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);
router.put('/change-password', auth, authController.changePassword);

// Admin only routes
router.post('/register', auth, roleCheck('ADMIN'), authController.register);

module.exports = router;
