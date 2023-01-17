const { MongodbPubSub } = require('graphql-mongoose-subscriptions');
const { PubSub }  = require('graphql-subscriptions');

const pubsub = new PubSub()

const NEW_NOTIFICATION = "new_notification";

module.exports = {
  pubsub,
  NEW_NOTIFICATION
};
