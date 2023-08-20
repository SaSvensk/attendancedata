const express = require('express')
const axios = require('axios');
//const schedule = require('node-schedule');
//const mysql = require('mysql');
const app = express()
const port = 3000
const https = require('https');
const fs = require('fs');
const htmlparser = require("htmlparser");
const { response } = require('express');
//const path = require('path');
var router = express.Router();

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
		var r = findMatchesFromDom(x)
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
		    var result = findMatchesFromDom(x)
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
				var rawJSON = x.raw ? JSON.parse(x.raw) : null
				var dataJSON = x.data ? JSON.parse(x.data) : null
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
		    var result = findFromDom(x)
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

const getMatches = function() {
	return new Promise((resolve, reject) => {
		scrapeWebpage('https://www.lippu.fi/artist/ilves/ilves-runkosarja-2021-2022-2982792/').then(response => {
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

const getEventData = function(eventId) {
	return new Promise((resolve, reject) => {

		//Scraping event data
		scrapeWebpage('https://www.lippu.fi/event/ilves-runkosarja-2021-2022-tampereen-jaeaehalli-hakametsae-' + eventId + '/').then(response => {
			let searchParameters = initTreeSearch(response)
            const eventDataUrl = "https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.10&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1" + searchParameters + "&fun=json&areaId=0"
			
			//scraping seat data
    	    scrapeJSON(eventDataUrl).then(blocks => {
                let tmpBlockIds = []
    		    blocks.data.blocks.forEach(x => {
    			    tmpBlockIds = tmpBlockIds.concat(x.areaBlocks)
    		    })
                let areaIds = Array.from(new Set(blocks.data.blocks.filter(x => x.areaId).map(x => x.areaId)))

    		    let blockIds = Array.from(new Set(tmpBlockIds))
    		    let areaPromises = []
                let blockPromises = []
                
    		    areaIds.forEach(id => {
                    if (id) {
                        let url = "https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.10&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1&key=web_4_" + eventId + "_0_ADV_0" + searchParameters + "&fun=json&areaId=" + id;
    			        let p = scrapeJSON(url).then(response => {
    			            return response.data
    		            })
    		            areaPromises.push(p)
                    }
    		    })

                //getting free seats i.e. seats not purchased yet for the event
                blockIds.forEach(id => {
                    if (id && id.length > 2) {
                        let url = "https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.10&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1&key=web_4_" + eventId + "_0_ADV_0" + searchParameters + "&fun=seatinfos&blockId=" + id.substring(1);
    			        let p = scrapeJSON(url).then(response => {
    			            return response.data
    		            })
    		            blockPromises.push(p)
                    }
    		    })
    		
    		    let blocksResolved = Promise.all(blockPromises).then(data => {
    		 	    return data
    		    })

                let areasResolved = Promise.all(areaPromises).then(data => {
    		 	    return data
    		    })
                Promise.all([blocksResolved, areasResolved]).then(data => {
					let freeSeatsInfo = data[0]
					let blockInfos = data[1]
					let ret = {
						eventId: eventId,
						snapshotTime: new Date()
					}
					let blocks = {}

					for (let i = 0; i < blockInfos.length; i++) {
						
						for (let j = 0; j < blockInfos[i].blocks.length; j++) {
							if (blockInfos[i].blocks[j].r.length > 0) {
								blocks[blockInfos[i].blocks[j].blockId] = {
									name: blockInfos[i].blocks[j].name,
									id: blockInfos[i].blocks[j].blockId,
									areaId: blockInfos[i].areaId,
									eventId: eventId
								}
							}
							let blockSeats = 0
							for (let k = 0; k < blockInfos[i].blocks[j].r.length; k++) {
								if (blockInfos[i].blocks[j].r[k].g.length > 0) {
									if (blockInfos[i].blocks[j].r[k].g[0].s) {
										blockSeats += blockInfos[i].blocks[j].r[k].g[0].s.length
									}
									
								}
							}
							blocks[blockInfos[i].blocks[j].blockId].seatsTotal = blockSeats
						}
					}

					for (let i = 0; i < freeSeatsInfo.length; i++) {
						if (blocks[freeSeatsInfo[i].b_id]) {
							blocks[freeSeatsInfo[i].b_id].seatsFree = Object.keys(freeSeatsInfo[i].seatInfos).length
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

app.get('/', (req, res) => {
	res.send("hei welcome!")
})

app.get('/matches', (req, res) => {
	getMatches().then(matches => {
        let promises = []
		console.log("found", matches.length, "total")
        for (let i = 0; i < /*matches.length*/ 1; i++) {
            promises.push(getEventData(matches[i].id))
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

app.get('/event', function (req, res) {
    getEventData(req.query.id).then(response => {
    	res.send(response.map(x => x.data))
    })
    .catch(e => {
    	res.status(500).send({error: e})
    })
})
