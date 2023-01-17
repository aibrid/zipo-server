const { skip } = require('graphql-resolvers');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ErrorResponse } = require('../utils/responses');

async function getUserInfo(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (payload) {
      return payload;
    }
    return null;
  } catch (error) {}
}

async function protect(_, __, context) {
  const user = await User.findById(context.user?.id).select(
    'name email ssoAppleId ssoGoogleId'
  );

  if (!user) {
    return new ErrorResponse(401, 'Please log in to continue');
  }

  context.user = user;
  context.user.id = user._id;

  return skip;
}

function authorize(...roles) {
  return (_, __, context) => {
    if (!roles.includes(context.user.role)) {
      return new ErrorResponse(
        403,
        'You are not authorized to perform this action'
      );
    }

    return skip;
  };
}

module.exports = {
  protect,
  authorize,
  getUserInfo,
};
