const express = require('express');
const { registerUser, loginUser, getProfile, updateProfile } = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser); // Endpoint registrasi
router.post('/login', loginUser); // Endpoint login
router.get('/profile', verifyToken, getProfile); // Endpoint profil pengguna
router.put('/profile/', protect, updateProfile);

module.exports = router;
