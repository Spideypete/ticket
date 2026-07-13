const Jsonfile = require('../config.json');
const fs = require('fs');
exports.run = async (client, message) => {
  if (message.author.id !== Jsonfile.owner)
    return message.channel.send('Sorry but you cant use this command D:').then((msg) => {
      setTimeout(() => msg.delete(), 7000);
    });

  function addToCollectors(messageID, channelID) {
    fs.readFile('./collectors.json', 'utf8', function readFileCallback(err, data) {
      if (err) return console.error(err);
      const obj = JSON.parse(data);
      obj.collector.push({ id: messageID, channelId: channelID });
      const json = JSON.stringify(obj);
      fs.writeFile('./collectors.json', json, 'utf8', function (err) {
        if (err) throw err;
      });
    });
  }

  const tickets = Jsonfile.tickets && Jsonfile.tickets.length ? Jsonfile.tickets : null;

  const signupEmbed = {
    color: Jsonfile.signup_color,
    title: Jsonfile.signup_title,
    description: Jsonfile.signup_description || 'React below to open a ticket.',
  };

  if (tickets) {
    signupEmbed.fields = tickets.map((t) => ({
      name: `${t.emoji} ${t.label}`,
      value: t.description || '​',
    }));
  }

  const signup = await message.channel.send({
    embeds: [signupEmbed],
  });

  if (tickets) {
    for (const t of tickets) {
      await signup.react(t.emoji);
    }
  } else {
    // Fallback: original single-ticket behaviour
    await signup.react('📩');
  }

  addToCollectors(signup.id, message.channel.id);
};

const contining = async (client, message, user, ticket) => {
  function addToTickets(messageID, channelID) {
    fs.readFile('./collectors.json', 'utf8', function readFileCallback(err, data) {
      if (err) console.error(err);
      const obj = JSON.parse(data);
      obj.tickets.push({ id: messageID, channelId: channelID, owner: user.id });
      const json = JSON.stringify(obj);
      fs.writeFile('./collectors.json', json, 'utf8', (err) => {
        if (err) throw err;
      });
    });
  }

  const channelName = `${ticket.prefix || 'ticket'}-${user.username}`.replace(/\s/g, '-').toLowerCase();

  let channel = await message.guild.channels.create(channelName, {
    parent: ticket.category || Jsonfile.answer_category,
  });

  channel.permissionOverwrites.edit(message.guild.id, {
    SEND_MESSAGES: false,
    VIEW_CHANNEL: false,
  });
  channel.permissionOverwrites.edit(user.id, {
    SEND_MESSAGES: true,
    VIEW_CHANNEL: true,
  });
  Jsonfile.Channelrole.forEach((role) => {
    channel.permissionOverwrites.edit(role, {
      SEND_MESSAGES: true,
      VIEW_CHANNEL: true,
    });
  });

  const reactionMessageEmbed = {
    color: ticket.color || Jsonfile.answer_color,
    fields: [
      {
        name: ticket.title || Jsonfile.answer_title,
        value: (ticket.message || Jsonfile.answer_description).replace(/{user}/g, `<@${user.id}>`),
      },
    ],
    footer: {
      icon_url: client.user.avatarURL(),
    },
  };
  const reactionMessage = await channel.send({
    embeds: [reactionMessageEmbed],
  });
  await reactionMessage.react('🔒');
  await reactionMessage.react('🔓');
  await reactionMessage.react('⛔');

  addToTickets(reactionMessage.id, channel.id);
};

module.exports.contining = contining;
