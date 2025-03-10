const express = require('express');
const { register, login, checkVerification,sendToken,forgotPassword, resetPassword } = require('../controllers/authController');
const { validateGroupToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Registrasi dengan validasi token grup
router.post('/register', validateGroupToken, register);
router.post('/login', login);
router.get('/check-verification', checkVerification);
router.post('/send-token', sendToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
