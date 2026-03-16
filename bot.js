// bot.js
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Events, 
    PermissionsBitField, 
    ChannelType 
} = require('discord.js');
require('dotenv').config();

// =======================
// CONFIGURATION
// =======================
const TOKEN = process.env.TOKEN;

const SURVIVOR_ROLE = 'SURVIVOR_ROLE_ID';       // Replace with @Survivor role ID
const PROJECTLEAD_ROLE = 'PROJECTLEAD_ROLE_ID'; // Replace with Projectlead role ID
const SUPPORT_ROLE = 'SUPPORT_ROLE_ID';         // Replace with Support role ID
const TICKET_CATEGORY = 'TICKET_CATEGORY_ID';   // Replace with your ticket category ID
const LOG_CHANNEL = 'LOG_CHANNEL_ID';           // Replace with channel ID where transcripts go
const TICKET_CHANNEL = 'TICKET_CHANNEL_ID';     // Replace with #📧│𝖢𝗋𝖾𝖺𝗍𝖾-𝖺-𝖳𝗂𝖼𝗄𝖾𝗍 channel ID

// =======================
// CLIENT SETUP
// =======================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,   // privileged → enable in dev portal
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent  // privileged → enable in dev portal
    ],
    partials: [Partials.Channel]
});

// =======================
// BUTTONS
// =======================
const verifyButton = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('verify')
            .setLabel('✅ I Agree')
            .setStyle(ButtonStyle.Success)
    );

const ticketButton = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('ticket')
            .setLabel('🎫 Create Ticket')
            .setStyle(ButtonStyle.Primary)
    );

const closeButton = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('close')
            .setLabel('🔒 Close Ticket')
            .setStyle(ButtonStyle.Danger)
    );

// =======================
// READY EVENT
// =======================
client.once(Events.ClientReady, () => {
    console.log(`Bot Online: ${client.user.tag}`);
});

// =======================
// INTERACTION HANDLER
// =======================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    // ---------------------
    // RULES VERIFICATION
    // ---------------------
    if (interaction.customId === 'verify') {
        const role = interaction.guild.roles.cache.get(SURVIVOR_ROLE);
        if (!role) return;
        if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'You already have the Survivor role!', ephemeral: true });
        }

        await interaction.member.roles.add(role);
        return interaction.reply({ content: '✅ You now have the Survivor role and access to the server!', ephemeral: true });
    }

    // ---------------------
    // TICKET CREATION
    // ---------------------
    if (interaction.customId === 'ticket') {

        // Only allow in #📧│𝖢𝗋𝖾𝖺𝗍𝖾-𝖺-𝖳𝗂𝖼𝗄𝖾𝗍
        if (interaction.channel.id !== TICKET_CHANNEL) {
            return interaction.reply({ content: '❌ You can only use the ticket button in the #📧│𝖢𝗋𝖾𝖺𝗍𝖾-𝖺-𝖳𝗂𝖼𝗄𝖾𝗍 channel.', ephemeral: true });
        }

        const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);
        if (!category) return interaction.reply({ content: 'Ticket category not found.', ephemeral: true });

        const ticketName = `ticket-${interaction.user.username.toLowerCase()}`;

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

        await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });

        await ticketChannel.send({ 
            content: `<@${interaction.user.id}> <@&${PROJECTLEAD_ROLE}> <@&${SUPPORT_ROLE}> Support will assist you shortly.`,
            components: [closeButton]
        });
    }

    // ---------------------
    // TICKET CLOSING
    // ---------------------
    if (interaction.customId === 'close') {
        await interaction.reply({ content: 'Closing ticket...', ephemeral: true });

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL);
        if (!logChannel) return;

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let transcript = '';
        messages.reverse().forEach(m => transcript += `${m.author.tag}: ${m.content}\n`);

        await logChannel.send({ 
            content: `Transcript for ${interaction.channel.name}`,
            files: [{ attachment: Buffer.from(transcript), name: `${interaction.channel.name}-transcript.txt` }]
        });

        await interaction.channel.delete();
    }
});

// =======================
// ADMIN COMMANDS TO SEND BUTTONS
// =======================
client.on(Events.MessageCreate, async message => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (message.content === '!sendrules') {
        await message.channel.send({ content: 'Please agree to the rules:', components: [verifyButton] });
    }

    if (message.content === '!sendtickets') {
        await message.channel.send({ content: 'Click below to create a ticket:', components: [ticketButton] });
    }
});

// =======================
// LOGIN
// =======================
client.login(TOKEN);
