const mongoose = require('mongoose');

const Todo = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  note: {
    type: String,
    required: true,
  },

  isCompleted: {
    type: Boolean,
    default: false,
  },
});

const Invitee = new mongoose.Schema({
  _id: mongoose.ObjectId,

  name: String,
  email: String,
});

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  date: {
    type: Date,
    required: true,
  },

  reminderDate: {
    type: Date,
    required: true,
  },

  daysBtwnReminderAndEvent: {
    type: Number,
    default: 5,
  },

  todoCount: {
    type: Number,
    default: 0,
  },

  todos: {
    type: [Todo],
  },

  bgCover: {
    type: String,
    required: true,
  },

  inviteLinkId: {
    type: String,
    required: true,
  },

  isInviteLinkActive: {
    type: Boolean,
    default: true,
  },

  invitedEmails: {
    type: [String],
    // required: true,
  },

  inviteeRoles: [
    {
      _id: false,
      id: {
        type: mongoose.ObjectId,
        required: true,
      },

      role: {
        type: String,
        enum: ['Viewer', 'Editor', 'Admin'],
        default: 'Viewer',
        required: true,
      },
    },
  ],
  invitees: [{ type: mongoose.ObjectId, ref: 'User', required: true }],

  owner: {
    type: mongoose.ObjectId,
    required: true,
    ref: 'User',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Event', EventSchema);
