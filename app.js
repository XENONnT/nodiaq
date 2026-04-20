var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require("body-parser");
var gp="";
var asset_version = "20260420";

// General MongoDB Access via monk
var monk = require('monk');

console.log("");
console.log("NOW: " + new Date());
console.log("");

var runs_cstr = process.env.RUNS_URI;
//console.log("Runs DB " + runs_cstr);
var runs_db = monk(runs_cstr, {authSource : process.env.RUNS_MONGO_AUTH_DB});

// In case different
var users_cstr = process.env.USERS_URI;
//console.log("Users DB " + users_cstr);
var users_db = monk(users_cstr, {authSource: process.env.USERS_MONGO_AUTH_DB});

var dax_cstr = process.env.DAQ_URI;
//console.log("DAX DB " + dax_cstr);
var db = monk(dax_cstr, {authSource: process.env.DAQ_MONGO_AUTH_DB});

// Routers for all the sub-sites
var indexRouter = require('./routes/index');
var optionsRouter = require('./routes/options');
var hostsRouter = require('./routes/hosts');
var runsRouter = require('./routes/runsui');
var logRouter = require('./routes/logui');
var helpRouter = require('./routes/help');
var statusRouter = require('./routes/status');
var authRouter = require('./routes/auth');
var controlRouter = require('./routes/control');
var monitorRouter = require('./routes/monitor');
var equipmentRouter = require('./routes/equipment');
var apiRouter = require('./routes/api');
var hvRouter = require('./routes/hypervisor');

// For Runs DB Datatable
var runs_mongo = require("./runs_mongo");

// Using express!
var app = express();

// For parsing POST data from request body
app.use(bodyParser.urlencoded({extended: true}));

// LONG STUFF TRY TO SPLIT OUT?
// Session caching
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
var uri = `mongodb://${process.env.DAQ_MONGO_USER}:${process.env.MONGO_PASSWORD_DAQ}@${process.env.DAQ_MONGO_HOST}:${process.env.DAQ_MONGO_PORT}/${process.env.DAQ_MONGO_AUTH_DB}`;

var store = new MongoDBStore({
  uri: uri,
  collection: 'mySessions'
});

store.on('connected', function() {
  store.client; // The underlying MongoClient object from the MongoDB driver
});

// Catch errors
var assert = require("assert");
store.on('error', function(error) {
  assert.ifError(error);
  assert.ok(false);
  //console.log(error);
});

app.use(session({
  secret: process.env.EXPRESS_SESSION,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
  store: store,
  // Boilerplate options, see:
  // * https://www.npmjs.com/package/express-session#resave
  // * https://www.npmjs.com/package/express-session#saveuninitialized
  resave: true,
  saveUninitialized: false
}));

// Passport Auth
var passport = require("passport");
require("./config/passport");
app.use(passport.initialize());
app.use(passport.session());


// End auth
// End long stuff
//require("./mongo_session_cache.js")
//require("./passport_session.js")


// Aliases for paths to node_modules (you might want to just copy .mins to static folder)
app.use('/bs', express.static(__dirname + '/node_modules/bootstrap3/dist/'));
app.use('/jq', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use('/je', express.static(__dirname + '/node_modules/jsoneditor/dist/'));


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Favicon
var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    req.runs_coll = runs_db.get(process.env.RUNS_MONGO_COLLECTION);
    req.users_db = users_db;
    next();
});


app.use(function(req, res, next) {
  res.locals.asset_version = asset_version;
  if (req.isAuthenticated()) {
    res.locals.user = req.user;
    req.is_daq = typeof req.user != 'undefined' && typeof req.user.groups != 'undefined' && req.user.groups.includes('daq');
    req.template_info_base = {
      pagetitle: 'XENONnT DAQ',
      detectors: [['tpc', 'TPC'], ['muon_veto', 'Muon Veto'], ['neutron_veto', 'Neutron Veto']],
      headertitle: 'XENONnT Data Acquisition',
      shortcuts : req.is_daq ? ['index', 'control', 'status', 'options', 'hosts', 'runs', 'monitor'] : ['index', 'control', 'status', 'runs', 'monitor', 'shifts', 'users'],
      asset_version: asset_version,
    };
  } else {
    req.template_info_base = {
      pagetitle: 'LZ DAQ',
      detectors: [['lz_tpc', 'LZ TPC'], ['lz_veto', 'LZ Veto']],
      headertitle: 'LZ Data Acquisition',
      shortcuts : ['index', 'control', 'status', 'runs', 'monitor', 'shifts', 'users'],
      asset_version: asset_version,
    };
  }
  next();
});

// This is the route for the automatic runs datatable api function
app.get('/runtable/getDatatable', runs_mongo.getDataForDataTable);

app.use('/', indexRouter);
app.use('/options', optionsRouter);
app.use('/hosts', hostsRouter);
app.use('/runsui', runsRouter);
app.use('/logui', logRouter);
app.use('/help', helpRouter);
app.use('/status', statusRouter);
app.use('/auth', authRouter);
app.use('/control', controlRouter);
app.use('/monitor', monitorRouter);
app.use('/equipment', equipmentRouter);
app.use('/api', apiRouter);
app.use('/hypervisor', hvRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
