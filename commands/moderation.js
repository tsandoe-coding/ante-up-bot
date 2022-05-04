const discordBotSettings = require('../settings/discordBotSettings');
const { getOrCreateServerConfig, updateQueueEmbed } = require('../utility');
const { ConfigModel } = require('../database/models/config');
const UserModel = require('../database/models/user');

const hasPermissionsToModerate = async (interaction) => {
    if(discordBotSettings.superUserIds.includes(interaction.user.id)){
        return true;
    }

    if(interaction.member.roles.cache.has(discordBotSettings.administratorRoleId) || 
        interaction.member.roles.cache.has(discordBotSettings.moderatorRoleId)){
            return true;
    }

    return false;
}

module.exports = {
    clearQueue: async (interaction) => {
        if(!hasPermissionsToModerate(interaction)){
            await interaction.reply({content: `Sorry, you do not have moderator privileges to clear the queue.`, ephemeral: true});
            return;
        }

        const config = await getOrCreateServerConfig(interaction);

        if(config.queueConfigs.length == 0){
            await interaction.reply({content: `No queue has been set up yet.`, ephemeral: true});
            return;
        }

        let queueName = interaction.options.data[0].value;
        
        let queueConfig = config.queueConfigs.find(x => x.name == queueName);
        
        if(!queueConfig){
            await interaction.reply({content: `No queue found by the name ${queueName}. Please check capitalization.`, ephemeral: true});
            return;
        }

        queueConfig.playerDiscordIds = [];

        await ConfigModel.replaceOne({_id: config._id}, config);

        await updateQueueEmbed(queueName,config);

        await interaction.reply({content: `The queue has been cleared.`});
    },
    setElo: async (interaction) => {
        if(!hasPermissionsToModerate(interaction)){
            await interaction.reply({content: `Sorry, you do not have moderator privileges to clear the queue.`, ephemeral: true});
            return;
        }
        const userDiscordId = interaction.options.data[0].value;

        if(!userDiscordId){
            await interaction.reply({content: "Something weird happened.", ephemeral: true});
            return;
        }

        const dbUser = await UserModel.findOne({discordId: userDiscordId});

        if(!dbUser){
            await interaction.reply({content: `User: ${user} does not have an account in our database yet.`, ephemeral: true});
            return;
        }

        dbUser.elo = interaction.options.data[1].value;

        await UserModel.replaceOne({_id: dbUser._id}, dbUser);

        const user = interaction.guild.members.cache.get(userDiscordId);

        await interaction.reply(`${user} has had their elo set to ${interaction.options.data[1].value}`)
    },
    removeUserFromQueue: async (interaction) => {
        if(!hasPermissionsToModerate(interaction)){
            await interaction.reply({content: `Sorry, you do not have moderator privileges to clear the queue.`, ephemeral: true});
            return;
        }

        const config = await getOrCreateServerConfig(interaction);

        if(config.queueConfigs.length == 0){
            await interaction.reply({content: `No queue has been set up yet.`, ephemeral: true});
            return;
        }

        let queueName = interaction.options.data[0].value;

        let queueConfig = config.queueConfigs.find(x => x.name == queueName);
        
        if(!queueConfig){
            await interaction.reply({content: `No queue found by the name ${queueName}. Please check capitalization.`, ephemeral: true});
            return;
        }

        const userDiscordId = interaction.options.data[1].value;
        const user = interaction.guild.members.cache.get(userDiscordId);

        if(!queueConfig.playerDiscordIds.includes(userDiscordId)){
            await interaction.reply({content: `User: ${user} was not found in the queue: ${queueName}`, ephemeral: true});
            return;
        }

        queueConfig.playerDiscordIds.splice(queueConfig.playerDiscordIds.indexOf(userDiscordId), 1);

        await ConfigModel.replaceOne({_id: config._id}, config);

        await updateQueueEmbed(queueName,config);

        await interaction.reply({content: `${user} has been removed from the queue: ${queueName}`, ephemeral: true});
    }
};