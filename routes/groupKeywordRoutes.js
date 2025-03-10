const express = require("express");
const router = express.Router();
const {addKeyword, getKeywordsByGroup, deleteKeyword} = require("../controllers/GroupKeywordController");
const {verifyToken, isAdmin } = require("../middleware/authMiddleware");

router.post("/add",verifyToken, isAdmin, addKeyword);
router.get("/:group_id", verifyToken, isAdmin,  getKeywordsByGroup);
router.delete("/:id", verifyToken, isAdmin,  deleteKeyword);

module.exports = router;
