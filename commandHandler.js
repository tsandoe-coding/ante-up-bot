const general = require('./commands/general');
const moderation = require('./commands/moderation');
const setup = require('./commands/setup');

module.exports = {
    handleCommands: async (interaction) => {
        if (interaction.commandName === 'ping') {
            await general.ping(interaction);
        }
        else if(interaction.commandName == 'setup-queue'){
            await setup.setupQueue(interaction);
        }
        else if(interaction.commandName == 'add-map'){
            await setup.addMap(interaction);
        }
        else if(interaction.commandName == 'simulate'){
            await setup.simulate(interaction);
        }
        else if(interaction.commandName == 'see-maps'){
            await setup.seeMaps(interaction);
        }
        else if(interaction.commandName == 'clear-queue'){
            await moderation.clearQueue(interaction);
        }
        else if(interaction.commandName == 'see-match'){
            await general.seeMatch(interaction);
        }
        else if(interaction.commandName == 'set-elo'){
            await moderation.setElo(interaction);
        }
        else if(interaction.commandName == 'remove-from-queue'){
            await moderation.removeUserFromQueue(interaction);
        }
        else if(interaction.commandName == 'profile'){
            await general.seeProfile(interaction);
        }
        else if(interaction.commandName == 'leaderboard'){
            await general.seeLeaderboard(interaction);
        }
    }
}