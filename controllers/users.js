const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const { sendEmail, createEmailParam } = require('../utils/mails');
const { ErrorResponse, SuccessResponse } = require('../utils/responses');
const { verificationMail } = require('../utils/sesMails');

// @desc Get information about the logged in user
// @type QUERY
// @access Private
module.exports.getLoggedInUser = asyncHandler(async (_, args, context) => {
  const user = await User.findById(context.user.id);
  user.id = user._id;
  return user;
});

// @desc Get information about a user by id
// @type QUERY
// @access Private

module.exports.getUserById = asyncHandler(async (_, args) => {
  const user = await User.findById(args.id);

  if (!user) {
    throw new ErrorResponse(404, 'User not found');
  }

  user.id = user._id;
  return user;
});

// @desc Verify email
// @type MUTATION
// @access Public
module.exports.verifyEmail = asyncHandler(async (_, args) => {
  const verifyEmailToken = crypto
    .createHash('sha256')
    .update(args.token)
    .digest('hex');

  // Check that the registration session exist and has not expired
  const user = await User.findOne({
    verifyEmailToken,
  });

  if (!user) {
    return new ErrorResponse(
      400,
      'Registration session expired. Please retry registration'
    );
  }

  // Check that the email has not been registered
  const emailTaken = await User.findOne({
    email: user.email,
    isEmailVerified: true,
  });

  if (emailTaken) {
    return new ErrorResponse(400, 'Email taken.');
  }

  // Update necessary fields
  user.isEmailVerified = true;
  user.verifyEmailExpire = undefined;
  user.verifyEmailToken = undefined;
  await user.save();

  try {
    const params = createEmailParam(
      null,
      user.email,
      `Welcome ${user.name}`,

      `Welcome to the Zipo`
    );

    await sendEmail(params);
  } catch (error) {
    // return new ErrorResponse(
    //   500,
    //   'Please check that your email is correct and try again.'
    // );
  }

  const jwtToken = user.getSignedJwtToken();

  return new SuccessResponse(200, true, user, jwtToken);
});

// @desc Register via email
// @type MUTATION
// @access Public
module.exports.register = asyncHandler(async (_, args) => {
  // Check that the email has not been registered
  const emailTaken = await User.findOne({
    email: args.email,
    isEmailVerified: true,
  });

  if (emailTaken) {
    return new ErrorResponse(400, 'Email taken');
  }

  // Save the document
  const salt = await bcrypt.genSalt(10);
  args.password = await bcrypt.hash(args.password, salt);
  const user = await User.create(args);

  // generate a token and save
  const token = user.generateEmailVerificationToken();
  await user.save();

  // Send verification email to user
  try {
    const params = createEmailParam(
      null,
      user.email,
      `Hi ${user.name}`,
      verificationMail(token)
    );

    await sendEmail(params);
  } catch (error) {
    // return new ErrorResponse(
    //   500,
    //   'Please check that your email is correct and try again.'
    // );
  }

  return new SuccessResponse(201, true);
});

// @desc Login with email and password
// @type MUTATION
// @access Public
module.exports.login = asyncHandler(async (_, args) => {
  // Check db for user
  const user = await User.findOne({
    email: args.email,
    isEmailVerified: true
  }).select('+password');

  if (!user) {
    return new ErrorResponse(400, 'Invalid credentials');
  }

  // Check if password matches
  const isPasswordMatch = await user.comfirmPassword(args.password);

  if (!isPasswordMatch) {
    return new ErrorResponse(400, 'Invalid credentials');
  }

  const token = user.getSignedJwtToken();
  return new SuccessResponse(200, true, user, token);
});

// @desc Login/Signup with google
// @type MUTATION
// @access Public
module.exports.authenticateWithGoogle = asyncHandler(async (_, args) => {
  // check if email exist, if it does, return the document
  const queryArray = [
    {
      ssoGoogleId: args.ssoGoogleId,
      isEmailVerified: true,
    },
  ];

  if (args.email) {
    queryArray.push({ email: args.email, isEmailVerified: true });
  }

  // Check if the user exists
  const userExist = await User.findOne({
    $or: queryArray,
  });

  // If user is already registered, return user account
  if (userExist) {
    const token = userExist.getSignedJwtToken();
    return new SuccessResponse(200, true, userExist, token);
  }

  // In cases of login, receiveNewsLetter isn;t selected. Set it automatically as true
  if (!args.hasOwnProperty('receiveNewsletter')) {
    args.receiveNewsletter = true;
  }

  // if it doesn't, register yhe user and mark emailVerified as true
  args.isEmailVerified = true;
  const user = await User.create(args);
  const token = user.getSignedJwtToken();

  try {
    const params = createEmailParam(
      null,
      args.email,
      `Welcome ${args.name}`,

      `Welcome to the Zipo`
    );

    await sendEmail(params);
  } catch (error) {
    // return new ErrorResponse(
    //   500,
    //   'Please check that your email is correct and try again.'
    // );
  }

  return new SuccessResponse(201, true, user, token);
});
