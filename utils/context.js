const { PubSub } = require('graphql-subscriptions');
const { getUserInfo } = require('../middleware/auth');
const requestIp = require('request-ip');

const pubsub = new PubSub();

const contextHandler = async ({ req, res }) => {
  let user = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    const token = req.headers.authorization.split(' ')[1];
    user = await getUserInfo(token);
  } else if (req.cookies.token) {
    const token = req.cookies.token;
    user = await getUserInfo(token);
  }
  const clientIp = requestIp.getClientIp(req);
  return { user, pubsub, res, req, clientIp };
};

module.exports = contextHandler;
