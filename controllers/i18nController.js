exports.getWelcomeMessage = (req, res) => {
    const message = req.t('welcome_message'); // Ambil terjemahan sesuai bahasa
    res.json({ message });
  };

  // Backend: controllers/languageController.js
// controllers/i18nController.js
exports.getAvailableLanguages = (req, res) => {
  res.status(200).json({ languages: ['en', 'id'] });
};
