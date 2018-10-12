var express = require('express');
var url = require('url');
var router = express.Router();

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    return res.redirect('/login');
}

router.get('/', ensureAuthenticated, function(req, res) {
    var clients = {
	fdaq00_reader_0: { status: 'none', rate: 0, buffer_length: 0},
	fdaq00_reader_1: { status: 'none', rate: 0, buffer_length: 0}
    };
    res.render('status', { clients: clients, user: req.user});
    //    res.render('index', { clients: clients });
});

router.get('/get_broker_status', ensureAuthenticated, function(req, res){
    var db = req.db;
    var collection = db.get('dispatcher_status');

    //var q = url.parse(req.url, true).query;
    //var detector = q.detector;

    collection.find({},
		    function(e, sdoc){
			if(sdoc.length === 0)
			    return res.send(JSON.stringify({}));
			return res.send(JSON.stringify(sdoc));
		    });
});

router.get('/get_detector_status', ensureAuthenticated, function(req, res){
	var db = req.db;
	var collection = db.get('aggregate_status');
	
	var q = url.parse(req.url, true).query;
	var detector = q.detector;
	
	collection.find({"detector": detector},
	{"sort": {"_id": -1}, "limit": 1},
	function(e, sdoc){
		if(sdoc.length === 0)
			return res.send(JSON.stringify({}));
		var rdoc = sdoc[0];
		var now = new Date();
		var oid = new req.ObjectID(rdoc['_id']);
		var indate = Date.parse(oid.getTimestamp());
		rdoc['checkin'] = parseInt((now-indate)/1000, 10);
		rdoc['timestamp'] = indate;
		return res.send(JSON.stringify(rdoc));
	});
});

router.get('/get_controller_status', ensureAuthenticated, function(req, res){
	var db = req.db;
	var collection = db.get('status');
	
	var q = url.parse(req.url, true).query;
	var controller = q.controller;
	
	collection.find({"host": controller},
	{"sort": {"_id": -1}, "limit": 1},
	function(e, sdoc){
		if(sdoc.length === 0)
			return res.send(JSON.stringify({}));
		var rdoc = sdoc[0];
		var now = new Date();
		var oid = new req.ObjectID(rdoc['_id']);
		var indate = Date.parse(oid.getTimestamp());
		rdoc['checkin'] = parseInt((now-indate)/1000, 10);
		rdoc['timestamp'] = indate;
		return res.send(JSON.stringify(rdoc));
	});
});
			
router.get('/get_reader_status', ensureAuthenticated, function(req, res){
    var db=req.db;
    var collection = db.get('status');

    var q = url.parse(req.url, true).query;
    var host = q.reader;
    
    collection.find(
	{'host': host}, {'sort': {'_id': -1}, 'limit': 1},
	function(e, sdoc){
	    if(sdoc.length == 0)
		return res.send(JSON.stringify({}));
	    var rdoc = sdoc[0];
	    console.log(rdoc);
	    // Basically return sdoc but we want to add time
	    // since client time may vary we assume server time
	    // is correct
	    var now = new Date();
	    var oid = new req.ObjectID(rdoc['_id']);
	    var indate = Date.parse(oid.getTimestamp());
	    rdoc['checkin'] = parseInt((now-indate)/1000, 10);
	    rdoc['ts'] = indate;
	    return res.send(JSON.stringify(rdoc));
	});
});

router.get('/get_reader_history', ensureAuthenticated, function(req,res){
    var db = req.db;
    var collection = db.get('status');

    var q = url.parse(req.url, true).query;
    var reader = q.reader;
    var limit  = q.limit;

    if(typeof limit == 'undefined')
	limit = 100;
    if(typeof reader == 'undefined')
	return res.send(JSON.stringify({}));

    collection.find({"host": reader},
		    {"sort": {"_id": -1}, "limit": parseInt(limit, 10)},
		    function(e, docs){
			rates = [];
			buffs = [];
			var host = null;
			for(var i = docs.length-1; i>=0; i-=1){
			    var oid = new req.ObjectID(docs[i]['_id']);
			    var dt = Date.parse(oid.getTimestamp());
			    if(host == null)
				host = docs[i]['host'];			    
			    rates.push([dt, docs[i]['rate']]);
			    buffs.push([dt, docs[i]['buffer_length']]);
			}
			if(host==null){
			    return res.send(JSON.stringify({}));
			}
			var ret = {};
			ret[host] = {"rates": rates, "buffs": buffs};
			return res.send(JSON.stringify(ret));
		    });
});
				

router.get('/get_command_queue', ensureAuthenticated, function(req,res){
	var db = req.db;
	var collection = db.get("control");
	
	var q = url.parse(req.url, true).query;
	var limit = q.limit;
	if(typeof limit === 'undefined')
		limit = 20;
	var findstr = {};
	var last_id = q.id;
	if(typeof last_id !== 'undefined' && last_id != '0'){
		var oid = new req.ObjectID(last_id);
		findstr = {"_id": {"$gt": oid}};
	}

	collection.find(findstr, {"sort": {"_id": -1},"limit": parseInt(limit, 10)}, 
	function(e, docs){
		return res.send(JSON.stringify(docs));
	});
});

module.exports = router;
