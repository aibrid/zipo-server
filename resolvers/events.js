const { combineResolvers } = require('graphql-resolvers');
const {
  getEvents,
  getEventById,
  generateInviteLinkId,
  createEvent,
  deleteEvent,
  toggleInviteLink,
  inviteUsers,
  acceptInvitation,
  rejectInvitation,
  removeInvitee,
  assignRoleToInvitee,
  addTodo,
  editTodo,
  deleteTodo,
  duplicateTodo,
  markTodo,
} = require('../controllers/events');
const { protect, authorize } = require('../middleware/auth');

module.exports = {
  Query: {
    events: combineResolvers(protect, getEvents),
    event_getById: combineResolvers(protect, getEventById),
    event_generateInviteLinkId: combineResolvers(protect, generateInviteLinkId),
  },
  Mutation: {
    event_create: combineResolvers(protect, createEvent),
    event_delete: combineResolvers(protect, deleteEvent),
    event_toggleInviteLink: combineResolvers(protect, toggleInviteLink),
    event_inviteUsers: combineResolvers(protect, inviteUsers),
    event_acceptInvitation: combineResolvers(protect, acceptInvitation),
    event_rejectInvitation: combineResolvers(protect, rejectInvitation),
    event_removeInvitee: combineResolvers(protect, removeInvitee),
    event_assignRoleToInvitee: combineResolvers(protect, assignRoleToInvitee),
    event_addTodo: combineResolvers(protect, addTodo),
    event_editTodo: combineResolvers(protect, editTodo),
    event_deleteTodo: combineResolvers(protect, deleteTodo),
    event_duplicateTodo: combineResolvers(protect, duplicateTodo),
    event_markTodo: combineResolvers(protect, markTodo),
  },
};
