

const dbName = 'course-1-derds-server';
const dbUser = 'course1';

module.exports = {
    dbConnectionString: `mongodb+srv://${dbUser}:${process.env.DB_PASSWORD}@cluster0.rf1eo.mongodb.net/${dbName}?retryWrites=true&w=majority`
}