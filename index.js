
require('dotenv').config()

const discordBotSettings = require('./settings/discordBotSettings');
const { Client, Intents } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { handleCommands } = require('./commandHandler');
const { handleButtons } = require('./buttonHandler');
const commandRegistry = require('./commandRegistry');


//our discord client, connects to the discord API and gives us an object to work with
global.discordBot = new Client({ intents: [Intents.FLAGS.GUILDS] });

//another client for interacting with the discord API // not sure
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);

// more magic that registeres all of the SLASH commands
(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(discordBotSettings.botId, discordBotSettings.primaryGuildId),
            { body: commandRegistry.commands },
        );
    } catch (error) {
        console.error(error);
    }
})();

//when the discord bot is logged in and ready to use, an event *
global.discordBot.on('ready', async () => {
    console.log(`Discord Bot logged in as ${global.discordBot.user.tag}!`);
});

global.discordBot.on('interactionCreate', async interaction => {
    try{
        if (interaction.isCommand()){
            await handleCommands(interaction);
        }
        else if(interaction.isButton()){
            await handleButtons(interaction);
        }
    }
    catch(err){
        console.log(err);
    }
});
  
global.discordBot.login(process.env.DISCORD_BOT_TOKEN);
