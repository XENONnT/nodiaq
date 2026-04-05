var mongoose = require('mongoose');
var DataTable = require('mongoose-datatable').default;
var runsModel;
var dbURI = process.env.RUNS_URI;
var runsdb = mongoose.connection;
var runs;
var runsTableSchema;

//DataTable.configure({ verbose: false, debug : false });
mongoose.plugin(DataTable.init);
mongoose.connect(dbURI, {authSource : process.env.RUNS_MONGO_AUTH_DB, useNewUrlParser:true, useUnifiedTopology: true});


runsdb.on('error', console.error.bind(console, 'connection error:'));
runsdb.once('open', function callback ()
	{
	    //console.log('Connection has succesfully opened');
	    var Schema = mongoose.Schema;
	    runsTableSchema = new Schema(
		{
		    number : {type: Number, required: true},
		    detectors: [String],
		    start : Date,
		    end : Date,
		    user: String,
		    mode: String,
		    source: String,
		    bootstrax: [{state: String, host: String, time: Date, started_processing: Date}],
			restrax: [{state: String, host: String}],
		    tags: [ {user: String, date: Date, name: String} ],
		    comments: [{user: String, date: Date, text: String}],
		},
		{ collection: process.env.RUNS_MONGO_COLLECTION});
	    
	    runs = mongoose.model('runs', runsTableSchema);
	    runsModel = require('mongoose').model('runs');
	});

exports.getDataForDataTable = function getData (request, response) {

  var conditions = {};
  if(typeof request.query['conditions'] !== 'undefined')
    conditions = JSON.parse(request.query['conditions']);
  // Date filtering
  if(request.query['date_min'] !== undefined){
    if(request.query['date_min'] !== '' && 
      request.query['date_max'] == '' && 
      !('start' in Object.keys(conditions)))
      conditions['start'] = {"$gt": new Date(request.query['date_min'])};
    else if(request.query['date_min'] !== '' &&
      request.query['date_max'] !== '' &&
      !('start' in Object.keys(conditions)))
      conditions['start'] = {"$gt": new Date(request.query['date_min']),
        "$lt": new Date(request.query['date_max'])};
    else if(request.query['date_min'] == '' &&
      request.query['date_max'] !== '' &&
      !('start' in Object.keys(conditions)))
      conditions['start'] = {"$lt": new Date(request.query['date_max'])};
  }
  //console.log(conditions);
  runsModel.dataTable(request.query, {conditions: conditions})
    .then((data) => response.send(data))
    .catch(function(err) {
      console.log("RUNS DB ERROR " + err); return response.send({error: err})
    });
  /*	runsModel.dataTable(request.query,  {"conditions": conditions}).then(
                            function (data) {
                                response.send(data);
                            }).catch(
                                function(err){
                                    console.log('RUNS DB ERROR ' + err);
                                });*/

};
