const AWS = require('aws-sdk');

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
};

AWS.config.apiVersions = {
  s3: '2006-03-01',
};

const sns = new AWS.SNS({
  region: 'us-east-1',
  credentials,
});

const ses = new AWS.SES({
  region: 'us-east-1',
  credentials,
});

var s3 = new AWS.S3({
  credentials,
});

const uploadFile = (params) => {
  // var params = { Bucket: 'bucket', Key: 'key', Body: stream };

  return s3.upload(params);
};

module.exports = {
  sns,
  ses,
  uploadFile,
};
