const { ConfigModel } = require('../database/models/config');
const { MessageEmbed, MessageButton, MessageActionRow } = require('discord.js');
const { getOrCreateServerConfig, addToQueue, updateQueueEmbed } = require('../utility');
const UserModel = require('../database/models/user');

const hasPermissionsToSetup = async (interaction) => {
    return interaction.user.id == '120253805538312195';
}

module.exports = {
    setupQueue: async (interaction) => {
        if(!hasPermissionsToSetup(interaction)){
            await interaction.reply("Only Derd#1385 may use this command.");
            return;
        }

        try{
            const config = await getOrCreateServerConfig(interaction);
            //check if a queue exists by the same name already
            const queueConfig = {};
            queueConfig.name = interaction.options.data[1].value;
            if(config.queueConfigs.map(x => x.name).includes(queueConfig.name)){
                await interaction.reply({content: `There exists a queue in the database under the name ${queueConfig.name} already... please delete this queue before adding it again.`});
                return;
            }

            queueConfig.capacity = interaction.options.data[0].value;
            queueConfig.game = interaction.options.data[2].value;
            let sortModeStr = interaction.options.data[3].value;
            queueConfig.channelDiscordId = interaction.channelId;
            
            if(sortModeStr.toLowerCase() != 'elo' && sortModeStr.toLowerCase() != 'captains'){
                await interaction.reply({content: 'Please provide either elo or captains for the team sort mode.', ephemeral: true});
                return;
            }
            else{
                if(sortModeStr == 'captains'){
                    queueConfig.sortType = 1;
                }
                else if(sortModeStr == 'elo'){
                    queueConfig.sortType = 2;
                }
            }
            
            const replyEmbed = new MessageEmbed()
                .setColor("DARK_ORANGE")
                .setTitle(`${queueConfig.name}: 0/${queueConfig.capacity}`)
                .setFooter({ text: `Powered by ${interaction.guild.name}`})
                .setDescription(`**No players currently queued.**`)
                .setThumbnail(interaction.guild.iconURL())
                
            const reply = await interaction.channel.send({
                embeds: [replyEmbed],
                components: [
                    new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setCustomId('join-queue')
                                .setEmoji('✅')
                                .setLabel('Join Queue')
                                .setStyle('PRIMARY'),
                            
                            new MessageButton()
                                .setCustomId('leave-queue')
                                .setEmoji('❌')
                                .setLabel('Leave Queue')
                                .setStyle('SECONDARY')
                        )
                ]
            })
    
            queueConfig.messageDiscordId = reply.id;
    
            config.queueConfigs.push(queueConfig);
    
            await ConfigModel.replaceOne({guildDiscordId: config.guildDiscordId}, config);
            
            await interaction.reply({content: `The queue needs some maps now!`, ephemeral: true });
        }
        catch(err){
            await interaction.reply({content: `Error setting up queue: ${err}`, ephemeral: true })
        }
    },
    addMap: async (interaction) => {
        if(!hasPermissionsToSetup(interaction)){
            await interaction.reply("Only Derd#1385 may use this command.");
            return;
        }

        try{
            const config = await getOrCreateServerConfig(interaction);

            if(config.queueConfigs.length == 0){
                await interaction.reply("Use setup-queue first...");
                return;
            }
    
            const map = {};
            let queueName = interaction.options.data[0].value;

            map.name = interaction.options.data[1].value;
            map.game = interaction.options.data[2].value;
            map.imageURL = interaction.options.data[3].value;
            
            let queueConfig = config.queueConfigs.find(x => x.name == queueName);
            queueConfig.maps.push(map);

            await ConfigModel.replaceOne({_id: config._id}, config);
    
            await interaction.reply({ content: `${map.name} has been added. You may verify this with the see-maps command.`, ephemeral: true });
        }
        catch(err){
            await interaction.reply({content: `Error adding map: ${err}`, ephemeral: true });
        }
    },
    simulate: async (interaction) => {
        if(!hasPermissionsToSetup(interaction)){
            await interaction.reply("Only Derd#1385 may use this command.");
            return;
        }

        try{
            const config = await getOrCreateServerConfig(interaction);

            if(config.queueConfigs.length == 0){
                await interaction.reply("Use setup-queue first...");
                return;
            }

            let queueName = interaction.options.data[0].value;

            const numberOfUsers = interaction.options.data[1].value;
            const guild = await global.discordBot.guilds.fetch(interaction.guildId);
            
            for(let i = 0;i<numberOfUsers;i++){
                //get a random user
                const randomUser = await guild.members.cache.random();
    
                let dbUser = await UserModel.findOne({discordId: randomUser.id});
    
                if(!dbUser){
                    //create the user
                    dbUser = new UserModel;
                    dbUser.discordId = randomUser.id;
                    await dbUser.save();
                }

                await addToQueue(queueName, dbUser, config);
            }
    
            await updateQueueEmbed(queueName);
    
            await interaction.reply({ content: `${numberOfUsers} users have been added to the queue.`, ephemeral: true });
        }
        catch(err) {
            await interaction.reply({content: `Error simulating: ${err}`, ephemeral: true });
        }
    },
    seeMaps: async (interaction) => {
        try{
            const config = await getOrCreateServerConfig(interaction);
            let queueName = interaction.options.data[0].value;

            if(config.queueConfigs.length === 0){
                await interaction.reply({content: `Sorry, there are no queues set up yet. Cannot see maps.`, ephemeral: true });
                return;
            }

            let queueConfig = config.queueConfigs.find(x => x.name == queueName);
            
            await interaction.reply({content: `Maps in the pool: ${queueConfig.maps.map((m) => m.name).join(', ')}`, ephemeral: true});
        }
        catch(e){
            await interaction.reply({content: `Error: ${e}`, ephemeral: true});
        }
    }
}