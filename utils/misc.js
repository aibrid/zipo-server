const { sendEmail, createEmailParam } = require('./mails');
const Event = require('../models/Event');

module.exports.randomNumbers = (length) => {
  let code = '';
  while (code.length < length) {
    code += Math.floor(Math.random() * (9 - 1 + 1)) + 1;
  }

  return code;
};

module.exports.generateNewInviteLinkId = async () => {
  // get the latest event
  const latestEvent = await Event.find()
    .limit(1)
    .sort({ _id: -1 })
    .select('inviteLinkId');
  console.log(latestEvent.inviteLinkId);
  const oldId = Number(latestEvent[0]?.inviteLinkId || 0);
  const newId = String(oldId + 1);

  let extraZeros = '';
  for (i = 0; i < 8 - newId.length; i++) {
    extraZeros += '0';
  }

  return extraZeros + newId;
};

module.exports.sendInvitationToEmails = async (
  emails,
  eventName,
  owner,
  date
) => {
  const params = createEmailParam(
    null,
    emails,
    `You are invited to ${eventName}`,

    `Hi, ${owner} is inviting you to his event which will take place on ${new Date(
      date
    ).toDateString()}. Login to the events App to accept the invitation.`
  );

  await sendEmail(params);
};
