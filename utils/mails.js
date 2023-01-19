const { ses } = require('../services/AwsService');

const mainEmail = process.env.AWS_SES_MAIN_SENDING_EMAIL;

const createEmailParam = (from, to, subject, message) => {
  if (!from) {
    from = `Zipo <${mainEmail}>`;
  }

  return {
    Destination: {
      ToAddresses: typeof to === 'string' ? [to] : to,
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: message,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: from,
    ReplyToAddresses: ['no-reply@zipo.me'],
  };
};

// Send mail to an email using amazon ses
const sendEmail = (params) => {
  // Create the promise and SES service object
  return ses.sendEmail(params).promise();
};

module.exports = {
  sendEmail,
  createEmailParam,
};
