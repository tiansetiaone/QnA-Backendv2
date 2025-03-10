const Question = require('../models/Question');
const Answer = require('../models/Answer');
const db = require('../config/db'); // Pastikan path-nya sesuai


exports.addQuestion = (req, res) => {
  const { questionText, categoryId } = req.body; // Hapus groupId dari body request

  if (!req.user || !req.user.id) {
    return res.status(400).json({ error: "User ID is missing" });
  }

  const userId = req.user.id;

  if (!questionText) {
    return res.status(400).json({ error: "Pertanyaan tidak boleh kosong" });
  }

  // Izinkan categoryId untuk kosong (null)
  const categoryValue = categoryId || null;

  // Panggil model untuk menyimpan pertanyaan (tanpa groupId)
  Question.createQuestion(userId, categoryValue, questionText, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Gagal menambahkan pertanyaan" });
    }

    res.status(201).json({ 
      message: "Pertanyaan berhasil ditambahkan", 
      questionId: result.insertId 
    });
  });
};


exports.getQuestions = (req, res) => {
  const sql = `
   SELECT 
    q.id,
    q.user_id,
    q.category_id,
    q.question_text,
    q.status,
    q.created_at,
    q.updated_at,
    q.assigned_to,
    u.username,
    u.whatsapp_number,
    u.group_id, -- Tambahkan group_id dari users
    c.category_name,
    a.answer_text
FROM 
    questions q
LEFT JOIN 
    users u ON q.user_id = u.id
LEFT JOIN 
    categories c ON q.category_id = c.id
LEFT JOIN 
    answers a ON q.id = a.question_id
ORDER BY 
    q.created_at DESC;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Database Error:', err);
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }

    // Cek apakah hasil kosong
    if (results.length === 0) {
      return res.status(404).json({ error: 'No questions found' });
    }

    // Kirim respon
    res.status(200).json(results);
  });
};

exports.getQuestionDetails = (req, res) => {
  const { id } = req.params;
  Question.getQuestionById(id, (err, question) => {
    if (err || question.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    Answer.getAnswersByQuestionId(id, (err, answers) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch answers' });
      }
      res.status(200).json({question});
 
    });
  });
};

exports.getAnswers = (req, res) => {
    const { questionId } = req.params;
    console.log('Question ID:', req.params.questionId);

    Question.getAnswersByQuestionId(questionId, (err, answers) => {
      if (err) {
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil jawaban' });
      }
  
      if (answers.error) {
        return res.status(404).json(answers); // Tampilkan error yang berasal dari fungsi
      }
  
      res.status(200).json(answers); // Jawaban ditemukan
    });
  };
  
   // controllers/questionController.js
  // controllers/questionController.js

exports.searchQuestions = (req, res) => {
  const { q } = req.body;

  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Kata kunci pencarian tidak boleh kosong." });
  }

  const keywords = q.trim().split(/\s+/);

  Question.searchQuestions(keywords, (err, results) => {
    if (err) {
      console.error("Search Error:", err);
      return res.status(500).json({ error: "Gagal melakukan pencarian." });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Tidak ada pertanyaan yang cocok dengan pencarian." });
    }

    res.status(200).json({ questions: results });
  });
};
  
  
// Ambil daftar pertanyaan beserta status dan jawaban
exports.getQuestionsWithStatus = async (req, res) => {
  try {
    const sql = `
      SELECT 
        q.id, 
        q.user_id, 
        q.category_id, 
        q.question_text, 
        q.status, 
        q.created_at, 
        q.updated_at,
        a.id AS answer_id,
        a.answer_text,
        a.admin_id,
        a.created_at AS answer_created_at
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      ORDER BY q.created_at DESC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(200).json({ questions: results });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve questions' });
  }
};

// controllers/questionController.js

exports.updateQuestionCategory = (req, res) => {
  const { questionId } = req.params; // Ambil questionId dari parameter URL
  const { categoryId } = req.body; // Ambil categoryId dari body request

  // Validasi input
  if (!questionId || !categoryId) {
    return res.status(400).json({ error: "ID pertanyaan dan kategori harus diberikan." });
  }

  // Query untuk memperbarui kategori pada tabel questions
  const sql = "UPDATE questions SET category_id = ?, updated_at = NOW() WHERE id = ?";
  db.query(sql, [categoryId, questionId], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Gagal memperbarui kategori pertanyaan." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pertanyaan tidak ditemukan." });
    }

    res.status(200).json({ message: "Kategori pertanyaan berhasil diperbarui." });
  });
};


exports.updateQuestionText = (req, res) => {
  const { questionId } = req.params; // Ambil questionId dari URL
  const { text } = req.body; // Ambil teks pertanyaan dari body request

  // Validasi input
  if (!questionId || !text) {
    return res.status(400).json({ error: "ID pertanyaan dan teks baru harus diberikan." });
  }

  // Query untuk memperbarui teks pertanyaan
  const sql = "UPDATE questions SET question_text = ?, updated_at = NOW() WHERE id = ?";
  db.query(sql, [text, questionId], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: "Gagal memperbarui teks pertanyaan." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pertanyaan tidak ditemukan." });
    }

    res.status(200).json({ message: "Teks pertanyaan berhasil diperbarui." });
  });
};


exports.findSimilarQuestions = async (req, res) => {
  const { question } = req.body;

  if (!question) {
      return res.status(400).json({ error: 'Pertanyaan tidak boleh kosong.' });
  }

  try {
      const query = `
          SELECT id, question_text
          FROM questions
          WHERE MATCH(question_text) AGAINST(? IN NATURAL LANGUAGE MODE)
          LIMIT 10;
      `;
      db.query(query, [question], (err, results) => {
          if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Gagal mencari pertanyaan serupa.' });
          }
          res.json({ suggestions: results });
      });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};


exports.deleteQuestion = (req, res) => {
  const { questionId } = req.params;

  db.getConnection((err, connection) => {
    if (err) {
      console.error('Database connection error:', err);
      return res.status(500).json({ message: 'Koneksi database gagal.' });
    }

    // Hapus jawaban yang terkait dulu
    connection.query('DELETE FROM answers WHERE question_id = ?', [questionId], (error) => {
      if (error) {
        connection.release();
        console.error('Error deleting answers:', error);
        return res.status(500).json({ message: 'Gagal menghapus jawaban terkait.' });
      }

      // Setelah jawaban terhapus, hapus pertanyaan
      connection.query('DELETE FROM questions WHERE id = ?', [questionId], (error, result) => {
        connection.release(); 

        if (error) {
          console.error('Error deleting question:', error);
          return res.status(500).json({ message: 'Gagal menghapus pertanyaan.' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Pertanyaan tidak ditemukan.' });
        }

        res.json({ message: 'Pertanyaan berhasil dihapus.' });
      });
    });
  });
};

