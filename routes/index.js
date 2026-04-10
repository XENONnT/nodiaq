var express = require('express');
var url = require('url');
var http = require('https');
var router = express.Router();
var gp="";

function ensureAuthenticated(req, res, next) {
  return req.isAuthenticated() ? next() : res.redirect('/login');
}

/* GET home page. */
router.get('/', ensureAuthenticated, function(req, res) {
  res.render('index', req.template_info_base);
});

router.get('/template_info', ensureAuthenticated, function(req, res) {
  return res.json(req.template_info_base);
});

router.get('/get_current_shifters', ensureAuthenticated, function(req, res){
  var today = new Date();
  req.users_db.get('shifts').aggregate([
    {$match: {start: {$lte: today}, end: {$gte: today}}},
    {$lookup: {from: 'users', localField: 'shifter', foreignField: 'lngs_ldap_uid', as: 'userdoc'}},
    {$project: {udoc: {$first: '$userdoc'}, shifter: 1, type: 1}},
    {$project: {
      'shifter': '$udoc.lngs_ldap_uid',
      'shift_type': '$type',
      'shifter_name': {$concat: ['$udoc.first_name', ' ', '$udoc.last_name']},
      'shifter_email': {$ifNull: ['$udoc.email', 'Not set']},
      'shifter_phone': {$ifNull: ['$udoc.cell', 'Not set']},
      'shifter_skype': {$ifNull: ['$udoc.skype', 'Not set']},
      'shifter_github': {$ifNull: ['$udoc.github', 'Not set']}
    }}
  ]).then(docs => res.json(docs))
  .catch(err => {console.log(err.message); return res.json([]);});
});

router.get('/account', ensureAuthenticated, function(req, res){
    res.render('account', req.template_info_base);
});

router.get('/account/request_github_access', ensureAuthenticated, function(req, res){

    var owner = process.env.GITHUB_ADMIN_USER;
    var password = process.env.GITHUB_ADMIN_PASSWORD;
    var gid = req.user.github;
    var q = url.parse(req.url, true).query;
    var group = q.group;

    // Just in case
    if(group != 'xenon1t' && group != 'xenonnt'){
	console.log(group);
	return res.json({"error": "sneaky"});
    }

  axios.post('https://api.github.com/orgs/xenonnt/invitations',
    {"invitee_id": gid,
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET
    },
    {headers: {'Accept': 'application/vnd.github.v3+json'}},

    options = {
	hostname: 'api.github.com',
	port: 443,
	path: '/orgs/' + group + '/memberships/' + gid,
	method: 'PUT',
	body: {
	    "role": "member",
	    "state": "active"
	},
	auth: owner + ":" + password,
	headers: {
	    "User-Agent": "Other"
	}
	//'Content-Type': 'application/x-www-form-urlencoded',
	//'Content-Length': Buffer.byteLength(postData)
	//}
    }).then( resp => {
      console.log(resp);
    }).catch (err => {
      console.log(err);
    });
});

router.get('/account/request_api_key', ensureAuthenticated, function(req, res){

    var api_username = req.user.lngs_ldap_uid;
    if (typeof req.user.lngs_lap_uid == 'undefined')

    // Generate API key
    var apikey = require("apikeygen").apikey;
    var key = apikey();

    // Hash it
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    //var salt = bcrypt.genSaltSync(saltRounds);
    //var hash = bcrypt.hashSync(key, salt);
    bcrypt.hash(key, saltRounds, function(err, hash) {

        req.users_db.get('users').update({"lngs_ldap_uid": req.user.lngs_ldap_uid},
		          {"$set": {"api_key": hash}});
        req.user.api_key = key;
        return res.redirect(gp+"/account");
    });
});

router.post('/updateContactInfo', ensureAuthenticated, (req, res) => {
  var collection = req.users_coll;
  var idoc = {};
  if(req.body.email != ""){
    idoc['email'] = req.body.email;
    req.user.email = req.body.email;
  }
  if(req.body.skype != ""){
    idoc["skype"] = req.body.skype;
    req.user.skype = req.body.skype;
  }
  if(req.body.cell != ""){
    idoc["cell"] = req.body.cell;
    req.user.cell = req.body.cell;
  }
  if(req.body.favorite_color != ""){
    idoc["favorite_color"] = req.body.favorite_color;
    req.user.favorite_color = req.body.favorite_color;
  }
  var query = {"first_name": req.user.first_name,"last_name": req.user.last_name};
  req.users_db.get('users').update(query, {"$set": idoc});
  return res.redirect(gp+'/account');
});

router.get('/login', function(req, res){
    res.render('login', { user: req.user });
});

router.get('/logout', function(req, res){
    req.logout(function(err) {
        if (err) {
            console.log(err.message || err);
        }
        res.redirect('/');
    });
});


router.get("/verify", function(req, res){
    var q = url.parse(req.url, true).query;
    var code = q.code;
    var timeout = 10*1000*60;
    req.users_db.collection('users').find({"github_hash": code},
		    function(e, docs){
			if(docs.length == 1){
                console.log('GITHUB verification at ' + new Date() + ' | ' + docs[0]["auth_time"]);
                if (new Date() - docs[0]["auth_time"] > timeout) {
                    collection.update({"_id": docs[0]["_id"]},
                        {$unset: {github_temp: 1, github_hash: 1, auth_time: 1
                        }});
                    return res.render("confirmationLander",
                        {message: "That code has expired"});
                }
			    collection.update({'_id': docs[0]['_id']},
					      {$set: {github: docs[0]['github_temp']},
					       $unset: {github_temp: 1, github_hash: 1, auth_time: 1}});
			    return res.render("confirmationLander",
					      {message: "Account linked, you can now login"});
			}
			else
			    res.render("confirmationLander",
				       {message: "Couldn't find an account to link"});
		    });

});

router.get("/verify_ldap", function(req, res){
    var q = url.parse(req.url, true).query;
    var code = q.code;
    var timeout = 10*1000*60;
    req.users_db.collection('users').find({"ldap_hash": code},
                    function(e, docs){
                        if(docs.length == 1){
                            console.log('LDAP verification at ' + new Date() + ' + ' + docs[0]["auth_time"]);
                            if (new Date() - docs[0]["auth_time"] > timeout) {
                                collection.update({
                                    "_id": docs[0]["_id"]},
                                    {"$unset": {
                                        "ldap_temp": 1,
                                        "ldap_hash": 1,
                                        "auth_time": 1
                                    }});
                                return res.render("confirmationLander",
                                    {message: "That code has expired"})
                            }
                            collection.update({'_id': docs[0]['_id']},
                                              {$set: {lngs_ldap_uid: docs[0]['ldap_temp']},
                                               $unset: {ldap_temp: 1, ldap_hash: 1, auth_time: 1}});
                            return res.render("confirmationLander",
                                              {message: "Account linked, you can now login"});
                        }
                        else
                            res.render("confirmationLander",
                                       {message: "Couldn't find an account to link"});
                    });

});

function SendConfirmationMail(req, random_hash, link, callback){
    // send mail
    var transporter = req.transporter;
    var mailOptions = {
        from: process.env.DAQ_CONFIRMATION_ACCOUNT,
        to: req.body.email,
        subject: 'XENONnT Account Confirmation',
        html: '<p>Please click <a href="https://xenon1t-daq.lngs.infn.it/'+link+'?code='+random_hash+'">here</a> within the next 10 minutes to verify your email.</p><p>If you did not request this email please delete.</p>'
    };
    
    transporter.sendMail(mailOptions, function(error, info){
	if (error) {
            console.log(error);
	    callback(false);
	}
	callback(true);
    });
}

router.post("/linkLDAP", function(req, res) {
    var collection = req.users_coll;
    if(req.body.lngs_id != "" && req.body.email != ""){
	collection.find({"email": req.body.email},
			function(e, docs){
			    //TryToFindUser(docs, req.body.email, collection, function(haveUser){
				//if(!haveUser)
                if (docs.length == 0)
				    return res.render(
					"confirmationLander",
					{message: "You don't seem to be in our database"});
				
				// Synchronous
				const cryptoRandomString = require('crypto-random-string');
				const random_hash = cryptoRandomString({length: 64, type: 'url-safe'});
				collection.update({"email": req.body.email},
						  {"$set": {"ldap_temp": req.body.lngs_id,
                                    "ldap_hash": random_hash,
                                    "auth_time": new Date()}});
				// Send Mail
				SendConfirmationMail(req, random_hash, 'verify_ldap', function(success){
				    if(success)
					return res.render("confirmationLander",
							  {message: "Check your email"});
				    else
					return res.render(
					    "confirmationLander",
					    {message: "Failed to send email confirmation"});
				    }); // end confirmation mail callback
			//}); // end try to find user callback
			}); // end mongo query callback
    }
    else
        return res.render("confirmationLander", 
			  {message: "You must provide a valid email and LDAP ID"});
});

router.post("/linkGithub", function(req, res) {
    var collection = req.users_coll;
    if(req.body.github != "" && req.body.email != ""){
	// set github ID to github_temp and send mail
	collection.find({"email": req.body.email},
			function(e, docs){
			    //TryToFindUser(docs, req.body.email, collection, function(haveUser){
                //                if(!haveUser)
                if (docs.length == 0)
                                    return res.render(
                                        "confirmationLander",
                                        {message: "You don't seem to be in our database"});

				// Synchronous
				const cryptoRandomString = require('crypto-random-string');
				var random_hash = cryptoRandomString({length : 64, type : 'url-safe'});
				collection.update({"email": req.body.email},
						  {"$set": {"github_temp": req.body.github,
							        "github_hash": random_hash,
                                    "auth_time": new Date()}});
				// Send Mail
                SendConfirmationMail(req, random_hash, 'verify', function(success){
                                    if(success)
					return res.render("confirmationLander",
							  {message: "Check your email"});
                                    else
					return res.render("confirmationLander",
							  {message: "Failed to send email confirmation"});
				}); // End email callback
//			    }); // End user callback
			});	// End mongo callback
    }
    else
	return res.render("confirmationLander", 
			  {message: "You must provide a valid email and GitHub account ID"});
});


module.exports = router;
