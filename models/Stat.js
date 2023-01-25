const mongoose = require('mongoose');

const StatSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
  },

  links: [{ link: String, date: Date, _id: false }],

  id: String,
});

module.exports = mongoose.model('Stat', StatSchema);
