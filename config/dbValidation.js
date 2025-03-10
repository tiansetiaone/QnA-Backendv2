const mysql = require('mysql2/promise'); // Gunakan versi berbasis promise
require('dotenv').config();

// Konfigurasi khusus untuk validasi user
const dbValidation = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = dbValidation;
