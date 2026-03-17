const {
  Client,
  GatewayIntentBits,
  Partials,
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

require('dotenv').config();

const TOKEN = process.env.TOKEN;

const PROJECTLEAD_ROLE = '1344404519932395681';
const SUPPORT_ROLE = '1344713168404091012';

const TICKET_CHANNEL = '1344419253062860911';
const TICKET_CATEGORY = '1344514759915081769';
const ARCHIVE_CATEGORY = '1344514813937713183';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
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

function isStaff(member) {
  return (
    member.roles.cache.has(PROJECTLEAD_ROLE) ||
    member.roles.cache.has(SUPPORT_ROLE)
  );
}

function isValidSteamId(input) {
  return /^[0-9]{17}$/.test(input.trim());
}

function getSteamProfileUrl(steamId) {
  return `https://steamcommunity.com/profiles/${steamId}`;
}

function getNextTicketNumber(guild) {

  const tickets = guild.channels.cache.filter(c =>
    c.parentId === TICKET_CATEGORY && c.name.startsWith("ticket-")
  );

  let highest = 0;

  tickets.forEach(channel => {
    const num = parseInt(channel.name.replace("ticket-", ""));
    if (!isNaN(num) && num > highest) highest = num;
  });

  const next = highest + 1;

  return `ticket-${String(next).padStart(3, "0")}`;
}

async function sendTicketPanel() {
  try {

    const channel = await client.channels.fetch(TICKET_CHANNEL);

    const embed = new EmbedBuilder()
      .setTitle('📨 Ticket-System')
      .setDescription(
        "Welcome to the support center.\n\n" +
        "Press the button below to open a support ticket.\n\n" +
        "**Requirements:**\n" +
        "• Steam ID (17 numbers)\n" +
        "• Description of the issue\n\n" +
        "⚠ Tickets can only be closed by the team."
      )
      .setColor(0x5865F2)
      .addFields(
        { name: "🛠 Support", value: "Questions, reports, or help requests.", inline: false },
        { name: "🔒 Privacy", value: "Tickets are private between you and staff.", inline: false }
      )
      .setFooter({ text: "Press the button below to create your ticket" })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      components: [ticketButtonRow]
    });

  } catch (error) {
    console.error("Failed to send ticket panel:", error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Bot Online: ${client.user.tag}`);
  await sendTicketPanel();
});

client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isButton()) {

    if (interaction.customId === 'ticket') {

      if (interaction.channel.id !== TICKET_CHANNEL) {
        return interaction.reply({
          content: "Use the ticket button in the create-a-ticket channel.",
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
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(17);

      const problemInput = new TextInputBuilder()
        .setCustomId('problem')
        .setLabel('Describe your problem')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);

      const row1 = new ActionRowBuilder().addComponents(steamInput);
      const row2 = new ActionRowBuilder().addComponents(problemInput);

      modal.addComponents(row1, row2);

      return interaction.showModal(modal);
    }

    if (interaction.customId === 'claim') {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Only staff can claim tickets.",
          ephemeral: true
        });
      }

      await interaction.channel.send(`🛠 Ticket claimed by ${interaction.user.tag}`);

      return interaction.reply({
        content: "Ticket claimed.",
        ephemeral: true
      });
    }

    if (interaction.customId === 'close') {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Only staff can close tickets.",
          ephemeral: true
        });
      }

      const archive = interaction.guild.channels.cache.get(ARCHIVE_CATEGORY);

      await interaction.reply({
        content: "Archiving ticket...",
        ephemeral: true
      });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });

      let transcript = "";

      messages.reverse().forEach(m => {
        transcript += `${m.author.tag}: ${m.content}\n`;
      });

      await interaction.channel.setParent(archive.id);
      await interaction.channel.setName(`closed-${interaction.channel.name}`);

      await interaction.channel.send({
        content: "Ticket archived",
        files: [{
          attachment: Buffer.from(transcript),
          name: "transcript.txt"
        }]
      });
    }

  }

  if (interaction.isModalSubmit()) {

    if (interaction.customId !== 'ticket_modal') return;

    const steamId = interaction.fields.getTextInputValue('steam_id').trim();
    const problem = interaction.fields.getTextInputValue('problem').trim();

    if (!isValidSteamId(steamId)) {
      return interaction.reply({
        content: "Steam ID must be exactly 17 numbers.",
        ephemeral: true
      });
    }

    const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);

    const ticketName = getNextTicketNumber(interaction.guild);

    const steamProfileUrl = getSteamProfileUrl(steamId);

    const ticketChannel = await interaction.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: PROJECTLEAD_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: SUPPORT_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 ${ticketName}`)
      .setDescription(
        `**User:** ${interaction.user}\n\n` +
        `**Steam ID:** ${steamId}\n` +
        `**Steam Profile:** ${steamProfileUrl}\n\n` +
        `**Problem:**\n${problem}`
      )
      .setColor(0x57F287)
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
