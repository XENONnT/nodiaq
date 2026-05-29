// routes/options.js
var express = require("express");
var url = require("url");
var router = express.Router();
var gp = '';
var fs = require("fs");
var path = require("path");
const SCRIPT_VERSION = '20210622';

function CurrentUsername(req) {
  const user = (req || {}).user || {};
  const ldapUid = user.lngs_ldap_uid;
  if (typeof ldapUid === "string" && ldapUid !== "" && ldapUid !== "not set") return ldapUid;
  const githubLogin = user.github;
  if (typeof githubLogin === "string" && githubLogin !== "" && githubLogin !== "not set") return githubLogin;
  const githubInfoUsername = user.github_info && user.github_info.username;
  if (typeof githubInfoUsername === "string" && githubInfoUsername !== "")
    return githubInfoUsername;
  const githubInfoLogin = user.github_info && user.github_info._json && user.github_info._json.login;
  if (typeof githubInfoLogin === "string" && githubInfoLogin !== "")
    return githubInfoLogin;
  return "unknown";
}

function TemplateInfo(req) {
  var template_info = req.template_info_base;
  template_info['extra_detectors'] = [['include', 'Includes'], ['backup', 'Backup']];
  return template_info;
}

function ensureAuthenticated(req, res, next) {
  return req.isAuthenticated() ? next() : res.redirect('/login');
}

router.get('/', ensureAuthenticated, function(req, res) {
  res.render('options', TemplateInfo(req));
});

router.get('/template_info', ensureAuthenticated, function(req, res) {
  return res.json(TemplateInfo(req));
});

router.get("/options_list", ensureAuthenticated, function(req, res){
  req.db.get('options').aggregate([
    {$unwind: '$detector'},
    {$sort: {name: 1}},
    {$group: {_id: '$detector', modes: {$push: '$name'}}},
    {$sort: {_id: -1}}
  ]).then(docs => res.json(docs))
  .catch(err => {console.log(err.message); return res.json([]);});
});

router.get("/options_json", ensureAuthenticated, function(req, res){
  var query = url.parse(req.url, true).query;
  var name = query.name;
  if(typeof name == "undefined")
    return res.json({"ERROR": "No name provided"});

  req.db.get('options').findOne({"name": name})
  .then( doc => res.json(doc))
  .catch(error => res.json({"error": error.message}));
});

router.post("/set_run_mode", ensureAuthenticated, function(req, res){
  const doc = JSON.parse(req.body.doc);
  if (typeof doc._id != 'undefined')
    delete doc._id;
  doc['last_modified'] = new Date();
  doc['user'] = CurrentUsername(req);
  if (typeof req.body.version == 'undefined' || req.body.version != SCRIPT_VERSION)
    return res.json({res: "Please hard-reload your page (shift-f5 or equivalent)"});

  // Check permissions
  if(typeof(req.user.groups) == "undefined" || !req.user.groups.includes("daq"))
    return res.json({"err": "I can't allow you to do that Dave"});

  if(typeof doc['name'] === 'undefined')
    return res.redirect("/options");
  req.db.get('options')
    .update({name: doc['name']}, doc, {replaceOne: true, upsert: true})
    .then(() => res.status(200).json({}))
    .catch(err => {
      console.log(err.message);
      return res.status(400).json({"err": err.message});
    });
});

router.get("/remove_run_mode", ensureAuthenticated, function(req, res){
  var query = url.parse(req.url, true).query;
  var name = query.name;

  // Check permissions
  if(typeof(req.user.groups) == "undefined" || !req.user.groups.includes("daq"))
    return res.json({"err": "I can't allow you to do that Dave"});

  (async () => {
    try {
      const doc = await req.db.get('options').findOne({'name': name});
      if (!doc)
        return res.json({err: `No config named ${name}`});

      const safeName = name.replace(/[^A-Za-z0-9_.-]/g, "_");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dir = "/daq_common3/nodiaq_backups/deleted_configs";
      const filename = `${safeName}_${stamp}.json`;
      const filepath = path.join(dir, filename);
      await fs.promises.mkdir(dir, {recursive: true});
      await fs.promises.writeFile(filepath, JSON.stringify(doc, null, 2) + "\n", {flag: "wx"});
      await req.db.get('options').remove({'name': name});
      return res.status(200).json({archived: filepath});
    } catch (err) {
      console.log(err.message);
      return res.json({err: err.message});
    }
  })();
});


module.exports = router;
