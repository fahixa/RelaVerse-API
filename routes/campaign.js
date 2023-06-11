const express = require('express');
const router = express.Router();
const multer = require('multer');
const Joi = require('joi');
const pool = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { makePrediction } = require('./model');

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
  date: Joi.date().required(),
  location: Joi.string().required(),
  whatsappLink: Joi.string().required()
});

router.post('/', upload.single('photoEvent'), verifyToken, async (req, res, next) => {
  try {
    const { title, name, userId, latitude, longitude, contact, description, date, location, whatsappLink } = req.body;

    const { error } = campaignSchema.validate({ title, name, userId, latitude, longitude, contact, description, date, location, whatsappLink });
    if (error) {
      return res.status(400).json({ error: true, message: error.details[0].message });
    }

    makePrediction(title).then(predictionData => {
      const prediction = predictionData;
      if (prediction < 0.7) {
        return res.status(400).json({ error: true, message: 'The campaign title is not appropriate' });
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
    }).catch(err => {
      console.error('An error occurred during prediction', err);
      return res.status(500).json({ error: true, message: 'An error occurred during prediction' });
    });

    function createCampaign(photoEvent) {
      pool.getConnection((err, connection) => {
        if (err) {
          console.error('Failed to connect to database', err);
          return res.status(500).json({ error: true, message: 'Failed to connect to database' });
        }
    
        const query = 'SELECT * FROM campaigns WHERE title = ?';
        connection.query(query, [title], (err, results) => {
          if (err) {
            connection.release();
            res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
          } else if (results.length > 0) {
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
                  const insertQuery = 'INSERT INTO campaigns (title, name, userId, latitude, longitude, contact, description, date, photoEvent, location, whatsappLink) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
                  connection.query(insertQuery, [title, name, userId, latitude, longitude, contact, description, date, photoEvent, location, whatsappLink], (err, results) => {
                    connection.release();
                    if (err) {
                      res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err });
                    } else {
                      res.status(201).json({ error: false, message: 'Campaign created successfully' });
                    }
                  });
                }
              }
            });
          }
        });
      });
    }
    }catch (err) {
    console.error('An error occurred', err);
    return res.status(500).json({ error: true, message: 'An error occurred while processing your request' });
  }
});

router.get('/all', verifyToken, (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database', detail: err.message });
    } else {
      const query = 'SELECT id, title, name, userId, photoEvent, latitude as lat, longitude as lon, contact, description, date, location, whatsappLink FROM campaigns ORDER BY date ASC';

      connection.query(query, (err, results) => {
        connection.release();

        if (err) {
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err.message });
        } else {
          const campaigns = results.map((row) => {
            row.lat = row.lat ? row.lat : null;
            row.lon = row.lon ? row.lon : null;
            return row;
          });
          res.status(200).json({ error: false, message: 'Successfully fetched all campaigns', campaigns });
        }
      });
    }
  });
});

router.get('/:campaignId', verifyToken, (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ error: true, message: 'Failed to connect to database', detail: err.message });
    } else {
      const query = 'SELECT id, title, name, userId, photoEvent, latitude as lat, longitude as lon, contact, description, date, location, whatsappLink FROM campaigns WHERE id = ?';

      connection.query(query, [req.params.campaignId], (err, results) => {
        connection.release();

        if (err) {
          res.status(500).json({ error: true, message: 'Failed to execute query', error_details: err.message });
        } else if (results.length === 0) {
          res.status(404).json({ error: true, message: 'Campaign not found' });
        } else {
          const campaign = results[0];
          campaign.lat = campaign.lat ? campaign.lat : null;
          campaign.lon = campaign.lon ? campaign.lon : null;
          res.status(200).json({ error: false, message: 'Successfully fetched campaign', campaign });
        }
      });
    }
  });
});

router.post('/volunteer/:campaignId', verifyToken, (req, res) => {
  const campaignId = req.params.campaignId;
  const userId = req.userId;

  pool.query('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaignResults) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Failed to execute query' });
    }
    if (campaignResults.length === 0) {
      return res.status(404).json({ error: true, message: 'Campaign not found' });
    }

    pool.query('SELECT * FROM users WHERE id = ?', [userId], (err, userResults) => {
      if (err) {
        return res.status(500).json({ error: true, message: 'Failed to execute query' });
      }
      if (userResults.length === 0) {
        return res.status(404).json({ error: true, message: 'User not found' });
      }

      pool.query(
        'SELECT * FROM campaign_participants WHERE campaign_id = ? AND user_id = ?',
        [campaignId, userId],
        (err, participantResults) => {
          if (err) {
            return res.status(500).json({ error: true, message: 'Failed to execute query' });
          }
          if (participantResults.length > 0) {
            return res.status(400).json({ error: true, message: 'User is already a participant' });
          }

          pool.query(
            'INSERT INTO campaign_participants (campaign_id, user_id) VALUES (?, ?)',
            [campaignId, userId],
            (err) => {
              if (err) {
                return res.status(500).json({ error: true, message: 'Failed to execute query' });
              }

              return res.status(200).json({ error: false, message: 'Joined the campaign successfully' });
            }
          );
        }
      );
    });
  });
});

router.get('/joined/:campaignId', verifyToken, (req, res) => {
  const campaignId = req.params.campaignId;
  const userId = req.userId;

  pool.query('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaignResults) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Failed to execute query' });
    }
    if (campaignResults.length === 0) {
      return res.status(404).json({ error: true, message: 'Campaign not found' });
    }

    const campaign = campaignResults[0];
    const { id, latitude, longitude } = campaign;

    pool.query(
      'SELECT users.id AS userId, users.name FROM campaign_participants JOIN users ON campaign_participants.user_id = users.id WHERE campaign_participants.campaign_id = ?',
      [campaignId],
      (err, participantResults) => {
        if (err) {
          return res.status(500).json({ error: true, message: 'Failed to execute query' });
        }

        const userList = participantResults.map((participant) => ({
          userId: participant.userId,
          name: participant.name,
        }));

        return res.status(200).json({
          error: false,
          message: 'Campaign details fetched successfully',
          campaignId: id,
          latitude,
          longitude,
          userList,
        });
      }
    );
  });
});

router.get('/volunteer/:userId', verifyToken, (req, res) => {
  const userId = req.params.userId;

  pool.query('SELECT * FROM users WHERE id = ?', [userId], (err, userResults) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Failed to execute query' });
    }
    if (userResults.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    const query = `
      SELECT
        c.id AS id,
        c.title AS title,
        c.name AS name,
        c.userId AS userId,
        c.photoEvent AS photoEvent,
        c.latitude AS latitude,
        c.longitude AS longitude,
        c.contact AS contact,
        c.description AS description,
        c.date AS date,
        c.location AS location,
        c.whatsappLink AS whatsapplink
      FROM
        campaign_participants AS cp
        JOIN campaigns AS c ON cp.campaign_id = c.id
      WHERE
        cp.user_id = ?;
    `;

    pool.query(query, [userId], (err, eventResults) => {
      if (err) {
        return res.status(500).json({ error: true, message: 'Failed to execute query' });
      }

      const userData = {
        userId: userResults[0].id,
        name: userResults[0].name,
        eventList: eventResults,
      };

      res.status(200).json({ error: false, message: 'User volunteer data retrieved successfully', userData });
    });
  });
});

router.get('/my-campaigns/:userId', verifyToken, (req, res) => {
  const userId = req.userId;

  pool.query('SELECT * FROM users WHERE id = ?', [userId], (err, userResults) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Failed to execute query' });
    }
    if (userResults.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    const query = `
      SELECT
        id,
        title,
        name,
        userId,
        photoEvent,
        latitude as lat,
        longitude as lon,
        contact,
        description,
        date,
        location,
        whatsappLink
      FROM
        campaigns
      WHERE
        userId = ?;
    `;

    pool.query(query, [userId], (err, campaignResults) => {
      if (err) {
        return res.status(500).json({ error: true, message: 'Failed to execute query' });
      }

      const campaigns = campaignResults.map((campaign) => {
        campaign.lat = campaign.lat ? campaign.lat : null;
        campaign.lon = campaign.lon ? campaign.lon : null;
        return campaign;
      });

      res.status(200).json({ error: false, message: 'User campaigns fetched successfully', campaigns });
    });
  });
});

router.delete('/leavecampaign/:campaignId', verifyToken, (req, res) => {
  const campaignId = req.params.campaignId;
  const userId = req.userId;

  // Check if the campaign exists
  pool.query('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaignResults) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Failed to execute query' });
    }
    if (campaignResults.length === 0) {
      return res.status(404).json({ error: true, message: 'Campaign not found' });
    }

    // Check if the user exists
    pool.query('SELECT * FROM users WHERE id = ?', [userId], (err, userResults) => {
      if (err) {
        return res.status(500).json({ error: true, message: 'Failed to execute query' });
      }
      if (userResults.length === 0) {
        return res.status(404).json({ error: true, message: 'User not found' });
      }

      // Check if the user is a participant
      pool.query(
        'SELECT * FROM campaign_participants WHERE campaign_id = ? AND user_id = ?',
        [campaignId, userId],
        (err, participantResults) => {
          if (err) {
            return res.status(500).json({ error: true, message: 'Failed to execute query' });
          }
          if (participantResults.length === 0) {
            return res.status(400).json({ error: true, message: 'User is not a participant of the campaign' });
          }

          // Remove the user as a participant
          pool.query(
            'DELETE FROM campaign_participants WHERE campaign_id = ? AND user_id = ?',
            [campaignId, userId],
            (err) => {
              if (err) {
                return res.status(500).json({ error: true, message: 'Failed to execute query' });
              }

              return res.status(200).json({ error: false, message: 'Successfully left the campaign' });
            }
          );
        }
      );
    });
  });
});

router.delete('/delete/:campaignId', verifyToken, (req, res) => {
  const campaignId = req.params.campaignId;
  const userId = req.userId;

  pool.query('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaignResults) => {
    if (err) {
      return res.status(500).json({ error: true, message: 'Failed to execute query' });
    }

    if (campaignResults.length === 0) {
      return res.status(404).json({ error: true, message: 'Campaign not found' });
    }

    const campaign = campaignResults[0];

    if (campaign.userId !== userId) {
      return res.status(401).json({ error: true, message: 'Unauthorized' });
    }

    pool.getConnection((err, connection) => {
      if (err) {
        return res.status(500).json({ error: true, message: 'Failed to establish database connection' });
      }

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return res.status(500).json({ error: true, message: 'Failed to begin transaction' });
        }

        connection.query('DELETE FROM campaign_participants WHERE campaign_id = ?', [campaignId], (err, deleteParticipantsResult) => {
          if (err) {
            connection.rollback(() => {
              connection.release();
              return res.status(500).json({ error: true, message: 'Failed to delete participants' });
            });
          }

          connection.query('DELETE FROM campaigns WHERE id = ?', [campaignId], (err, deleteCampaignResult) => {
            if (err) {
              connection.rollback(() => {
                connection.release();
                return res.status(500).json({ error: true, message: 'Failed to delete campaign' });
              });
            }

            connection.commit((err) => {
              if (err) {
                connection.rollback(() => {
                  connection.release();
                  return res.status(500).json({ error: true, message: 'Failed to commit transaction' });
                });
              }

              connection.release();
              return res.status(200).json({ success: true, message: 'Campaign deleted successfully' });
            });
          });
        });
      });
    });
  });
});

module.exports = router;