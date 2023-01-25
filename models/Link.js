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
    required: function () {
      return this.type === 'Shortened';
    },
  },

  combinedLink: {
    links: [{ title: String, id: String, url: String }],
    description: String,
    title: String,
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
