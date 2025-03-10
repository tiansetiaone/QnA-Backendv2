const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const whatsappService = require('../services/whatsappService');
const { validateGroupToken } = require("../controllers/groupTokenController");
const { verifiedNumbers } = require("../whatsapp/verifiedNumbersStore");
const { generateToken } = require('../utils/tokenUtils');
const { sendMessageToUser } = require('../whatsapp/wabot');


const userTokens = {}; // Simpan token sementara di memori

// Fungsi untuk mengirim token verifikasi
exports.sendToken = async (req, res) => {
    const { whatsappNumber } = req.body;

    try {
        // Cek apakah nomor sudah terdaftar di sistem
        const [user] = await db.promise().query('SELECT * FROM users WHERE whatsapp_number = ?', [whatsappNumber]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'Nomor WhatsApp tidak terdaftar.' });
        }

        // Generate dan kirim token
        const token = generateToken();
        userTokens[whatsappNumber] = { token, expiresAt: Date.now() + 15 * 60 * 1000 }; // Token berlaku 15 menit

        try {
            await sendMessageToUser(`${whatsappNumber}@c.us`, `Token verifikasi Anda adalah: *${token}*`);
            res.json({ message: 'Token berhasil dikirim.' });
        } catch (error) {
            res.status(500).json({ message: 'Gagal mengirim token.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat memeriksa nomor WhatsApp.' });
    }
};


// Fungsi untuk reset password
exports.forgotPassword = async (req, res) => {
    const { whatsapp_number } = req.body; // Harus sesuai dengan frontend
  
    if (!whatsapp_number) {
        return res.status(400).json({ message: "Nomor WhatsApp wajib diisi." });
    }
  
    try {
        const [user] = await db.promise().query(
            "SELECT * FROM users WHERE whatsapp_number = ?", 
            [whatsapp_number]
        );
  
        if (user.length === 0) {
            return res.status(404).json({ message: "Nomor WhatsApp tidak terdaftar." });
        }
  
        // Buat token reset dan simpan ke database
        const resetToken = generateToken();
        await db.promise().query(
            "UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE whatsapp_number = ?", 
            [resetToken, whatsapp_number]
        );
        console.log("Hasil UPDATE:", resetToken, whatsapp_number);
  
        // Kirim token ke WhatsApp user
        await sendMessageToUser(`${whatsapp_number}@c.us`, `Token reset password Anda: *${resetToken}* (Berlaku 15 menit).`);
  
        res.json({ message: "Token reset telah dikirim ke WhatsApp Anda." });
    } catch (error) {
        console.error("Error saat memproses forgot password:", error);
        res.status(500).json({ message: "Terjadi kesalahan, coba lagi nanti." });
    }
};


exports.resetPassword = async (req, res) => {
    try {
        console.log("Request body:", req.body);

        const { whatsapp_number: whatsappNumber, token, new_password: newPassword } = req.body;

        if (!whatsappNumber || !token || !newPassword) {
            return res.status(400).json({ message: "Semua field harus diisi!" });
        }

        console.log("Token dari request:", token);
        console.log("Nomor dari request:", whatsappNumber);

        // Cek apakah token valid
        const [rows] = await db.promise().query(
            "SELECT * FROM users WHERE whatsapp_number = ? AND reset_token = ? AND reset_token_expiry > NOW()",
            [whatsappNumber, token]
        );

        console.log("Hasil query:", rows);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: "Token tidak valid atau sudah kedaluwarsa" });
        }

        // Hash password baru
        const bcrypt = require("bcrypt");
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password dan hapus token reset
        await db.promise().query(
            "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE whatsapp_number = ?",
            [hashedPassword, whatsappNumber]
        );

        res.json({ message: "Password berhasil direset!" });

    } catch (error) {
        console.error("Error reset password:", error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
};



exports.register = async (req, res) => {
  const { username, password, whatsapp_number, token } = req.body;

  try {
      // Cek apakah token valid dan belum kadaluarsa
      const tokenQuery = "SELECT group_id FROM group_tokens WHERE token = ? AND expires_at > NOW()";
      const [tokenResults] = await db.promise().query(tokenQuery, [token]);

      if (tokenResults.length === 0) {
          return res.status(400).json({ error: "Token tidak valid atau sudah kadaluarsa" });
      }

      const group_id = tokenResults[0].group_id; // Gunakan ID grup dalam format lengkap

      // Validasi group token melalui controller lain jika diperlukan
      const groupData = await new Promise((resolve, reject) => {
          validateGroupToken({ query: { token } }, {
              json: (response) => {
                  if (response.success) resolve(response.group);
                  else reject(new Error(response.error));
              },
              status: (code) => ({
                  json: (response) => reject(new Error(response.error)),
              }),
          });
      });

      if (!groupData || !groupData.id) {
          return res.status(400).json({ success: false, message: "Token tidak valid atau sudah kedaluwarsa." });
      }

      // Cek apakah nomor sudah diverifikasi
      if (!whatsappService.isVerified(whatsapp_number)) {
          return res.status(403).json({ success: false, message: "Nomor WhatsApp belum diverifikasi di grup." });
      }

      // Cek apakah nomor sudah terdaftar
      const checkUserSql = "SELECT id FROM users WHERE whatsapp_number = ?";
      const [userResults] = await db.promise().query(checkUserSql, [whatsapp_number]);

      if (userResults.length > 0) {
          return res.status(409).json({ success: false, message: "Nomor WhatsApp sudah terdaftar." });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Simpan user ke database
      const insertUserSql = "INSERT INTO users (username, whatsapp_number, password, role, group_id) VALUES (?, ?, ?, 'user', ?)";
      const [insertResult] = await db.promise().query(insertUserSql, [username, whatsapp_number, hashedPassword, group_id]);

      res.status(201).json({ success: true, message: "Registrasi berhasil!", data: { id: insertResult.insertId } });

  } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
};
  

exports.login = (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM users WHERE username = ? OR whatsapp_number = ?";
    db.query(sql, [username, username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: "Username atau password salah" });
        }

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Username atau password salah" });
        }

        // Buat token dengan group_id dalam format WhatsApp
        const token = jwt.sign(
            { id: user.id, group_id: user.group_id }, 
            process.env.JWT_SECRET, 
            { expiresIn: "24h" }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                whatsapp_number: user.whatsapp_number,
                role: user.role,
                group_id: user.group_id, // Format tetap `120363371365175527@g.us`
                is_narasumber: user.is_narasumber // ✅ Tambahkan is_narasumber ke respons
            }
        });
    });
};



exports.checkVerification = async (req, res) => {
    const { whatsapp_number } = req.query;
    
    if (!whatsapp_number) {
        return res.status(400).json({ verified: false, message: "Nomor WhatsApp diperlukan." });
    }

    // Gunakan daftar nomor yang sudah diverifikasi oleh bot
    const isVerified = verifiedNumbers.has(whatsapp_number);

    return res.json({ verified: isVerified });
};

// Fungsi untuk menambahkan nomor yang telah diverifikasi ke dalam set
exports.verifyNumber = (number) => {
    verifiedNumbers.add(number);
    console.log(`[INFO] Nomor ${number} telah diverifikasi.`);
};