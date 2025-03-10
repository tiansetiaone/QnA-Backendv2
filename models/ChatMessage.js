const db = require('../config/db');

const ChatMessage = {
  // Menyimpan pesan ke database
  saveMessage: (sender, message, isAdmin) => {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO chat_messages (sender, message, is_admin) VALUES (?, ?, ?)';
      db.execute(query, [sender, message, isAdmin ? 1 : 0], (err, results) => {
        if (err) {
          console.error('Error saving message:', err.message);
          return reject(err);
        }
        console.log('Message saved successfully!');
        resolve(results);
      });
    });
  },

  // Mendapatkan semua pesan
  getAllMessages: () => {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM chat_messages ORDER BY timestamp ASC';
      db.execute(query, (err, results) => {
        if (err) {
          console.error('Error retrieving messages:', err.message);
          return reject(err);
        }
        resolve(results);
      });
    });
  },

  // Mendapatkan pesan berdasarkan nomor pengirim
  getMessagesBySender: (sender) => {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM chat_messages WHERE sender = ? ORDER BY timestamp ASC';
      db.execute(query, [sender], (err, results) => {
        if (err) {
          console.error('Error retrieving messages by sender:', err.message);
          return reject(err);
        }
        resolve(results);
      });
    });
  },
};

module.exports = ChatMessage;
