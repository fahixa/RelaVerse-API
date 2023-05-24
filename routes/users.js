const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

router.put('/:id', verifyToken, (req, res) => {
  const userId = req.params.id;
  const { name, phone_number, email, password } = req.body;

  pool.getConnection((err, connection) =>{
    if (err) {
      res.status(500).json({ error: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM users WHERE id = ?';
      connection.query(query, [userId], (err, results) => {
        if (err) {
          connection.release();
          res.status(500).json({ error: 'Failed to execute query' });
        } else if (results.length === 0) {
          connection.release();
          res.status(404).json({ error: 'User not found' });
        } else {
          const user = results[0];

          if (user.id !== req.userId) {
            connection.release();
            res.status(401).json({ error: 'Unauthorized' });
          } else {
            if (password) {
              bcrypt.genSalt(10, (err, salt) => {
                if (err) {
                  connection.release();
                  res.status(500).json({ error: 'Failed to generate salt' });
                } else {
                  bcrypt.hash(password, salt, (err, hash) => {
                    if (err) {
                      connection.release();
                      res.status(500).json({ error: 'Failed to hash password' });
                    } else {
                      const hashedPassword = hash;
                      const query = 'UPDATE users SET name = ?, phone_number = ?, email = ?, password = ? WHERE id = ?';
                      connection.query(query, [name, phone_number, email, hashedPassword, userId], (err, results) => {
                        connection.release();
                        if (err) {
                          res.status(500).json({ error: 'Failed to execute query' });
                        } else {
                          res.status(200).json({ message: 'User updated successfully' });
                        }
                      });
                    }
                  });
                }
              });
            } else {
              const query = 'UPDATE users SET name = ?, phone_number = ?, email = ? WHERE id = ?';
              connection.query(query, [name, phone_number, email, userId], (err, results) => {
                connection.release();
                if (err) {
                  res.status(500).json({ error: 'Failed to execute query' });
                } else {
                  res.status(200).json({ message: 'User updated successfully' });
                }
              });
            }
          }
        }
      });
    }
  });
});

module.exports = router;