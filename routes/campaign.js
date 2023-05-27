const express = require('express');
const router = express.Router();
const multer = require('multer');
const Joi = require('joi');
const pool = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage({
  keyFilename: path.join(__dirname, "../keys/bangkit-386813-0aa8ddedf7ae.json"),
  projectId: "bangkit-386813",
});

const bucket = storage.bucket("relaverse");

const multerStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only JPEG and PNG is allowed!'), false);
  }
};

const upload = multer({
  storage: multerStorage,
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

router.post('/', upload.single('photoEvent'),verifyToken, async (req, res, next) => {
  try {
    const { title, name, userId, latitude, longitude, contact, description, date } = req.body;
    
    const { error } = campaignSchema.validate({ title, name, userId, latitude, longitude, contact, description, date });
    if (error) {
      return res.status(400).json({ error: true, message: error.details[0].message });
    }

    if (!req.file) {
      return res.status(400).json({ error: true, message: 'photoEvent is required' });
    }

    if (req.file.size > 1024 * 1024 * 5) {
      return res.status(400).json({ error: true, message: 'File size is too large. Maximum size is 5MB.' });
    }

    const newFileName = Date.now() + "-" + req.file.originalname;
    const fileUpload = bucket.file(newFileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: req.file.mimetype
      }
    });

    blobStream.on("error", (error) => {
      console.error('Something went wrong!', error);
      return res.status(500).json({ error: true, message: "Something went wrong uploading your file" });
    });

    blobStream.on("finish", () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
      createCampaign(publicUrl);
    });

    blobStream.end(req.file.buffer);

    function createCampaign(photoEvent) {
      pool.getConnection((err, connection) => {
        if (err) {
          console.error('Failed to connect to database', err);
          return res.status(500).json({ error: true, message: 'Failed to connect to database' });
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
  } }catch (err) {
    console.error('An error occurred', err);
    return res.status(500).json({ error: true, message: 'An error occurred while processing your request' });
  }
});

router.get('/all', verifyToken, (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT id, title, name, userId, photoEvent, latitude as lat, longitude as lon, contact, description, date FROM campaigns';

      connection.query(query, (err, results) => {
        connection.release();

        if (err) {
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
        } else {
          const campaigns = results.map((row) => {
            row.lat = row.lat ? row.lat : null;
            row.lon = row.lon ? row.lon : null;
            return row;
          });
          res.status(200).json({ error: false, campaigns });
        }
      });
    }
  });
});

router.get('/:campaignId', verifyToken, (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database' });
    } else {
      const query = 'SELECT id, title, name, userId, photoEvent, latitude as lat, longitude as lon, contact, description, date FROM campaigns WHERE id = ?';

      connection.query(query, [req.params.campaignId], (err, results) => {
        connection.release();

        if (err) {
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
        } else if (results.length === 0) {
          res.status(404).json({ error: true, message: 'Campaign not found' });
        } else {
          const campaign = results[0];
          campaign.lat = campaign.lat ? campaign.lat : null;
          campaign.lon = campaign.lon ? campaign.lon : null;
          res.status(200).json({ error: false, campaign });
        }
      });
    }
  });
});

module.exports = router;