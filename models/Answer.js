const db = require('../config/db');

exports.createAnswer = (questionId, answerText, adminId, callback) => {
    const sql = 'INSERT INTO answers (question_id, answer_text, admin_id) VALUES (?, ?, ?)';
  
    // Cek apakah pertanyaan sudah memiliki jawaban
    db.query('SELECT * FROM answers WHERE question_id = ?', [questionId], (err, results) => {
      if (err) {
        return callback(err, null); // Error saat query database
      }
  
      if (results.length > 0) {
        return callback(null, { error: 'Pertanyaan sudah dijawab sebelumnya' });
      }
  
      // Insert jawaban baru
      db.query(sql, [questionId, answerText, adminId], (err, result) => {
        if (err) {
          return callback(err, null); // Error saat insert jawaban
        }
        
        callback(null, { message: 'Jawaban berhasil ditambahkan', answerId: result.insertId });
      });
    });
  };

exports.getAnswersByQuestionId = (questionId, callback) => {
    const sql = 'SELECT * FROM answers WHERE question_id = ?';
  
    db.query(sql, [questionId], (err, results) => {
      if (err) {
        return callback(err, null); // Error saat query database
      }
  
      if (results.length === 0) {
        return callback(null, { error: 'Jawaban tidak ditemukan' });
      }
  
      callback(null, results); // Jawaban ditemukan
    });
  };
