const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

router.post('/', (req, res) => {
  const { name, phone_number, email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: 'Failed to connect to database' });
    } else {
      bcrypt.genSalt(10, (err, salt) => {
        if (err) {
          res.status(500).json({ error: 'Failed to generate salt' });
        } else {
          bcrypt.hash(password, salt, (err,hash) => {
            if (err) {
              res.status(500).json({ error: 'Failed to hash password' });
            } else {
              const hashedPassword = hash;

              const query = 'INSERT INTO users (name, phone_number, email, password) VALUES (?,?,?,?)';
              connection.query(query, [name, phone_number, email, hashedPassword], (err, results) => {
                connection.release();
                if (err) {
                  res.status(500).json({ error: 'Failed to execute query' });
                } else {
                  const token = jwt.sign({ id: results.insertId }, 'secret-key', { expiresIn: '1h' });
                  res.status(201).json({ message: 'User registered successfully', token });
                }
              });
            }
          });
        }
      });
    }
  });
});

module.exports = router;