const { combineResolvers } = require('graphql-resolvers');
const {
  isCustomizable,
  shortenLink,
  shortenCustomLink,
  getOriginalLink,
} = require('../controllers/links');
const { protect, authorize } = require('../middleware/auth');

module.exports = {
  Query: {
    link_isCustomizable: combineResolvers(isCustomizable),
    getOriginalLink: getOriginalLink,
  },
  Mutation: {
    link_shorten: combineResolvers(shortenLink),
    link_shortenCustom: combineResolvers(protect, shortenCustomLink),
  },
};
