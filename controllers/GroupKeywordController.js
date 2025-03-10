const db = require("../config/db");

// Fungsi untuk menambah keyword ke dalam grup
exports.addKeyword = (req, res) => {
  const { keyword } = req.body;
  const group_id = req.user.group_id;

  if (!group_id || !keyword) {
    return res.status(400).json({ error: "Group ID dan keyword harus disediakan" });
  }

  const sql = "INSERT INTO group_keywords (group_id, keyword) VALUES (?, ?)";
  db.query(sql, [group_id, keyword], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Gagal menambah keyword" });
    }
    res.status(201).json({ id: results.insertId, group_id, keyword });
  });
};


// Fungsi untuk mendapatkan semua keywords dalam grup
exports.getKeywordsByGroup = (req, res) => {
  const group_id = req.user.group_id; // Sudah dalam format WhatsApp

  const sql = "SELECT id, keyword FROM group_keywords WHERE group_id = ?";
  db.query(sql, [group_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Gagal mengambil keywords" });
    }
    res.json(results);
  });
};



// Fungsi untuk menghapus keyword dari grup
exports.deleteKeyword = (req, res) => {
  const { id } = req.params;
  const group_id = req.user.group_id; // Sudah dalam format WhatsApp

  const sql = "DELETE FROM group_keywords WHERE id = ? AND group_id = ?";
  db.query(sql, [id, group_id], (err, results) => {
    if (err || results.affectedRows === 0) {
      return res.status(404).json({ error: "Keyword tidak ditemukan atau tidak berhak menghapus" });
    }

    // Response dengan notifikasi berhasil
    res.json({ 
      message: "Keyword berhasil dihapus",
      id: parseInt(id) // Pastikan ID dikembalikan dalam format angka
    });
  });
};