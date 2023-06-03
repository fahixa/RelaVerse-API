const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

router.post('/', (req, res) => {
  const { name, phone_number, email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const emailQuery = 'SELECT * FROM users WHERE email = ?';
      const phoneQuery = 'SELECT * FROM users WHERE phone_number = ?';

      connection.query(emailQuery, [email], (err, emailResults) => {
        if (err) {
          connection.release();
          res.status(500).json({ error: true, message: 'Failed to execute query' });
        } else {
          if (emailResults.length > 0) {
            connection.release();
            res.status(409).json({ error: true, message: 'User with this email already exists' });
          } else {
            connection.query(phoneQuery, [phone_number], (err, phoneResults) => {
              if (err) {
                connection.release();
                res.status(500).json({ error: true, message: 'Failed to execute query' });
              } else {
                if (phoneResults.length > 0) {
                  connection.release();
                  res.status(409).json({ error: true, message: 'User with this phone number already exists' });
                } else {
                  bcrypt.genSalt(10, (err, salt) => {
                    if (err) {
                      connection.release();
                      res.status(500).json({ error: true, message: 'Failed to generate salt' });
                    } else {
                      bcrypt.hash(password, salt, (err, hash) => {
                        if (err) {
                          connection.release();
                          res.status(500).json({ error: true, message: 'Failed to hash password' });
                        } else {
                          const hashedPassword = hash;

                          const insertQuery = 'INSERT INTO users (name, phone_number, email, password) VALUES (?,?,?,?)';
                          connection.query(insertQuery, [name, phone_number, email, hashedPassword], (err, results) => {
                            connection.release();
                            if (err) {
                              res.status(500).json({ error: true, message: 'Failed to execute query' });
                            } else {
                              const token = jwt.sign({ id: results.insertId }, 'secret-key', { expiresIn: '1w' });
                              res.status(201).json({ error: false, message: 'User registered successfully', token });
                            }
                          });
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        }
      });
    }
  });
});

module.exports = router;