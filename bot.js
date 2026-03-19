const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.TOKEN;

const PROJECTLEAD_ROLE = '1344404519932395681';
const SUPPORT_ROLE = '1344713168404091012';

const TICKET_CHANNEL = '1344419253062860911';
const TICKET_CATEGORY = '1344514759915081769';
const ARCHIVE_CATEGORY = '1344514813937713183';

const AUTO_DELETE_DAYS = 10;
const COUNTER_FILE = path.join(__dirname, 'ticket-counter.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const ticketButtonRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('ticket')
    .setLabel('🎫 Create Ticket')
    .setStyle(ButtonStyle.Primary)
);

const staffButtonsRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('claim')
    .setLabel('🛠 Claim Ticket')
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('close')
    .setLabel('🔒 Close Ticket')
    .setStyle(ButtonStyle.Danger)
);

function buildArchiveButtonsRow(transcriptUrl) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Open Transcript')
      .setStyle(ButtonStyle.Link)
      .setURL(transcriptUrl),
    new ButtonBuilder()
      .setCustomId('delete_ticket')
      .setLabel('🗑 Delete Ticket')
      .setStyle(ButtonStyle.Danger)
  );
}

function isStaff(member) {
  return (
    member.roles.cache.has(PROJECTLEAD_ROLE) ||
    member.roles.cache.has(SUPPORT_ROLE)
  );
}

function isValidSteamId(input) {
  return /^[0-9]{17}$/.test(input.trim());
}

function getSteamProfileUrl(id) {
  return `https://steamcommunity.com/profiles/${id}`;
}

async function ensureCounterFile() {
  try {
    await fs.access(COUNTER_FILE);
  } catch {
    await fs.writeFile(
      COUNTER_FILE,
      JSON.stringify({ lastTicketNumber: 0 }, null, 2),
      'utf8'
    );
  }
}

async function getNextTicketNumber() {
  await ensureCounterFile();

  const raw = await fs.readFile(COUNTER_FILE, 'utf8');
  const data = JSON.parse(raw);

  const next = Number(data.lastTicketNumber || 0) + 1;
  data.lastTicketNumber = next;

  await fs.writeFile(COUNTER_FILE, JSON.stringify(data, null, 2), 'utf8');

  return `ticket-${String(next).padStart(3, '0')}`;
}

async function sendTicketPanel() {
  try {
    console.log('Trying to send ticket panel...');

    const channel = await client.channels.fetch(TICKET_CHANNEL, { force: true });

    if (!channel) {
      console.error('Ticket panel error: channel not found.');
      return;
    }

    if (!channel.isTextBased()) {
      console.error('Ticket panel error: channel is not text based.');
      return;
    }

    const me = channel.guild.members.me || await channel.guild.members.fetchMe();
    const perms = channel.permissionsFor(me);

    if (!perms) {
      console.error('Ticket panel error: could not read bot permissions.');
      return;
    }

    if (
      !perms.has(PermissionsBitField.Flags.ViewChannel) ||
      !perms.has(PermissionsBitField.Flags.SendMessages) ||
      !perms.has(PermissionsBitField.Flags.EmbedLinks)
    ) {
      console.error(
        'Ticket panel error: missing View Channel, Send Messages, or Embed Links permission.'
      );
      return;
    }

    const recentMessages = await channel.messages.fetch({ limit: 20 });
    const existingPanel = recentMessages.find(
      msg =>
        msg.author.id === client.user.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].title === '📨 Ticket-System'
    );

    if (existingPanel) {
      console.log('Ticket panel already exists. Not sending another one.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📨 Ticket-System')
      .setDescription(
        'Press the button below to open a support ticket.\n\n' +
          '**Requirements:**\n' +
          '• Steam ID (17 numbers)\n' +
          '• Description of the issue\n\n' +
          '⚠ Tickets can only be closed by the team.'
      )
      .setColor(0x5865f2)
      .addFields({
        name: '🛠 Support',
        value: 'Questions, reports, or help requests.'
      })
      .setFooter({ text: 'Press the button below to create your ticket' })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      components: [ticketButtonRow]
    });

    console.log('Ticket panel sent successfully.');
  } catch (error) {
    console.error('Failed to send ticket panel:', error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Bot Online: ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: '🛠 Fixing issues… probably', type: 0 }],
    status: 'online'
  });

  await ensureCounterFile();

  setTimeout(async () => {
    await sendTicketPanel();
  }, 3000);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'ticket') {
      if (interaction.channel.id !== TICKET_CHANNEL) {
        return interaction.reply({
          content: 'Use the ticket button in the create-a-ticket channel.',
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Create Support Ticket');

      const steamInput = new TextInputBuilder()
        .setCustomId('steam_id')
        .setLabel('Steam ID (17 numbers)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(17)
        .setMaxLength(17)
        .setRequired(true);

      const problemInput = new TextInputBuilder()
        .setCustomId('problem')
        .setLabel('Describe your problem')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(steamInput),
        new ActionRowBuilder().addComponents(problemInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'claim') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: 'Only staff can claim tickets.',
          ephemeral: true
        });
      }

      await interaction.channel.setTopic(`Claimed by ${interaction.user.tag}`);
      await interaction.channel.send(`🛠 Ticket claimed by ${interaction.user.tag}`);

      return interaction.reply({
        content: 'Ticket claimed.',
        ephemeral: true
      });
    }

    if (interaction.customId === 'close') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: 'Only staff can close tickets.',
          ephemeral: true
        });
      }

      const archive = interaction.guild.channels.cache.get(ARCHIVE_CATEGORY);

      if (!archive) {
        return interaction.reply({
          content: 'Archive category not found.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: 'Archiving ticket...',
        ephemeral: true
      });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const orderedMessages = [...messages.values()].reverse();

      let transcript = '';
      let creatorId = null;

      for (const m of orderedMessages) {
        const text =
          m.content && m.content.trim().length > 0
            ? m.content
            : '[embed/attachment/system message]';

        transcript += `${m.author.tag}: ${text}\n`;

        if (!creatorId && !m.author.bot) {
          creatorId = m.author.id;
        }
      }

      if (!creatorId) {
        const overwrite = interaction.channel.permissionOverwrites.cache.find(
          po =>
            po.id !== interaction.guild.id &&
            po.id !== PROJECTLEAD_ROLE &&
            po.id !== SUPPORT_ROLE
        );

        if (overwrite) creatorId = overwrite.id;
      }

      await interaction.channel.setParent(archive.id);
      await interaction.channel.setName(`closed-${interaction.channel.name}`);

      const transcriptMessage = await interaction.channel.send({
        content: `Ticket archived. Auto deleting in ${AUTO_DELETE_DAYS} days.`,
        files: [
          {
            attachment: Buffer.from(transcript, 'utf8'),
            name: `${interaction.channel.name}-transcript.txt`
          }
        ]
      });

      const transcriptAttachment = transcriptMessage.attachments.first();

      if (transcriptAttachment) {
        const archiveEmbed = new EmbedBuilder()
          .setTitle('📦 Ticket Archived')
          .setDescription('This ticket is archived. Use the buttons below.')
          .setColor(0xed4245)
          .setTimestamp();

        await interaction.channel.send({
          embeds: [archiveEmbed],
          components: [buildArchiveButtonsRow(transcriptAttachment.url)]
        });
      }

      if (creatorId && transcriptAttachment) {
        try {
          const creator = await client.users.fetch(creatorId);

          const transcriptButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Open Transcript')
              .setStyle(ButtonStyle.Link)
              .setURL(transcriptAttachment.url)
          );

          await creator.send({
            content: `Here is the transcript for your ticket: ${interaction.channel.name}`,
            components: [transcriptButton]
          });
        } catch (err) {
          console.error('Failed to DM transcript link to creator:', err);
          await interaction.channel.send(
            '⚠️ I could not DM the transcript link to the ticket creator.'
          );
        }
      } else {
        await interaction.channel.send(
          '⚠️ I could not determine the ticket creator or transcript link.'
        );
      }

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (err) {
          console.error('Auto delete failed:', err);
        }
      }, AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000);
    }

    if (interaction.customId === 'delete_ticket') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: 'Only staff can delete archived tickets.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: 'Deleting archived ticket...',
        ephemeral: true
      });

      try {
        await interaction.channel.delete();
      } catch (err) {
        console.error('Manual delete failed:', err);
      }
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId !== 'ticket_modal') return;

    const steamId = interaction.fields.getTextInputValue('steam_id');
    const problem = interaction.fields.getTextInputValue('problem');

    if (!isValidSteamId(steamId)) {
      return interaction.reply({
        content: 'Steam ID must be exactly 17 numbers.',
        ephemeral: true
      });
    }

    const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);

    if (!category) {
      return interaction.reply({
        content: 'Ticket category not found.',
        ephemeral: true
      });
    }

    const ticketName = await getNextTicketNumber();
    const steamProfile = getSteamProfileUrl(steamId);

    const ticketChannel = await interaction.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      topic: `Created by ${interaction.user.tag} (${interaction.user.id})`,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: PROJECTLEAD_ROLE,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        },
        {
          id: SUPPORT_ROLE,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 ${ticketName}`)
      .setDescription(
        `**User:** ${interaction.user}\n\n` +
          `**Steam ID:** ${steamId}\n` +
          `**Steam Profile:** ${steamProfile}\n\n` +
          `**Problem:**\n${problem}`
      )
      .setColor(0x57f287)
      .setTimestamp();

    await ticketChannel.send({
      embeds: [embed],
      components: [staffButtonsRow]
    });

    return interaction.reply({
      content: `Ticket created: ${ticketChannel}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);
