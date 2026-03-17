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

require('dotenv').config();

const TOKEN = process.env.TOKEN;

const PROJECTLEAD_ROLE = '1344404519932395681';
const SUPPORT_ROLE = '1344713168404091012';

const TICKET_CHANNEL = '1344419253062860911';
const TICKET_CATEGORY = '1344514759915081769';
const ARCHIVE_CATEGORY = '1344514813937713183';

const AUTO_DELETE_DAYS = 10;

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers
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

function getNextTicketNumber(guild) {

const tickets = guild.channels.cache.filter(c =>
c.parentId === TICKET_CATEGORY && c.name.startsWith("ticket-")
);

let highest = 0;

tickets.forEach(ch => {
const num = parseInt(ch.name.replace("ticket-", ""));
if (!isNaN(num) && num > highest) highest = num;
});

const next = highest + 1;

return `ticket-${String(next).padStart(3, "0")}`;
}

async function sendTicketPanel() {

const channel = await client.channels.fetch(TICKET_CHANNEL);

const embed = new EmbedBuilder()
.setTitle('📨 Ticket-System')
.setThumbnail('attachment://logo.png')
.setDescription(
"Press the button below to open a support ticket.\n\n" +
"**Requirements:**\n" +
"• Steam ID (17 numbers)\n" +
"• Description of the issue\n\n" +
"⚠ Tickets can only be closed by the team."
)
.setColor(0x5865F2)
.addFields({
name: "🛠 Support",
value: "Questions, reports, or help requests."
})
.setFooter({ text: "Press the button below to create your ticket" })
.setTimestamp();

await channel.send({
embeds: [embed],
components: [ticketButtonRow],
files: ["./logo.png"]
});

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
.setMinLength(17)
.setMaxLength(17)
.setRequired(true);

const problemInput = new TextInputBuilder()
.setCustomId('problem')
.setLabel('Describe your problem')
.setStyle(TextInputStyle.Paragraph)
.setRequired(true)
.setMinLength(10);

modal.addComponents(
new ActionRowBuilder().addComponents(steamInput),
new ActionRowBuilder().addComponents(problemInput)
);

return interaction.showModal(modal);

}

if (interaction.customId === 'claim') {

if (!isStaff(interaction.member)) {
return interaction.reply({
content: "Only staff can claim tickets.",
ephemeral: true
});
}

await interaction.channel.setTopic(`Claimed by ${interaction.user.tag}`);

await interaction.channel.send(
`🛠 Ticket claimed by ${interaction.user.tag}`
);

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
content: `Ticket archived. Auto deleting in ${AUTO_DELETE_DAYS} days.`,
files: [{
attachment: Buffer.from(transcript),
name: "transcript.txt"
}]
});

setTimeout(async () => {
try {
await interaction.channel.delete();
} catch {}
}, AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000);

}

}

if (interaction.isModalSubmit()) {

if (interaction.customId !== 'ticket_modal') return;

const steamId = interaction.fields.getTextInputValue('steam_id');
const problem = interaction.fields.getTextInputValue('problem');

if (!isValidSteamId(steamId)) {
return interaction.reply({
content: "Steam ID must be exactly 17 numbers.",
ephemeral: true
});
}

const ticketName = getNextTicketNumber(interaction.guild);

const steamProfile = getSteamProfileUrl(steamId);

const ticketChannel = await interaction.guild.channels.create({
name: ticketName,
type: ChannelType.GuildText,
parent: TICKET_CATEGORY,
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
`**Steam Profile:** ${steamProfile}\n\n` +
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
