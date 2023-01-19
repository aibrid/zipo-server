const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { randomNumbers } = require('../utils/misc');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },

  name: {
    type: String,
  },

  password: {
    type: String,
    default: null,
    select: false,
  },

  isEmailVerified: {
    type: Boolean,
    default: false,
  },

  receiveNewsletter: {
    type: Boolean,
    default: false,
  },

  // For single sign on
  ssoGoogleId: String,

  // For handling registration through email
  verifyEmailToken: String,
  verifyEmailExpire: { type: Date, expires: 600 },

  // For Handling password reset
  resetPasswordToken: String,
  resetPasswordCode: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  id: String,
});

UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: process.env.JWT_EXPIRY_TIME,
    }
  );
};

UserSchema.methods.comfirmPassword = async function (password) {
  return bcrypt.compare(password, this.password || '');
};

UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(4).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

UserSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(20).toString('hex');

  // Hash token and set to verifyEmailToken field
  this.verifyEmailToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Set expiration time for registration session as 10 minutes
  this.verifyEmailExpire = Date.now() + 10 * 60 * 1000;

  return token;
};

UserSchema.methods.handleResetPassword = function () {
  const token = crypto.randomBytes(20).toString('hex');
  const code = randomNumbers(5);

  // Hash token and set to verifyEmailToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Set expiration time for registration session
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  this.resetPasswordCode = code;
  this.isResetPasswordCodeVerified = false;

  return {
    token,
    code,
  };
};

module.exports = mongoose.model('User', UserSchema);
