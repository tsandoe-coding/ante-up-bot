const mongoose = require('../index');

const { Schema } = mongoose;

const mapSchema = new Schema({
    game: String,
    name: String,
    imageURL: String
});

const anteCoupleSchema = new Schema({
    antePlayerDiscordIds: {type: [String], default: [] }
})

module.exports = {
    anteCoupleSchema,
    mapSchema
}