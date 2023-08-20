const express = require('express')
const axios = require('axios');
//const schedule = require('node-schedule');
//const mysql = require('mysql');
const app = express()
const port = 3000
const https = require('https');
const fs = require('fs');
const htmlparser = require('htmlparser');
//const path = require('path');
var router = express.Router();

const { Pool, Client } = require('pg')

const pool = new Pool({
	user: 'postgres',
	host: 'localhost',
	database: 'postgres',
	password: 'sami',
	port: 5432,
  })
  pool.query('SELECT NOW()', (err, res) => {
	console.log(res.rows)
	pool.end()
  })

var privateKey  = fs.readFileSync('key.pem', 'utf8');
var certificate = fs.readFileSync('cert.pem', 'utf8');

var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, app);

process.on('SIGINT', function() {
	
    connection.end((err) => {
	    console.log("Connection ended")
    });
    console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
    // some other closing procedures go here
    process.exit( );
})

var handler = new htmlparser.DefaultHandler(function (error, dom) {
    if (error) {
    	//do domething with error
    }
    else {
        return dom
    }       
});

var initTreeSearch = function(domJSON) {
	var returnvalue = null
	domJSON.dom.forEach(x => {
		var r = findFromDom(x)
		if (r) {
			returnvalue = r
		}
	})
	return returnvalue
}

var initMatchesSearch = function(domJSON) {
	var returnvalue = null
	domJSON.dom.forEach(x => {
		let r = findMatchesFromDom(x)
		if (r) {
			returnvalue = r
		}
	})
	return returnvalue
}

var findMatchesFromDom = function(domJSON) {
	var returnvalue = null
	if (domJSON.type == 'script' && (domJSON.attribs) && domJSON.attribs.type == 'application/configuration') {
		if (domJSON.children) {
			domJSON.children.forEach(x => {
				var dataJSON = x.data ? JSON.parse(x.data) : null
				if (dataJSON) {
					if (dataJSON.calendar_content) {
						returnvalue = dataJSON.calendar_content.result
					}
				}
			})
		}
	}

	if (domJSON.children) {
		domJSON.children.forEach(x => {
		    const result = findMatchesFromDom(x)
		    if (result) {
		    	returnvalue = result
		    }
	    })
	}
	return returnvalue
}

var findFromDom = function(domJSON) {
	var returnvalue = null
	if (domJSON.type == 'script' && (domJSON.attribs) && domJSON.attribs.type == 'application/configuration') {
		if (domJSON.children) {
			domJSON.children.forEach(x => {
				const rawJSON = x.raw ? JSON.parse(x.raw) : null
				const dataJSON = x.data ? JSON.parse(x.data) : null
				if (rawJSON) {
					if (rawJSON.seatmapOptions) {
						returnvalue = rawJSON.seatmapOptions.additionalRequestParams
					}
				}
				if (dataJSON) {
					if (dataJSON.seatmapOptions) {
						returnvalue = dataJSON.seatmapOptions.additionalRequestParams
					}
				}
			})
		}
	}

	if (domJSON.children) {
		domJSON.children.forEach(x => {
		    const result = findFromDom(x)
		    if (result) {
		    	returnvalue = result
		    }
	    })
	}
	return returnvalue
}

var parser = new htmlparser.Parser(handler);

httpsServer.listen(8443);

app.listen(port, () => console.log(`App is listening on port ${port}!`))

var scrapeWebpage = function(url) {
	return new Promise((resolve, reject) => {
		axios.get(url).then(response => {
            var x = parser.parseComplete(response.data);
            resolve(handler)
        })   
        .catch(e => {
            reject(e)
	    })
    }) 
}

var scrapeJSON = function(url) {
	return new Promise((resolve, reject) => {
		axios.get(url).then(response => {
            resolve(response)
        })   
        .catch(e => {
            reject(e)
	    })
    }) 
}

const getMatches = (url) => {
	return new Promise((resolve, reject) => {
		scrapeWebpage(url).then(response => {
			console.log("matches loaded!")
    	    const nextMatches = initMatchesSearch(response)
    	    const responseJSON = nextMatches
            resolve(responseJSON)
        })
        .catch(e => {
			console.log("error while fetching the matches!")
        	reject(e)
        })
	})
}

const getEventData = (eventId, eventName, eventUrl) => {
	return new Promise((resolve, reject) => {

		//Scraping event data
		console.log(eventUrl, eventName)
		scrapeWebpage('https://www.lippu.fi' + eventUrl).then(response => {
			let searchParameters = initTreeSearch(response)
            const eventDataUrl = "https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.11&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1" + searchParameters + "&fun=json&areaId=0"
			
			//scraping seat data
    	    scrapeJSON(eventDataUrl).then(blockResponse => {
    		    const blockIds = blockResponse.data.blocks.map(x => x.blockId)

                let blockPromises = []

                //getting free seats i.e. seats not purchased yet for the event
                blockIds.forEach(id => {
                    if (id && id.length > 2) {
                        const url = "https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.11&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1&key=web_4_" + eventId + "_0_ADV_0" + searchParameters + "&fun=seatinfos&blockId=" + id.substring(1);
						blockPromises.push(scrapeJSON(url).then(response => { return response.data }))
                    }
    		    })

                Promise.all(blockPromises).then(data => {
					let ret = {
						eventId: eventId,
						eventName: eventName,
						arenaSeatsTotal: blockResponse.data.individualSeats,
						snapshotTime: new Date(),
						blocks: {},
						blockSeatsTotal: 0,
						blockSeatsFree: 0
					}
					
					let blocks = {}

					for (let i = 0; i < data.length; i++) {
						const blockData = blockResponse.data.blocks.find(x => x.blockId == data[i].b_id)
						if (blockData) {
							blocks[blockData.blockId] = {
								name: blockData.name,
								id: blockData.blockId,
								seatsTotal: 0,
								seatsFree: 0,
								percentsFree: 0
							}

							let blockSeats = 0
							for (let k = 0; k < blockData.r.length; k++) {
								if (blockData.r[k].g.length > 0) {
									if (blockData.r[k].g[0].s) {
										blockSeats += blockData.r[k].g[0].s.length
									}
									
								}
							}
							if (blockSeats > 0) {
								blocks[blockData.blockId].seatsTotal = blockSeats
						        blocks[blockData.blockId].seatsFree = Object.keys(data[i].seatInfos).length
							    blocks[blockData.blockId].percentsFree = (100 - ((Object.keys(data[i].seatInfos).length / blockSeats) * 100)).toFixed(2)

							    ret.blockSeatsTotal += blockSeats
							    ret.blockSeatsFree += Object.keys(data[i].seatInfos).length
							} else {
								delete blocks[blockData.blockId]
							}
							
						}
					}
					
                    console.log("seat infos loaded successfully for match!", eventId)
					ret.blocks = blocks
                    resolve(ret)
                })
                .catch(e => {
                    console.log("virhe!")
                    reject(e)
                })
    	    })
            .catch(e => {
				console.log("virhe!")
            	reject(e)
            })
        })
        .catch(e => {
        	reject(e)
        })
	})
}

app.get('/api', (req, res) => {
	res.send("hei welcome!")
})

app.get('/api/matches', (req, res) => {
	getMatches(req.query.url).then(matches => {
        let promises = []
		console.log("found", matches.length, "total")
        for (let i = 0; i < /*matches.length*/ 1; i++) {
            promises.push(getEventData(matches[i].id, matches[i].title, matches[i].url))
        }
        Promise.all(promises).then(response => {
			console.log("all matches and their data loaded!")
            res.send(response)
        })
        .catch(e => {
            console.log("error! send code 500")
            res.status(500).send({error: e})
        })
	})
	.catch(e => {
		console.log("error occured while fetching the matches...")
		console.log("Information retrieval ended in failure")
		console.log(e.message)
		res.status(500).send({error: e})
	})
})

app.get('/api/event', function (req, res) {
    getEventData(req.query.id).then(response => {
    	res.send(response.map(x => x.data))
    })
    .catch(e => {
    	res.status(500).send({error: e})
    })
})
