// routes/hypervisor.js
var express = require('express');
var url = require('url');
var router = express.Router();


function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated())
    return res.redirect('/login');
  if (typeof req.user.groups == 'undefined' || !req.user.groups.includes('daq'))
    return res.redirect('/');
  return next();
}

router.get('/', ensureAuthenticated, function(req, res) {
  res.render('hypervisor', req.template_info_base);
});

router.get('/readout_status', ensureAuthenticated, function(req, res) {
  var q = url.parse(req.url, true).query;
  var host = q.host;
  if (typeof host == 'undefined') return res.json({});
  req.db.get('status').find({host: host}, {sort: {_id: -1}, limit: 1})
  .then( (docs) => {
    if (docs.length == 0)
      return res.json({});
    docs[0]['checkin'] = new Date()-docs[0]['time'];
    return res.json(docs[0]);
  }).catch( (err) => res.json({err: err.message}));
});

router.get('/eb_status', ensureAuthenticated, function(req, res) {
  var q = url.parse(req.url, true).query;
  var host = q.host;
  if (typeof host == 'undefined')
    return res.json({});
  req.db.get('eb_monitor').find({host: host}, {sort: {_id: -1}, limit: 1})
  .then( (docs) => {
    if (docs.length == 0)
      return res.json({});
    docs[0]['checkin'] = new Date()-docs[0]['time'];
    return res.json(docs[0]);
  }).catch( (err) => res.json({err: err.message}));
});

router.post('/control', ensureAuthenticated, function(req, res) {
  var data = req.body.data;
  req.db.get('hypervisor').update(
    {ack: 0},
    {'$push': {commands: data},
     '$currentDate': {time: 1},
     '$set': {user: req.user.lngs_ldap_uid, ack: 0}
    },
    {upsert: true}
  ).then( () => res.sendStatus(200))
  .catch( (err) => res.status(200).json({message: err.message}));
});

module.exports = router;
