const express = require('express');
const { addAnswer, getAnswers } = require('../controllers/answerController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/:questionId/answers', protect, addAnswer); // Tambah jawaban baru
router.get('/:questionId/answers', getAnswers); // Tambah jawaban baru

module.exports = router;
