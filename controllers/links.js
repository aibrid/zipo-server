const endOfDay = require('date-fns/endOfDay');
const sub = require('date-fns/sub');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const Link = require('../models/Link');
const Stat = require('../models/Stat');
const User = require('../models/User');
const { generateLink } = require('../utils/misc');
const { SuccessResponse, ErrorResponse } = require('../utils/responses');

// @desc Get original link
// @type QUERY
// @access Public
module.exports.getOriginalLink = asyncHandler(async (_, args, { clientIp }) => {
  const link = await Link.findOne({ path: args.path });

  if (link) {
    const stat = await Stat.findOne({ ip: clientIp });

    // If ip is already recoreded
    if (stat) {
      // If link has not been accessed by the ip address
      if (
        !stat.links.find((linkStat) => linkStat.link === link._id.toString())
      ) {
        stat.links.push({ link: link._id.toString(), date: new Date() });
        stat.save();
      }
    } else {
      Stat.create({
        ip: clientIp,
        links: [{ link: link._id.toString(), date: new Date() }],
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
