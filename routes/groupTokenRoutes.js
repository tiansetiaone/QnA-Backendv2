const express = require('express');
const { validateGroupToken, generateGroupToken } = require('../controllers/groupTokenController');

const router = express.Router();

// Endpoint untuk validasi token grup
router.get('/validate', validateGroupToken);

// Endpoint untuk admin membuat token grup baru
router.post('/generate', generateGroupToken);

module.exports = router;
