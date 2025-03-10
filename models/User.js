const db = require('../config/db');
const bcrypt = require('bcrypt');

// Menambahkan pengguna baru
exports.createUser = async (username, whatsappNumber, password, role, callback) => {
  const hashedPassword = await bcrypt.hash(password, 10); // Hash password
  const sql = 'INSERT INTO users (username, whatsapp_number, password, role) VALUES (?, ?, ?, ?)';
  db.query(sql, [username, whatsappNumber, hashedPassword, role || 'user'], callback);
};

// Mendapatkan pengguna berdasarkan username atau whatsapp_number
exports.getUserByUsernameOrWhatsapp = (identifier, callback) => {
  const sql = 'SELECT * FROM users WHERE username = ? OR whatsapp_number = ?';
  db.query(sql, [identifier, identifier], callback);
};

// Mendapatkan pengguna berdasarkan ID
exports.getUserById = (id, callback) => {
  const sql = 'SELECT * FROM users WHERE id = ?';
  db.query(sql, [id], callback);
};

// Memperbarui data pengguna
exports.updateUserProfile = (userId, updateData, callback) => {
  const { username, whatsappnumber, password } = updateData;

  const fields = [];
  const values = [];

  if (username) {
    fields.push('username = ?');
    values.push(username);
  }

  if (whatsappnumber) {
    fields.push('whatsapp_number = ?');
    values.push(whatsappnumber);
  }

  if (password) {
    fields.push('password = ?');
    values.push(password);
  }

  values.push(userId);

  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

  db.query(sql, values, callback);
};
