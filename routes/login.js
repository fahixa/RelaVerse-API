const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

router.post('/', (req, res) => {
  const { email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM users WHERE email = ?';
      connection.query(query, [email], (err, results) => {
        connection.release();
        if (err) {
          res.status(500).json({ error: true, message: 'Failed to execute query' });
        } else if (results.length === 0) {
          res.status(401).json({ error: true, message: 'Invalid email or password' });
        } else {
          const user = results[0];
          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              res.status(500).json({ error: true, message: 'Failed to compare passwords' });
            } else if (!isMatch) {
              res.status(401).json({ error: true, message: 'Invalid email or password' });
            } else {
              const token = jwt.sign({ id: user.id }, 'secret-key', { expiresIn: '1w' });
              res.status(200).json({ error: false, message: 'Login successful', token, user });
            }
          });
        }
      });
    }
  });
});

module.exports = router;