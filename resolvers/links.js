const { combineResolvers } = require('graphql-resolvers');
const {
  isCustomizable,
  shortenLink,
  shortenCustomLink,
  combineCustomLink,
  getOriginalLink,
  getLinks,
} = require('../controllers/links');
const { protect, authorize } = require('../middleware/auth');

module.exports = {
  Query: {
    links: combineResolvers(protect, getLinks),
    link_isCustomizable: combineResolvers(isCustomizable),
    getOriginalLink: getOriginalLink,
  },
  Mutation: {
    link_shorten: combineResolvers(shortenLink),
    link_shortenCustom: combineResolvers(protect, shortenCustomLink),
    link_combineCustom: combineResolvers(protect, combineCustomLink),
  },
};
