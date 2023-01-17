const endOfDay = require('date-fns/endOfDay');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const User = require('../models/User');

const { SuccessResponse, ErrorResponse } = require('../utils/responses');

// @desc Get notifications for the logged-in user
// @type QUERY
// @access Private
module.exports.getNotifications = asyncHandler(async (_, args, context) => {
  const limit = args.pagination?.limit
    ? Math.floor(parseInt(args.pagination.limit, 10))
    : 10;

  const cursor = args.pagination?.cursor;

  ////////////////////////////////////////////////////////////////////////////////////////
  const query = {
    owner: context.user.id,
  };

  if (cursor) {
    query._id = { $lt: cursor };
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////
  let notifications = await Notification.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('initiator', 'name email photo');

  const totalDocs = await Notification.find({
    owner: context.user.id,
  }).countDocuments();

  const hasNextPage = notifications.length > limit ? true : false;
  if (hasNextPage) {
    notifications = notifications.slice(0, limit);
  }
  const docsRetrieved = notifications.length;

  await User.findByIdAndUpdate(context.user.id, {newNotifications: 0})

  return {
    data: notifications,
    pagination: {
      nextcursor: hasNextPage ? notifications[docsRetrieved - 1]._id : null,
      totalDocs,
      docsRetrieved,
      hasNextPage,
    },
  };
});
