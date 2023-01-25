const { combineResolvers } = require('graphql-resolvers');
const {
  isCustomizable,
  shortenLink,
  shortenCustomLink,
  editShortenedLink,
  combineCustomLink,
  editCombinedLink,
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
    link_shortened_edit: combineResolvers(protect, editShortenedLink),
    link_combined_edit: combineResolvers(protect, editCombinedLink),
    link_combineCustom: combineResolvers(protect, combineCustomLink),
  },
};
