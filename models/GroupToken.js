const db = require('../config/db'); // Sesuaikan dengan path file db.js

const GroupToken = {
  createToken: (groupId, token, expiresAt, callback) => {
    const query = `INSERT INTO group_tokens (group_id, token, expires_at) VALUES (?, ?, ?)`;
    db.query(query, [groupId, token, expiresAt], (err, results) => {
      if (err) return callback(err, null);
      callback(null, results);
    });
  },

  findToken: (token, callback) => {
    const query = `SELECT * FROM group_tokens WHERE token = ? AND expires_at > NOW()`;
    db.query(query, [token], (err, results) => {
      if (err) return callback(err, null);
      callback(null, results.length > 0 ? results[0] : null);
    });
  },

  deleteToken: (token, callback) => {
    const query = `DELETE FROM group_tokens WHERE token = ?`;
    db.query(query, [token], (err, results) => {
      if (err) return callback(err, null);
      callback(null, results);
    });
  }
};

module.exports = GroupToken;
