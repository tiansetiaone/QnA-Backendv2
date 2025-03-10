const Answer = require('../models/Answer');
const Question = require('../models/Question');
const db = require('../config/db');
const { sendMessageToUser } = require('../whatsapp/wabot');

// Fungsi untuk menambahkan jawaban
exports.addAnswer = (req, res) => {
  const { questionId, answerText, adminId, adminGroup } = req.body;
  console.log('Data diterima di backend:', { questionId, answerText, adminId, adminGroup });

  // Validasi input
  if (!questionId || !answerText) {
    return res.status(400).json({ error: 'Pertanyaan atau jawaban tidak boleh kosong.' });
  }

  if (!adminId && !adminGroup) {
    return res.status(403).json({ error: 'Anda tidak memiliki izin untuk menjawab pertanyaan.' });
  }

  // Mulai transaksi
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Error saat mendapatkan koneksi:', err);
      return res.status(500).json({ error: 'Gagal mendapatkan koneksi database' });
    }

    connection.beginTransaction((transactionErr) => {
      if (transactionErr) {
        console.error('Error saat memulai transaksi:', transactionErr);
        connection.release();
        return res.status(500).json({ error: 'Gagal memulai transaksi' });
      }


      // Tambahkan jawaban ke tabel answers
      const insertAnswerQuery = `
        INSERT INTO answers (question_id, answer_text, admin_id, admin_group, created_at, updated_at) 
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;
      connection.query(insertAnswerQuery, [questionId, answerText, adminId, adminGroup], (insertErr, insertResult) => {
        if (insertErr) {
          console.error('Error saat menambahkan jawaban:', insertErr);
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Gagal menambahkan jawaban' });
          });
        }

        // Perbarui status pertanyaan menjadi 'answered'
        const updateQuestionStatusQuery = `
          UPDATE questions SET status = ? WHERE id = ?
        `;
        connection.query(updateQuestionStatusQuery, ['answered', questionId], (updateErr) => {
          if (updateErr) {
            console.error('Error saat memperbarui status pertanyaan:', updateErr);
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Gagal memperbarui status pertanyaan' });
            });
          }

          // Kirim notifikasi ke WhatsApp user
          const getUserAndAdminQuery = `
  SELECT 
    u.whatsapp_number, 
    u.username, 
    q.question_text, 
    q.group_id, 
    a.answer_text, 
    a.created_at, 
    COALESCE(ad.username, ad_group.username, 'Super Admin') AS admin_name, 
    COALESCE(ad.whatsapp_number, ad_group.whatsapp_number, '') AS admin_phone, 
    COALESCE(ad_group.username, '') AS admin_group 
FROM questions q
JOIN users u ON q.user_id = u.id
JOIN answers a ON q.id = a.question_id
LEFT JOIN users ad ON a.admin_id = ad.id 
LEFT JOIN users ad_group ON a.admin_group = ad_group.id 
WHERE q.id = ?
        `;

        connection.query(getUserAndAdminQuery, [questionId], (userErr, userResult) => {
          if (userErr || userResult.length === 0) {
            console.error('Gagal mendapatkan data pengguna dan pertanyaan:', userErr);
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Gagal mendapatkan data pengguna dan pertanyaan' });
            });
          }

          const {
            whatsapp_number: userPhoneNumber,
            username,
            question_text: questionText,
            group_id: groupId,
            answer_text: answerText,
            created_at: answerTime,
            admin_name: adminName,
            admin_phone: adminPhone,
            admin_group: adminGroup
          } = userResult[0];
          
          const formattedAnswerTime = new Date(answerTime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
          
          const message = `
Halo ${username},

Pertanyaan Anda:
"${questionText}"

Jawaban dari narasumber:
"${answerText}"

📌 Narasumber : ${adminName || adminGroup || 'Tidak diketahui'}
📞 Nomor : ${adminPhone || 'Tidak tersedia'}
📅 Waktu : ${formattedAnswerTime}

Terima kasih atas pertanyaan Anda!
`.trim();


          sendMessageToUser(userPhoneNumber, message)
            .then(() => {
              console.log(`Notifikasi berhasil dikirim ke WhatsApp: ${userPhoneNumber}`);
              connection.commit((commitErr) => {
                if (commitErr) {
                  console.error('Error saat melakukan commit:', commitErr);
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ error: 'Gagal menyelesaikan transaksi' });
                  });
                }

                connection.release();
                res.status(201).json({
                  message: 'Jawaban berhasil ditambahkan dan notifikasi dikirim ke pengguna.',
                  answerId: insertResult.insertId,
                });
              });
            })
            .catch((error) => {
              console.error('Gagal mengirim pesan WhatsApp:', error);
              connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Gagal mengirim notifikasi WhatsApp' });
              });
            });
        });
      });
    });
  });
});
};


// Fungsi untuk mendapatkan jawaban berdasarkan questionId
exports.getAnswers = (req, res) => {
  const { questionId } = req.params;
  console.log('Question ID:', questionId);

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
