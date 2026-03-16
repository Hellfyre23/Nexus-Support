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
    ChannelType,
    EmbedBuilder
} = require('discord.js');
require('dotenv').config();

// =======================
// CONFIGURATION
// =======================
const TOKEN = process.env.TOKEN;

const SURVIVOR_ROLE = 'SURVIVOR_ROLE_ID';          // Replace with @Survivor role ID
const PROJECTLEAD_ROLE = 'PROJECTLEAD_ROLE_ID';    // Replace with Projectlead role ID
const SUPPORT_ROLE = 'SUPPORT_ROLE_ID';            // Replace with Support role ID

const TICKET_CHANNEL = '1344419253062860911';      // #create-a-ticket channel
const TICKET_CATEGORY = '1344514759915081769';     // Open tickets category
const ARCHIVE_CATEGORY = '1344514813937713183';    // Archived tickets category

// =======================
// CLIENT SETUP
// =======================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// =======================
// BUTTONS
// =======================
const verifyButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('verify')
        .setLabel('✅ I Agree')
        .setStyle(ButtonStyle.Success)
);

const ticketButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('ticket')
        .setLabel('🎫 Create Ticket')
        .setStyle(ButtonStyle.Primary)
);

const closeButton = new ActionRowBuilder().addComponents(
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
// HELPERS
// =======================
function isStaff(member) {
    return (
        member.roles.cache.has(PROJECTLEAD_ROLE) ||
        member.roles.cache.has(SUPPORT_ROLE)
    );
}

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

        if (!role) {
            return interaction.reply({
                content: '❌ Survivor role not found. Please contact staff.',
                ephemeral: true
            });
        }

        if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: 'You already have the Survivor role!',
                ephemeral: true
            });
        }

        try {
            await interaction.member.roles.add(role);
            return interaction.reply({
                content: '✅ You now have the Survivor role and access to the server!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error giving Survivor role:', error);
            return interaction.reply({
                content: '❌ I could not assign the Survivor role. Make sure my bot role is above Survivor.',
                ephemeral: true
            });
        }
    }

    // ---------------------
    // TICKET CREATION
    // ---------------------
    if (interaction.customId === 'ticket') {
        if (interaction.channel.id !== TICKET_CHANNEL) {
            return interaction.reply({
                content: '❌ You can only use the ticket button in the create-a-ticket channel.',
                ephemeral: true
            });
        }

        const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);
        if (!category) {
            return interaction.reply({
                content: '❌ Ticket category not found.',
                ephemeral: true
            });
        }

        const safeUsername = interaction.user.username
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
            .slice(0, 20);

        const ticketName = `ticket-${safeUsername}`;

        const existingTicket = interaction.guild.channels.cache.find(
            ch => ch.parentId === TICKET_CATEGORY && ch.name === ticketName
        );

        if (existingTicket) {
            return interaction.reply({
                content: `You already have an open ticket: ${existingTicket}`,
                ephemeral: true
            });
        }

        const overwrites = [
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
        ];

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: overwrites
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle('Ticket-System')
                .setDescription(
                    'You can create a ticket here:\nPress the button and enter your request.\n\n(Tickets can only be closed by the team)'
                )
                .setColor(0x2b2d31)
                .setThumbnail('attachment://logo.png');

            await ticketChannel.send({
                content: `<@${interaction.user.id}> <@&${PROJECTLEAD_ROLE}> <@&${SUPPORT_ROLE}>`,
                embeds: [ticketEmbed],
                files: ['./logo.png'],
                components: [closeButton]
            });

            return interaction.reply({
                content: `✅ Ticket created: ${ticketChannel}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating ticket:', error);
            return interaction.reply({
                content: '❌ There was an error creating your ticket.',
                ephemeral: true
            });
        }
    }

    // ---------------------
    // TICKET CLOSING / ARCHIVING
    // ---------------------
    if (interaction.customId === 'close') {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Only the team can close tickets.',
                ephemeral: true
            });
        }

        const archiveCategory = interaction.guild.channels.cache.get(ARCHIVE_CATEGORY);
        if (!archiveCategory) {
            return interaction.reply({
                content: '❌ Archive category not found.',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: '📦 Archiving ticket...',
            ephemeral: true
        });

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let transcript = '=== Ticket Transcript ===\n\n';

            messages.reverse().forEach(msg => {
                transcript += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '[embed/attachment]'}\n`;
            });

            const archivedName = interaction.channel.name.startsWith('closed-')
                ? interaction.channel.name
                : `closed-${interaction.channel.name}`.slice(0, 100);

            await interaction.channel.setParent(archiveCategory.id, { lockPermissions: false });
            await interaction.channel.setName(archivedName);

            await interaction.channel.permissionOverwrites.set([
                {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: PROJECTLEAD_ROLE,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                },
                {
                    id: SUPPORT_ROLE,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }
            ]);

            const archiveEmbed = new EmbedBuilder()
                .setTitle('Ticket Archived')
                .setDescription(`This ticket was closed by ${interaction.user}.`)
                .setColor(0xff0000);

            await interaction.channel.send({
                embeds: [archiveEmbed],
                files: [
                    {
                        attachment: Buffer.from(transcript, 'utf-8'),
                        name: `${interaction.channel.name}-transcript.txt`
                    }
                ]
            });
        } catch (error) {
            console.error('Error archiving ticket:', error);
            try {
                await interaction.followUp({
                    content: '❌ There was an error archiving this ticket.',
                    ephemeral: true
                });
            } catch {}
        }
    }
});

// =======================
// ADMIN COMMANDS TO SEND BUTTONS
// =======================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (message.content === '!sendrules') {
        await message.channel.send({
            content: 'Please agree to the rules:',
            components: [verifyButton]
        });
    }

    if (message.content === '!sendtickets') {
        const embed = new EmbedBuilder()
            .setTitle('Ticket-System')
            .setDescription(
                'You can create a ticket here:\nPress the button and enter your request.\n\n(Tickets can only be closed by the team)'
            )
            .setColor(0x2b2d31)
            .setThumbnail('attachment://logo.png');

        await message.channel.send({
            embeds: [embed],
            files: ['./logo.png'],
            components: [ticketButton]
        });
    }
});

// =======================
// LOGIN
// =======================
client.login(TOKEN);
