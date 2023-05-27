const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/api/login', require('./routes/login'));
app.use('/api/register', require('./routes/register'));
app.use('/api/users', require('./routes/users'));
app.use('/api/campaign', require('./routes/campaign'));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

module.exports = app;