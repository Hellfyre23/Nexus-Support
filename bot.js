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
  EmbedBuilder
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
    .setLabel('Create Ticket')
    .setStyle(ButtonStyle.Primary)
);

const staffButtonsRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('claim')
    .setLabel('Claim Ticket')
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('close')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger)
);

function isStaff(member) {
  return (
    member.roles.cache.has(PROJECTLEAD_ROLE) ||
    member.roles.cache.has(SUPPORT_ROLE)
  );
}

function makeTicketName(username) {
  const safe = username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);

  return `ticket-${safe || 'user'}`;
}

async function sendTicketPanel() {
  try {

    const channel = await client.channels.fetch(TICKET_CHANNEL);

    const embed = new EmbedBuilder()
      .setTitle('Ticket-System')
      .setDescription(
        'You can create a ticket here:\nPress the button and enter your request.\n\n(Tickets can only be closed by the team)'
      )
      .setColor(0x2b2d31);

    await channel.send({
      embeds: [embed],
      components: [ticketButtonRow]
    });

    console.log("Ticket panel sent.");

  } catch (error) {
    console.error("Failed to send ticket panel:", error);
  }
}

client.once(Events.ClientReady, async () => {

  console.log(`Bot Online: ${client.user.tag}`);

  await sendTicketPanel();

});

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isButton()) return;

  if (interaction.customId === 'ticket') {

    if (interaction.channel.id !== TICKET_CHANNEL) {
      return interaction.reply({
        content: 'Use the ticket button in the create-a-ticket channel only.',
        ephemeral: true
      });
    }

    const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);

    const ticketName = makeTicketName(interaction.user.username);

    const existingTicket = interaction.guild.channels.cache.find(
      ch => ch.parentId === TICKET_CATEGORY && ch.name === ticketName
    );

    if (existingTicket) {
      return interaction.reply({
        content: `You already have an open ticket: ${existingTicket}`,
        ephemeral: true
      });
    }

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
      .setTitle('Ticket-System')
      .setDescription('Support will assist you shortly.')
      .setColor(0x2b2d31);

    await ticketChannel.send({
      content: `<@${interaction.user.id}> <@&${PROJECTLEAD_ROLE}> <@&${SUPPORT_ROLE}>`,
      embeds: [embed],
      components: [staffButtonsRow]
    });

    return interaction.reply({
      content: `Ticket created: ${ticketChannel}`,
      ephemeral: true
    });
  }

  if (interaction.customId === 'claim') {

    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'Only staff can claim tickets.',
        ephemeral: true
      });
    }

    await interaction.channel.send(`Ticket claimed by ${interaction.user.tag}`);

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

    await interaction.reply({
      content: 'Archiving ticket...',
      ephemeral: true
    });

    const messages = await interaction.channel.messages.fetch({ limit: 100 });

    let transcript = "";

    messages.reverse().forEach(m => {
      transcript += `${m.author.tag}: ${m.content}\n`;
    });

    await interaction.channel.setParent(archive.id);
    await interaction.channel.setName("closed-" + interaction.channel.name);

    await interaction.channel.send({
      content: "Ticket archived",
      files: [{
        attachment: Buffer.from(transcript),
        name: "transcript.txt"
      }]
    });
  }

});

client.login(TOKEN);
