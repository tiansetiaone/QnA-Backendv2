const db = require("../config/db");

// Periksa koneksi database
db.query("SELECT 1", (error) => {
  if (error) {
    console.error("Database connection failed:", error);
  } else {
    console.log("Database connected.");
  }
});


// Buat pertanyaan baru
// Buat pertanyaan baru dengan mengambil group_id dari tabel users
exports.createQuestion = (userId, categoryId, questionText, callback) => {
  const getUserGroupQuery = `SELECT group_id FROM users WHERE id = ?`;

  db.query(getUserGroupQuery, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching user group_id:", err);
      return callback(err, null);
    }

    if (results.length === 0) {
      return callback(new Error("User not found"), null);
    }

    const groupId = results[0].group_id || null; // Ambil group_id user

    const insertQuestionQuery = `
      INSERT INTO questions (user_id, category_id, question_text, group_id, status) 
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(insertQuestionQuery, [userId, categoryId, questionText, groupId, "pending"], (error, insertResults) => {
      if (error) {
        console.error("Error inserting question:", error);
        return callback(error, null);
      }
      callback(null, insertResults);
    });
  });
};


// Ambil semua pertanyaan
exports.getQuestions = (callback) => {
  const sql = `
        SELECT 
    q.*,
    u.username,
    u.whatsapp_number,            -- Menambahkan whatsapp_number
    c.category_name,
    c.category_name AS category_text, -- Kolom category_text
    a.answer_text                     -- Kolom answer_text
FROM 
    questions q
JOIN 
    users u ON q.user_id = u.id
JOIN 
    categories c ON q.category_id = c.id
LEFT JOIN 
    answers a ON q.id = a.question_id
  `;
  console.log("Executing SQL Query:", sql); // Log SQL query
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error executing query:", err); // Log error
    }
    callback(err, results); // Callback dengan error dan hasil
  });
};

// SELECT q.*, u.username, c.id AS category_name
// FROM questions q
// JOIN users u ON q.user_id = u.id
// JOIN categories c ON q.category_id = c.id

// Ambil pertanyaan berdasarkan ID
exports.getQuestionById = (id, callback) => {
  const sql = `
    SELECT  
    q.*, 
    u.username, 
    c.category_name 
FROM 
    questions q
JOIN 
    users u 
ON 
    q.user_id = u.id
LEFT JOIN 
    categories c 
ON 
    q.category_id = c.id
WHERE 
    q.id = ?;
  `;
  db.query(sql, [id], (error, results) => {
    if (error) {
      console.error("Error fetching question by ID:", error);
      return callback(error, null);
    }
    if (!results || results.length === 0) {
      return callback(null, []); // Kembalikan array kosong jika tidak ada hasil
    }
    callback(null, results[0]); // Ambil hasil pertama
  });
};

exports.getAnswersByQuestionId = (questionId, callback) => {
  const sql = "SELECT * FROM answers WHERE question_id = ?";

  db.query(sql, [questionId], (err, results) => {
    if (err) {
      return callback(err, null); // Error saat query database
    }

    if (results.length === 0) {
      return callback(null, { error: "Jawaban tidak ditemukan" });
    }

    callback(null, results); // Jawaban ditemukan
  });
};

// models/Question.js

exports.searchQuestions = (keywords, callback) => {
  const sql = `
    SELECT 
      q.id,
      q.user_id,
      q.category_id,
      q.question_text,
      q.status,
      q.created_at,
      q.updated_at,
      u.username,
      u.whatsapp_number,
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
    WHERE 
      ${keywords.map(() => "q.question_text LIKE ?").join(" OR ")}
    ORDER BY 
      q.created_at DESC
  `;

  const values = keywords.map(keyword => `%${keyword}%`);

  db.query(sql, values, (err, results) => {
    callback(err, results);
  });
};
