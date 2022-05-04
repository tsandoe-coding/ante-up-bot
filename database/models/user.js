const mongoose = require('../index');

const { Schema } = mongoose;

const mapRecord = new Schema({
    name: String,
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
});

const userSchema = new Schema({
    discordId: String,
    elo: { type: Number, default: 1500 },
    mapRecords: { type: [mapRecord], default: [] },
    coins: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
