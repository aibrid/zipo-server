const { combineResolvers } = require('graphql-resolvers');
const {
  getLoggedInUser,
  getUserById,
  sendVerificationCode,
  resendVerificationCode,
  verifyEmail,
  register,
  registerWithApple,
  registerWithGoogle,
  login,
  loginWithGoogle,
  loginWithApple,
  sendResetPasswordMail,
  resendResetPasswordMail,
  verifyResetPasswordCode,
  resetPassword,
} = require('../controllers/users');
const { protect, authorize } = require('../middleware/auth');

module.exports = {
  Query: {
    user: combineResolvers(protect, getLoggedInUser),
    user_getById: combineResolvers(protect, getUserById),
  },
  Mutation: {
    auth_sendVerificationCode: sendVerificationCode,
    auth_resendVerificationCode: resendVerificationCode,
    auth_verifyEmail: verifyEmail,
    auth_register: register,
    auth_registerWithApple: registerWithApple,
    auth_registerWithGoogle: registerWithGoogle,
    auth_login: login,
    auth_loginWithApple: loginWithApple,
    auth_loginWithGoogle: loginWithGoogle,
    auth_sendResetPasswordMail: sendResetPasswordMail,
    auth_resendResetPasswordMail: resendResetPasswordMail,
    auth_verifyResetPasswordCode: verifyResetPasswordCode,
    auth_resetPassword: resetPassword,
  },
};
