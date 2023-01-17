const mongoose = require('mongoose');

mongoose.connection.once('open', () => {
  console.log('MongoDB connected'.cyan.bold);
});

mongoose.connection.on('error', (err) => {
  console.error('err'.red.underline, err);
});

const options = {};

if (process.env.NODE_ENV === 'production') {
  options.tlsCAFile = `/home/ec2-user/rds-combined-ca-bundle.pem`;
}

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URL, options);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = connectDB;

module.exports = {
  connectDB,
  disconnectDB,
};
