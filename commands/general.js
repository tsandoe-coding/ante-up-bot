const { sendMatchInfo } = require('../utility');
const MatchModel = require('../database/models/match');
const UserModel = require('../database/models/user');
const EmbedService = require('../embeds');

module.exports = {
    ping: async (interaction) => {
        await interaction.reply('Pong!');
    },
    seeMatch: async (interaction) => {
        //check if is match channel
        const matchNumber = await interaction.channel.name.substring(9);

        if(!matchNumber || matchNumber <= 0){
            await interaction.reply({content: 'This is not a valid match channel to use this command.', ephemeral: true});
            return;
        }

        const match = await MatchModel.findOne({number: matchNumber});

        if(!match){
            await interaction.reply({content: 'Something weird happened...sorry.', ephemeral: true});
            return;
        }

        await sendMatchInfo(interaction.channel, match);
    },
    seeProfile: async (interaction) => {
        let user;
        if(interaction.options.data[0]){
            user = interaction.guild.members.cache.get(interaction.options.data[0].value);
        }
        else {
            user = interaction.guild.members.cache.get(interaction.user.id);
        }

        const dbUser = await UserModel.findOne({discordId: user.id});

        if(!dbUser){
            await interaction.reply({content: `${user} does not have a profile set up in our system yet.`, ephemeral: true});
            return;
        }

        await interaction.reply({embeds: [
            await EmbedService.getProfileEmbed(user, dbUser)
        ]})
    },
    seeLeaderboard: async (interaction) => {
        await interaction.reply({
            embeds: [
                await EmbedService.getLeaderboardEmbed()
            ]
        })
    }
}