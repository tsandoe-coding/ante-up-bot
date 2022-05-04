const mongoose = require('../index');
const { mapSchema } = require('./common');

const { Schema } = mongoose;

const queueConfigSchema = new Schema({
    game: String,
    channelDiscordId: String,
    messageDiscordId: String,
    sortType: { type: Number, default: 1 }, //1 = captains pick, 2 = Elo Sorted
    playerDiscordIds: { type: [String], default: [] },
    capacity: Number,
    name: String,
    maps: { type: [mapSchema], default: [] }
});

const configSchema = new Schema({
    guildDiscordId: String,
    queueConfigs: { type: [queueConfigSchema], default: [] },
});

module.exports.ConfigModel = mongoose.model('Config', configSchema);
module.exports.queueConfigSchema = queueConfigSchema;