const express = require('express');  
const bodyParser = require('body-parser');  
const cors = require('cors');  
require('dotenv').config();  
const i18n = require('i18next');  
const Backend = require('i18next-fs-backend');  
const middleware = require('i18next-http-middleware');  
const { initWhatsAppClient, sendMessageToUser, getQR, client, isAdmin } = require('./whatsapp/wabot');  

// Routes  
const authRoutes = require('./routes/authRoutes');  
const questionRoutes = require('./routes/questionRoutes');  
const answerRoutes = require('./routes/answerRoutes');  
const userRoutes = require('./routes/userRoutes');  
const categoryRoutes = require('./routes/categoryRoutes');  
const i18nRoutes = require('./routes/i18nRoutes');  
const translateRoutes = require('./routes/translateRoutes');  
const groupTokenRoutes = require('./routes/groupTokenRoutes'); 
const groupKeywordRoutes = require("./routes/groupKeywordRoutes");
// groupTokenRoutes belum dibuat

const app = express();  
let isConnected = false;  

// Inisialisasi WhatsApp Client  
initWhatsAppClient();  

// Middleware  
app.use(cors());  
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded({ extended: false }));  
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
  

// Routes  
app.use('/api/auth', authRoutes);  
app.use('/api/questions', questionRoutes);  
app.use('/api/answers', answerRoutes);  
app.use('/api/users', userRoutes);  
app.use('/api/categories', categoryRoutes);  
app.use('/api/group-tokens', groupTokenRoutes);
app.use("/api/group-keywords", groupKeywordRoutes);

// Configure i18n for internationalization  
i18n.use(Backend)  
  .use(middleware.LanguageDetector)  
  .init({  
    fallbackLng: 'en',  
    backend: {  
      loadPath: './locales/{{lng}}.json',  
    },  
  });  

app.use(middleware.handle(i18n));  
app.use('/api/i18n', i18nRoutes);  
app.use('/api/translate', translateRoutes);  

// CORS options for frontend  
const corsOptions = {  
  origin: ['http://localhost:3000', 'https://qna-frontendv2-production.up.railway.app/'],  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  
  credentials: true,  
};  

app.use(cors(corsOptions));  

// Endpoint API untuk mendapatkan QR code terbaru
app.get('/api/get-qr', async (req, res) => {
  let qrData = getQR();
  console.log("API get-qr dipanggil:", qrData);

  if (!qrData.currentQRCode || qrData.currentQRCode.startsWith('undefined')) {
      console.log("⚠️ QR Code belum tersedia, menunggu...");
      await new Promise(resolve => setTimeout(resolve, 3000)); // Tunggu QR siap
      qrData = getQR(); // Ambil QR terbaru setelah delay
  }

  res.json(qrData);
});


// Endpoint untuk memeriksa status koneksi WhatsApp  
app.get('/api/check-auth', async (req, res) => {
  try {
    if (client && client.info && client.info.wid) {
      const whatsappNumber = client.info.wid.user;
      const admin = await isAdmin(whatsappNumber);
      if (admin) {
        isConnected = true;
        return res.status(200).json({ authenticated: true, role: 'admin' });
      } else {
        await client.logout();
        initWhatsAppClient();
        return res.status(200).json({ authenticated: false, role: 'non-admin', message: 'You are not an admin.' });
      }
    }
    res.status(200).json({ authenticated: false });
  } catch (err) {
    console.error('Error checking WhatsApp connection:', err.message);
    res.status(500).json({ authenticated: false, error: 'Server error' });
  }
});

// Endpoint untuk memeriksa status bot
app.get('/api/bot-status', async (req, res) => {
  try {
    if (client && client.info && client.info.wid) {
      return res.status(200).json({ ready: true, message: 'Bot is ready.' });
    }
    res.status(200).json({ ready: false, message: 'Bot is not ready yet.' });
  } catch (err) {
    console.error('Error checking bot status:', err.message);
    res.status(500).json({ ready: false, error: 'Server error' });
  }
});


// Endpoint untuk status koneksi WhatsApp
app.get('/api/status', (req, res) => {
  if (client && client.info && client.info.wid) {
    res.json({
      connected: true,
      message: 'WhatsApp sedang terhubung.'
    });
  } else {
    res.json({
      connected: false,
      message: 'WhatsApp belum terhubung.'
    });
  }
});

// Endpoint untuk admin membalas pesan
app.post('/admin/reply', (req, res) => {
  const { to, message } = req.body;

  if (!/^\d+$/.test(to)) {
    return res.status(400).send({ success: false, message: 'Nomor tujuan tidak valid.' });
  }

  try {
    sendMessageToUser(to, message);
    res.status(200).send({ success: true, message: 'Pesan berhasil dikirim.' });
  } catch (error) {
    console.error('Gagal mengirim pesan:', error.message);
    res.status(500).send({ success: false, message: 'Gagal mengirim pesan.' });
  }
});

// Middleware to log request method and URL
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.send('Hello from QnA Backend!');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Tangani error tak terduga di Puppeteer
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  if (err.message.includes('Target closed')) {
    console.log('Restarting WhatsApp client...');
    initWhatsAppClient();
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});