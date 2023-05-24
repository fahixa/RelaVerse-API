const jwt = require('jsonwebtoken');

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

module.exports = verifyToken;