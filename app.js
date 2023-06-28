const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { getS3SignedUrl } = require('./utils/fileUploads');

const app = express();

let origin = ['https://zipo.me', 'http://localhost:3000'];
if (process.env.TEST_ENV === 'yes') {
  origin.push('http://localhost:3000', 'http://localhost:5000', 'https://studio.apollographql.com');
}

app.use(cors({ origin: origin, credentials: true }));
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production' && process.env.TEST_ENV === 'yes'
        ? true
        : false,
  })
);
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`Hello man`);
});

module.exports = app;
