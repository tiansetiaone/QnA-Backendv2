const jwt = require("jsonwebtoken");
const db = require("../config/db");
const i18n = require("i18next");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
      console.log("Token tidak ada dalam header!");
      return res.status(403).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Mengambil token setelah "Bearer"
  if (!token) {
      console.log("Format token salah!");
      return res.status(403).json({ error: "Invalid token format" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
          console.log("Token tidak valid atau sudah kedaluwarsa!");
          return res.status(403).json({ error: "Invalid or expired token" });
      }

      console.log("Decoded Token:", decoded); // Debug untuk memastikan `group_id` ada

      req.user = { id: decoded.id, group_id: decoded.group_id };
      console.log("req.user setelah decode:", req.user); // Debug apakah `req.user` tersimpan

      next();
  });
};


// Middleware untuk memverifikasi role admin pada grup tertentu
exports.isAdmin = (req, res, next) => {
  console.log("Middleware isAdmin dijalankan...");
  console.log("req.user:", req.user); // Debug

  if (!req.user) {
      console.log("User tidak terautentikasi!");
      return res.status(403).json({ error: "User not authenticated" });
  }

  const { id, group_id } = req.user;
  console.log("User ID:", id, "Group ID:", group_id); // Debug

  if (!group_id) {
      console.log("Group ID tidak ditemukan di token!");
      return res.status(403).json({ error: "Group ID not found in token" });
  }

  next();
};

// Middleware untuk melindungi rute dengan token JWT
exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Query database untuk memastikan pengguna ada
    const sql = `
    SELECT u.id, u.username, u.role, s.language 
    FROM users u 
    LEFT JOIN settings s ON u.id = s.user_id 
    WHERE u.id = ?`;

    db.query(sql, [decoded.id], (error, results) => {
      if (error || results.length === 0) {
        return res.status(401).json({ error: "Invalid token" });
      }

      req.user = {
        id: results[0].id,
        username: results[0].username,
        role: results[0].role,
        language: results[0].language || "id", // Default ke bahasa Inggris
      };
      console.log("User role from protect middleware:", req.user.role);
      // Ubah bahasa sesuai dengan pengaturan user
      i18n.changeLanguage(req.user.language); // Memastikan bahasa sesuai user
      console.log("User language set to:", req.user.language);
      next();
    
    });
  } catch (err) {
    console.error(err);
    return res.status(403).json({ error: "Invalid token" });
  }
};

exports.validateGroupToken = (req, res, next) => {
  const token = req.query.token || req.body.token; // Cek dari query atau body

  if (!token) {
      return res.status(400).json({ error: "Group token is required" });
  }

  const sql = "SELECT * FROM group_tokens WHERE token = ? AND expires_at > NOW()";
  db.query(sql, [token], (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Database error" });
      }

      if (results.length === 0) {
          return res.status(401).json({ error: "Invalid or expired group token" });
      }

      req.group = results[0]; // Simpan data grup
      next();
  });
};



