const mysql = require('mysql');

const dbConfig = {
  host: '34.101.168.45',
  user: 'root',
  password: 'relaverse',
  database: 'relaverse'
};

const pool = mysql.createPool(dbConfig);

module.exports = pool;