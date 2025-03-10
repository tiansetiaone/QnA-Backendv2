const express = require('express');
const { getWelcomeMessage, getAvailableLanguages } = require('../controllers/i18nController');
const { protect } = require('../middleware/authMiddleware'); // Jika perlu autentikasi

const router = express.Router();

// Endpoint untuk mendapatkan pesan welcome dalam bahasa user
router.get('/welcome', protect, getWelcomeMessage);

// Backend: routes/languageRoutes.js
router.get('/languages', getAvailableLanguages);

module.exports = router;
