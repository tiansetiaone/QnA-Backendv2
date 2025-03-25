const qrcode = require("qrcode-terminal");
const db = require("../config/db");
const dbValidation = require("../config/dbValidation");
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");

// Lokasi autentikasi di dalam proyek
const localAuthPath = path.join(__dirname, ".wwebjs_auth");
const tmpAuthPath = path.join("/tmp", ".wwebjs_auth");


// Pastikan direktori autentikasi dipindahkan ke /tmp
if (fs.existsSync(localAuthPath)) {
  console.log("Memindahkan folder autentikasi ke /tmp...");
  fse.ensureDirSync(tmpAuthPath);
  fse.copySync(localAuthPath, tmpAuthPath, { overwrite: true });
}

let client;
let clientReady = false;
let isQRGenerated = false;
let currentQRCode = null;
let isConnected = false; // Deklarasi di luar fungsi
let userChoices = {}; // Untuk menyimpan daftar pertanyaan sementara
const { verifiedNumbers } = require("./verifiedNumbersStore");

// Fungsi global
const retryWithDelay = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`Percobaan ${i + 1} gagal:`, err);
      if (i < retries - 1) await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("Operasi gagal setelah beberapa kali percobaan.");
};

const getWWebVersion = async () => {
  return retryWithDelay(
    async () => {
      const version = await client.getWWebVersion();
      console.log(`Versi WhatsApp Web: ${version}`);
      return version;
    },
    5,
    2000
  ); // 5 percobaan dengan jeda 2 detik
};

// Fungsi helper untuk query dengan Promise
const queryAsync = (query, params) => {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

const closeWWebTab = async () => {
  try {
    const browser = await client.pupBrowser;
    const pages = await browser.pages();

    for (let page of pages) {
      const url = page.url();
      if (url.includes("web.whatsapp.com")) {
        console.log("✅ Menutup tab WhatsApp Web...");
        await page.close();
      }
    }

    console.log("✅ Tab WhatsApp Web berhasil ditutup.");
  } catch (err) {
    console.error("❌ Gagal menutup tab WhatsApp Web:", err.message);
  }
};

// Fungsi untuk menghapus folder sesi
const deleteSessionFolder = () => {
  return new Promise((resolve, reject) => {
    fs.rm(tmpAuthPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error("❌ Gagal menghapus folder sesi:", err.message);
        reject(err);
      } else {
        console.log("✅ Folder sesi dihapus.");
        resolve();
      }
    });
  });
};

// Fungsi untuk logout dengan aman
async function safeLogout(client) {
  try {
      console.log("🛑 Mematikan WhatsApp Client...");
      await client.logout();
      console.log("✅ Client dimatikan. Menghapus sesi...");

      // Tunggu sebentar agar file tidak terkunci
      await new Promise(resolve => setTimeout(resolve, 2000));

      fs.rmSync('./.wwebjs_auth', { recursive: true, force: true });
      console.log("✅ Folder sesi dihapus.");
  } catch (error) {
      console.error("❌ Error saat logout:", error);
  }
}

// Fungsi untuk restart client setelah logout
async function restartClient() {
  console.log("🔄 Memulai ulang dalam 3 detik...");
  await new Promise(resolve => setTimeout(resolve, 3000)); // Tunggu 3 detik sebelum restart

  client = new Client({
      authStrategy: new LocalAuth({ clientId: "bot" }),
      puppeteer: { headless: true }
  });

  client.initialize();
}

const initWhatsAppClient = () => {
  console.log("Menginisialisasi ulang WhatsApp Client...");
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: tmpAuthPath }),
    puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });
  

  client.on("qr", (qr) => {
    console.log("QR Code baru tersedia, scan untuk login!");
    isQRGenerated = false; // Reset status QR
    currentQRCode = qr;
    qrcode.generate(qr, { small: true });
});


  client.on("authenticated", async () => {
    console.log("Bot berhasil terautentikasi.");
  
    try {
      let retries = 10;
      while ((!client.info || !client.info.wid) && retries > 0) {
        console.log("Menunggu client.info tersedia...");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Jeda 2 detik untuk menghindari spam loop
        retries--;
      }
  
      if (!client.info || !client.info.wid) {
        throw new Error("Client info belum tersedia setelah menunggu.");
      }
  
      console.log(`✅ Bot berhasil login sebagai ${client.info.wid.user}`);
      isConnected = true;
    } catch (err) {
      console.error("❌ Error dalam event authenticated:", err.message);
      console.log("🔄 Restarting bot...");
      initWhatsAppClient(); // Restart bot jika gagal
    }
  });

 // Event handler untuk disconnect
 client.on("disconnected", async (reason) => {
  console.log(`⚠️ Bot terputus: ${reason}. Restarting...`);
  isConnected = false;

  try {
    console.log("🛑 Mematikan WhatsApp Client...");
    await client.destroy();

    console.log("✅ Client dimatikan. Menghapus sesi...");
    await deleteSessionFolder();

    console.log("🔄 Memulai ulang dalam 3 detik...");
    setTimeout(initWhatsAppClient, 3000);
  } catch (error) {
    console.error("❌ Gagal restart:", error.message);
    console.log("⏳ Coba restart ulang dalam 10 detik...");
    setTimeout(initWhatsAppClient, 10000);
  }
});


  client.on("auth_failure", async (message) => {
    console.error("❌ Autentikasi gagal:", message);
    console.log("Menunggu 10 detik sebelum restart...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    initWhatsAppClient();
  });

  client.on("ready", async () => {
    console.log("WhatsApp Client is ready!");

    if (!client) {
      console.log("⚠️ Client belum terinisialisasi!");
    } else {
      console.log("✅ Client berhasil diinisialisasi.");
    }

    clientReady = true;
    console.log("⚡ clientReady = ", clientReady);

    try {
      const version = await getWWebVersion();
      console.log(`WhatsApp Web Version: ${version}`);
      let retries = 5;
      while ((!client.info || !client.info.wid) && retries > 0) {
        console.log("Menunggu client.info tersedia...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries--;
      }

      if (retries === 0) {
        console.error("Gagal mendapatkan client.info setelah 5 percobaan.");
        return;
      }

      const botNumber = client.info.wid.user;
      const isAdminUser = await isAdmin(botNumber);
      if (isAdminUser) {
        console.log(`Admin authenticated: ${botNumber} dan Bot dapat dijalankan`);
        isConnected = true;
      } else {
        console.log("Nomor bot bukan admin. Mematikan bot...");
        await client.logout();
        isConnected = false;
      }
    } catch (err) {
      console.error("Error during bot initialization:", err);
    }
  });

  const sessionTracking = {}; // Menyimpan status sesi per user/grup

  // Fungsi untuk mengatur status sesi tanpa database
  function setSessionStatus(id, status, durationMinutes = 30) {
    const expiresAt = status === "active" ? Date.now() + durationMinutes * 60 * 1000 : 0;
    sessionTracking[id] = { status, expires: expiresAt };

    console.log(`[SESSION] ${id} status: ${status}, berlaku hingga: ${expiresAt ? new Date(expiresAt) : "Tidak aktif"}`);
  }

  // Fungsi untuk mengecek apakah sesi masih aktif
  function isSessionActive(id) {
    const session = sessionTracking[id];
    return session && session.status === "active" && (!session.expires || Date.now() < session.expires);
  }

  client.on("message", async (message) => {
    console.log(`[LOG] Pesan diterima: ${message.body}`);
    try {
      const isGroup = message.from.endsWith("@g.us");
      console.log(`[DEBUG] isGroup: ${isGroup}, message.from: ${message.from}`);
      const sessionId = isGroup ? message.from : message.from;
      const fromNumbers = isGroup ? message.author : message.from;
      const fromNumber = fromNumbers.replace("@c.us", "");
      console.log(`[DEBUG] fromNumber: ${fromNumber}`);

      console.log(`[DEBUG] isGroup: ${isGroup}, fromNumber: ${fromNumber}`);

      // Fungsi menangani perintah !forward dari admin grup
if (message.body.startsWith("!forward")) {
  const senderNumber = message.author || message.from.replace("@c.us", ""); // Nomor pengirim

  // Cek apakah pengirim adalah admin_group
  const senderRecord = await queryAsync(
      `SELECT role, group_id FROM users WHERE whatsapp_number = ?`, 
      [senderNumber]
  );

  if (senderRecord.length === 0 || senderRecord[0].role !== "admin_group") {
      await message.reply("🚫 *Anda tidak memiliki izin untuk menggunakan perintah ini!*");
      return;
  }

  const adminGroupId = senderRecord[0].group_id; // Ambil group_id admin

  const args = message.body.split(" ");
  if (args.length < 3 || !args[1].startsWith("@")) {
      await message.reply("⚠️ *Format salah! Gunakan:*\n\n*!forward @user [pertanyaan]*");
      return;
  }

  const mentionedUser = args[1].replace("@", ""); // Ambil nomor user yang disebut
  const userQuestion = args.slice(2).join(" ");

  // Cek apakah user ada di database
  const userRecord = await queryAsync(
      `SELECT id, group_id FROM users WHERE whatsapp_number = ?`, 
      [mentionedUser]
  );

  if (userRecord.length === 0) {
      await message.reply(`❌ *User dengan nomor ${mentionedUser} tidak ditemukan di database.*`);
      return;
  }

  const userIdFromDB = userRecord[0].id;
  const userGroupId = userRecord[0].group_id;

  // Cek apakah user berasal dari grup yang sama dengan admin
  if (adminGroupId !== userGroupId) {
      await message.reply("🚫 *Anda hanya dapat meneruskan pertanyaan dari user dalam grup yang sama.*");
      return;
  }

  // Simpan pertanyaan ke database
  await queryAsync(
      `INSERT INTO questions (user_id, question_text, status, assigned_to, created_at, updated_at) 
      VALUES (?, ?, 'pending', NULL, NOW(), NOW())`,
      [userIdFromDB, userQuestion]
  );

  await message.reply(`✅ *Pertanyaan dari ${mentionedUser} telah dikirim ke narasumber!*`);

  // Kirim pertanyaan ke fungsi pemilihan narasumber
  await pilihNarasumber(message, userQuestion, false, mentionedUser);
}


if (message.body.startsWith("!buatlink")) {
  console.log(`[DEBUG] Perintah !buatlink diterima`);

  if (!message.from.endsWith("@g.us")) {
      await message.reply("❌ Perintah ini hanya bisa digunakan dalam grup.");
      return;
  }

  const senderNumber = message.author.replace(/\D/g, ""); // Nomor pengirim tanpa simbol
  const groupId = message.from;

  console.log(`[DEBUG] Nomor Pengirim: ${senderNumber}`);
  console.log(`[DEBUG] Group ID: ${groupId}`);

  try {
      // Cek apakah user ada di database dan ambil data role serta group_id
      const result = await queryAsync(
          `SELECT role, group_id FROM users WHERE whatsapp_number LIKE ?`,
          [`%${senderNumber}`]
      );

      console.log(`[DEBUG] Hasil Query User:`, result);

      if (!result.length) {
          await message.reply("⚠️ Nomor Anda tidak terdaftar dalam sistem.");
          return;
      }

      const userRole = result[0].role;
      let userGroupId = result[0].group_id;

      // Jika role bukan admin_group, tolak perintah
      if (userRole !== "admin_group") {
          await message.reply("⚠️ Anda bukan admin dalam sistem, hanya admin_group yang bisa menjalankan perintah ini.");
          return;
      }

      // Jika group_id masih kosong, update dengan message.from (group ID)
      if (!userGroupId) {
          await queryAsync(
              `UPDATE users SET group_id = ? WHERE whatsapp_number LIKE ?`,
              [groupId, `%${senderNumber}`]
          );

          console.log(`[SUCCESS] group_id diperbarui untuk ${senderNumber} menjadi ${groupId}`);
      }

      console.log(`[DEBUG] ${senderNumber} adalah admin_group di grup ${groupId}`);

      // Generate token unik untuk grup
      const token = `${groupId.split("@")[0]}-${Date.now()}`;
      const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // Berlaku 24 jam

      // Simpan token ke database
      await queryAsync(
          `INSERT INTO group_tokens (group_id, token, expires_at) VALUES (?, ?, ?) 
          ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
          [groupId, token, expiration]
      );

      // Buat link registrasi
      const serverURL = process.env.FRONTEND_URL || "http://localhost:3000";
      const registerLink = `${serverURL}register?token=${token}`;

      // Kirim link ke grup
      await message.reply(`✅ *Link pendaftaran berhasil dibuat!*\n\n📝 *Gunakan link berikut untuk mendaftar:*\n${registerLink}\n\n🔹 Link berlaku hingga: ${expiration.toLocaleString()}`);
  } catch (error) {
      console.error(`[ERROR] Kesalahan memproses perintah !buatlink:`, error);
      await message.reply("❌ Terjadi kesalahan saat memproses permintaan. Silakan coba lagi nanti.");
  }
}


// Menangani verifikasi manual di grup
if (message.body.toLowerCase() === "!verifikasi") {
  try {
    const senderNumber = message.author || message.from;
    const cleanNumber = senderNumber.replace("@c.us", ""); // Hapus domain WA
    console.log("Nomor yang diverifikasi:", senderNumber); // Debugging
    verifiedNumbers.add(cleanNumber);
    console.log("List nomor terverifikasi:", [...verifiedNumbers]); // Debugging

    // Format pesan konfirmasi dengan nomor user
    const verificationMessage = `✅ Nomor Anda *${cleanNumber}* telah terverifikasi di aplikasi QnA!`;

    client.sendMessage(message.from, verificationMessage);
  } catch (error) {
    console.error("Error saat memverifikasi nomor:", error);
    client.sendMessage(message.from, "Terjadi kesalahan saat memproses pesan Anda.");
  }
}


      client.on("message_create", async (message) => {
        console.log(`[DEBUG] Pesan masuk dari: ${message.from}`);
    
        // Menangkap pesan bot sendiri di grup
        const isFromGroup = message.from.endsWith("@g.us") || message.to.endsWith("@g.us");
        const isBotMessage = message.id.fromMe;
    
        console.log(`[DEBUG] isFromGroup: ${isFromGroup}, isBotMessage: ${isBotMessage}`);
    
        // Pastikan pesan benar-benar dari grup
        if (!isFromGroup) {
            console.log(`[DEBUG] Pesan bukan dari grup, dari: ${message.from}`);
            return;
        }
    
        if (!message.body.startsWith("!setAdminGroup")) return; // Filter perintah
    
        console.log(`[DEBUG] Perintah !setAdminGroup diterima`);
    
        const senderNumber = message.author 
            ? message.author.replace(/\D/g, "") 
            : message.from.replace(/\D/g, "");
        const groupId = message.from;
    
        console.log(`[DEBUG] Sender Number: ${senderNumber}`);
        console.log(`[DEBUG] Group ID: ${groupId}`);
    
        // Cek apakah pengirim adalah admin
        const adminCheck = await queryAsync(
            `SELECT role FROM users WHERE whatsapp_number LIKE ?`,
            [`%${senderNumber}`]
        );
    
        if (!adminCheck || adminCheck.length === 0 || adminCheck[0].role !== "admin") {
            await message.reply("⚠️ *Anda tidak memiliki izin untuk mengangkat admin grup.*");
            return;
        }
    
        // Ambil nomor yang ditandai untuk dijadikan admin_group
        const mentionedUsers = message.mentionedIds.map(id => id.replace(/\D/g, "")); 
    
        if (mentionedUsers.length === 0) {
            await message.reply("⚠️ *Format salah! Gunakan: !setAdminGroup @nomor*");
            return;
        }
    
        for (const adminNumber of mentionedUsers) {
            // Update user menjadi admin_group di database
            await queryAsync(
                `UPDATE users SET role = 'admin_group' WHERE whatsapp_number LIKE ?`,
                [`%${adminNumber}`]
            );
    
            console.log(`[DEBUG] ${adminNumber} sekarang menjadi admin_group di grup ${groupId}`);
        }
    
        await message.reply(`✅ *akun sekarang sebagai Admin grup!*`);
    });
    
    
    if (message.body.startsWith("!setNarasumber")) {
      console.log(`[DEBUG] Perintah !setNarasumber diterima`);
  
      if (!message.from.endsWith("@g.us")) {
          await message.reply("❌ *Perintah ini hanya dapat dijalankan di dalam grup.*");
          return;
      }
  
      const senderNumber = message.author.replace(/\D/g, ""); // Nomor pengirim
      const groupId = message.from; // ID grup WhatsApp
  
      // Cek apakah pengirim adalah admin_group
      const adminCheck = await queryAsync(
          `SELECT group_id FROM users WHERE whatsapp_number LIKE ?`,
          [`%${senderNumber}`]
      );
  
      if (!adminCheck || adminCheck.length === 0) {
          await message.reply("⚠️ *Anda tidak memiliki izin untuk mengatur narasumber.*");
          return;
      }
  
      const adminGroupId = adminCheck[0].group_id; // Ambil group_id dari admin_group
  
      // Ambil nomor yang ditandai sebagai narasumber dari pesan
      const mentionedUsers = message.mentionedIds.map(id => id.replace(/\D/g, "")); 
  
      if (mentionedUsers.length === 0) {
          await message.reply("⚠️ *Format salah! Gunakan: !setNarasumber @nomor*");
          return;
      }
  
      for (const narasumberNumber of mentionedUsers) {
          // Update user menjadi narasumber & set role sebagai admin_group
          await queryAsync(
              `UPDATE users SET is_narasumber = 1, role = 'admin_group', group_id = ? WHERE whatsapp_number LIKE ?`,
              [adminGroupId, `%${narasumberNumber}`]
          );
  
          console.log(`[DEBUG] ${narasumberNumber} sekarang menjadi narasumber dan admin_group di grup ${adminGroupId}`);
      }
  
      await message.reply(`✅ *Narasumber berhasil ditambahkan ke grup ini*`);
  }
  
  if (message.body.startsWith("!hapusNarasumber")) {
      console.log(`[DEBUG] Perintah !hapusNarasumber diterima`);
  
      if (!message.from.endsWith("@g.us")) {
          await message.reply("❌ *Perintah ini hanya dapat dijalankan di dalam grup.*");
          return;
      }
  
      const senderNumber = message.author.replace(/\D/g, ""); // Nomor pengirim
      const groupId = message.from; // ID grup WhatsApp
  
      // Cek apakah pengirim adalah admin_group
      const adminCheck = await queryAsync(
          `SELECT group_id FROM users WHERE role = 'admin_group' AND whatsapp_number LIKE ?`,
          [`%${senderNumber}`]
      );
  
      if (!adminCheck || adminCheck.length === 0) {
          await message.reply("⚠️ *Anda tidak memiliki izin untuk menghapus narasumber.*");
          return;
      }
  
      const adminGroupId = adminCheck[0].group_id; // Ambil group_id dari admin_group
  
      // Ambil nomor yang ditandai sebagai narasumber dari pesan
      const mentionedUsers = message.mentionedIds.map(id => id.replace(/\D/g, "")); 
  
      if (mentionedUsers.length === 0) {
          await message.reply("⚠️ *Format salah! Gunakan: !hapusNarasumber @nomor*");
          return;
      }
  
      for (const narasumberNumber of mentionedUsers) {
          // Hapus status narasumber & ubah role kembali ke user
          await queryAsync(
              `UPDATE users SET is_narasumber = 0, role = 'user' WHERE whatsapp_number LIKE ? AND group_id = ?`,
              [`%${narasumberNumber}`, adminGroupId]
          );
  
          console.log(`[DEBUG] ${narasumberNumber} bukan lagi narasumber dan perannya kembali menjadi user di grup ${adminGroupId}`);
      }
  
      await message.reply(`✅ *Narasumber berhasil dihapus dari grup ini!*`);
  }
  
  
  
     // **Perintah untuk mengatur sesi (Admin Group Only)**
if (message.body.startsWith("!setSession")) {
  console.log(`[DEBUG] Perintah !setSession diterima`);

  // Pastikan perintah hanya bisa dijalankan di dalam grup
  if (!isGroup) {
      await message.reply("❌ *Perintah ini hanya dapat dijalankan di dalam grup.*");
      return;
  }

  const senderNumber = fromNumber.replace(/\D/g, ""); // Hapus semua karakter non-digit
  const groupId = message.from; // ID grup dari mana pesan dikirim
  console.log(`[DEBUG] Nomor pengirim: ${senderNumber}, Grup ID: ${groupId}`);

  try {
      // Cek apakah pengirim adalah admin_group dan memiliki group_id yang sesuai
      const adminCheck = await queryAsync(
          `SELECT id FROM users WHERE role = 'admin_group' AND whatsapp_number LIKE ? AND group_id = ?`, 
          [`%${senderNumber}`, groupId]
      );

      console.log(`[DEBUG] Hasil query adminCheck:`, adminCheck);

      // Jika pengirim bukan admin di grup tersebut, beri balasan dan hentikan eksekusi
      if (!adminCheck || adminCheck.length === 0) {
          await message.reply("⚠️ *Anda tidak memiliki izin untuk mengatur sesi di grup ini.*");
          return;
      }

      // Cek format perintah
      const args = message.body.split(" ");
      if (args.length < 2 || (args[1] !== "aktif" && args[1] !== "nonaktif")) {
          await message.reply("⚠️ *Format salah!*\nGunakan: *!setSession [aktif/nonaktif] [durasi (opsional)]*\nContoh:\n!setSession aktif 10");
          return; // Hentikan jika format salah
      }

      // Jika format benar dan admin, atur status sesi
      if (args[1] === "aktif") {
          const durasi = args[2] ? parseInt(args[2]) : 30; // Default 30 menit jika tidak diisi
          setSessionStatus(groupId, "active", durasi);
          sessionTracking[groupId] = { status: "active", duration: durasi };
          await message.reply(`✅ Sesi tanya jawab telah diaktifkan selama ${durasi} menit.`);
      } else if (args[1] === "nonaktif") {
          setSessionStatus(groupId, "inactive", 0);
          sessionTracking[groupId] = { status: "inactive", duration: 0 };
          await message.reply("✅ Sesi tanya jawab telah dinonaktifkan.");
      }
  } catch (error) {
      console.error(`[ERROR] Gagal memproses perintah !setSession:`, error);
      await message.reply("❌ Terjadi kesalahan dalam mengatur sesi. Silakan coba lagi.");
  }
}


   // **Logika penanganan pertanyaan langsung dari user**
if (message.body.startsWith("!question")) {
  const userQuestion = message.body.slice("!question".length).trim();
  
  if (!userQuestion) {
      await message.reply(`⚠️ *Format salah!*
Gunakan:
*!question [pertanyaan]*

Contoh:
!question Apa jadwal pengiriman hari ini?`);
      return;
  }

  if (isGroup) {
      const sessionId = message.from;
      console.log(`[DEBUG] Cek status sesi untuk grup ID: ${sessionId}`);

      if (!sessionTracking[sessionId] || sessionTracking[sessionId].status !== "active") {
          await message.reply("⚠️ *Sesi tanya jawab belum aktif. Gunakan `!setSession aktif [durasi]` untuk mengaktifkan.*");
          return;
      }
  }

  const groupId = isGroup ? message.from : null;
  if (groupId) {
      const groupKeywords = await queryAsync(`SELECT keyword FROM group_keywords WHERE group_id = ?`, [groupId]);
      const keywords = groupKeywords.map(row => row.keyword.toLowerCase());
      const matchedKeywords = keywords.filter(keyword => userQuestion.includes(keyword));

      if (matchedKeywords.length > 0) {
          console.log(`[INFO] Pesan mengandung keyword khusus: ${matchedKeywords.join(", ")}`);
          const keywordConditions = matchedKeywords.map(() => "question_text LIKE ?").join(" OR ");
          const queryValues = matchedKeywords.map((kw) => `%${kw}%`);
          const similarQuestions = await queryAsync(
              `SELECT COUNT(*) AS total FROM questions WHERE ${keywordConditions}`,
              queryValues
          );

          const totalSimilar = similarQuestions[0].total;
          const serverURL = process.env.FRONTEND_URL || "http://localhost:3000";
          const questionListLink = `${serverURL}similar-questions?query=${encodeURIComponent(userQuestion)}`;

          if (totalSimilar > 0) {
              await message.reply(
                  `📌 *Ditemukan ${totalSimilar} pertanyaan serupa!*
🔗 *Lihat daftar pertanyaan serupa:*
${questionListLink}

Ketik *lanjut* untuk mengajukan pertanyaan ke narasumber.`
              );
          } else {
              await pilihNarasumber(message, userQuestion, isGroup, fromNumber);
          }

          client.once("message", async (responseMsg) => {
              if (responseMsg.from === message.from && responseMsg.body.toLowerCase() === "lanjut") {
                  await pilihNarasumber(message, userQuestion, isGroup, fromNumber);
              }
          });
      } else {
          console.log(`[INFO] Pesan tidak mengandung keyword khusus, diteruskan ke narasumber.`);
          await message.reply("🔄 *Pertanyaan Anda sedang diproses dan akan diteruskan ke narasumber.*");
          await pilihNarasumber(message, userQuestion, isGroup, fromNumber);
      }
  } else {
      console.log(`[INFO] Grup tidak memiliki keyword khusus, diteruskan ke narasumber.`);
      await message.reply("🔄 *Pertanyaan Anda sedang diproses dan akan diteruskan ke narasumber.*");
      await pilihNarasumber(message, userQuestion, isGroup, fromNumber);
  }
}
    } catch (err) {
      console.error("[ERROR] Kesalahan memproses pesan:", err);
      await message.reply("⚠️ *Terjadi kesalahan saat memproses pesan Anda.*");
    }
  });
  
  
 // Fungsi pemilihan narasumber berdasarkan group_id
async function pilihNarasumber(message, userQuestion, isGroup, senderNumber) {
    if (!senderNumber) {
        console.error(`[ERROR] senderNumber tidak tersedia!`);
        await message.reply("⚠️ *Nomor pengirim tidak ditemukan. Harap coba lagi.*");
        return;
    }
    senderNumber = senderNumber.replace("@c.us", ""); // Format nomor

    console.log(`[DEBUG] Mencari user_id dan group_id untuk nomor: ${senderNumber}`);
    const userRecord = await queryAsync(
        `SELECT id, group_id FROM users WHERE whatsapp_number = ?`,
        [senderNumber]
    );

    if (userRecord.length === 0) {
        console.error(`[ERROR] Nomor ${senderNumber} tidak ditemukan dalam database.`);
        await message.reply("⚠️ *Nomor Anda belum terdaftar dalam sistem. Harap hubungi admin.*");
        return;
    }

    const userIdFromDB = userRecord[0].id;
    const userGroupId = userRecord[0].group_id; // Ambil group_id user pengirim
    console.log(`[DEBUG] user_id ditemukan: ${userIdFromDB}, group_id: ${userGroupId}`);

    // Ambil daftar narasumber berdasarkan group_id
    const narasumberList = await queryAsync(
        `SELECT id, username, whatsapp_number FROM users WHERE is_narasumber = 1 AND group_id = ?`,
        [userGroupId]
    );

    if (!narasumberList || narasumberList.length === 0) {
        await message.reply("⚠️ *Belum ada narasumber yang terdaftar di grup ini.*");
        return;
    }

    // Jika hanya ada satu narasumber, langsung kirim pertanyaan tanpa menampilkan pilihan
    if (narasumberList.length === 1) {
        const selectedNarasumber = narasumberList[0];

        await queryAsync(
            `INSERT INTO questions (user_id, question_text, status, assigned_to, group_id, created_at, updated_at) 
            VALUES (?, ?, 'pending', ?, ?, NOW(), NOW())`,
            [userIdFromDB, userQuestion, selectedNarasumber.id, userGroupId]
        );

        await message.reply("✅ *Pertanyaan Anda diterima dan sedang diproses.*");

        const formattedNarasumberNumber = formatPhoneNumber(selectedNarasumber.whatsapp_number, false);
        console.log(`[DEBUG] Mengirim pesan ke narasumber: ${formattedNarasumberNumber}`);

        await sendMessageToAdmin(
            formattedNarasumberNumber,
            `❓ *Pertanyaan baru dari +${senderNumber}:*\n\n${userQuestion}`,
            false
        );

        return;
    }

    // Jika lebih dari satu narasumber, tampilkan opsi pemilihan
    let narasumberOptions = "👤 *Pilih Narasumber:*\n";
    narasumberList.forEach((narasumber, index) => {
        narasumberOptions += `${index + 1}. ${narasumber.username}\n`;
    });
    narasumberOptions += "0. Kirim ke semua narasumber\n";
    narasumberOptions += "\nKetik *nomor narasumber* atau *0* untuk mengirim ke semua.";

    await message.reply(narasumberOptions);

    client.once("message", async (adminResponseMsg) => {
        const selectedIndex = parseInt(adminResponseMsg.body) - 1;

        if (selectedIndex === -1) { // Jika user memilih opsi "0"
            for (const narasumber of narasumberList) {
                await queryAsync(
                    `INSERT INTO questions (user_id, question_text, status, assigned_to, group_id, created_at, updated_at) 
                    VALUES (?, ?, 'pending', ?, ?, NOW(), NOW())`,
                    [userIdFromDB, userQuestion, narasumber.id, userGroupId]
                );

                const formattedNarasumberNumber = formatPhoneNumber(narasumber.whatsapp_number, false);
                await sendMessageToAdmin(
                    formattedNarasumberNumber,
                    `❓ *Pertanyaan baru dari +${senderNumber}:*\n${userQuestion}`,
                    false
                );
            }
            await message.reply("✅ *Pertanyaan telah dikirim ke semua narasumber di grup ini.*");
        } else if (selectedIndex >= 0 && selectedIndex < narasumberList.length) {
            const selectedNarasumber = narasumberList[selectedIndex];

            await queryAsync(
                `INSERT INTO questions (user_id, question_text, status, assigned_to, group_id, created_at, updated_at) 
                VALUES (?, ?, 'pending', ?, ?, NOW(), NOW())`,
                [userIdFromDB, userQuestion, selectedNarasumber.id, userGroupId]
            );

            await message.reply("✅ *Pertanyaan Anda diterima dan sedang diproses.*");

            const formattedNarasumberNumber = formatPhoneNumber(selectedNarasumber.whatsapp_number, false);
            console.log(`[DEBUG] Mengirim pesan ke narasumber: ${formattedNarasumberNumber}`);

            await sendMessageToAdmin(
                formattedNarasumberNumber,
                `❓ *Pertanyaan baru dari +${senderNumber}:*\n\n${userQuestion}`,
                false
            );
        } else {
            await message.reply("⚠️ *Pilihan narasumber tidak valid.*");
        }
    });
}

  client.initialize();
};


const isAdmin = async (whatsappNumber) => {
  const query = "SELECT role FROM users WHERE whatsapp_number = ?";
  const results = await queryAsync(query, [whatsappNumber]);
  return results.length > 0 && results[0].role === "admin";
};

const validateUser = async (userId) => {
  try {
    const query = "SELECT id FROM users WHERE id = ?";
    const [rows] = await dbValidation.execute(query, [userId]);
    return rows.length > 0;
  } catch (err) {
    console.error("Error saat memvalidasi user_id:", err.message);
    return false;
  }
};

const saveQuestion = async (userId, categoryId, questionText, groupId) => {
  try {
    const query = `
      INSERT INTO questions (user_id, category_id, question_text, status, group_id, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, NOW(), NOW())
    `;
    db.execute(query, [userId, categoryId, questionText, groupId]);
    console.log("Pertanyaan berhasil disimpan ke database!");
  } catch (err) {
    console.error("Gagal menyimpan pertanyaan ke database:", err.message);
  }
};

const processQuestion = async (message, content, isGroup) => {
  try {
    const args = content.slice("!question".length).trim().split(" ");
    const userId = parseInt(args[0], 10);
    const questionText = args.slice(1).join(" ");
    const categoryId = null;
    const groupId = isGroup ? message.chat?.id || null : null;

    if (!userId || isNaN(userId) || !questionText) {
      await message.reply(`Format salah! Gunakan:\n- !question [userId] [pertanyaan]\n\nContoh:\n!question 12345 Apa jadwal pengiriman hari ini?`);
      return;
    }

    const isValidUser = await validateUser(userId);
    if (!isValidUser) {
      await message.reply(`Token Bot ${userId} tidak valid!`);
      return;
    }
    await saveQuestion(userId, categoryId, questionText, groupId);
    const replyMessage = isGroup ? `Pertanyaan Anda berhasil disimpan dalam grup ${message.chat?.name || "tidak diketahui"}!` : `Pertanyaan Anda berhasil disimpan!`;
    await message.reply(replyMessage);
  } catch (err) {
    console.error("Error saat memproses pertanyaan:", err);
    await message.reply("Terjadi kesalahan saat memproses pertanyaan Anda.");
  }
};

const formatPhoneNumber = (phone, isGroup = false) => {
  if (isGroup) {
    // Validasi bahwa ID grup diakhiri dengan "@g.us"
    if (!phone.endsWith("@g.us")) {
      throw new Error(`ID grup tidak valid: ${phone}`);
    }
    return phone; // ID grup tidak perlu diformat
  } else {
    // Format nomor telepon untuk individu (tambahkan kode negara)
    let cleanedPhone = phone.replace(/[^0-9]/g, ""); // Hapus karakter selain angka

    // Misalnya, untuk Indonesia, kita tambahkan kode negara '62' di depan nomor
    if (cleanedPhone.startsWith("0")) {
      cleanedPhone = "62" + cleanedPhone.slice(1); // Mengganti '0' dengan '62'
    }

    // Validasi panjang nomor telepon
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      throw new Error(`Nomor telepon tidak valid: ${cleanedPhone}`);
    }

    return `${cleanedPhone}@c.us`; // Format nomor individu dengan akhiran @c.us
  }
};

const sendMessageToUser = async (to, message) => {
  if (!client) {
    console.error("WhatsApp client belum siap!");
    return;
  }

  try {
    // Log ID yang akan digunakan
    console.log(`Mengirim pesan ke: ${to.endsWith("@c.us") ? to : `${to}@c.us`}`);

    // Kirim pesan
    const response = await client.sendMessage(to.endsWith("@c.us") ? to : `${to}@c.us`, message);

    // Log respons
    console.log("Pesan terkirim:", response);
  } catch (err) {
    // Log error yang lebih detail
    console.error(`Gagal mengirim pesan ke ${to}:`, err.message);
    console.log(`[DEBUG] sendMessageToAdmin - to: ${to}, message: ${message}`);
    throw err;
  }
};

// Fungsi untuk mengirim pesan, dengan dukungan ID grup atau individu
const sendMessageToAdmin = async (to, message, isGroup = false) => {
  try {
    let formattedNumber;

    // Jika isGroup true, kita tidak perlu memformat nomor (langsung gunakan ID grup apa adanya)
    if (isGroup) {
      formattedNumber = to; // Tidak memformat jika itu grup
    } else {
      // Jika isGroup false, maka kita format nomor individu
      formattedNumber = formatPhoneNumber(to, isGroup); // Format nomor untuk individu
    }

    // Log nomor tujuan untuk debug
    console.log(`[DEBUG] Mengirim pesan ke: ${formattedNumber}`);

    // Kirim pesan
    const response = await client.sendMessage(formattedNumber, message);
    console.log("Pesan terkirim:", response);
  } catch (err) {
    // Tangkap dan log error
    console.error(`Gagal mengirim pesan ke ${to}:`, err.message);
    throw err; // Lempar error agar bisa ditangani di tempat lain
  }
};

const sendMessageToGroup = async (groupId, message) => {
  if (!client) {
    console.error("WhatsApp client belum siap!");
    return;
  }

  try {
    console.log(`Mengirim pesan ke grup: ${groupId}`);

    const response = await client.sendMessage(groupId, message);

    console.log("Pesan ke grup terkirim:", response);
  } catch (err) {
    console.error(`Gagal mengirim pesan ke grup ${groupId}:`, err.message);
    throw err;
  }
};


const getQR = () => {
  if (isConnected) {
    return { connected: true }; // Jika terhubung, kembalikan status
  }
  return { connected: false, currentQRCode };
};

module.exports = {
  sendMessageToUser,
  initWhatsAppClient,
  sendMessageToAdmin,
  sendMessageToGroup,
  isAdmin,
  getQR,
  client,
  clientReady,
};
