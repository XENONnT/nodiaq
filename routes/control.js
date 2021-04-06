// routes.control.js
var express = require("express");
var url = require("url");
var router = express.Router();
var gp='';

router.get('/', function(req, res) {
  var template = req.template_info_base;
  res.render('control', template);
});

router.get('/template_info', function(req, res) {
  return res.json(req.template_info_base);
}

router.get('/modes', function(req, res){
  var db = req.db;
  var collection = db.get("options");
  var q = url.parse(req.url, true).query;
  var detector = q.detector;
  collection.aggregate([
    {$addFields: {_detector: '$detector'}},
    {$unwind: '$detector'},
    {$match: {detector: {$ne: 'include'}}},
    {$unwind: '$detector'},
    {$sort: {name: 1}},
    {$group: {
      _id: '$detector',
      options: {$push: '$name'},
      desc: {$push: '$description'},
      link: {$push: {$cond: [{$isArray: '$_detector'}, '$_detector', ['$_detector']]}}
    }},
    {$project: {configs: {$zip: {inputs: ['$options', '$desc', '$link']}}}}
  ]).then( (docs) => res.json(docs))
  .catch( (err) => {console.log(err.message); return res.json({error: err.message})});
});

function GetControlDocs(collection) {
  return collection.aggregate([
    {$sort: {_id: -1}},
    {$group: {
      _id: '$key',
      value: {$first: '$value'},
      user: {$first: '$user'},
      time: {$first: '$time'},
      detector: {$first: '$detector'},
      key: {$first: '$field'}
    }},
    {$group: {
      _id: '$detector',
      keys: {$push: '$key'},
      values: {$push: '$value'},
      users: {$push: '$user'},
      times: {$push: '$time'}
    }},
    {$project: {
      detector: '$_id',
      _id: 0,
      state: {$arrayToObject: {$zip: {inputs: ['$keys','$values']}}},
      user: {$arrayElemAt: ['$users', {$indexOfArray: ['$times', {$max: '$times'}]}]}
    }}
  ]);
}

router.get("/get_control_docs", function(req, res){
    var db = req.db;
    var collection = db.get("detector_control");
    GetControlDocs(collection)
    .then((docs) => res.json(docs))
    .catch((err) => {console.log(err.message); return res.json({});});
});

router.post('/set_control_docs', function(req, res){
    var db = req.db;
    var collection = db.get("detector_control");

    if (typeof req.user.lngs_ldap_uid == 'undefined')
      return res.sendStatus(403);
    var data = req.body.data;
    GetControlDocs(collection).then((docs) => {
      var updates = [];
      for (var i in docs) {
        var olddoc = docs[i];
        var newdoc = data[olddoc['detector']];
        if (typeof newdoc == 'undefined')
          continue;
        for (var key in olddoc.state)
          if (typeof newdoc[key] != 'undefined' && newdoc[key] != olddoc.state[key])
            updates.push({detector: olddoc['detector'], field: key, value: newdoc[key], user: req.user.lngs_ldap_uid, time: new Date(), key: olddoc['detector']+'.'+key});
      }
      return updates.length > 0 ? collection.insert(updates) : 0;
    }).then( () => res.sendStatus(200))
    .catch((err) => {
      console.log(err.message);
      return res.sendStatus(451);
    });
});

module.exports = router;
