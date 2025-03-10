const { Translate } = require('@google-cloud/translate').v2;

const translate = new Translate({
  projectId: 'your-project-id', // Ganti dengan Project ID Google Cloud Anda
  keyFilename: 'path/to/keyfile.json', // Path file credential Google Cloud
});

exports.translateText = async (req, res) => {
  const { text, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'Text and target language are required' });
  }

  try {
    const [translation] = await translate.translate(text, targetLanguage);
    res.json({ original: text, translated: translation });
  } catch (error) {
    console.error('Error translating text:', error);
    res.status(500).json({ error: 'Failed to translate text' });
  }
};


exports.getAvailableLanguages = (req, res) => {
  res.status(200).json({ languages: ['en', 'id'] });
};



