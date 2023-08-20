const express = require('express')
const axios = require('axios');
//const schedule = require('node-schedule');
//const mysql = require('mysql');
const app = express()
const port = 3000
const https = require('https');
const fs = require('fs');
const htmlparser = require("htmlparser");
const path = require('path');
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

var updateDatabase = function() {
	return new Promise((resolve, reject) => {
		var insertDate = new Date()
	    getMatches().then(response => {
		    console.log("matches loaded, next step: finding id:s")
		    var promises = []
		    response.matches.forEach(x => {
			    var p = getEventData(x.id).then(ev => {
				    var i = 0
				    var params = ev[0].config.url.split("&")
				    var eventid
				    params.forEach(param => {
					    if (param.split("=")[0] == "evId") {
						    eventid = param.split("=")[1]
					    }
				    })
                    ev.forEach(element => {
                        i += Object.keys(element.data.seatInfos).length
                    })
                    db.insertDataToDB(i, eventid, insertDate)
			    })
			    promises.push(p)
		    })
		    Promise.all(promises).then(() => {
		    	resolve()
		    })
		    .catch(e => {
		    	reject(e)
		    })
	    })
	    .catch(e => {
	    	reject(e)
	    })
	})
}

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

app.listen(port, () => console.log(`App listening on port ${port}!`))

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

var getMatches = function() {
	return new Promise((resolve, reject) => {
		scrapeWebpage('https://www.lippu.fi/artist/ilves/ilves-runkosarja-2020-2021-2743479/').then(response => {
			console.log("yeyeyeye")
    	    var nextIlvesMatches = initMatchesSearch(response)
    	    console.log("ok")
    	    var responseJSON = {matches: nextIlvesMatches}
            resolve(responseJSON)
        })
        .catch(e => {
        	reject(e)
        })
	})
}

var getEventData = function(eventId) {
	return new Promise((resolve, reject) => {
		console.log("geteventdata")

		//Scraoing event data
		scrapeWebpage('https://www.lippu.fi/event/ilves-runkosarja-2020-2021-tampereen-jaeaehalli-hakametsae-' + eventId + '/').then(response => {
			var searchParameters = initTreeSearch(response)
			
			//scraping seat data
    	    scrapeJSON("https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.10&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1" + searchParameters + "&fun=json&areaId=0").then(blocks => {
			    let tmpBlockIds = []
    		    blocks.data.blocks.forEach(x => {
    			    tmpBlockIds = tmpBlockIds.concat(x.areaBlocks)
    		    })
    		    var blockIds = Array.from(new Set(tmpBlockIds))
    		    var promises = []
    		    blockIds.forEach(id => {
    			    let url = "https://api.eventim.com/seatmap/api/SeatMapHandler?smcVersion=v6.1&version=v6.2.10&cType=web&cId=4&evId=" + eventId + "&a_holds=1&a_rowRules=1&key=web_4_" + eventId + "_0_ADV_0" + searchParameters + "&fun=seatinfos&blockId=" + id.substring(1);;
    			    var p = scrapeJSON(url).then(response => {
    			        return response
    		        })
    		        .catch(() => {
    			        console.log("error")
    		        })
    		        promises.push(p)
    		    })
    		
    		    Promise.all(promises).then(data => {
    		    	console.log("kkaaak")
    		 	    resolve(data)
    		    })
    		    .catch(e => {
    		    	console.log("jijijiji")
    			    reject(e);
    		    })
    	    })
            .catch(e => {
				console.log("eeieeoeoep")
            	reject(e)
            })
        })
        .catch(e => {
        	console.log("errrororr")
        })
	})
}

router.get('/', (req, res) => {
	res.send("hei welcome!")
})
/*
router.get('/pastevents', (req, res) => {
	db.getPastEventIds().then(response => {
		res.send(response)
	})
	.catch(e => {
		res.status(500).send({error: e})
	})
})
*/
/*
router.get('/update', (req, res) => {
	updateDatabase().then(() => {
		res.send("Updated!")
	})
	.catch(e => {
		res.status(500).send({error: e})
	})
})
*/
router.get('/matches', (req, res) => {
	getMatches().then(response => {
		res.send(response)
	})
	.catch(e => {
		res.status(500).send({error: e})
	})
})
/*
router.get('/trackingdata', (req, res) => {
	db.getEventTrackingFromDB(req.query.id).then(response => {
		res.send(response)
	})
	.catch(e => {
		res.status(500).send({error: e})
	})
})
*/
router.get('/getevent', function (req, res) {
    getEventData(req.query.id).then(response => {
    	res.send(response.map(x => x.data))
    })
    .catch(e => {
    	res.status(500).send({error: e})
    })
})
