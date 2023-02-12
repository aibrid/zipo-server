const endOfDay = require('date-fns/endOfDay');
const sub = require('date-fns/sub');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const Link = require('../models/Link');
const Stat = require('../models/Stat');
const User = require('../models/User');
const { generateLink } = require('../utils/misc');
const { SuccessResponse, ErrorResponse } = require('../utils/responses');

function getAlternatePaths(url) {
  const alternators = [];

  // Facebook usecase
  if (url.match('facebook.com')) {
    alternators.push('facebook');
  }

  // Twitter usecase
  if (url.match('twitter.com')) {
    alternators.push('twitter');
  }

  // Youtube usecase
  if (url.match('youtube.com')) {
    alternators.push('youtube');
  }

  // Figma usecase
  if (url.match('figma.com')) {
    alternators.push('figma');
  }

  // Instagram usecase
  if (url.match('instagram.com')) {
    alternators.push('instagram');
  }

  // Tiktok usecase
  if (url.match('tiktok.com')) {
    alternators.push('tiktok');
  }

  // Jumia usecase
  if (url.match('jumia.com')) {
    alternators.push('jumia');
  }

  // Konga usecase
  if (url.match('konga.com')) {
    alternators.push('konga');
  }

  // Alibaba usecase
  if (url.match('alibaba.com')) {
    alternators.push('Alibaba');
  }

  // Aliexpress usecase
  if (url.match('aliexpress.com')) {
    alternators.push('aliexpress');
  }

  // Aws usecase
  if (url.match('aws.amazon.com')) {
    alternators.push('aws');
  }

  // Amazon usecase
  if (url.match('amazon.com')) {
    alternators.push('amazon');
  }

  // Pinterest usecase
  if (url.match('pinterest.com')) {
    alternators.push('pinterest');
  }

  // Snapchat usecase
  if (url.match('snapchat.com')) {
    alternators.push('snapchat');
  }

  // Linkedin usecase
  if (url.match('linkedin.com')) {
    alternators.push('linkedin');
  }

  // Vimeo usecase
  if (url.match('vimeo.com')) {
    alternators.push('vimeo');
  }

  // Github usecase
  if (url.match('github.com')) {
    alternators.push('github');
  }

  return alternators;
}

// @desc Get original link
// @type QUERY
// @access Public
module.exports.getOriginalLink = asyncHandler(async (_, args, { clientIp }) => {
  const link = await Link.findOne({ path: args.path });

  if (link) {
    const stat = await Stat.findOne({ ip: clientIp });

    // If ip is already recoreded
    if (stat) {
      // If link has not been accessed by the ip address, save the link and increase the link click count for the ip
      if (
        !stat.links.find((linkStat) => linkStat.link === link._id.toString())
      ) {
        stat.links.push({ link: link._id.toString(), date: new Date() });
        stat.clicks = stat.clicks + 1;
        stat.save();
      } else {
        // If link has been accessed by the ip address, increase the link click count for the ip only
        stat.clicks = stat.clicks + 1;
        stat.save();
      }
    } else {
      Stat.create({
        ip: clientIp,
        links: [{ link: link._id.toString(), date: new Date() }],
        clicks: 1,
      });
    }
  }

  if (!link) {
    return new ErrorResponse(404, 'link not found');
  }

  return link;
});

// @desc Get links for the logged-in user
// @type QUERY
// @access Private
module.exports.getLinks = asyncHandler(async (_, args, context) => {
  const query = { owner: context.user.id };

  const data = await Link.find(query);

  return data.map((link) => {
    if (link.type === 'Shortened') {
      link.combinedLink = undefined;
    }
    link.id = link._id;
    return link;
  });
});

// @desc Get a link by id for the logged-in user
// @type QUERY
// @access Private
module.exports.getLinkById = asyncHandler(async (_, args, context) => {
  const event = await Event.findById(args.id)
    .populate('invitees', '_id name email photo')
    .populate('owner', '_id name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('getEvent', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to view this event.');
  }

  const data = fillEvent(event._doc);
  data.owner.id = data.owner._id;
  return data;
});

// @desc Check if a text can be used as a custom link text
// @type QUERY
// @access Private
module.exports.isCustomizable = asyncHandler(async (_, args, context) => {
  const link = await Link.findOne({ path: args.path }).select('_id');

  if (link) {
    return false;
  }

  return true;
});

// @desc Shorten a link
// @type MUTATION
// @access Private
module.exports.shortenLink = asyncHandler(async (_, args, context) => {
  const linkExists = await Link.findOne({ link: args.link });

  if (linkExists) {
    return new SuccessResponse(200, true, linkExists);
  }

  args.path = await generateLink();
  args.alternators = getAlternatePaths(args.link);

  args.type = 'Shortened';
  const link = await Link.create(args);

  return new SuccessResponse(201, true, link);
});

// @desc Shorten a custom link
// @type MUTATION
// @access Private
module.exports.shortenCustomLink = asyncHandler(async (_, args, context) => {
  const pathTaken = await Link.findOne({ path: args.path });

  if (pathTaken) {
    return new ErrorResponse(400, `'${args.path}' is taken`);
  }
  args.type = 'Shortened';
  args.owner = context.user.id;
  const link = await Link.create(args);

  return new SuccessResponse(201, true, link);
});

// @desc Edit a shortened link
// @type MUTATION
// @access Private
module.exports.editShortenedLink = asyncHandler(async (_, args, context) => {
  const link = await Link.findById(args.id);

  if (!link) {
    return new ErrorResponse(404, 'Link not found');
  }

  if (link.owner.toString() !== context.user.id.toString()) {
    return new ErrorResponse(403, 'Unauthorized');
  }

  link.link = args.link;
  await link.save();

  return new SuccessResponse(200, true, link);
});

// @desc Edit a combined link
// @type MUTATION
// @access Private
module.exports.editCombinedLink = asyncHandler(async (_, args, context) => {
  const link = await Link.findById(args.id);

  if (!link) {
    return new ErrorResponse(404, 'Link not found');
  }

  if (link.owner.toString() !== context.user.id.toString()) {
    return new ErrorResponse(403, 'Unauthorized');
  }

  console.log(args.combinedLink);
  link.combinedLink = args.combinedLink;
  await link.save();

  return new SuccessResponse(200, true, link);
});

// @desc Combine a custom link
// @type MUTATION
// @access Private
module.exports.combineCustomLink = asyncHandler(async (_, args, context) => {
  const pathTaken = await Link.findOne({ path: args.path });

  if (pathTaken) {
    return new ErrorResponse(400, `'${args.path}' is taken`);
  }
  args.type = 'Combined';
  args.owner = context.user.id;

  const link = await Link.create(args);

  return new SuccessResponse(201, true, link);
});
