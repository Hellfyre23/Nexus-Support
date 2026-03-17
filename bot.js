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

const PROJECTLEAD_ROLE = "1344404519932395681";
const SUPPORT_ROLE = "1344713168404091012";

const TICKET_CHANNEL = "1344419253062860911";
const TICKET_CATEGORY = "1344514759915081769";
const ARCHIVE_CATEGORY = "1344514813937713183";

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

const ticketButton = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("ticket")
.setLabel("🎫 Create Ticket")
.setStyle(ButtonStyle.Primary)
);

const closeButton = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("close")
.setLabel("🔒 Close Ticket")
.setStyle(ButtonStyle.Danger)
);

function isStaff(member){
return member.roles.cache.has(PROJECTLEAD_ROLE) || member.roles.cache.has(SUPPORT_ROLE);
}

function makeTicketName(name){
return "ticket-" + name.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20);
}

client.once(Events.ClientReady, () => {
console.log(`Bot Online: ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

if(!interaction.isButton()) return;

if(interaction.customId === "ticket"){

if(interaction.channel.id !== TICKET_CHANNEL){
return interaction.reply({content:"Use the ticket button in the create-a-ticket channel.",ephemeral:true});
}

const category = interaction.guild.channels.cache.get(TICKET_CATEGORY);

const ticketName = makeTicketName(interaction.user.username);

const existing = interaction.guild.channels.cache.find(c => c.name === ticketName && c.parentId === TICKET_CATEGORY);

if(existing){
return interaction.reply({content:`You already have a ticket: ${existing}`,ephemeral:true});
}

const ticketChannel = await interaction.guild.channels.create({
name: ticketName,
type: ChannelType.GuildText,
parent: category.id,
permissionOverwrites:[
{ id: interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel]},
{ id: interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},
{ id: PROJECTLEAD_ROLE, allow:[PermissionsBitField.Flags.ViewChannel]},
{ id: SUPPORT_ROLE, allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

const embed = new EmbedBuilder()
.setTitle("Ticket-System")
.setDescription("You can create a ticket here:\nPress the button and enter your request.\n\n(Tickets can only be closed by the team)")
.setColor(0x2b2d31)
.setThumbnail("attachment://logo.png");

await ticketChannel.send({
content:`<@${interaction.user.id}> <@&${PROJECTLEAD_ROLE}> <@&${SUPPORT_ROLE}>`,
embeds:[embed],
files:["./logo.png"],
components:[closeButton]
});

return interaction.reply({content:`Ticket created: ${ticketChannel}`,ephemeral:true});
}

if(interaction.customId === "close"){

if(!isStaff(interaction.member)){
return interaction.reply({content:"Only staff can close tickets.",ephemeral:true});
}

const archive = interaction.guild.channels.cache.get(ARCHIVE_CATEGORY);

await interaction.reply({content:"Archiving ticket...",ephemeral:true});

const messages = await interaction.channel.messages.fetch({limit:100});

let transcript = "";

messages.reverse().forEach(m=>{
transcript += `${m.author.tag}: ${m.content}\n`;
});

await interaction.channel.setParent(archive.id);
await interaction.channel.setName("closed-" + interaction.channel.name);

await interaction.channel.send({
content:"Ticket archived",
files:[{
attachment:Buffer.from(transcript),
name:"transcript.txt"
}]
});

}

});

client.on(Events.MessageCreate, async message => {

if(message.author.bot) return;

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

if(message.content === "!sendtickets"){

const channel = message.guild.channels.cache.get(TICKET_CHANNEL);

const embed = new EmbedBuilder()
.setTitle("Ticket-System")
.setDescription("You can create a ticket here:\nPress the button and enter your request.\n\n(Tickets can only be closed by the team)")
.setColor(0x2b2d31)
.setThumbnail("attachment://logo.png");

await channel.send({
embeds:[embed],
files:["./logo.png"],
components:[ticketButton]
});

message.reply("Ticket button sent.");

}

});

client.login(TOKEN);
