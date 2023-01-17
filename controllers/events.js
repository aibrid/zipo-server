const endOfDay = require('date-fns/endOfDay');
const sub = require('date-fns/sub');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const User = require('../models/User');
const {
  generateNewInviteLinkId,
  sendInvitationToEmails,
} = require('../utils/misc');
const { SuccessResponse, ErrorResponse } = require('../utils/responses');

const operationRoles = {
  getEvent: ['Admin', 'Editor', 'Viewer'],
  deleteEvent: ['Admin'],
  toggleEventInviteLink: ['Admin'],
  inviteUserToEvent: ['Admin', 'Editor'],
  removeInviteeFromEvent: ['Admin', 'Editor'],
  addTodo: ['Admin', 'Editor'],
  editTodo: ['Admin', 'Editor'],
  deleteTodo: ['Admin', 'Editor'],
  markTodo: ['Admin', 'Editor'],
  duplicateTodo: ['Admin', 'Editor'],
};

const fillEvent = (event) => {
  event.id = event._id;

  event.invitees = event.invitees.map((invitee) => {
    const inviteeRole = event.inviteeRoles.find(
      (role) => role.id.toString() === invitee._id.toString()
    );

    invitee.role = inviteeRole.role;
    invitee.id = invitee._id;
    return invitee;
  });

  return event;
};

function checkPermission(operation, userId, event) {
  // Check if the user owns the event. Event owners are automatic Admins
  if (event.owner._id.toString() === userId.toString()) {
    return {
      hasPermission: true,
      userType: 'Owner',
      notifHosts: event.invitees.map((invitee) => invitee._id),
      executor: userId,
    };
  }

  const inviteeRole = event.inviteeRoles.find(
    (role) => role.id.toString() === userId.toString()
  )?.role;

  // Check the operation type with the user role to see if he is an invitee and has permissions
  if (operationRoles[operation].indexOf(inviteeRole) !== -1) {
    const notifHosts = event.invitees
      .filter((invitee) => invitee._id.toString() !== userId.toString())
      .map((invitee) => invitee._id);

    // If a notification should be sent, the event owner should also receive it since he didn't carry out the action himself
    notifHosts.push(event.owner._id);
    return {
      hasPermission: true,
      userType: 'Invitee',
      notifHosts,
      executor: userId,
    };
  }

  // If user does not pass the check above, then he is not permitted to carry out the operation
  return {
    hasPermission: false,
  };
}

// @desc Get events for the logged-in user
// @type QUERY
// @access Private
module.exports.getEvents = asyncHandler(async (_, args, context) => {
  const query = {
    $or: [{ owner: context.user.id }, { invitees: { $in: [context.user.id] } }],
  };

  const events = await Event.find(query)
    .populate('invitees', '_id name email photo')
    .populate('owner', '_id name email photo');

  let data = events.map((event, key) => {
    const resp = fillEvent(event._doc);

    // This JSON conversion below is done because of mongoose's object model behaviour
    resp.invitees = JSON.parse(JSON.stringify(resp.invitees));
    return resp;
  });

  // Handle event filter
  const today = new Date();
  // Return only events that are occuring today
  if (args.status === 'Today') {
    data = data.filter((event) => {
      console.log(endOfDay(today), endOfDay(event.date));
      return endOfDay(today).getTime() === endOfDay(event.date).getTime();
    });
  }

  // Return only events that are yet to occur
  if (args.status === 'Upcoming') {
    data = data.filter((event) => {
      console.log(endOfDay(today), endOfDay(event.date));
      return endOfDay(event.date).getTime() > endOfDay(today).getTime();
    });
  }

  // Return only events that have passed
  if (args.status === 'Passed') {
    data = data.filter((event) => {
      console.log(endOfDay(today), endOfDay(event.date));
      return endOfDay(event.date).getTime() < endOfDay(today).getTime();
    });
  }

  return data;
});

// @desc Get an event by id for the logged-in user
// @type QUERY
// @access Private
module.exports.getEventById = asyncHandler(async (_, args, context) => {
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

// @desc Generate an invitation link for an event
// @type QUERY
// @access Private
module.exports.generateInviteLinkId = asyncHandler(async (_, args, context) => {
  // Generate new invite link
  const newInviteLinkId = await generateNewInviteLinkId();

  return newInviteLinkId;
});

// @desc Create an event
// @type MUTATION
// @access Private
module.exports.createEvent = asyncHandler(async (_, args, context) => {
  const obj = args.input;

  // Set the event owner & event id____________________
  obj.owner = context.user.id;
  obj._id = mongoose.Types.ObjectId();

  // Calculate todo count____________________
  if (obj.todos) {
    obj.todoCount = obj.todos.length;
  }

  // Set the reminder date____________________
  obj.reminderDate = sub(new Date(obj.date), {
    days: obj.daysBtwnReminderAndEvent,
  });

  // Make sure that there are no duplicate invite link id in the database____________________
  // Check if the invite link is id taken
  const inviteLinkTaken = await Event.findOne({
    inviteLinkId: obj.inviteLinkId,
  }).select('inviteLinkId');
  // If invite link id is taken, generate a new one
  if (inviteLinkTaken) {
    obj.inviteLinkId = await generateNewInviteLinkId();
  }

  // Make sure that event creator's email is not part of the emails that will receive a notification
  obj.invitedEmails = obj.invitedEmails.filter(
    (email) => email !== context.user.email
  );
  // Get all users whose email match an invited email_________________
  const invitedRegisteredUsers = await User.find({
    email: obj.invitedEmails,
  }).select('email name');

  const notificationObj = {
    initiator: context.user.id,
    type: 'Event Invite',
    message: `Invited you to an event. ${obj.title}`,
    resourceType: 'Event',
    resourceId: obj._id,
    isActionRequired: true,
    actionType: 'Accept or Decline Invitation',
    actionTaken: false,
  };

  const notifPayload = invitedRegisteredUsers.map((user) => {
    delete user.email;
    delete user.name;

    return {
      owner: user._id,
      ...notificationObj,
    };
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Create the event____________________
    await Event.create([obj], { session });

    // Save invite-notification for each invited-registered-user
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user
    await User.updateMany(
      { email: obj.invitedEmails },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  const event = await Event.findById(obj._id)
    .populate('invitees', '_id name email photo')
    .populate('owner', '_id name email photo');

  // Send push notifications to users____________________

  // Send invitations via email____________________
  await sendInvitationToEmails(
    event.invitedEmails,
    event.title,
    context.user?.name || 'An events app user',
    event.date
  );

  return new SuccessResponse(200, true, event);
});

// @desc Delete an event
// @type MUTATION
// @access Private
module.exports.deleteEvent = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('invitees', 'name email')
    .populate('owner', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('deleteEvent', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(
      403,
      'You are not authorized to delete this event.'
    );
  }

  // Create notification Payload
  const notificationObj = {
    initiator: context.user.id,
    type: 'Event Delete',
    message: `Deleted the event. ${event.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: false,
  };

  const notifPayload = permission.notifHosts.map((user) => {
    return {
      owner: user,
      ...notificationObj,
    };
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Delete the event__________________
    await Event.findByIdAndDelete(args.id, { session });

    // Save delete-notification for each invitee
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user
    await User.updateMany(
      { _id: permission.notifHosts },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  const data = fillEvent(event._doc);
  return new SuccessResponse(200, true, data);
});

// @desc Toggle invitation link to either active or inactive
// @type MUTATION
// @access Private
module.exports.toggleInviteLink = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }
  // Handle Permissions
  const permission = checkPermission(
    'toggleEventInviteLink',
    context.user.id,
    event
  );

  if (!permission.hasPermission) {
    return new ErrorResponse(
      403,
      'You are not authorized to edit this part of the event.'
    );
  }
  // Edit the event___________________
  event.isInviteLinkActive = args.isInviteLinkActive;
  await event.save();

  const data = fillEvent(event._doc);
  return new SuccessResponse(200, true, data);
});

// @desc Invite users to an event
// @type MUTATION
// @access Private
module.exports.inviteUsers = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission(
    'inviteUserToEvent',
    context.user.id,
    event
  );

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to invite users.');
  }

  // Make sure that the event owner's email and the invitee emails are not part of the emails that will receive a notification
  const eventUserEmails = [
    event.owner.email,
    ...event.invitees.map((invitee) => invitee.email),
  ];

  args.invitedEmails = args.invitedEmails.filter(
    (email) => eventUserEmails.indexOf(email) === -1
  );

  // If there are no more emails after filtering out the event owner's email and invitee's email, no need to proceed further
  if (args.invitedEmails.length === 0) {
    const data = fillEvent(event._doc);
    return new SuccessResponse(200, true, data);
  }

  // Get all users whose email match an invited email_________________
  const invitedRegisteredUsers = await User.find({
    email: args.invitedEmails,
  }).select('email name');

  const notificationObj = {
    initiator: context.user.id,
    type: 'Event Invite',
    message: `Invited you to an event. ${event.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: true,
    actionType: 'Accept or Decline Invitation',
    actionTaken: false,
  };

  const notifPayload = invitedRegisteredUsers.map((user) => {
    delete user.email;
    delete user.name;

    return {
      owner: user._id,
      ...notificationObj,
    };
  });

  // Handle new emails
  args.invitedEmails.forEach((email) => {
    if (event.invitedEmails.indexOf(email) === -1) {
      event.invitedEmails.push(email);
    }
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event____________________
    await event.save({ session });

    // Save invite-notification for each invited-registered-user____________________
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user________________
    await User.updateMany(
      { email: args.invitedEmails },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  // Send invitations via email____________________
  await sendInvitationToEmails(
    args.invitedEmails,
    event.title,
    context.user?.name || 'An events app user',
    event.date
  );

  const data = fillEvent(event._doc);
  return new SuccessResponse(200, true, data);
});

// @desc Invitee accepts an invitation
// @type MUTATION
// @access Private
module.exports.acceptInvitation = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id);

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Confirm that the logged-in user was invited to the event__________________
  if (event.invitedEmails.indexOf(context.user.email) === -1) {
    return new ErrorResponse(403, 'You have not been invited to this event.');
  }

  // Get the invited user information
  const invitee = await User.findById(context.user.id).select(
    'name email photo'
  );
  const role = 'Viewer';
  // Update necessary fields
  event.invitees.push(invitee._id);
  event.inviteeRoles.push({ id: invitee._id, role });
  event.invitedEmails = event.invitedEmails.filter(
    (email) => email !== context.user.email
  );

  const notifPayload = {
    initiator: context.user.id,
    owner: event.owner,
    type: 'Event Invitation Accepted',
    message: `${invitee.name} accepted your invitation to ${event.title}`,
    resourceType: 'Event',
    resourceId: event._id,
  };

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event____________________
    await event.save({ session });

    // If this action was triggered in response to a notification, mark the actionTaken field as true
    if (args.viaNotification) {
      await Notification.updateOne(
        {
          owner: context.user.id,
          initiator: event.owner,
          resourceId: event._id,
          resourceType: 'Event',
          type: 'Event Invite',
        },
        { actionTaken: true },
        { session }
      );
    }
    // Save invite-notification for the event owner____________________
    await Notification.create([notifPayload], { session });

    // Increase notification count by 1 for the event owner________________
    await User.updateOne(
      { _id: event.owner },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  const data = invitee._doc;
  data.role = role;
  data.id = data._id;
  return new SuccessResponse(200, true, data);
});

// @desc Invitee rejects an invitation
// @type MUTATION
// @access Private
module.exports.rejectInvitation = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Confirm that the logged-in user was invited to the event__________________
  if (event.invitedEmails.indexOf(context.user.email) === -1) {
    return new ErrorResponse(403, 'You have not been invited to this event.');
  }

  // Remove the user's email from the list of invited emails
  event.invitedEmails = event.invitedEmails.filter(
    (email) => email !== context.user.email
  );

  const notifPayload = {
    initiator: context.user.id,
    owner: event.owner,
    type: 'Event Invitation Rejected',
    message: `${context.user.name} rejected your invitation to ${event.title}`,
    resourceType: 'Event',
    resourceId: event._id,
  };

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event____________________
    await event.save({ session });

    // If this action was triggered in response to a notification, mark the actionTaken field as true
    if (args.viaNotification) {
      await Notification.updateOne(
        {
          owner: context.user.id,
          initiator: event.owner,
          resourceId: event._id,
          resourceType: 'Event',
          type: 'Event Invite',
        },
        { actionTaken: true },
        { session }
      );
    }
    // Save invite-notification for the event owner____________________
    await Notification.create([notifPayload], { session });

    // Increase notification count by 1 for the event owner________________
    await User.updateOne(
      { _id: event.owner },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  const data = fillEvent(event._doc);
  return new SuccessResponse(200, true, data);
});

// @desc Remove an invitee from an event
// @type MUTATION
// @access Private
module.exports.removeInvitee = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission(
    'removeInviteeFromEvent',
    context.user.id,
    event
  );

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to remove users.');
  }

  // Confirm that the logged-in user is not trying to remove himself
  if (args.inviteeId === context.user.id.toString()) {
    return new ErrorResponse(403, 'You cannot remove yourself.');
  }
  // Confirm that inviteeId belongs to an actual invitee in the event
  if (
    !event.invitees.find((invitee) => invitee._id.toString() === args.inviteeId)
  ) {
    return new ErrorResponse(
      400,
      `InviteeId: ${args.inviteeId} does not match any invitee`
    );
  }

  // If the executor is an invitee, check that he is not trying to remove another invitee that has a higher or equal role
  if (permission.userType === 'Invitee') {
    console.log(permission, 'permission');
    // Role of the executor who is trying to remove another invitee
    const executorRole = event.inviteeRoles.find(
      (role) => role.id.toString() === permission.executor
    )?.role;

    // Role of the invitee who is about to be removed
    const executeeRole = event.inviteeRoles.find(
      (role) => role.id.toString() === args.inviteeId
    )?.role;

    if (executorRole === 'Editor' && executeeRole === 'Admin') {
      return new ErrorResponse(
        403,
        'You can only remove users who are Viewers'
      );
    }

    if (executorRole === 'Admin' && executeeRole === 'Admin') {
      return new ErrorResponse(
        403,
        'You can only remove users who are Editors or Viewers'
      );
    }

    if (executorRole === 'Editor' && executeeRole === 'Editor') {
      return new ErrorResponse(
        403,
        'You can only remove users who are Viewers'
      );
    }
  }

  const inviteeRoles = event.inviteeRoles;
  // Remove the invitee from the list of invitees and the invitee roles
  event.invitees = event.invitees.filter(
    (invitee) => invitee._id.toString() !== args.inviteeId
  );
  event.inviteeRoles = inviteeRoles.filter(
    (inviteeRole) => inviteeRole.id.toString() !== args.inviteeId
  );

  const notifPayload = {
    initiator: context.user.id,
    owner: args.inviteeId,
    type: 'Invitee Removal',
    message: `You were removed from the event: ${event.title}`,
    resourceType: 'Event',
    resourceId: event._id,
  };

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event____________________
    await event.save({ session });

    // Save invite-notification for the removed invitee____________________
    await Notification.create([notifPayload], { session });

    // Increase notification count by 1 for the removed invitee________________
    await User.updateOne(
      { _id: args.inviteeId },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  // Prepare response data
  const invitee = await User.findById(args.inviteeId).select(
    'name email photo'
  );
  const data = invitee._doc;
  data.role = inviteeRoles.find(
    (inviteeRole) => inviteeRole.id.toString() === args.inviteeId
  )?.role;
  data.id = data._id;
  return new SuccessResponse(200, true, data);
});

// @desc Assign role to an invitee
// @type MUTATION
// @access Private
module.exports.assignRoleToInvitee = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Confirm that the logged-in user owns the event__________________
  if (event.owner._id.toString() !== context.user.id.toString()) {
    return new ErrorResponse(403, 'Unauthorized to perform this action.');
  }

  // Confirm that inviteeId belongs to an actual invitee in the event
  if (
    !event.invitees.find((invitee) => invitee._id.toString() === args.inviteeId)
  ) {
    return new ErrorResponse(
      400,
      `InviteeId: ${args.inviteeId} does not match any invitee`
    );
  }

  const inviteeRoles = event.inviteeRoles;
  // Assign role to the invitee
  event.inviteeRoles = inviteeRoles.map((inviteeRole) => {
    if (inviteeRole.id.toString() === args.inviteeId) {
      inviteeRole.role = args.role;
    }

    return inviteeRole;
  });

  const notifPayload = {
    initiator: context.user.id,
    owner: args.inviteeId,
    type: 'Invitee Role Assigned',
    message: `${args.role} Role was assigned to you on the event: ${event.title}`,
    resourceType: 'Event',
    resourceId: event._id,
  };

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event____________________
    await event.save({ session });

    // Save invite-notification for the removed invitee____________________
    await Notification.create([notifPayload], { session });

    // Increase notification count by 1 for the removed invitee________________
    await User.updateOne(
      { _id: args.inviteeId },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  // Prepare response data
  const invitee = await User.findById(args.inviteeId).select(
    'name email photo'
  );
  const data = invitee._doc;
  data.role = args.role;
  data.id = data._id;
  return new SuccessResponse(200, true, data);
});

// @desc Add a todo to an event
// @type MUTATION
// @access Private
module.exports.addTodo = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('addTodo', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to add todos.');
  }

  // Create notification Payload
  const notificationObj = {
    initiator: context.user.id,
    type: 'Todo Added',
    message: `Added a Todo. ${args.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: false,
  };

  const notifPayload = permission.notifHosts.map((user) => {
    return {
      owner: user,
      ...notificationObj,
    };
  });

  // Add updates to event (add todo to the list of todos, increase todoCount)
  event.todos.push({ title: args.title, note: args.note });
  event.todoCount = event.todoCount + 1;

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event__________________
    await event.save({ session });

    // Save todo-add-notification to event participants
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user
    await User.updateMany(
      { _id: permission.notifHosts },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  return new SuccessResponse(200, true, event.todos[event.todos.length - 1]);
});

// @desc Edit a todo of an event
// @type MUTATION
// @access Private
module.exports.editTodo = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('editTodo', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to edit todos.');
  }

  // Add updates to event (Edit the todo)
  const todoToEdit = event.todos.find(
    (todo) => todo._id.toString() === args.todoId
  );

  if (!todoToEdit) {
    return new ErrorResponse(404, 'Todo does not exist.');
  }

  event.todos = event.todos.map((todo) => {
    if (todo._id.toString() === todoToEdit._id.toString()) {
      todo.title = args.title;
      todo.note = args.note;
    }

    return todo;
  });

  // Create notification Payload
  const notificationObj = {
    initiator: context.user.id,
    type: 'Todo Edited',
    message: `Edited a Todo. ${todoToEdit.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: false,
  };

  const notifPayload = permission.notifHosts.map((user) => {
    return {
      owner: user,
      ...notificationObj,
    };
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event__________________
    await event.save({ session });

    // Save todo-add-notification to event participants
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user
    await User.updateMany(
      { _id: permission.notifHosts },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  return new SuccessResponse(
    200,
    true,
    event.todos.find((todo) => todo._id.toString() === args.todoId)
  );
});

// @desc Delete a todo from an event
// @type MUTATION
// @access Private
module.exports.deleteTodo = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('editTodo', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to remove todos.');
  }

  // Add updates to event (Remove the event and decrease todoCount)
  const todoToRemove = event.todos.find(
    (todo) => todo._id.toString() === args.todoId
  );

  if (!todoToRemove) {
    return new ErrorResponse(404, 'Todo does not exist.');
  }

  event.todos = event.todos.filter(
    (todo) => todo._id.toString() !== todoToRemove._id.toString()
  );
  event.todoCount = event.todoCount - 1;

  // Create notification Payload
  const notificationObj = {
    initiator: context.user.id,
    type: 'Todo Deleted',
    message: `Deleted a Todo. ${todoToRemove.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: false,
  };

  const notifPayload = permission.notifHosts.map((user) => {
    return {
      owner: user,
      ...notificationObj,
    };
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event__________________
    await event.save({ session });

    // Save todo-add-notification to event participants
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user
    await User.updateMany(
      { _id: permission.notifHosts },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  return new SuccessResponse(200, true, todoToRemove);
});

// @desc Duplicate a todo in an event
// @type MUTATION
// @access Private
module.exports.duplicateTodo = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('addTodo', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to duplicate todos.');
  }

  // Add updates to event (add todo to the list of todos, increase todoCount)
  const todoToDuplicate = event.todos.find(
    (todo) => todo._id.toString() === args.todoId
  );

  if (!todoToDuplicate) {
    return new ErrorResponse(404, 'Todo does not exist.');
  }

  event.todos.push({
    title: todoToDuplicate.title,
    note: todoToDuplicate.note,
  });
  event.todoCount = event.todoCount + 1;

  // Create notification Payload
  const notificationObj = {
    initiator: context.user.id,
    type: 'Todo Duplicated',
    message: `Duplicated a Todo. ${todoToDuplicate.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: false,
  };

  const notifPayload = permission.notifHosts.map((user) => {
    return {
      owner: user,
      ...notificationObj,
    };
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event__________________
    await event.save({ session });

    // Save todo-add-notification to event participants
    await Notification.create(notifPayload, { session });

    // Increase notification count by 1 for each invited-registered-user
    await User.updateMany(
      { _id: permission.notifHosts },
      { $inc: { newNotifications: 1 } },
      { session }
    );
  });
  session.endSession();

  return new SuccessResponse(200, true, event.todos[event.todos.length - 1]);
});

// @desc Mark a todo as completed or not
// @type MUTATION
// @access Private
module.exports.markTodo = asyncHandler(async (_, args, context) => {
  // Get the event___________________
  const event = await Event.findById(args.id)
    .populate('owner', 'name email photo')
    .populate('invitees', 'name email photo');

  if (!event) {
    return new ErrorResponse(404, 'Event not found.');
  }

  // Handle Permissions
  const permission = checkPermission('markTodo', context.user.id, event);

  if (!permission.hasPermission) {
    return new ErrorResponse(403, 'You are not authorized to mark todos.');
  }

  // Add updates to event (Edit the todo)
  const todoToEdit = event.todos.find(
    (todo) => todo._id.toString() === args.todoId
  );

  if (!todoToEdit) {
    return new ErrorResponse(404, 'Todo does not exist.');
  }

  const sendNotification = todoToEdit.isCompleted !== args.isCompleted;

  event.todos = event.todos.map((todo) => {
    if (todo._id.toString() === todoToEdit._id.toString()) {
      todo.isCompleted = args.isCompleted;
    }

    return todo;
  });

  // Create notification Payload
  const narration = args.isCompleted ? 'Completed' : 'Unmarked';
  const notificationObj = {
    initiator: context.user.id,
    type: `Todo ${narration}`,
    message: `${narration} a Todo. ${todoToEdit.title}`,
    resourceType: 'Event',
    resourceId: event._id,
    isActionRequired: false,
  };

  const notifPayload = permission.notifHosts.map((user) => {
    return {
      owner: user,
      ...notificationObj,
    };
  });

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    // Update the event__________________
    await event.save({ session });

    // Only send notifications if todo's completion status changes

    if (sendNotification) {
      // Save todo-add-notification to event participants
      await Notification.create(notifPayload, { session });

      // Increase notification count by 1 for each invited-registered-user
      await User.updateMany(
        { _id: permission.notifHosts },
        { $inc: { newNotifications: 1 } },
        { session }
      );
    }
  });
  session.endSession();

  return new SuccessResponse(
    200,
    true,
    event.todos.find((todo) => todo._id.toString() === args.todoId)
  );
});
