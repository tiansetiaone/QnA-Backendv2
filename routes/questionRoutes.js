const express = require("express");
const { addQuestion, getQuestions, getQuestionDetails, getAnswers, searchQuestions, getQuestionsWithStatus, updateQuestionCategory, findSimilarQuestions, deleteQuestion, updateQuestionText } = require("../controllers/questionController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", protect, addQuestion); // Tambah pertanyaan baru
router.get("/", getQuestions); // Ambil semua pertanyaan
router.get("/details/:id", protect, getQuestionDetails); // Detail pertanyaan beserta jawaban
router.get("/:questionId/answers", getAnswers); // Tambah jawaban baru
router.post("/search", searchQuestions);
router.get("/all", protect, getQuestionsWithStatus); // Ambil semua pertanyaan dengan status
router.put("/:questionId/update", updateQuestionCategory);
router.post("/find", findSimilarQuestions);
router.delete("/:questionId", protect, deleteQuestion);
router.put('/:questionId/edit', protect, updateQuestionText);
module.exports = router;
