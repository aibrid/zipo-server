const { combineResolvers } = require('graphql-resolvers');
const { getNotifications } = require('../controllers/notifications');
const { protect, authorize } = require('../middleware/auth');

module.exports = {
  Query: {
    notifications: combineResolvers(protect, getNotifications),
  },
};
