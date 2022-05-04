const { MessageEmbed } = require('discord.js');
const { ConfigModel } = require('./database/models/config');
const discordBotSettings = require('./settings/discordBotSettings');

module.exports = {
    getMatchEmbed: async (match) => {
        const embed= new MessageEmbed();

        embed.setTitle(`Match #${ match.number }`);

        const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);

        const config = await ConfigModel.findOne({guildDiscordId: discordBotSettings.primaryGuildId});

        let description = ``;

        if(config){
            for(const qConfig of config.queueConfigs){
                if(qConfig._id == match.queueConfigId){
                    description += `This match was generated from the ${qConfig.name} queue.\n\n`;
                    break;
                }
            }
        }

        description += `Map: ${match.map.name}\n\n`;

        if(match.sortType == 2){
            //elo
            description += `It took ${match.randomizationIterations} tries to find these teams.`;
        }
        else if(match.sortType == 1){
            //captains pick
            description += `${guild.members.cache.get(match.activeCaptainDiscordId)} is choosing from this pool. Use /pick to choose a player.\n\n`;

            description += `${match.poolDiscordIds.map(p => guild.members.cache.get(p)).join(" ")}\n\n`
        }

        let team1= '';
        for(let i = 0;i<match.team1DiscordIds.length;i++){
            const member = guild.members.cache.get(match.team1DiscordIds[i]);
            if (member) {
                team1 += (`${ member }\n`);
            }
        }

        let team2 = '';
        for(let i = 0;i<match.team2DiscordIds.length;i++){
            const member = guild.members.cache.get(match.team2DiscordIds[i]);
            if (member) {
                team2 += (`${ member }\n`);
            }
        }

        const mmrDifference = Math.abs(match.team1ELO - match.team2ELO);
        let team1Percentage = 0;
        let team2Percentage = 0;
        if (match.team1ELO == match.team2ELO) {
            team1Percentage = 50;
            team2Percentage = 50;
        }
        else if (match.team1ELO > match.team2ELO) {
            team1Percentage = 50 + ((mmrDifference / 1500) * 100);
            team2Percentage = 100 - team1Percentage;
        }
        else if (match.team2ELO > match.team1ELO) {
            team2Percentage = 50 + ((mmrDifference / 1500) * 100);
            team1Percentage = 100 - team2Percentage;
        }

        embed.addField(`Team 1 - ${team1Percentage.toFixed(2)}%`, team1, true);
        embed.addField(`Team 2 - ${team2Percentage.toFixed(2)}%`, team2, true);
        embed.setThumbnail(match.map.imageURL);
        embed.setDescription(description);
        embed.setFooter({
            text: `Powered by ${guild.name}`, 
            iconURL: guild.iconURL()
        });

        return embed;
    },
    getMatchLogCancelledEmbed: async (match) => {
        const embed= new MessageEmbed();
        const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);
        
        embed.setTitle(`Match Log #${ match.number }`);

        let description = `Players who anted this match: `;
        for(const anteCouple of match.anteCouples){
            for(const discordId of anteCouple.antePlayerDiscordIds){
                description += `${guild.members.cache.get(discordId)} `;
            }
        }

        let team1= '';

        for(let i = 0;i<match.team1DiscordIds.length;i++){
            const member = guild.members.cache.get(match.team1DiscordIds[i]);
            if (member) {
                team1 += (`${ member } +-0\n`);
            }
        }

        let team2= '';
        for(let i = 0;i<match.team2DiscordIds.length;i++){
            const member = guild.members.cache.get(match.team2DiscordIds[i]);
            if (member) {
                team2 += (`${ member } +-0\n`);
            }
        }

        const mmrDifference = Math.abs(match.team1ELO - match.team2ELO);
        let team1Percentage = 0;
        let team2Percentage = 0;
        if (match.team1ELO == match.team2ELO) {
            team1Percentage = 50;
            team2Percentage = 50;
        }
        else if (match.team1ELO > match.team2ELO) {
            team1Percentage = 50 + ((mmrDifference / 1500) * 100);
            team2Percentage = 100 - team1Percentage;
        }
        else if (match.team2ELO > match.team1ELO) {
            team2Percentage = 50 + ((mmrDifference / 1500) * 100);
            team1Percentage = 100 - team2Percentage;
        }

        embed.setDescription(description);

        embed.addField(`Team 1 - ${team1Percentage.toFixed(2)}%`, team1, true);
        embed.addField(`Team 2 - ${team2Percentage.toFixed(2)}%`, team2, true);
        embed.setThumbnail(match.map.imageURL);
        
        embed.setFooter({
            text: `Match cancelled!`,
            iconURL: guild.iconURL()
        })

        return embed;
    },
    getMatchLogsEmbed: async (match, winningTeamNumber, team1Users, team1EloMap, team2Users, team2EloMap) => {
        const embed= new MessageEmbed();

        embed.setTitle(`Match Log #${ match.number }`);

        let team1= '';

        const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);
        
        for(let i = 0;i<match.team1DiscordIds.length;i++){
            const member = guild.members.cache.get(match.team1DiscordIds[i]);
            if (member) {
                let oldElo = team1EloMap.get(member.id);
                let newElo = team1Users.find(x => x.discordId == member.id).elo;
                if(newElo > oldElo){
                    team1 += (`${ member } +${newElo - oldElo} elo\n`);
                }
                else if(oldElo > newElo){
                    team1 += (`${ member } -${newElo - oldElo} elo\n`);
                }
                else{
                    team1 += (`${ member } +-0 elo\n`);
                }
            }
        }

        let team2= '';
        for(let i = 0;i<match.team2DiscordIds.length;i++){
            const member = guild.members.cache.get(match.team2DiscordIds[i]);
            if (member) {
                let oldElo = team2EloMap.get(member.id);
                let newElo = team2Users.find(x => x.discordId == member.id).elo;
                if(newElo > oldElo){
                    team2 += (`${ member } +${newElo - oldElo} elo\n`);
                }
                else if(oldElo > newElo){
                    team2 += (`${ member } -${newElo - oldElo} elo\n`);
                }
                else{
                    team2 += (`${ member } +-0 elo\n`);
                }
            }
        }

        const mmrDifference = Math.abs(match.team1ELO - match.team2ELO);
        let team1Percentage = 0;
        let team2Percentage = 0;
        if (match.team1ELO == match.team2ELO) {
            team1Percentage = 50;
            team2Percentage = 50;
        }
        else if (match.team1ELO > match.team2ELO) {
            team1Percentage = 50 + ((mmrDifference / 1500) * 100);
            team2Percentage = 100 - team1Percentage;
        }
        else if (match.team2ELO > match.team1ELO) {
            team2Percentage = 50 + ((mmrDifference / 1500) * 100);
            team1Percentage = 100 - team2Percentage;
        }

        embed.addField(`Team 1 - ${team1Percentage.toFixed(2)}%`, team1, true);
        embed.addField(`Team 2 - ${team2Percentage.toFixed(2)}%`, team2, true);
        embed.setThumbnail(match.map.imageURL);

        embed.setFooter({
            text: `Team ${winningTeamNumber} won!`,
            iconURL: guild.iconURL()
        })

        return embed;
    },
    getProfileEmbed: async (user, dbUser) => {
        const embed= new MessageEmbed();

        let description = `Coins: ${dbUser.coins}\n`
        description += `Elo: ${dbUser.elo}\n\n`;

        let totalWins = 0;
        let totalLosses = 0;
        for(const mapRecord of dbUser.mapRecords){
            totalWins += mapRecord.wins;
            totalLosses += mapRecord.losses;

            embed.addField(mapRecord.name, `W: ${mapRecord.wins} L: ${mapRecord.losses}`, true);
        }

        description += `Total Wins: ${totalWins}\n`;
        description += `Total Losses: ${totalLosses}\n`;

        embed.setDescription(description);

        if(user.avatarURL()){
            embed.setImage(`${user.avatarURL()}`);
        }
        else{
            embed.setImage(`${user.user.avatarURL()}`);
        }
        embed.setFooter({
            text: `${user.user.username}'s Profile`
        })

        return embed;
    }
}