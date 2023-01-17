const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Types.ObjectId,
    required: true,
  },

  initiator: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: 'User',
  },

  type: {
    type: String,
    enum: [
      'Event Invite',
      'Event Archive',
      'Event Delete',
      'Event Invitation Accepted',
      'Event Invitation Rejected',
      'Invitee Removal',
      'Invitee Role Assigned',
      'Todo Added',
      'Todo Edited',
      'Todo Deleted',
      'Todo Duplicated',
      'Todo Unmarked',
      'Todo Completed',
    ],
    required: true,
  },

  message: {
    type: String,
    required: true,
  },

  resourceType: {
    type: String,
    enum: ['Event', 'Todo'],
    required: true,
  },

  resourceId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },

  isActionRequired: {
    type: Boolean,
    default: false,
  },

  actionType: {
    type: String,
    enum: ['Accept or Decline Invitation'],
  },

  actionTaken: {
    type: Boolean,
  },

  ttl: {
    type: Date,
    default: Date.now,
    expires: '180d',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', NotificationSchema);
