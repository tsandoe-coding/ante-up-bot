const { ConfigModel } = require('./database/models/config');
const UserModel = require('./database/models/user');
const MatchModel = require('./database/models/match');
const { MessageEmbed, MessageButton, MessageActionRow } = require('discord.js');
const discordBotSettings = require('./settings/discordBotSettings');
const { Permissions } = require('discord.js');
const EmbedService = require('./embeds');
const EloService = require('./elo');
const systemSettings = require('./settings/systemSettings');

const getOrCreateUser = async (interaction) => {
    let user = await UserModel.findOne({discordId: interaction.user.id});

    if(!user){
        //create the user
        user = new UserModel;
        user.discordId = interaction.user.id;
        await user.save();
    }

    return user;
}

//magic algorithm, i'm really not sure how this all works LOL
const generateELOSortedTeams = (userMap, userList, n, r) => {
        
    // Track the lowest difference team
    let minDiff = Number.MAX_VALUE;
    let teams = null;
    let num = 1;

    const combinationUtil = (arr, data, start, end, index, r) => {
        if (minDiff === 0) {
            return;
        }

        // Current combination is ready to be generate
        if (index === r) {
            const combo = {id: num++, team1: [], team1ELO: 0, team2: [], team2ELO: 0};

            for (let j = 0; j < arr.length; j++) {
                if (data.includes(j)) {
                    combo.team1.push(userMap.get(arr[j]));
                    combo.team1ELO += userMap.get(arr[j]).elo;
                } else {
                    combo.team2.push(userMap.get(arr[j]));
                    combo.team2ELO += userMap.get(arr[j]).elo;
                }
            }

            // Check if this is the lowest difference
            let diff = Math.abs(combo.team1ELO - combo.team2ELO);
            if (diff < minDiff) {
                minDiff = diff;
                teams = combo;
            }
            return;
        }

        // replace index with all possible elements. The condition
        // "end-i+1 >= r-index" makes sure that including one element
        // at index will make a combination with remaining elements
        // at remaining positions
        for (let i = start; i <= end && end - i + 1 >= r - index; i++) {
            data[index] = i;
            combinationUtil(arr, data, i + 1, end, index + 1, r);
        }
    }

    // A temporary array to store all combination one by one
    let data = [];

    // generate all combination using temprary array 'data[]'
    combinationUtil(userList.map(user => user.discordId), data, 0, n - 1, 0, r);

    return teams;
}

const getExtraComponents = async (match) => {
    const anteButton = new MessageButton()
    .setCustomId(`ante`)
    .setLabel(`Ante Up`)
    .setStyle(`SUCCESS`)
    
    return [
        anteButton
    ]
    
}

const getMatchComponents = async () => {
    //the goal is return a list of buttons
    const randMapButton = new MessageButton()
        .setCustomId(`random-map`)
        .setLabel('Map Vote')
        .setStyle('SECONDARY')
        .setEmoji('🌐');

    const team1VictoryButton = new MessageButton()
        .setCustomId(`team-1-victory`)
        .setLabel('Team 1 Win')
        .setStyle('PRIMARY')
        .setEmoji('1️⃣');
    
    const team2VictoryButton = new MessageButton()
        .setCustomId(`team-2-victory`)
        .setLabel('Team 2 Win')
        .setStyle('PRIMARY')
        .setEmoji('2️⃣'); 

    const cancelButton = new MessageButton()
        .setCustomId(`cancel`)
        .setLabel(`Cancel`)
        .setStyle('DANGER')

    const subMeButton = new MessageButton()
        .setCustomId(`substitute`)
        .setLabel(`Substitute`)
        .setStyle('SECONDARY')

    return [
        randMapButton,
        team1VictoryButton,
        team2VictoryButton,
        cancelButton,
        subMeButton,
    ]
}

const sendMatchInfo = async (channel, match) => {
    let message;

    if(match.messageDiscordId){
        //remove buttons from the previous embed
        message = channel.messages.cache.get(match.messageDiscordId);
        if(message){
            await message.edit({
                components: []
            });
        }
    }

    const buttonsRow = new MessageActionRow().addComponents(await getMatchComponents());
    const extraRow = new MessageActionRow().addComponents(await getExtraComponents());
    message = await channel.send({
        embeds: [
            await EmbedService.getMatchEmbed(match)
        ],
        components: [buttonsRow, extraRow]
    });

    match.messageDiscordId = message.id;
    match.messageChannelId = message.channel.id;
    await match.save();
}

const createEloSortedMatch = async (queueConfig) => {
    const match = new MatchModel();
    match.number = await MatchModel.countDocuments({}) + 1;
    match.queueConfigId = queueConfig._id;

    //setup the generate randomteams
    const userList = [];
    for(let i = 0;i < queueConfig.playerDiscordIds.length;i++){
        userList.push(await UserModel.findOne({discordId: queueConfig.playerDiscordIds[i]}));
    }
    
    const userMap = new Map();
    userList.forEach(user => userMap.set(user.discordId, user));

    //get the teams
    const teams = generateELOSortedTeams(userMap, userList, queueConfig.playerDiscordIds.length, queueConfig.playerDiscordIds.length / 2);
    //organize by elo to display top elo players first
    teams.team1.sort((a, b) => a.elo > b.elo ? -1 : 1);
    teams.team2.sort((a, b) => a.elo > b.elo ? -1 : 1);

    match.team1DiscordIds = teams.team1.map(x => x.discordId);
    match.team2DiscordIds = teams.team2.map(x => x.discordId);
    match.allPlayerDiscordIds = match.team1DiscordIds.concat(match.team2DiscordIds);
    match.randomizationIterations = teams.id;
    match.team1ELO = Math.floor(teams.team1ELO / (queueConfig.playerDiscordIds.length / 2));
    match.team2ELO = Math.floor(teams.team2ELO / (queueConfig.playerDiscordIds.length / 2));
    match.sortType = queueConfig.sortType;

    //set the map
    //maps are in the queueConfig
    match.map = queueConfig.maps[Math.floor(Math.random()*queueConfig.maps.length)];

    //create info text channel
    const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);
    const infoChannel = await guild.channels.create(`🏆-match-${match.number}`);

    match.infoChannelDiscordId = infoChannel.id;

    //set permissions on channels
    await infoChannel.setParent(discordBotSettings.matchesCategoryId);

    const infoPermissionOverwrites = [
        {
            id: discordBotSettings.everyoneRoleId,
            deny: [Permissions.FLAGS.SEND_MESSAGES]
        }
    ];

    for(let i = 0;i<match.allPlayerDiscordIds.length;i++){
        infoPermissionOverwrites.push({
            id: match.allPlayerDiscordIds[i],
            allow: [Permissions.FLAGS.SEND_MESSAGES]
        })
    }
    await infoChannel.edit({
        permissionOverwrites: infoPermissionOverwrites
    });

    await sendMatchInfo(infoChannel, match);

    //create voice channels
    const connectPermissions = [
        {
            id: discordBotSettings.everyoneRoleId,
            deny: [Permissions.FLAGS.CONNECT]
        },
        {
            id: discordBotSettings.spectatorRoleId,
            allow: [Permissions.FLAGS.CONNECT]
        }
    ];
    for(let i = 0;i<match.allPlayerDiscordIds.length;i++){
        connectPermissions.push({
            id: match.allPlayerDiscordIds[i],
            allow: [Permissions.FLAGS.CONNECT]
        })
    }

    const team1Voice = await guild.channels.create(`Match ${match.number} T1`, {
        type: 'GUILD_VOICE'
    });
    match.team1VoiceChannelDiscordId = team1Voice.id;

    await team1Voice.setParent(discordBotSettings.matchesCategoryId);

    await team1Voice.edit({
        permissionOverwrites: connectPermissions
    });

    const team2Voice = await guild.channels.create(`Match ${match.number} T2`, {
        type: 'GUILD_VOICE'
    });
    match.team2VoiceChannelDiscordId = team2Voice.id;

    await team2Voice.setParent(discordBotSettings.matchesCategoryId);

    await team2Voice.edit({
        permissionOverwrites: connectPermissions
    });

    //move users to channels
    for(let i = 0;i<match.team1DiscordIds.length;i++){
        const member = await guild.members.cache.get(match.team1DiscordIds[i]);
        if(member){
            if(member.voice.channel){
                await member.edit({
                    channel: team1Voice
                })
            }
        }
    }
    for(let i = 0;i<match.team2DiscordIds.length;i++){
        const member = await guild.members.cache.get(match.team2DiscordIds[i]);
        if(member){
            if(member.voice.channel){
                await member.edit({
                    channel: team2Voice
                })
            }
        }
    }

    await match.save();
}

const updateQueueEmbed = async (queueName, config = null) => {
    if(!config){
        config = await ConfigModel.findOne({}); //get first config
    }
    
    let queueConfig = config.queueConfigs.find(x => x.name == queueName);
    const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);

    try{
        const queueChannel = await guild.channels.fetch(queueConfig.channelDiscordId);
        const queueMessage = await queueChannel.messages.fetch(queueConfig.messageDiscordId);

        const playersInQueue = [];
        for(const id of queueConfig.playerDiscordIds){
            playersInQueue.push(await guild.members.fetch(id));
        }

        const queueEmbed = new MessageEmbed()
            .setColor("DARK_ORANGE")
            .setTitle(`${queueConfig.name}: ${queueConfig.playerDiscordIds.length}/${queueConfig.capacity}`)
            .setFooter({ text: `Powered by ${guild.name}`})
            .setDescription(playersInQueue.join('\n'))
            .setThumbnail(guild.iconURL());

        await queueMessage.edit({embeds: [
            queueEmbed
        ]});
    }
    catch(err) {
        console.log(err);
    }
};

const deleteVoiceChannels = async (match) => {
    const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);

    const voiceChannelDeletionIntervalId = setInterval(() => {

        const team1Voice = guild.channels.cache.get(match.team1VoiceChannelDiscordId);
        const team2Voice = guild.channels.cache.get(match.team2VoiceChannelDiscordId);

        let team1VoiceDeleted = false;
        let team2VoiceDeleted = false;

        if(team1Voice){
            if(team1Voice.members.size <= 0){
                team1Voice.delete().then(() => {
                    team1VoiceDeleted = true;
                }).catch(voiceDeleteErr => {
                    console.log(voiceDeleteErr)
                });
            }
        }
        else {
            team1VoiceDeleted = true;
        }

        if(team2Voice){
            if(team2Voice.members.size <= 0){
                team2Voice.delete().then(() => {
                    team2VoiceDeleted = true;
                }).catch(voiceDeleteErr => {
                    console.log(voiceDeleteErr)
                });
            }
        }
        else {
            team2VoiceDeleted = true;
        }

        if(team1VoiceDeleted && team2VoiceDeleted){
            clearInterval(voiceChannelDeletionIntervalId);
        }
    }, 10000);
}

const cancelMatch = async (match) => {
    const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);
    const matchLogsChannel = guild.channels.cache.get(discordBotSettings.matchLogsChannelId);
    
    await matchLogsChannel.send({
        embeds: [
            await EmbedService.getMatchLogCancelledEmbed(match)
        ]
    });

    const infoChannel = guild.channels.cache.get(match.infoChannelDiscordId);
    await infoChannel.delete();

    await deleteVoiceChannels(match);
}

const endMatch = async (match, winningTeamNumber) => {
    //distribute elo
    //post to match logs
    //delete info channel
    //create check to see if voice channels are empty and delete after that
    let team1EloMap = new Map();
    let team1AvgElo = 0;
    let team1Users = [];
    let team2EloMap = new Map();
    let team2AvgElo = 0;
    let team2Users = [];

    for(let i = 0;i<match.team1DiscordIds.length;i++){
        const user = await UserModel.findOne({discordId: match.team1DiscordIds[i]});
        if(!user){
            continue;
        }
        team1Users.push({...user._doc});
        team1EloMap.set(match.team1DiscordIds[i], user.elo);
        team1AvgElo += user.elo;
    }

    for(let i = 0;i<match.team2DiscordIds.length;i++){
        const user = await UserModel.findOne({discordId: match.team2DiscordIds[i]});
        if(!user){
            continue;
        }
        team2Users.push({...user._doc});
        team2EloMap.set(match.team2DiscordIds[i], user.elo);
        team2AvgElo += user.elo;
    }

    team1AvgElo = team1AvgElo / team1EloMap.size;
    team2AvgElo = team2AvgElo / team2EloMap.size;

    if(winningTeamNumber == 1){
        for(let i = 0;i<team1Users.length;i++){
            team1Users[i].elo = EloService.getNewRating(team1Users[i].elo, team2AvgElo, 1);

            //distribute coins if user anted up
            for(const anteCouple of match.anteCouples){
                if(anteCouple.antePlayerDiscordIds.includes(team1Users[i].discordId)){
                    if(anteCouple.antePlayerDiscordIds.length == 2){
                        team1Users[i].coins += systemSettings.defaultCoinAnteAmount;
                    }
                    break;
                }
            }

            //map win
            let needsMapRecord = true;
            for(const mapRecord of team1Users[i].mapRecords){
                if(mapRecord.name == match.map.name){
                    mapRecord.wins += 1;
                    needsMapRecord = false;
                    break;
                }
            }
            if(needsMapRecord){
                team1Users[i].mapRecords.push({
                    name: match.map.name,
                    wins: 1,
                    losses: 0
                })
            }
            
            await UserModel.replaceOne({discordId: team1Users[i].discordId}, team1Users[i]);
        }
        for(let i = 0;i<team2Users.length;i++){
            team2Users[i].elo = EloService.getNewRating(team2Users[i].elo, team1AvgElo, 0);

            //distribute coins if user anted up
            for(const anteCouple of match.anteCouples){
                if(anteCouple.antePlayerDiscordIds.includes(team1Users[i].discordId)){
                    if(anteCouple.antePlayerDiscordIds.length == 2){
                        team1Users[i].coins -= systemSettings.defaultCoinAnteAmount;
                        break;
                    }
                }
            }
            
            //map loss
            let needsMapRecord = true;
            for(const mapRecord of team2Users[i].mapRecords){
                if(mapRecord.name == match.map.name){
                    mapRecord.losses += 1;
                    needsMapRecord = false;
                    break;
                }
            }
            if(needsMapRecord){
                team2Users[i].mapRecords.push({
                    name: match.map.name,
                    wins: 0,
                    losses: 1
                })
            }

            await UserModel.replaceOne({discordId: team2Users[i].discordId}, team2Users[i]);
        }
    }
    else if(winningTeamNumber == 2){
        for(let i = 0;i<team1Users.length;i++){
            team1Users[i].elo = EloService.getNewRating(team1Users[i].elo, team2AvgElo, 0);

            //distribute coins if user anted up
            for(const anteCouple of match.anteCouples){
                if(anteCouple.antePlayerDiscordIds.includes(team1Users[i].discordId)){
                    if(anteCouple.antePlayerDiscordIds.length == 2){
                        team1Users[i].coins -= systemSettings.defaultCoinAnteAmount;
                        break;
                    }
                }
            }

            //map loss
            let needsMapRecord = true;
            for(const mapRecord of team1Users[i].mapRecords){
                if(mapRecord.name == match.map.name){
                    mapRecord.losses += 1;
                    needsMapRecord = false;
                    break;
                }
            }
            if(needsMapRecord){
                team1Users[i].mapRecords.push({
                    name: match.map.name,
                    wins: 0,
                    losses: 1
                })
            }

            await UserModel.replaceOne({discordId: team1Users[i].discordId}, team1Users[i]);
        }
        for(let i = 0;i<team2Users.length;i++){
            team2Users[i].elo = EloService.getNewRating(team2Users[i].elo, team1AvgElo, 1);

            //distribute coins if user anted up
            for(const anteCouple of match.anteCouples){
                if(anteCouple.antePlayerDiscordIds.includes(team1Users[i].discordId)){
                    if(anteCouple.antePlayerDiscordIds.length == 2){
                        team1Users[i].coins += systemSettings.defaultCoinAnteAmount;
                        break;
                    }
                }
            }

            //map win
            let needsMapRecord = true;
            for(const mapRecord of team2Users[i].mapRecords){
                if(mapRecord.name == match.map.name){
                    mapRecord.wins += 1;
                    needsMapRecord = false;
                    break;
                }
            }
            if(needsMapRecord){
                team2Users[i].mapRecords.push({
                    name: match.map.name,
                    wins: 1,
                    losses: 0
                })
            }
            
            await UserModel.replaceOne({discordId: team2Users[i].discordId}, team2Users[i]);
        }
    }

    //the elo maps contain the old elos
    //the users have been updated
    const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);
    const matchLogsChannel = guild.channels.cache.get(discordBotSettings.matchLogsChannelId);
    
    await matchLogsChannel.send({
        embeds: [
            await EmbedService.getMatchLogsEmbed(match, winningTeamNumber, team1Users, team1EloMap, team2Users, team2EloMap)
        ]
    });

    const infoChannel = guild.channels.cache.get(match.infoChannelDiscordId);
    await infoChannel.delete();

    await deleteVoiceChannels(match);
}

const createCaptainsPickMatch = async (queueConfig) => {
    const match = new MatchModel();
    match.number = await MatchModel.countDocuments({}) + 1;
    match.queueConfigId = queueConfig._id;

    //choose captains
    const userList = [];
    for(let i = 0;i < queueConfig.playerDiscordIds.length;i++){
        userList.push(await UserModel.findOne({discordId: queueConfig.playerDiscordIds[i]}));
    }
    userList.sort((a,b) => {
        if(a.elo > b.elo){
            return -1;
        }
        return 1;
    });
    match.captain1DiscordId = userList[0].discordId;
    match.captain2DiscordId = userList[1].discordId;
    match.activeCaptainDiscordId = match.captain1DiscordId;
    
    match.team1DiscordIds = [match.captain1DiscordId]
    match.team2DiscordIds = [match.captain2DiscordId]
    match.allPlayerDiscordIds = queueConfig.playerDiscordIds;
    match.poolDiscordIds = queueConfig.playerDiscordIds;
    match.poolDiscordIds.splice(match.poolDiscordIds.indexOf(match.captain1DiscordId), 1);
    match.poolDiscordIds.splice(match.poolDiscordIds.indexOf(match.captain2DiscordId), 1);

    match.team1ELO = userList[0].elo;
    match.team2ELO = userList[1].elo;
    match.sortType = queueConfig.sortType;

    //set the map
    //maps are in the queueConfig
    match.map = queueConfig.maps[Math.floor(Math.random()*queueConfig.maps.length)];

    //create info text channel
    const guild = await global.discordBot.guilds.fetch(discordBotSettings.primaryGuildId);
    const infoChannel = await guild.channels.create(`🏆-match-${match.number}`);

    match.infoChannelDiscordId = infoChannel.id;

    //set permissions on channels
    await infoChannel.setParent(discordBotSettings.matchesCategoryId);

    const infoPermissionOverwrites = [
        {
            id: discordBotSettings.everyoneRoleId,
            deny: [Permissions.FLAGS.SEND_MESSAGES]
        }
    ];

    for(let i = 0;i<match.allPlayerDiscordIds.length;i++){
        infoPermissionOverwrites.push({
            id: match.allPlayerDiscordIds[i],
            allow: [Permissions.FLAGS.SEND_MESSAGES]
        })
    }
    await infoChannel.edit({
        permissionOverwrites: infoPermissionOverwrites
    });

    await sendMatchInfo(infoChannel, match);

    //create voice channels
    const connectPermissions = [
        {
            id: discordBotSettings.everyoneRoleId,
            deny: [Permissions.FLAGS.CONNECT]
        },
        {
            id: discordBotSettings.spectatorRoleId,
            allow: [Permissions.FLAGS.CONNECT]
        }
    ];
    for(let i = 0;i<match.allPlayerDiscordIds.length;i++){
        connectPermissions.push({
            id: match.allPlayerDiscordIds[i],
            allow: [Permissions.FLAGS.CONNECT]
        })
    }

    const team1Voice = await guild.channels.create(`Match ${match.number} T1`, {
        type: 'GUILD_VOICE'
    });
    match.team1VoiceChannelDiscordId = team1Voice.id;

    await team1Voice.setParent(discordBotSettings.matchesCategoryId);

    await team1Voice.edit({
        permissionOverwrites: connectPermissions
    });

    const team2Voice = await guild.channels.create(`Match ${match.number} T2`, {
        type: 'GUILD_VOICE'
    });
    match.team2VoiceChannelDiscordId = team2Voice.id;

    await team2Voice.setParent(discordBotSettings.matchesCategoryId);

    await team2Voice.edit({
        permissionOverwrites: connectPermissions
    });

    await match.save();
}

module.exports = {
    cancelMatch: cancelMatch,
    endMatch: endMatch,
    sendMatchInfo: sendMatchInfo,
    getOrCreateUser: getOrCreateUser,

    getOrCreateServerConfig: async (interaction) => {
        let config = await ConfigModel.findOne({guildDiscordId: interaction.guildId});
    
        if(!config){
            //create the user
            config = new ConfigModel;
            config.guildDiscordId = interaction.guildId;
            await config.save();
        }
    
        return config;
    },
    addToQueue: async (queueName, dbUser, config = null, interaction = null) => {
        if(!config){
            config = await ConfigModel.findOne({}); //get first config
        }

        let queueConfig = config.queueConfigs.find(x => x.name == queueName);

        queueConfig.playerDiscordIds.push(dbUser.discordId);

        if(queueConfig.playerDiscordIds.length >= queueConfig.capacity){
            //match generation

            //get a copy of  the queue to make a match from
            const queueCopy = {...queueConfig._doc};

            queueConfig.playerDiscordIds = [];
            
            //remove users from all other queues they are in
            let queueNamesToUpdate = []; //keep track of which queue embeds to update

            for(const playerDiscordId of queueCopy.playerDiscordIds){
                for(const q of config.queueConfigs){
                    //if this queue hasn't already been tagged
                    while(q.playerDiscordIds.includes(playerDiscordId)){
                        q.playerDiscordIds.splice(q.playerDiscordIds.indexOf(playerDiscordId), 1);

                        //tag the queue as needed to update
                        if(!queueNamesToUpdate.includes(q.name)){
                            queueNamesToUpdate.push(q.name);
                        }
                    }
                }
            }

            await ConfigModel.replaceOne({_id: config._id}, config);

            //refresh the queue displays
            for(const qName in queueNamesToUpdate){ 
                await updateQueueEmbed(qName);
            }

            if(queueConfig.sortType == 1){
                await createCaptainsPickMatch(queueCopy);
            }
            else if(queueConfig.sortType == 2){
                await createEloSortedMatch(queueCopy);
            }

            await interaction.deleteReply();
        }
        else{
            await ConfigModel.replaceOne({_id: config._id}, config);

            await updateQueueEmbed(queueName);
        }

    },
    updateQueueEmbed: updateQueueEmbed,
    getMatchComponents: getMatchComponents
}