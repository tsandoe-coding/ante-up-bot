const mongoose = require('mongoose');
const databaseSettings = require('../settings/databaseSettings');

const connect = async () => {
    await mongoose.connect(databaseSettings.dbConnectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
}

connect()
    .then(() => {
        console.log("Connected to mongo database (cloud) via mongoose.")
    })
    .catch(err => {
        console.log(`Error connecting to database`, err)
    });
    
module.exports = mongoose;