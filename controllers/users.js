const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const { sendEmail, createEmailParam } = require('../utils/mails');
const { ErrorResponse, SuccessResponse } = require('../utils/responses');

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

// @desc Send verification code to an email
// @type MUTATION
// @access Public
module.exports.sendVerificationCode = asyncHandler(async (_, args) => {
  // Check if email is taken
  const userExist = await User.findOne({
    email: args.email,
    isSignupCompleted: true,
  });

  // Make sure that there is no duplicate email
  if (userExist) {
    throw new ErrorResponse(404, 'Email taken');
  }

  const user = await User.create(args);

  const { token, code } = user.handleEmailVerification();
  await user.save();

  // Send verification code to user
  try {
    const params = createEmailParam(
      null,
      args.email,
      `Your verification code`,

      `${code} is your verification code. Expires in 10 minutes. Thanks.`
    );

    await sendEmail(params);
  } catch (error) {
    console.log(error);
    return new ErrorResponse(
      500,
      'Please check that your email is correct and try again.'
    );
  }

  return new SuccessResponse(200, true, null, token);
});

// @desc Resend verification code to an email
// @type MUTATION
// @access Public
module.exports.resendVerificationCode = asyncHandler(async (_, args) => {
  const verifyEmailToken = crypto
    .createHash('sha256')
    .update(args.token)
    .digest('hex');

  // Check that the registration session exist and has not expired
  const user = await User.findOne({
    verifyEmailToken,
  });

  if (!user) {
    return new ErrorResponse(400, 'Registration session expired.');
  }

  // Reset the registration session expiry time
  user.verifyEmailExpire = new Date();
  await user.save();

  // Send verification code to user
  try {
    const params = createEmailParam(
      null,
      user.email,
      `Your verification code`,

      `${user.verifyEmailCode} is your verification code. Expires in 10 minutes. Thanks.`
    );

    await sendEmail(params);
  } catch (error) {
    console.log(error);
    return new ErrorResponse(
      500,
      'Please check that your email is correct and try again.'
    );
  }

  return new SuccessResponse(200, true, null, user.token);
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
    return new ErrorResponse(400, 'Registeration session expired.');
  }

  // Check that the email has not been registered
  const emailTaken = await User.findOne({
    email: user.email,
    isSignupCompleted: true,
  });

  if (emailTaken) {
    return new ErrorResponse(400, 'Email taken.');
  }

  // Check that the code is correct
  if (user.verifyEmailCode !== args.code) {
    return new ErrorResponse(400, 'Incorrect code.');
  }

  // Change the email Verification status
  user.isEmailVerified = true;
  await user.save();

  return new SuccessResponse(200, true, null, args.token);
});

// @desc Register via email
// @type MUTATION
// @access Public
module.exports.register = asyncHandler(async (_, args) => {
  const verifyEmailToken = crypto
    .createHash('sha256')
    .update(args.token)
    .digest('hex');

  // Check that the registration session exist and has not expired
  const user = await User.findOne({
    verifyEmailToken,
  });

  if (!user) {
    return new ErrorResponse(400, 'Registration session expired.');
  }

  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash(args.password, salt);

  // Update necessary fields
  user.name = args.name;
  user.password = password;
  user.isSignupCompleted = true;
  // Remove email verification fields in order to avoid document deletion due to the (time to live index)
  user.verifyEmailToken = undefined;
  user.verifyEmailExpire = undefined;
  user.verifyEmailCode = undefined;
  await user.save();

  const token = user.getSignedJwtToken();
  // Send welcome message to user
  try {
    const params = createEmailParam(
      null,
      user.email,
      `Welcome ${args.name}`,

      `Welcome to the Events App. Create your first event and keep track of it effectively`
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

// @desc Login with google
// @type MUTATION
// @access Public
module.exports.loginWithGoogle = asyncHandler(async (_, args) => {
  const queryArray = [
    {
      ssoGoogleId: args.ssoGoogleId,
      isSignupCompleted: true,
    },
  ];

  if (args.email) {
    queryArray.push({ email: args.email, isSignupCompleted: true });
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

  // Verify the email field if 'email' was included in the arguments
  if (args.email) {
    args.isEmailVerified = true;
  }
  args.isSignupCompleted = true;
  args.receiveNewsletter = true;
  const user = await User.create(args);
  const token = user.getSignedJwtToken();

  // Send welcome message to user if 'email' was included
  if (args.email) {
    try {
      const params = createEmailParam(
        null,
        args.email,
        `Welcome ${args.name ? args.name : ''}`,

        `Welcome to the Events App. Create your first event and keep track of it effectively`
      );

      await sendEmail(params);
    } catch (error) {
      // return new ErrorResponse(
      //   500,
      //   'Please check that your email is correct and try again.'
      // );
    }
  }

  return new SuccessResponse(201, true, user, token);
});

// @desc Login with apple
// @type MUTATION
// @access Public
module.exports.loginWithApple = asyncHandler(async (_, args) => {
  const queryArray = [
    {
      ssoAppleId: args.ssoAppleId,
      isSignupCompleted: true,
    },
  ];

  if (args.email) {
    queryArray.push({ email: args.email, isSignupCompleted: true });
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

  // Verify the email field if 'email' was included in the api arguments
  if (args.email) {
    args.isEmailVerified = true;
  }
  args.isSignupCompleted = true;
  args.receiveNewsletter = true;
  const user = await User.create(args);
  const token = user.getSignedJwtToken();

  // Send welcome message to user if 'email' was included in the api arguments
  if (args.email) {
    try {
      const params = createEmailParam(
        null,
        args.email,
        `Welcome ${args.name ? args.name : ''}`,

        `Welcome to the Events App. Create your first event and keep track of it effectively`
      );

      await sendEmail(params);
    } catch (error) {
      // return new ErrorResponse(
      //   500,
      //   'Please check that your email is correct and try again.'
      // );
    }
  }

  return new SuccessResponse(201, true, user, token);
});

// @desc Register with google
// @type MUTATION
// @access Public
module.exports.registerWithGoogle = asyncHandler(async (_, args) => {
  const queryArray = [
    {
      ssoGoogleId: args.ssoGoogleId,
      isSignupCompleted: true,
    },
  ];

  if (args.email) {
    queryArray.push({ email: args.email, isSignupCompleted: true });
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

  // Verify the email field if 'email' was included in the api arguments
  if (args.email) {
    args.isEmailVerified = true;
  }
  args.isSignupCompleted = true;
  args.receiveNewsletter = true;
  const user = await User.create(args);
  const token = user.getSignedJwtToken();

  // Send welcome message to user if 'email' was included in the api arguments
  if (args.email) {
    try {
      const params = createEmailParam(
        null,
        args.email,
        `Welcome ${args.name ? args.name : ''}`,

        `Welcome to the Events App. Create your first event and keep track of it effectively`
      );

      await sendEmail(params);
    } catch (error) {
      // return new ErrorResponse(
      //   500,
      //   'Please check that your email is correct and try again.'
      // );
    }
  }

  return new SuccessResponse(201, true, user, token);
});

// @desc Register with apple
// @type MUTATION
// @access Public
module.exports.registerWithApple = asyncHandler(async (_, args) => {
  const queryArray = [
    {
      ssoAppleId: args.ssoAppleId,
      isSignupCompleted: true,
    },
  ];

  if (args.email) {
    queryArray.push({ email: args.email, isSignupCompleted: true });
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

  // Verify the email field if 'email' was included in the api arguments
  if (args.email) {
    args.isEmailVerified = true;
  }

  args.isSignupCompleted = true;
  args.receiveNewsletter = true;
  const user = await User.create(args);
  const token = user.getSignedJwtToken();

  // Send welcome message to user if 'email' was included in the api arguments
  if (args.email) {
    try {
      const params = createEmailParam(
        null,
        args.email,
        `Welcome ${args.name ? args.name : ''}`,

        `Welcome to the Events App. Create your first event and keep track of it effectively`
      );

      await sendEmail(params);
    } catch (error) {
      // return new ErrorResponse(
      //   500,
      //   'Please check that your email is correct and try again.'
      // );
    }
  }

  return new SuccessResponse(201, true, user, token);
});

// @desc Login with email and password
// @type MUTATION
// @access Public
module.exports.login = asyncHandler(async (_, args) => {
  // Check db for user
  const user = await User.findOne({
    email: args.email,
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

// @desc Send instructions to a user's email on how to reset his password
// @type MUTATION
// @access Public
module.exports.sendResetPasswordMail = asyncHandler(async (_, args) => {
  // Check if user exists
  const user = await User.findOne({
    email: args.email,
  });

  if (!user) {
    return new ErrorResponse(400, 'Email does not belong to any user');
  }

  const { token, code } = user.handleResetPassword();
  await user.save();

  // Send Email
  try {
    const params = createEmailParam(
      null,
      user.email,
      `Your Reset Password Code`,

      `Hi${
        user.name ? ' ' + user.name : ''
      }, ${code} is your reset password code. Expires in 10 minutes. Thanks`
    );

    await sendEmail(params);
  } catch (error) {
    return new ErrorResponse(
      500,
      'Please check that your email is correct and try again.'
    );
  }
  return new SuccessResponse(200, true, null, token);
});

// @desc resend instructions to a user's email on how to reset his password
// @type MUTATION
// @access Public
module.exports.resendResetPasswordMail = asyncHandler(async (_, args) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(args.token)
    .digest('hex');

  // Check that the registration session exist and has not expired
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return new ErrorResponse(400, 'Registration session expired.');
  }

  // Reset the session expiry time
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  await user.save();

  // Resend Email
  try {
    const params = createEmailParam(
      null,
      user.email,
      `Your Reset Password Code`,

      `Hi${user.name ? ' ' + user.name : ''}, ${
        user.resetPasswordCode
      } is your reset password code. Expires in 10 minutes. Thanks`
    );

    await sendEmail(params);
  } catch (error) {
    //  return new ErrorResponse(
    //    500,
    //   //  'EmailPlease check that your email is correct and try again.'
    //  );
  }
  return new SuccessResponse(200, true, null, args.token);
});
// @desc User tries to verify the code sent to him for resetting his password
// @type MUTATION
// @access Public
module.exports.verifyResetPasswordCode = asyncHandler(async (_, args) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(args.token)
    .digest('hex');

  // Check if doc exist
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return new ErrorResponse(400, 'Invalid token');
  }

  if (user.resetPasswordCode !== args.code) {
    return new ErrorResponse(400, 'Incorrect code');
  }

  user.isResetPasswordCodeVerified = true;
  await user.save();

  return new SuccessResponse(200, true, null, args.token);
});

// @desc User resets his password
// @type MUTATION
// @access Public
module.exports.resetPassword = asyncHandler(async (_, args) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(args.token)
    .digest('hex');

  // Check if doc exist
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return new ErrorResponse(400, 'Invalid token');
  }

  if (!user.isResetPasswordCodeVerified) {
    return new ErrorResponse(400, 'Reset password code not yet verified');
  }

  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash(args.password, salt);

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.resetPasswordCode = undefined;
  user.isResetPasswordCodeVerified = undefined;
  await user.save();

  return new SuccessResponse(200, true);
});
