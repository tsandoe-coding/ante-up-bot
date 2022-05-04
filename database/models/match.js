const mongoose = require('../index');
const { mapSchema, anteCoupleSchema } = require('./common');

const { Schema } = mongoose;

const matchSchema = new Schema({
    number: Number,
    messageDiscordId: String,
    infoChannelDiscordId: String,
    substitutePlayerDiscordIds: [String],
    mapVotes: { type: [String], default: [] },
    team1DiscordIds: { type: [String], default: []},
    team1WinVoteDiscordIds: { type: [String], default: [] },
    team2WinVoteDiscordIds: { type: [String], default: [] },
    team1ELO: Number,
    team2DiscordIds: { type: [String], default: []},
    team2ELO: Number,
    queueConfigId: String,
    allPlayerDiscordIds: { type: [String], default: []},
    poolDiscordIds: { type: [String], default: [] },
    sortType: { type: Number, default: 1 }, //1 = captains pick, 2 = Elo Sorted
    captain1DiscordId: String,
    captain2DiscordId: String,
    winners: { type: Number, default: 0 }, //-1 = cancelled, 0 = unreported, 1 = team 1 victory, 2 = team 2 victory
    activeCaptainDiscordId: String,
    map: mapSchema,
    team1VoiceChannelDiscordId: String,
    team2VoiceChannelDiscordId: String,
    infoChannelDiscordId: String,
    randomizationIterations: { type: Number, default: 0 },
    cancelVoteDiscordIds: { type: [String], default: [] },
    anteCouples: { type: [anteCoupleSchema], default: [] }
});

module.exports = mongoose.model('Match', matchSchema);
