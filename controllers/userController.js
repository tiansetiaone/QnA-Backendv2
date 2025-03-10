const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db');

// Registrasi pengguna baru
exports.registerUser = async (req, res) => {
    console.log('Request received with data:', req.body);
    const { username, whatsapp_number, password } = req.body;
  
    if (!username || !whatsapp_number || !password) {
        console.log('Validation failed: Missing fields');
      return res.status(400).json({ error: 'All fields are required' });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully');
      db.query(
        'INSERT INTO users (username, whatsapp_number, password) VALUES (?, ?, ?)',
        [username, whatsapp_number, hashedPassword],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
        }
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  };

// Login pengguna
exports.loginUser = async (req, res) => {
    try {
      const { username, whatsapp_number, password } = req.body;
  
      console.log('Request received for login:', req.body); // Log body request
  
      // Cek username atau whatsapp_number
      const query = username
        ? 'SELECT * FROM users WHERE username = ?'
        : 'SELECT * FROM users WHERE whatsapp_number = ?';
      const value = username || whatsapp_number;
  
      console.log('Query:', query, 'Value:', value); // Log query dan value
  
      db.query(query, [value], async (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
  
        if (results.length === 0) {
          console.log('User not found with value:', value); // Log jika user tidak ditemukan
          return res.status(404).json({ error: 'User not found' });
        }
  
        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.log('Password mismatch for user:', user.username); // Log jika password salah
          return res.status(401).json({ error: 'Invalid credentials' });
        }
  
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });
        res.status(200).json({
          message: 'Login successful',
          token,
          user: { id: user.id, username: user.username, whatsapp_number: user.whatsapp_number, role: user.role, },
        });
      });
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  


// Mendapatkan profil pengguna
exports.getProfile = (req, res) => {
    console.log('Fetching profile for user ID:', req.user.id);
    User.getUserById(req.user.id, (err, users) => {
      if (err || users.length === 0) {
        console.log('User not found');
        return res.status(404).json({ error: 'User not found' });
      }
      const user = users[0];
      delete user.password;
      res.status(200).json(user);
    });
  };


  // Update User Profile
exports.updateProfile = async (req, res) => {
  const userId = req.user.id; // ID pengguna dari middleware protect
  const { username, whatsappnumber, password } = req.body;

  if (!username || !whatsappnumber) {
    return res.status(400).json({ error: "Username and WhatsApp number are required" });
  }

  try {
    // Jika password disediakan, enkripsi terlebih dahulu
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Siapkan data untuk diupdate
    const updateData = hashedPassword
      ? { username, whatsappnumber, password: hashedPassword }
      : { username, whatsappnumber };

    User.updateUserProfile(userId, updateData, (err, result) => {
      if (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({ message: 'Profile updated successfully' });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Mendapatkan daftar semua user
exports.getAllUsers = (req, res) => {
  const sql = "SELECT id, username, whatsapp_number, role FROM users";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching users:", err);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
    res.status(200).json({ users: results });
  });
};