const db = require('../config/db');

const GroupKeyword = {
  create: (group_id, keyword, callback) => {
    const query = 'INSERT INTO group_keywords (group_id, keyword) VALUES (?, ?)';
    db.query(query, [group_id, keyword], callback);
  },

  getByGroupId: (group_id, callback) => {
    const query = 'SELECT * FROM group_keywords WHERE group_id = ?';
    db.query(query, [group_id], callback);
  },

  getAll: (callback) => {
    const query = 'SELECT * FROM group_keywords';
    db.query(query, callback);
  },

  deleteById: (id, callback) => {
    const query = 'DELETE FROM group_keywords WHERE id = ?';
    db.query(query, [id], callback);
  }
};

module.exports = GroupKeyword;
