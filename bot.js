const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, PermissionsBitField, ChannelType } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const VERIFY_ROLE = 'VERIFY_ROLE_ID';
const PROJECTLEAD_ROLE = 'PROJECTLEAD_ROLE_ID';
const SUPPORT_ROLE = 'SUPPORT_ROLE_ID';
const TICKET_CATEGORY = 'TICKET_CATEGORY_ID';
const LOG_CHANNEL = 'LOG_CHANNEL_ID';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel]
});

// ------------------------
// Rule Verification Button
// ------------------------
const verifyButton = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('verify')
            .setLabel('✅ I Agree')
            .setStyle(ButtonStyle.Success)
    );

// ------------------------
// Ticket Button
// ------------------------
const ticketButton = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('ticket')
            .setLabel('🎫 Create Ticket')
            .setStyle(ButtonStyle.Primary)
    );

// ------------------------
// Close Button
// ------------------------
const closeButton = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('close')
            .setLabel('🔒 Close Ticket')
            .setStyle(ButtonStyle.Danger)
    );

// ------------------------
// Ready Event
// ------------------------
client.once('ready', () => {
    console.log(`Bot online: ${client.user.tag}`);
});

// ------------------------
// Interaction Event
// ------------------------
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    // Verification
    if (interaction.customId === 'verify') {
        const role = interaction.guild.roles.cache.get(VERIFY_ROLE);
        if (!role) return;
        if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'You already accepted the rules.', ephemeral: true });
        }
        await interaction.member.roles.add(role);
        return interaction.reply({ content: 'You now have access to the server!', ephemeral: true });
    }

    // Ticket creation
    if (interaction.customId === 'ticket') {
        const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);
        if (!category) return;

        const ticketName = `ticket-${interaction.user.username.toLowerCase()}`;

        // Check if ticket already exists
        if (category.children.find(ch => ch.name === ticketName)) {
            return interaction.reply({ content: 'You already have a ticket.', ephemeral: true });
        }

        const overwrites = [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: PROJECTLEAD_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: SUPPORT_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];

        const ticketChannel = await interaction.guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites
        });

        await ticketChannel.send({ content: `<@${interaction.user.id}> <@&${PROJECTLEAD_ROLE}> <@&${SUPPORT_ROLE}> Support will assist you shortly.`, components: [closeButton] });
        return interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
    }

    // Ticket close
    if (interaction.customId === 'close') {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL);
        if (!logChannel) return;

        // Save transcript
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let transcript = '';
        messages.reverse().forEach(m => transcript += `${m.author.tag}: ${m.content}\n`);

        await logChannel.send({ content: `Transcript for ${interaction.channel.name}`, files: [{ attachment: Buffer.from(transcript), name: `${interaction.channel.name}-transcript.txt` }] });
        await interaction.channel.delete();
    }
});

// ------------------------
// Commands to send buttons
// ------------------------
client.on(Events.MessageCreate, async message => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (message.content === '!sendrules') {
        await message.channel.send({ content: 'Please agree to the rules:', components: [verifyButton] });
    }

    if (message.content === '!sendtickets') {
        await message.channel.send({ content: 'Click below to create a ticket:', components: [ticketButton] });
    }
});

// ------------------------
client.login(TOKEN);
