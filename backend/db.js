
const config = require('./config.js')
const db = config.database
const mysql = require('mysql');

const connection = mysql.createConnection(db);

connection.connect((err) => {
    if(err){
        console.log('Error connecting to DB');
        return;
    }
    console.log('Connection established');
});

module.exports = {
	getEventTrackingFromDB(eventId) {
	    return new Promise((resolve, reject) => {
		    connection.query('SELECT * FROM freetickets WHERE eventId = ? ORDER BY date ASC', [eventId], (err, res) => {
                if(err) {
            	    reject(err)
                }
                resolve(res)
            });
	    })
    },
    insertDataToDB(freeTickets, eventId, date) {
	    connection.query('CREATE TABLE IF NOT EXISTS freetickets ( eventId VARCHAR(20) NOT NULL, freetickets INT, date DATETIME NOT NULL, PRIMARY KEY(eventId, date))', (err, res) => {
            if(err) throw err;

            connection.query("INSERT INTO freetickets (eventId, freetickets, date) VALUES (?, ?, ?)", [eventId, freeTickets, date], (err, res) => {
                if(err) throw err;
            });
        });
    },
    getPastEventIds() {
        return new Promise((resolve, reject) => {
            connection.query('select eventId, max(date) as maxdate from freetickets group by eventId having maxdate < (select max(date) from freetickets);', (err, res) => {
                if(err) {
                    reject(err)
                };
                resolve(res)
            });  
        })
        
    }
}