// routes/api.js
var express = require("express");
var fs = require("fs");
var path = require("path");
var url = require("url");
var bcrypt = require('bcrypt');
var ObjectId = require('mongodb').ObjectID;
var router = express.Router();

var status_enum = [
  "idle",
  "arming",
  "armed",
  "running",
  "error",
  "unknown"
];

function checkKey(req, res, next) {
  var q = url.parse(req.url, true).query;
  var user = q.api_user;
  var key = q.api_key;
  if (typeof(user) == 'undefined' || typeof(key) == 'undefined') {
    return res.json({});
  }
  var collection = req.users_db.get("users");
  var query = {lngs_ldap_uid: user};
  var options = {api_key: 1, groups: 1};
  collection.find(query, options, function(e, docs) {
    if (e) {
      return res.json({message: e.message});
    }
    if (docs.length == 0 || typeof(docs[0].api_key) == 'undefined')
      return res.json({message: 'Access denied'});
    bcrypt.compare(key, docs[0].api_key, function(err, ret) {
      if (err) return res.json({message: err});
      if (ret == true) {
        req.is_daq = typeof docs[0].groups != 'undefined' && docs[0].groups.includes('daq');
        return next();
      } // if (ret == true)
      return res.json({message: 'Access Denied'});
    });
  });
}

router.get("/helloworld", checkKey, function(req, res) {
  var today = new Date();
  return res.json({message: 'Hello to you too. The current time is ' + today.toUTCString()});
});

router.get("/getstatus/:host", checkKey, function(req, res) {
  var q = url.parse(req.url, true).query;
  var host = req.params.host;
  var time_sec = 0;
  var collection = req.db.get('status');
  try {
    time_sec = parseInt(q.time_seconds);
  } catch(error){
  }
  var query = {host: host};
  var options = {sort: {'_id': -1}};
  if (time_sec > 0) {
    query['time'] = {$gte: new Date(new Date()-time_sec*1000)};
  } else {
    options['limit'] = 1;
  }
  collection.find(query, options, function(err, docs) {
    if (err) {
      return res.json({message: err.message});
    }
    return res.json(docs);
  });
});

router.get("/geterrors", checkKey, function(req, res) {
  var q = url.parse(req.url, true).query;
  var min_level = 2;
  var collection = req.db.get('log');
  try{
    min_level = parseInt(q.level);
  } catch(error){
  }
  var query = {priority: {$gte: min_level, $lt: 5}};
  var options = {sort: {'_id': -1}, limit: 1};
  collection.find(query, options).then( (docs) => {
    return res.json(docs);
  }).catch( (err) => {
    return res.json({message: err.message});
  });
});

function GetControlDoc(collection, detector) {
  var keys = ['active', 'comment', 'mode', 'remote', 'softstop', 'stop_after'];
  var p = keys.map(k => collection.findOne({key: `${detector}.${k}`}, {sort: {_id: -1}}));
  return Promise.all(p).then(values => {
    var ret = {};
    var latest = values[0].time;
    var user = "";
    values.forEach(doc => {
      ret[doc.field] = doc.value;
      if (doc.time > latest) {
        user = doc.user;
        latest = doc.time;
      }
    });
    ret['user'] = user;
    return ret;
  }).catch(err => {console.log(err.message); return {};});
}

function GetDetectorStatus(collection, detector) {
  var timeout = 30;
  var query = {detector: detector, time: {$gte: new Date(new Date()-timeout*1000)}};
  var options = {sort: {'_id': -1}, limit: 1};
  return collection.find(query, options);
}

router.get("/getcommand/:detector", checkKey, function(req, res) {
  var detector = req.params.detector;
  var collection = req.db.get("detector_control");
  GetControlDoc(collection, detector)
    .then(doc => res.json({detector: detector, user: doc.user, state: doc}))
    .catch(err => res.json({}));
});

router.get("/detector_status/:detector", checkKey, function(req, res) {
  var detector = req.params.detector;
  var collection = req.db.get("aggregate_status");
  GetDetectorStatus(collection, detector).then( docs => {
    if (docs.length == 0)
      return res.json({message: "No status update within the last 30 seconds"});
    return res.json(docs[0]);
  }).catch( err => {
    return res.json({message: err.message});
  });
});

function GetCurrentMode(options_coll, ctrl_coll, detector) {
  return ctrl_coll.findOne({key: `${detector}.mode`},{sort: {_id: -1}})
    .then(doc => options_coll.findOne({name: doc.value}))
    .catch(err => ({}));
}

router.post("/setcommand/:detector", checkKey, function(req, res) {
  var q = url.parse(req.url, true).query;
  var user = q.api_user;
  var data = req.body;
  var detector = req.params.detector;
  var ctrl_coll = req.db.get("detector_control");
  var options_coll = req.db.get("options");
  promises = [GetControlDoc(ctrl_coll, detector)];
  if (typeof data.mode != 'undefined') {
    promises.push(options_coll.findOne({name: data.mode}));
  } else {
    promises.push(GetCurrentMode(options_coll, ctrl_coll, detector));
  }
  Promise.all(promises).then( values => {
    var det = values[0];
    // first - is the detector in "remote" mode?
    if (det.remote != 'true' && !req.is_daq)
      throw {message: "Detector must be in remote mode to control via the API"};
    // is the mode valid?
    if (values[1] === null) {
      throw {message: "Invalid mode provided"};
    }
    // now we validate the incoming command
    var changes = [];
    for (var key in det) {
      if (typeof data[key] != 'undefined' && data[key] != '' && data[key] != det[key]) {
        if (key == 'stop_after') {
          try{
            data[key] = parseInt(data[key]);
          }catch(error){
            continue;
          }
        } else if (key == 'active' && data[key] == 'true' && values[1].detector !== detector) {
          // check linking
          throw {message: 'Incompatible mode'};
        } else if (key == 'mode' && typeof values[1].detector != 'string') {
          throw {message: 'Linked modes not available for API use'};
        } else {
        }
        changes.push([key, data[key]]);
      } // if key is valid
    } // for all keys
    if (changes.length > 0) {
      ctrl_coll.insert(changes.map((val) => ({detector: detector, user: user,
          time: new Date(), field: val[0], value: val[1],
          key: `${detector}.${val[0]}`})))
        .then( () => res.json({message: "Update successful"}))
        .catch( (err) => {throw err});
    } else {
      throw {message: "No changes registered"};
    }
  }).catch((err) => res.json({message: err.message}));
});

function GetSystemMonitorStatus(collection, host) {
  var query = {host: host,};
  var options = {sort: {'_id': -1}, limit: 1};
  return collection.find(query, options);
}

function CSVEscape(value) {
  if (typeof value == 'undefined' || value === null) {
    return '';
  }
  var out = value.toString();
  if (out.search(/[",\n]/) != -1) {
    return '"' + out.replace(/"/g, '""') + '"';
  }
  return out;
}

function ParseXYZList(values) {
  var x = '';
  var y = '';
  var z = '';
  if (Array.isArray(values)) {
    if (typeof values[0] != 'undefined') x = values[0];
    if (typeof values[1] != 'undefined') y = values[1];
    if (typeof values[2] != 'undefined') z = values[2];
  }
  return {x: x, y: y, z: z};
}

function ParseCoords(coords) {
  if (Array.isArray(coords)) {
    return ParseXYZList(coords);
  }
  if (typeof coords == 'object' && coords !== null && Array.isArray(coords.pmt)) {
    return ParseXYZList(coords.pmt);
  }
  return {x: '', y: '', z: ''};
}

// Output headers are defined by downstream consumers, not by Mongo field names.
const SAMPLE_CSV_HEADERS = [
  'pmt_index',
  'detector',
  'signal_channel',
  'position_x',
  'position_y',
  'position_z',
  'array',
  'sector'
];

const PMT_SECTOR_MAP_PATH = path.join(__dirname, '..', 'pmt_sector_map.csv');
var pmt_sector_lookup = null;
var pmt_sector_lookup_mtime = null;

function GetSectorKey(detector, pmt_index) {
  return `${detector}:${pmt_index}`;
}

// Keep the extracted sector map as a small cached lookup, reloading if the file changes.
function GetSectorLookup() {
  try {
    var stat = fs.statSync(PMT_SECTOR_MAP_PATH);
    if (pmt_sector_lookup !== null &&
        pmt_sector_lookup_mtime !== null &&
        stat.mtimeMs === pmt_sector_lookup_mtime) {
      return pmt_sector_lookup;
    }
    var lookup = {};
    var lines = fs.readFileSync(PMT_SECTOR_MAP_PATH, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line === '') {
        return;
      }
      if (idx === 0) {
        return;
      }
      var fields = line.split(',');
      if (fields.length < 3) {
        return;
      }
      var detector = fields[0];
      var pmt_index = fields[1];
      var sector = fields[2];
      if (detector === '' || pmt_index === '') {
        return;
      }
      lookup[GetSectorKey(detector, pmt_index)] = sector;
    });
    pmt_sector_lookup = lookup;
    pmt_sector_lookup_mtime = stat.mtimeMs;
    return lookup;
  } catch (err) {
    return {};
  }
}

function BuildMappingRow(cable_doc, sector_lookup) {
  var coords = ParseCoords(cable_doc.coords);
  var pmt = typeof cable_doc.pmt == 'undefined' ? '' : cable_doc.pmt;
  var detector = typeof cable_doc.detector == 'undefined' ? '' : cable_doc.detector;
  var sector = '';
  if (detector !== '' && pmt !== '') {
    sector = sector_lookup[GetSectorKey(detector, pmt)] || '';
  }
  return {
    pmt_index: pmt,
    detector: detector,
    signal_channel: pmt,
    position_x: coords.x,
    position_y: coords.y,
    position_z: coords.z,
    array: typeof cable_doc.array == 'undefined' ? '' : cable_doc.array,
    sector: sector,
  };
}

function RowsToCSV(headers, rows) {
  var lines = [];
  lines.push(headers.join(','));
  rows.forEach(row => {
    lines.push(headers.map(k => CSVEscape(row[k])).join(','));
  });
  return lines.join('\n') + '\n';
}

router.get("/sample.csv", checkKey, function(req, res) {
  var cable_collection = req.db.get("cable_map");
  cable_collection.find({}).then(cable_docs => {
    var sector_lookup = GetSectorLookup();
    var rows = cable_docs.map(doc => BuildMappingRow(doc, sector_lookup));
    rows.sort((a, b) => {
      if (a.detector != b.detector) {
        return a.detector.localeCompare(b.detector);
      }
      var ach = parseInt(a.pmt_index, 10);
      var bch = parseInt(b.pmt_index, 10);
      if (Number.isNaN(ach) && Number.isNaN(bch)) return 0;
      if (Number.isNaN(ach)) return 1;
      if (Number.isNaN(bch)) return -1;
      return ach - bch;
    });
    var csv = RowsToCSV(SAMPLE_CSV_HEADERS, rows);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="sample.csv"');
    return res.send(csv);
  }).catch(err => {
    return res.json({message: err.message});
  });
});

router.get("/gethoststatus/:host", checkKey, function(req, res) {
  var host = req.params.host
  var collection = req.db.get("system_monitor");
  GetSystemMonitorStatus(collection,host).then( docs => {
    if (docs.length == 0)
      return res.json({message: "No status update found for this host"});
    return res.json(docs[0]);
  }).catch( err => {
    return res.json({message: err.message});
  });
});
module.exports = router;
