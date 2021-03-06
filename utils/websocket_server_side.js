// ==================================
// Websocket Server Side Code 
// ==================================
//var async = require('async');
var path = require('path');

module.exports = function (checkPerodically, logger) {
	var helper = require(path.join(__dirname, './helper.js'))(process.env.creds_filename, logger);
	var ws_server = {};
	var chain = null;
	var broadcast = null;
	var known_everything = {};
	var marbles_lib = null;
	var known_height = 0;

	// setup this module
	ws_server.setup = function (l_chain, l_marbles_lib, l_broadcast, logger) {
		chain = l_chain;
		marbles_lib = l_marbles_lib;
		broadcast = l_broadcast;
		logger = l_marbles_lib;
	};

	// process web socket messages
	ws_server.process_msg = function (ws, data) {
		var options = {
			peer_urls: [helper.getPeersUrl(0)],
			ws: ws,
			endorsed_hook: endorse_hook,
			ordered_hook: orderer_hook
		};
		if (marbles_lib === null) {
			logger.error('marbles lib is null...');				//can't run in this state
			return;
		}

		// create a new marble
		if (data.type == 'create') {
			logger.info('[ws] create marbles req');
			options.args = {
				marble_id: data.name,
				color: data.color,
				size: data.size,
				marble_owner: data.username,
				owners_company: data.company,
				auth_company: process.env.marble_company,
			};

			marbles_lib.create_a_marble(options, function (err, resp) {
				if (err != null) send_err(err, data);
				else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
			});
		}

		// transfer a marble
		else if (data.type == 'transfer_marble') {
			logger.info('[ws] transfering req');
			options.args = {
				marble_id: data.name,
				marble_owner: data.username,
				owners_company: data.company,
				auth_company: process.env.marble_company
			};

			marbles_lib.set_marble_owner(options, function (err, resp) {
				if (err != null) send_err(err, data);
				else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
			});
		}

		// delete marble
		else if (data.type == 'delete_marble') {
			logger.info('[ws] delete marble req');
			options.args = {
				marble_id: data.name,
				auth_company: process.env.marble_company
			};

			marbles_lib.delete_marble(options, function (err, resp) {
				if (err != null) send_err(err, data);
				else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
			});
		}

		// get all owners, marbles, & companies
		else if (data.type == 'read_everything') {
			logger.info('[ws] read everything req');
			ws_server.check_for_updates(ws);
		}


		// send transaction error msg 
		function send_err(msg, input) {
			sendMsg({ msg: 'tx_error', e: msg, input: input });
			sendMsg({ msg: 'tx_step', state: 'committing_failed' });
		}

		// send a message, socket might be closed...
		function sendMsg(json) {
			if (ws) {
				try {
					ws.send(JSON.stringify(json));
				}
				catch (e) {
					logger.debug('[ws error] could not send msg', e);
				}
			}
		}

		// endorsement stage callback
		function endorse_hook(err) {
			if (err) sendMsg({ msg: 'tx_step', state: 'endorsing_failed' });
			else sendMsg({ msg: 'tx_step', state: 'ordering' });
		}

		// ordering stage callback
		function orderer_hook(err) {
			if (err) sendMsg({ msg: 'tx_step', state: 'ordering_failed' });
			else sendMsg({ msg: 'tx_step', state: 'committing' });
		}
	};

	//------------------------------------------------------------------------------------------

	// sch next periodic check
	function sch_next_check() {
		clearTimeout(checkPerodically);
		checkPerodically = setTimeout(function () {
			try {
				ws_server.check_for_updates(null);
			}
			catch (e) {
				console.log('');
				logger.error('Error in sch next check\n\n', e);
				sch_next_check();
				ws_server.check_for_updates(null);
			}
		}, 2000);													//check perodically, should be slighly shorter than the block delay
	}

	// --------------------------------------------------------
	// Check for Updates to Ledger
	// --------------------------------------------------------
	ws_server.check_for_updates = function (ws_client) {
		marbles_lib.channel_stats(null, function (err, resp) {
			var newBlock = false;
			if (err == null) {
				if (resp && resp.height && resp.height.low) {
					if (resp.height.low > known_height || ws_client) {
						if (!ws_client) {
							logger.info('New block detected!', resp.height.low, resp);
							known_height = resp.height.low;
							newBlock = true;
							logger.debug('[checking] there are new things, sending to all clients');
							broadcast({ msg: 'block', e: null, block_height: resp.height.low });				//send to all clients
						} else {
							logger.debug('[checking] on demand req, sending to a client');
							ws_client.send(JSON.stringify({ msg: 'block', e: null, block_height: resp.height.low })); //send to a client
						}
					}
				}
			}

			if (newBlock || ws_client) {
				read_everything(ws_client, function () {
					sch_next_check();						//check again
				});
			} else {
				sch_next_check();							//check again
			}
		});
	};

	// read complete state of marble world
	function read_everything(ws_client, cb) {
		var options = {
			peer_urls: [helper.getPeersUrl(0)],
		};

		marbles_lib.read_everything(options, function (err, resp) {
			if (err != null) {
				console.log('');
				logger.debug('[checking] could not get everything:', err);
				if (cb) cb();
			}
			else {
				var data = resp.parsed;
				if (data && data.owners_index && data.marbles) {
					console.log('');
					logger.debug('[checking] number of owners:', data.owners_index.length);
					logger.debug('[checking] number of marbles:', data.marbles.length);
				}

				data.owners_index = organize_usernames(data.owners_index);
				data.marbles = organize_marbles(data.marbles);
				var knownAsString = JSON.stringify(known_everything);			//stringify for easy comparison (order should stay the same)
				var latestListAsString = JSON.stringify(data);

				if (knownAsString === latestListAsString) {
					logger.debug('[checking] same everything as last time');
					if (ws_client !== null) {									//if this is answering a clients req, send to 1 client
						logger.debug('[checking] sending to 1 client');
						ws_client.send(JSON.stringify({ msg: 'everything', e: err, everything: data }));
					}
				}
				else {															//detected new things, send it out
					logger.debug('[checking] there are new things, sending to all clients');
					known_everything = data;
					broadcast({ msg: 'everything', e: err, everything: data });	//sent to all clients
				}
				if (cb) cb();
			}
		});
	}

	// organize the marble owner list
	function organize_usernames(data) {
		var ownerList = [];
		var myUsers = [];
		for (var i in data) {						//lets reformat it a bit, only need 1 peer's response
			var pos = data[i].indexOf('.');
			var temp = {
				username: data[i].substring(0, pos),
				company: data[i].substring(pos + 1)
			};
			if (temp.company === process.env.marble_company) {
				myUsers.push(temp);					//these are my companies users
			}
			else {
				ownerList.push(temp);				//everyone else
			}
		}

		ownerList = sort_usernames(ownerList);
		ownerList = myUsers.concat(ownerList);		//my users are first, bring in the others
		return ownerList;
	}

	//
	function organize_marbles(allMarbles) {
		var ret = {};
		for (var i in allMarbles) {
			if (!ret[allMarbles[i].owner.username]) {
				ret[allMarbles[i].owner.username] = {
					username: allMarbles[i].owner.username,
					company: allMarbles[i].owner.company,
					marbles: []
				};
			}
			ret[allMarbles[i].owner.username].marbles.push(allMarbles[i]);
		}
		return ret;
	}

	// alpha sort everyone else
	function sort_usernames(temp) {
		temp.sort(function (a, b) {
			var entryA = a.company + a.username;
			var entryB = b.company + b.username;
			if (entryA < entryB) return -1;
			if (entryA > entryB) return 1;
			return 0;
		});
		return temp;
	}

	return ws_server;
};
