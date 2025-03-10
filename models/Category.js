const db = require('../config/db');

// Tambahkan kategori baru
exports.createCategory = (categoryData, callback) => {
  const { category_name } = categoryData;
  const sql = 'INSERT INTO categories (category_name, created_at, updated_at) VALUES (?, NOW(), NOW())';
  db.query(sql, [category_name], callback);
};

// Ambil semua kategori
exports.getCategories = (callback) => {
  const sql = 'SELECT * FROM categories';
  db.query(sql, callback);
};

// Perbarui kategori
exports.updateCategory = (id, categoryData, callback) => {
  const { category_name } = categoryData;
  const sql = 'UPDATE categories SET category_name = ?, updated_at = NOW() WHERE id = ?';
  db.query(sql, [category_name, id], callback);
};

// Hapus kategori
exports.deleteCategory = (id, callback) => {
  const sql = 'DELETE FROM categories WHERE id = ?';
  db.query(sql, [id], callback);
};


