const express = require('express');
const { translateText, getAvailableLanguages} = require('../controllers/translateController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Route untuk menerjemahkan konten dinamis menggunakan Google Translate API
router.post('/translate', translateText);
router.post('/translates', getAvailableLanguages);

// Route untuk teks statis (menggunakan i18next)
router.get('/welcome', (req, res) => {
  const message = req.t('welcome_message'); // Ambil teks berdasarkan bahasa user
  res.json({ message });
});

module.exports = router;
