var express = require("express");
var url = require("url");
var router = express.Router();
var ObjectId = require('mongodb').ObjectId;
var gp='';

function DateToObjectId(date) {
  return ObjectId(Math.floor(date/1000).toString(16) + "0000000000000000");
}

function GetTemplateInfo(req) {
  var template_info = req.template_info_base;
  template_info['hosts'] = ['reader7', 'reader8', 'reader9',
    'eb0', 'eb1', 'eb2', 'eb3', 'eb4', 'eb5',
    'reader0', 'reader1', 'reader2', 'oldmaster'];
  return template_info;
}

function ensureAuthenticated(req, res, next) {
  return req.isAuthenticated() ? next() : res.redirect('/login');
}

router.get('/', ensureAuthenticated, function(req, res) {
  res.render('hosts', GetTemplateInfo(req));
});

router.get('/template_info', ensureAuthenticated, function(req, res) {
  return res.json(GetTemplateInfo(req));
});

router.get("/get_host_status", ensureAuthenticated, function(req, res){
  var q = url.parse(req.url, true).query;
  var host = q.host;

  req.db.get('system_monitor').find({"host": host}, {"sort": {"_id": -1}, "limit": 1})
  .then(docs => {
    if (docs.length == 0)
      return res.json({});
    docs[0]['checkin'] = new Date() - docs[0]['time'];
    docs[0]['drift'] = docs[0]['time'].getTime()/1000 - parseInt(docs[0]['_id'].toHexString().substring(0,8), 16);
    return res.json(docs[0]);
  }).catch(err => {console.log(err.message); res.json({});});
});

router.get("/get_host_history", ensureAuthenticated, function(req, res){
  var q = url.parse(req.url, true).query;
  var host = q.host;
  if (typeof host == 'undefined')
    return res.json([]);
  var resolution = typeof q.resolution == 'undefined' ? 60 : parseInt(q.resolution);
  var lookback = typeof q.lookback == 'undefined' ? 3600 : parseInt(q.lookback);
  var min_id = DateToObjectId(new Date()-lookback*1000);
  var query = {host: host, _id: {$gt: min_id}};
  req.db.get('system_monitor').aggregate([
    {$match: query},
    {$sort: {_id: -1}},
    {$project: {time_bin: {$toInt: {$divide: [{$subtract: [new Date(), '$time']}, 1000*resolution]}},
      time: {$toLong: '$time'}, cpu_percent: 1, mem: '$virtual_memory.percent', swap: '$swap_memory.percent', temperature: 1}},
    {$group: {_id: '$time_bin', mem: {$avg: '$mem'}, swap: {$avg: '$swap'}, cpu: {$avg: '$cpu_percent'}, t: {$avg: '$time'},
      temp0: {$avg: {$ifNull: ['$temperature.package_id_0', 0]}}, temp1: {$avg: {$ifNull: ['$temperature.package_id_1', 0]}}}},
    {$sort: {_id: -1}},
    {$group: {_id: null,
      cpu: {$push: {$concatArrays: [['$t'], ['$cpu']]}},
      mem: {$push: {$concatArrays: [['$t'], ['$mem']]}},
      swap: {$push: {$concatArrays: [['$t'], ['$swap']]}},
      temp0: {$push: {$concatArrays: [['$t'], ['$temp0']]}},
      temp1: {$push: {$concatArrays: [['$t'], ['$temp1']]}},
    }},
    {$project: {docs: {$objectToArray: '$$ROOT'}}},
    {$unwind: '$docs'},
    {$skip: 1}, // skip the _id entry
    {$project: {
      _id: 0,
      type: 'line',
      name: '$docs.k',
      data: '$docs.v'
    }}])
    .then(docs => res.json(docs))
  .catch(err => {console.log(err); return res.json([]);});
});
/*
      {$limit: limit},
  req.db.get('system_monitor').find(query, opts)
    .then(docs => {
      if(docs.length==0)
        return res.json({});

      // Mem %, CPU %, Disk % on each disk
      r = {"mem": [], "cpu": [], "swap": []};
      names = {"mem": "Memory%", "cpu": "CPU%", "swap": "Swap%"};
      docs.forEach(doc => {
        var t = doc['time'].getTime();
        r["cpu"].unshift([t, doc['cpu_percent']]);
        r["mem"].unshift([t, doc['virtual_memory']['percent']]);
        r["swap"].unshift([t, doc['swap_memory']['percent']]);
        for(j in doc['disk']){
          if(!(j in r)){
            r[j] = [];
            names[j] = "Disk%("+j+")";
          }
          r[j].unshift([t, doc['disk'][j]['percent']]);
        }
      });
      ret = [];
      for(i in r)
        ret.push({"type": "line", "name": names[i], "data": r[i]})

      return res.json(ret);
    })
    .catch(err => {console.log(err.message); return res.json([]);});
});*/

module.exports = router;
