const { combineResolvers } = require('graphql-resolvers');
const {
  getLoggedInUser,
  getUserById,
  verifyEmail,
  register,
  login,
  authenticateWithGoogle,
} = require('../controllers/users');
const { protect, authorize } = require('../middleware/auth');

module.exports = {
  Query: {
    user: combineResolvers(protect, getLoggedInUser),
    user_getById: combineResolvers(protect, getUserById),
  },
  Mutation: {
    auth_verifyEmail: verifyEmail,
    auth_register: register,
    auth_login: login,
    auth_google: authenticateWithGoogle,
  },
};
