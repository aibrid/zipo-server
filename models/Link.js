const mongoose = require('mongoose');

const LinkSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
    unique: true,
  },

  alternators: [String],

  type: {
    type: String,
    enum: ['Shortened', 'Combined'],
    required: true,
  },

  link: {
    type: String,
    required: true,
  },

  owner: {
    type: mongoose.ObjectId,
    ref: 'User',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  id: String,
});

module.exports = mongoose.model('Link', LinkSchema);
