express = require('express');
const router = express.Router();
const multer = require('multer');
const Joi = require('joi');
const pool = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, new Date().toISOString() + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only JPEG and PNG is allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter
});

const campaignSchema = Joi.object({
  title: Joi.string().required(),
  name: Joi.string().required(),
  userId: Joi.number().integer().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  contact: Joi.string().required(),
  description: Joi.string().required(),
  date: Joi.date().required()
});

router.post('/', upload.single('photoEvent'),verifyToken, (req, res) => {
  const { title, name, userId, latitude, longitude, contact, description, date } = req.body;
  
  const { error } = campaignSchema.validate({ title, name, userId, latitude, longitude, contact, description, date });
  if (error) {
    return res.status(400).json({ error: true, message: error.details[0].message });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM campaigns WHERE title = ?';
      connection.query(query, [title], (err, results) => {
        if (err) {
          connection.release();
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
        } else if(results.length > 0) {
          connection.release();
          res.status(400).json({ error: true, message: 'Campaign title already exists. Please choose a different title.' });
        } else {
          const query = 'SELECT * FROM users WHERE id = ?';
          connection.query(query, [userId], (err, results) => {
            if (err) {
              connection.release();
              res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
            } else if (results.length === 0) {
              connection.release();
              res.status(400).json({ error: true, message: 'Invalid userId - Foreign key constraint failed' });
            } else {
              const user = results[0];
          
              if (user.id !== req.userId) {
                connection.release();
                res.status(401).json({ error: true, message: 'Unauthorized' });
              } else {
                // pastikan req.file ada sebelum menyimpan path gambar ke database
                const photoEvent = req.file ? req.file.path : null;
                const insertQuery = 'INSERT INTO campaigns (title, name, userId, latitude, longitude, contact, description, date, photoEvent) VALUES (?,?,?,?,?,?,?,?,?)';
                connection.query(insertQuery, [title, name, userId, latitude, longitude, contact, description, date, photoEvent], (err, results) => {
                  connection.release();
                  if(err) {
                    res.status(500).json({ error: true, message: 'Failed to executequery', error_details: err });
                  } else {
                    res.status(201).json({ error: false, message: 'Campaign created successfully' });
                  }
                });
              }
            }
          });
        }
      });
    }
  });
});

router.get('/', verifyToken, (req, res) => {
  pool.getConnection((err,connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM campaigns WHERE userId = ?';
      connection.query(query, [req.userId], (err, results) => {
        if (err) {
          connection.release();
          res.status(500).json({ error: true,message: 'Failed to execute query' });
        } else {
          connection.release();
          res.status(200).json({ error: false, campaigns: results });
        }
      });
    }
  });
});

router.get('/all', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM campaigns';

      connection.query(query, (err, results) => {
        connection.release();

        if (err) {
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
        } else {
          res.status(200).json({ error: false, campaigns: results });
        }
      });
    }
  });
});

module.exports = router;

/*
express = require('express');
const router = express.Router();
const multer = require('multer');
const Joi = require('joi');
const pool = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, new Date().toISOString() + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only JPEG and PNG is allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter
});

const campaignSchema = Joi.object({
  title: Joi.string().required(),
  name: Joi.string().required(),
  userId: Joi.number().integer().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  contact: Joi.string().required(),
  description: Joi.string().required(),
  date: Joi.date().required()
});

router.post('/', upload.single('photoEvent'), verifyToken, (req, res) => {
  const { title, name, userId, latitude, longitude, contact, description, date } = req.body;
  
  const { error } = campaignSchema.validate({ title, name, userId, latitude, longitude, contact, description, date });
  if (error) {
    return res.status(400).json({ error: true, message: error.details[0].message });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM campaigns WHERE title = ?';
      connection.query(query, [title], (err, results) => {
        if (err) {
          connection.release();
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
        } else if(results.length > 0) {
          connection.release();
          res.status(400).json({ error: true, message: 'Campaign title already exists. Please choose a different title.' });
        } else {
          const query = 'SELECT * FROM users WHERE id = ?';
          connection.query(query, [userId], (err, results) => {
            if (err) {
              connection.release();
              res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
            } else if (results.length === 0) {
              connection.release();
              res.status(400).json({ error: true, message: 'Invalid userId - Foreign key constraint failed' });
            } else {
              const user = results[0];
          
              if (user.id !== req.userId) {
                connection.release();
                res.status(401).json({ error: true, message: 'Unauthorized' });
              } else {
                // pastikan req.file ada sebelum menyimpan path gambar ke database
                const photoEvent = req.file ? req.file.path : null;
                const insertQuery = 'INSERT INTO campaigns (title, name, userId, latitude, longitude, contact, description, date, photoEvent) VALUES (?,?,?,?,?,?,?,?,?)';
                connection.query(insertQuery, [title, name, userId, latitude, longitude, contact, description, date, photoEvent], (err, results) => {
                  connection.release();
                  if(err) {
                    res.status(500).json({ error: true, message: 'Failed to executequery', error_details: err });
                  } else {
                    res.status(201).json({ error: false, message: 'Campaign created successfully' });
                  }
                });
              }
            }
          });
        }
      });
    }
  });
});

router.get('/', verifyToken, (req, res) => {
  pool.getConnection((err,connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT * FROM campaigns WHERE userId = ?';
      connection.query(query, [req.userId], (err, results) => {
        if (err) {
          connection.release();
          res.status(500).json({ error: true,message: 'Failed to execute query' });
        } else {
          connection.release();
          res.status(200).json({ error: false, campaigns: results });
        }
      });
    }
  });
});

module.exports = router;
*/