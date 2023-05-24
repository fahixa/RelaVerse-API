const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Konfigurasi koneksi ke SQL Instance
const dbConfig = {
  host: '34.101.168.45',
  user: 'root',
  password: 'relaverse',
  database: 'relaverse'
};

// Membuat koneksi pool untuk reusabilitas koneksi
const pool = mysql.createPool(dbConfig);

// Rute API untuk login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM users WHERE email = ?';
      connection.query(query, [email], (err, results) => {
        connection.release();
        if (err) {
          res.status(500).json({ error: 'Failed to execute query'+ '!' });
        } else if (results.length === 0) {
          res.status(401).json({ error: 'Invalid email or password' });
        } else {
          const user = results[0];
          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              res.status(500).json({ error: 'Failed to compare passwords' });
            } else if (!isMatch) {
              res.status(401).json({ error: 'Invalid email or password' });
            } else {
              // Generate JWT Token
              const token = jwt.sign({ id: user.id }, 'secret-key', { expiresIn: '1h' });
              res.status(200).json({ message: 'Login successful', token, user });
            }
          });
        }
      });
    }
  });
});

// Rute API untuk register
app.post('/api/register', (req, res) => {
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
                  // Generate JWT Token
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

// Middleware untuk memverifikasi JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
  } else {
    jwt.verify(token, 'secret-key', (err, decoded) => {
      if (err) {
        res.status(500).json({ error: 'Failed to authenticate token' });
      } else {
        req.userId = decoded.id;
        next();
      }
    });
  }
};

// Rute API untukmemperbarui data pengguna
app.put('/api/users/:id', verifyToken, (req, res) => {
  const userId = req.params.id;
  const { name, phone_number, email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: 'Failed to connect to database' });
    } else {
      // Cek apakah pengguna dengan id tersebut ada di database
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

          // Cek apakah user yang mengakses API adalah pemilik data tersebut
          if (user.id !== req.userId) {
            connection.release();
            res.status(401).json({ error: 'Unauthorized' });
          } else {
            // Hash password baru jika ada
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

// Menjalankan server backend pada port tertentu
const port = 3000;
app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});