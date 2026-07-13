const config = require(`../config.json`);
const fs = require('fs');
const { MessageAttachment } = require('discord.js');
const { contining } = require('../commands/startapps.js');
module.exports = (client, messageReaction, user) => {
  if (user.bot) return; // Ignore bot's reactions

  // Readfile collectors.json and save it in a variable
  let collectors = JSON.parse(fs.readFileSync('./collectors.json', 'utf8'));

  // Handle collectors
  if (collectors.collector.filter((e) => e.id === messageReaction.message.id).length > 0) {
    const tickets = config.tickets && config.tickets.length ? config.tickets : null;
    let ticket = null;

    if (tickets) {
      ticket = tickets.find((t) => t.emoji === messageReaction.emoji.name);
    } else if (messageReaction.emoji.name === '📩') {
      // Fallback single-ticket mode
      ticket = {
        title: config.answer_title,
        message: config.answer_description,
        color: config.answer_color,
        category: config.answer_category,
        prefix: 'ticket',
      };
    }

    if (ticket) {
      let channelname = `${ticket.prefix || 'ticket'}-${user.username}`.replace(/\s/g, '-').toLowerCase();
      if (messageReaction.message.guild.channels.cache.find((channel) => channel.name === channelname) && config.one_app) {
        user.send(`You already have an ongoing ticket.`).catch(console.error);
        return messageReaction.users.remove(user.id);
      }
      contining(client, messageReaction.message, user, ticket);
      messageReaction.users.remove(user.id);
    }
  }

  // Handle tickets
  if (collectors.tickets.filter((e) => e.id === messageReaction.message.id).length > 0) {
    let channel = messageReaction.message.guild.channels.cache.find((channel) => channel.id === messageReaction.message.channel.id);
    const ownerID = collectors.tickets.filter((e) => e.id === messageReaction.message.id)[0].owner;
    // Get owner of the ticket
    client.users.fetch(ownerID).then((owner) => {
      switch (messageReaction.emoji.name) {
        case '🔒':
          if (!checkUser(messageReaction.message, user) && !config.allow_user_lock) {
            user.send('Only Staff can lock the channels');
            return messageReaction.users.remove(user.id);
          }
          if (channel.permissionOverwrites.cache.get(ownerID)?.deny.has('SEND_MESSAGES')) {
            user.send('This channel is already locked');
            return messageReaction.users.remove(user.id);
          }
          channel.permissionOverwrites.edit(owner, {
            SEND_MESSAGES: false,
          });
          return messageReaction.message.channel.send('Channel Locked 🔒');
        case '🔓':
          if (!checkUser(messageReaction.message, user) && !config.allow_user_unlock) {
            user.send('Only Staff can unlock the channels');
            return messageReaction.users.remove(user.id);
          }
          if (channel.permissionOverwrites.cache.get(ownerID)?.allow.has('SEND_MESSAGES')) {
            user.send('This channel is already unlocked');
            return messageReaction.users.remove(user.id);
          }
          channel.permissionOverwrites.edit(owner, {
            SEND_MESSAGES: true,
          });
          return messageReaction.message.channel.send('Channel Unlocked 🔓');
        case '⛔':
          if (!messageReaction.message.guild.channels.cache.find((c) => c.name.toLowerCase() === channel.name)) return;
          if (!checkUser(messageReaction.message, user) && !config.allow_user_delete) {
            user.send('Only Staff can delete the channels').catch(console.error);
            return messageReaction.users.remove(user.id);
          }

          // Build and send the transcript BEFORE deleting the channel
          sendTranscript(channel, ownerID).catch(console.error);

          setTimeout(() => {
            if (messageReaction.message.guild.channels.cache.find((c) => c.name.toLowerCase() === channel.name)) channel.delete();
            removeTicketfromCollectors(messageReaction.message.id);
          }, 5000);

          return messageReaction.message.channel.send('Deleting this channel in 5 seconds!');
      }
    });
  }
};

const fetchAllMessages = async (channel) => {
  let all = [];
  let lastId;
  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const fetched = await channel.messages.fetch(opts);
    if (fetched.size === 0) break;
    all = all.concat([...fetched.values()]);
    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }
  return all;
};

const sendTranscript = async (channel, ownerID) => {
  const transcriptChannel = config.transcript_channel
    ? channel.guild.channels.cache.get(config.transcript_channel)
    : null;
  if (!transcriptChannel) {
    console.log('No transcript_channel configured; skipping transcript.');
    return;
  }

  const msgs = await fetchAllMessages(channel);
  msgs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = msgs.map((m) => {
    const time = m.createdAt.toISOString();
    const attachments = m.attachments.size
      ? ` [attachments: ${[...m.attachments.values()].map((a) => a.url).join(', ')}]`
      : '';
    return `[${time}] ${m.author.tag}: ${m.content}${attachments}`;
  });

  const transcriptText = lines.join('\n');
  const attachment = new MessageAttachment(Buffer.from(transcriptText, 'utf8'), `transcript-${channel.name}.txt`);

  await transcriptChannel.send({
    content: `📄 **Transcript** for ticket \`${channel.name}\` (opened by <@${ownerID}>) — ${msgs.length} messages`,
    files: [attachment],
  });
  console.log(`Transcript sent for ${channel.name} (${msgs.length} messages).`);
};

const checkUser = (message, user) => {
  if (message.guild.members.cache.find((member) => member.id === user.id).permissions.has('ADMINISTRATOR')) return true;

  const roles = config.Channelrole.some((role) => {
    if (message.guild.members.cache.find((member) => member.id === user.id).roles.cache.find((r) => r.id === role)) return true;
  });
  if (roles) return true;

  return false;
};
const removeTicketfromCollectors = (MessageID) => {
  let collectors = JSON.parse(fs.readFileSync('./collectors.json', 'utf8'));
  collectors.tickets = collectors.tickets.filter((e) => e.id !== MessageID);
  const json = JSON.stringify(collectors);
  fs.writeFile('./collectors.json', json, 'utf8', (err) => {
    if (err) throw err;
  });
};
