const db = require('../config/db');
const crypto = require('crypto');

// Fungsi untuk validasi token grup
exports.validateGroupToken = (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ error: 'Group token is required' });
    }

    const sql = "SELECT * FROM group_tokens WHERE token = ? AND expires_at > NOW()";
    db.query(sql, [token], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired group token' });
        }

        res.json({ success: true, group: results[0] });
    });
};

// Fungsi untuk membuat token grup baru (hanya admin)
exports.generateGroupToken = (req, res) => {
    const { group_id, expires_in } = req.body;

    if (!group_id) {
        return res.status(400).json({ error: 'Group ID is required' });
    }

    const token = crypto.randomBytes(16).toString('hex'); // Generate token unik
    const expires_at = new Date(Date.now() + (expires_in || 24 * 60 * 60 * 1000)); // Default 24 jam

    const sql = "INSERT INTO group_tokens (group_id, token, expires_at) VALUES (?, ?, ?)";
    db.query(sql, [group_id, token, expires_at], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ success: true, token, expires_at });
    });
};
