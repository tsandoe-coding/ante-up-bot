const { IntegrationApplication } = require('discord.js');
const { ConfigModel } = require('./database/models/config');
const MatchModel = require('./database/models/match');
const UserModel = require('./database/models/user');
const systemSettings = require('./settings/systemSettings');

const { getOrCreateServerConfig, getOrCreateUser, addToQueue, updateQueueEmbed, sendMatchInfo, endMatch, cancelMatch } = require('./utility');

module.exports = {
    handleButtons: async (interaction) => {

        if(interaction.customId == 'join-queue'){
            const config = await getOrCreateServerConfig(interaction);

            let queueConfig = config.queueConfigs.find(x => x.messageDiscordId == interaction.message.id);

            try{
                // if(queueConfig.playerDiscordIds.includes(interaction.user.id)){
                //     await interaction.reply({content: "You are already in the queue.", ephemeral: true});
                //     return;
                // }

                const dbUser = await getOrCreateUser(interaction);
                
                await addToQueue(queueConfig.name, dbUser, config, interaction);
            }
            catch(err){
                await interaction.reply(`Error: ${err}`);
            }
        }
        else if(interaction.customId == 'leave-queue'){
            const config = await getOrCreateServerConfig(interaction);
            let queueConfig = config.queueConfigs.find(x => x.messageDiscordId == interaction.message.id);

            try{
                if(!queueConfig.playerDiscordIds.includes(interaction.user.id)){
                    await interaction.reply({content: "You are not in the queue.", ephemeral: true});
                    return;
                }

                //remove from queue
                queueConfig.playerDiscordIds.splice(queueConfig.playerDiscordIds.findIndex((id) => {
                    return id == interaction.user.id
                }), 1);

                await ConfigModel.replaceOne({_id: config._id}, config);

                await updateQueueEmbed(queueConfig.name, config);

                await interaction.reply({content: `You have left the queue.`, ephemeral: true});
            }
            catch(err){
                await interaction.reply(`Error: ${err}`);
            }
        }
        else if(interaction.customId == 'random-map'){
            const match = await MatchModel.findOne({messageDiscordId: interaction.message.id});
            if(!match){
                await interaction.reply({content: 'A match was not found in this channel.', ephemeral: true});
                return;
            }
            
            if(!match.allPlayerDiscordIds.includes(interaction.user.id)){
                await interaction.reply({content: "Sorry, you are not in this match.", ephemeral: true});
                return;
            }
  
            if(match.mapVotes.includes(interaction.user.id)){
                await interaction.reply({content: "You have already voted for a map change.", ephemeral: true});
                return;
            }

            match.mapVotes.push(interaction.user.id);
            await MatchModel.replaceOne({_id: match._id}, match);

            if(match.mapVotes.length >= match.allPlayerDiscordIds.length / 2){
                //change the map
                const config = await ConfigModel.findOne({guildDiscordId: interaction.guild.id});
                if(!config){
                    await interaction.reply({content: "Server config was not found..."});
                    return;
                }

                const queueConfig = config.queueConfigs.find(x => x._id == match.queueConfigId);
            
                let newMap = queueConfig.maps[Math.floor(Math.random()*queueConfig.maps.length)];
                while(newMap.name == match.map.name){
                    newMap = queueConfig.maps[Math.floor(Math.random()*queueConfig.maps.length)];
                }
                match.map = newMap;
                match.mapVotes = [];
                await MatchModel.replaceOne({_id: match._id}, match);

                await sendMatchInfo(interaction.channel, match);
                await interaction.reply(`The map has been vote changed to ${match.map.name}!`);
                return;
            }
            await interaction.reply(`${interaction.user} has voted to change the map! ${match.mapVotes.length} / ${match.allPlayerDiscordIds.length / 2} needed to trigger a random map change.`);
        }
        else if(interaction.customId == 'team-1-victory' || interaction.customId == 'team-2-victory'){
            const match = await MatchModel.findOne({messageDiscordId: interaction.message.id});
            if(!match){
                await interaction.reply({content: 'A match was not found in this channel.', ephemeral: true});
                return;
            }
            
            if(!match.allPlayerDiscordIds.includes(interaction.user.id)){
                await interaction.reply({content: "Sorry, you are not in this match.", ephemeral: true});
                return;
            }

            if(interaction.customId == 'team-1-victory'){
                if(match.team1WinVoteDiscordIds.includes(interaction.user.id)){
                    await interaction.reply({content: "You have already voted for team 1 winning the match.", ephemeral: true});
                    return;
                }
                match.team1WinVoteDiscordIds.push(interaction.user.id);
                if(match.team1WinVoteDiscordIds.length >= (match.allPlayerDiscordIds.length / 2) + 1){
                    await endMatch(match, 1);

                    return;
                }
                await MatchModel.replaceOne({_id: match._id}, match);
                await interaction.reply({content: `${interaction.user} has voted for team 1 winning this match. ${match.team1WinVoteDiscordIds.length} / ${(match.allPlayerDiscordIds.length / 2) + 1}`});
            }
            else if(interaction.customId == 'team-2-victory'){
                if(match.team2WinVoteDiscordIds.includes(interaction.user.id)){
                    await interaction.reply({content: "You have already voted for team 2 winning the match.", ephemeral: true});
                    return;
                }

                match.team2WinVoteDiscordIds.push(interaction.user.id);
                if(match.team2WinVoteDiscordIds.length >= (match.allPlayerDiscordIds.length / 2) + 1){
                    //team 2 win
                    await endMatch(match, 2);
                    return;
                }
                await MatchModel.replaceOne({_id: match._id}, match);
                await interaction.reply({content: `${interaction.user} has voted for team 2 winning this match. ${match.team2WinVoteDiscordIds.length} / ${(match.allPlayerDiscordIds.length / 2) + 1}`});
            }
        }
        else if(interaction.customId == 'cancel'){
            const match = await MatchModel.findOne({messageDiscordId: interaction.message.id});
            if(!match){
                await interaction.reply({content: 'A match was not found in this channel.', ephemeral: true});
                return;
            }
            
            if(!match.allPlayerDiscordIds.includes(interaction.user.id)){
                await interaction.reply({content: "Sorry, you are not in this match.", ephemeral: true});
                return;
            }
            
            if(match.cancelVoteDiscordIds.includes(interaction.user.id)){
                await interaction.reply({content: "You have already voted to cancel this match.", ephemeral: true});
                return;
            }

            match.cancelVoteDiscordIds.push(interaction.user.id);

            await MatchModel.replaceOne({_id: match._id}, match);

            if(match.cancelVoteDiscordIds.length >= (match.allPlayerDiscordIds.length / 2) + 1){
                await cancelMatch(match);
            }
            else{
                await interaction.reply(`${interaction.user} has voted to cancel the match. ${match.cancelVoteDiscordIds.length} / ${(match.allPlayerDiscordIds.length / 2) + 1}`);
            }
        }
        else if(interaction.customId == 'substitute'){
            const match = await MatchModel.findOne({messageDiscordId: interaction.message.id});
            let inMatch = false;

            if(!match){
                await interaction.reply({content: 'A match was not found in this channel.', ephemeral: true});
                return;
            }
            
            if(match.allPlayerDiscordIds.includes(interaction.user.id)){
                inMatch = true;
            }

            if(inMatch){
                //sub me out daddy
                if(match.substitutePlayerDiscordIds.includes(interaction.user.id)){
                    await interaction.reply({content: "You are already looking for a sub.", ephemeral: true});
                    return;
                }

                match.substitutePlayerDiscordIds.push(interaction.user.id);

                await MatchModel.replaceOne({_id: match._id}, match);

                await interaction.reply(`${interaction.user} is looking to be replaced in this match by a substitute.`);
            }
            else{
                //sub into match
                if(match.substitutePlayerDiscordIds.length <= 0){
                    await interaction.reply({content: `There are no players looking for substitutes at this time.`, ephemeral: true});
                    return;
                }

                //find the team that the player is on
                if(match.team1DiscordIds.includes(match.substitutePlayerDiscordIds[0])){
                    //team 1 sub
                    match.team1DiscordIds.splice(match.team1DiscordIds.indexOf(match.substitutePlayerDiscordIds[0]), 1);
                    match.team1DiscordIds.push(interaction.user.id);
                }
                else if(match.team2DiscordIds.includes(match.substitutePlayerDiscordIds[0])){
                    //team 2 sub
                    match.team2DiscordIds.splice(match.team2DiscordIds.indexOf(match.substitutePlayerDiscordIds[0]), 1);
                    match.team2DiscordIds.push(interaction.user.id);
                }

                match.substitutePlayerDiscordIds.splice(0, 1);
                match.allPlayerDiscordIds.push(interaction.user.id);

                await MatchModel.replaceOne({_id: match._id}, match);

                await sendMatchInfo(interaction.channel, match);
            }
        }
        else if(interaction.customId == 'ante'){
            const match = await MatchModel.findOne({messageDiscordId: interaction.message.id});

            if(!match){
                await interaction.reply({content: 'A match was not found in this channel.', ephemeral: true});
                return;
            }

            if(!match.allPlayerDiscordIds.includes(interaction.user.id)){
                await interaction.reply({content: "Sorry, you are not in this match.", ephemeral: true});
                return;
            }

            //check if a user has enough coins to ante
            const dbUser = await UserModel.findOne({discordId: interaction.user.id});
            if(!dbUser){
                await interaction.reply({content: "Something weird happened.", ephemeral: true});
                return;
            }
            if(dbUser.coins < systemSettings.defaultCoinAnteAmount){
                await interaction.reply({content: `You need at least ${systemSettings.defaultCoinAnteAmount} coins to participate with an ante.`, ephemeral: true});
                return;
            }
            
            //check if they already anted
            for(const anteCouple of match.anteCouples){
                for(const discordId of anteCouple.antePlayerDiscordIds){
                    if(discordId == interaction.user.id){
                        await interaction.reply({content: `You have already supplied an ante for this match.`, ephemeral: true});
                        return;
                    }
                }
            }

            //check if there's an available ante to fill
            for(const anteCouple of match.anteCouples){
                if(anteCouple.antePlayerDiscordIds.length == 1){ 
                    //check if the player is on the opposite team
                    let oppositeTeam = false;
                    if(match.team1DiscordIds.includes(interaction.user.id) && match.team2DiscordIds.includes(anteCouple.antePlayerDiscordIds[0])){
                        oppositeTeam = true;
                    }
                    else if(match.team2DiscordIds.includes(interaction.user.id) && match.team1DiscordIds.includes(anteCouple.antePlayerDiscordIds[0])){
                        oppositeTeam = true;
                    }

                    if(oppositeTeam){
                        anteCouple.antePlayerDiscordIds.push(interaction.user.id);
                    
                        await MatchModel.replaceOne({_id: match._id}, match);
    
                        await interaction.reply(`${interaction.guild.members.cache.get(interaction.user.id)} has anted up with ${interaction.guild.members.cache.get(anteCouple.antePlayerDiscordIds[0])}`);
                        return;
                    }
                }
            }

            //make a new ante
            match.anteCouples.push({
                antePlayerDiscordIds: [interaction.user.id]
            });

            await MatchModel.replaceOne({_id: match._id}, match);

            await interaction.reply(`${interaction.guild.members.cache.get(interaction.user.id)} is looking to ante up with an opposing player...`);
        }
    } 
}