// public/javascripts/status_script.js
var CHECKIN_TIMEOUT=10;
document.ceph_chart = null;
document.last_time_charts = {};
document.reader_data = {};

var readers = [];
var reader_labels = {};
var controllers = [];
var eventbuilders = [];

function GetReaderLabel(host) {
  if (typeof reader_labels[host] != 'undefined' && reader_labels[host] !== "")
    return reader_labels[host];
  return host;
}

function GetReaderSeriesName(host, variable) {
  var suffix = variable == "buff" ? " buffer" : " rate";
  return GetReaderLabel(host) + suffix;
}

function SetHosts(hosts) {
  $.getJSON("status/template_info", data => {
    reader_labels = data.readers.reduce((labels, proc) => {
      labels[proc[1]] = proc[0] || proc[1];
      return labels;
    }, {});
    readers = data.readers.map(proc => proc[1]);
    controllers = data.controllers.map(proc => proc[1]);
    eventbuilders = data.eventbuilders;
    UpdateStatusPage();
    setInterval(UpdateStatusPage, 5000);
    RedrawRatePlot();
  });
}

function GetStatus(i, checkin) {
  var statuses = ['Idle', 'Arming', 'Armed', 'Running', 'Error', 'Timeout', 'Unknown'];
  var s = statuses[i];
  var color = ['blue', 'cyan', 'cyan', 'green', 'red', 'red', 'yellow'];
  var c = checkin < CHECKIN_TIMEOUT ? color[i] : 'red';
  return "<span style='color:" + c + "'><strong>" + s + "</strong></span>";
}

function RedrawRatePlot(){
  var history = $("#menu_history_s").val();
  var resolution = $("#menu_resolution_s").val();
  var variable = $("#menu_variable_s").val();

  document.reader_data = {};
  DrawProgressRate(0);
  var limit = parseInt(history);
  var seen_so_far = 0;
  readers.forEach(reader => {
    $.getJSON("status/get_reader_history?limit="+limit+"&res="+resolution+"&reader="+reader, 
      function(data){
        if (typeof data.err != 'undefined') {
          console.log("Error: " + data.err);
          return;
        }
        for (var key in data) {
          document.reader_data[key] = data[key];
        }
        DrawProgressRate(++seen_so_far/readers.length);
        // we use seen_so_far instead of Object.keys(reader_data) because if get_reader_history returns nothing then
        // reader_data doesn't get longer, so we never reach 100% and the plot never gets drawn
        if(seen_so_far == readers.length){
          DrawInitialRatePlot();
        }
      });
  });
}

function DrawProgressRate(frac){
  var rate_chart = '#rate_chart';
  if(frac == 0){
    $(rate_chart).html('<br><br><br><div class="progress"><div id="PBAR" class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div></div><p class="text-center"><strong>Polling data for chart</strong></p>');
  }
  else if(frac == 1)
    $(rate_chart).html("");
  else{
    prog = Math.floor(100*frac);
    $('#PBAR').css('width', prog+'%').attr('aria-valuenow', prog);
  }
}

function DrawInitialRatePlot(){

  // Convert data dict to highcharts format
  var series = [];
  var variable = $("#menu_variable_s").val();
  var yaxis_label = variable == "buff" ? "MB" : "MB/s";
  readers.forEach(reader => {
    if (typeof document.reader_data[reader] == 'undefined')
      return;
    var rates = {};
    if(variable == "rate") {
      rates = {"type": "line", 
        "id": reader,
        "name": GetReaderSeriesName(reader, variable), 
        "data": document.reader_data[reader]['rate']};
    } else if(variable == "buff") {
      rates = {"type": "area", 
        "id": reader,
        "name": GetReaderSeriesName(reader, variable), 
        "data": document.reader_data[reader]['buff']};
    }
    series.push(rates);
  });

  var chart_opts = {
    chart: {
      zoomType: 'xy',
      //            margin: [5, 5, 20, 80],
    },
    plotOptions: {
      series: {
        fillOpacity: 0.3,
        lineWidth: 1
      },
    },
    credits: {
      enabled: false,
    },
    title: {
      text: '',
    },
    xAxis: {
      type: 'datetime',
    },
    yAxis: {
      title: {
        text: yaxis_label,
      },
      min: 0,
    },
    legend: {
      enabled: true,
    },
    series: series,
  };
  var div = 'rate_chart';
  document.RatePlot = Highcharts.chart(div, chart_opts);
}

function UpdateStatusPage(){
    UpdateCommandPanel();
    UpdateCrateControllers();
    UpdateFromReaders();
    UpdateBootstrax();
    UpdateDispatcher();
}

function UpdateDispatcher() {
  $.getJSON("status/get_detector_status?detector=tpc", (data) => {
    if (typeof data.checkin != 'undefined' && data.checkin < 10) {
      $("#dispatcher_status").html("online").css("color", "green");
    } else {
      $("#dispatcher_status").html("offline").css("color", "red");
    }
  });
}

function UnpackEBStatus(doc) {
  if (doc.state === 'busy') return ['green', `processing ${doc.run_id} on ${doc.cores} cores to ${doc.targets.toString()}`];
  if (doc.state === 'dead_bootstrax') return ['red', 'dead'];
  if (doc.state === 'idle') return ['blue', 'napping'];
  if (doc.state === 'hosting microstrax') return ['green', 'hosting SKYNET'];
  if (doc.state === 'clean_abandoned') return ['yellow', 'cleaning abandoned data'];
  if (doc.state === 'clean_ceph') return ['yellow', 'cleaning Ceph'];
  if (doc.state === 'clean_non_latest') return ['yellow', 'cleaning old data'];
  return ['orange', doc.state];
}

function UpdateBootstrax() {
  eventbuilders.forEach(eb => {
    $.getJSON("status/get_eb_status?eb="+eb, function(data) {
      if (Object.keys(data).length == 0)
        return;
      var eb = data.host.substr(0,3);
      var html = "";
      var timeout = 20; // seconds since last update
      if (data.checkin > timeout*1000) {
        $(`#${eb}_status`).html("dead").css("color", "red");
      } else {
        var info = UnpackEBStatus(data)
        $(`#${eb}_status`).css('color', info[0]).html(info[1]);
      }
      $(`#${eb}_checkin`).html((data['checkin']/1000).toFixed(0));
    });
  });
}

function UpdateFromReaders(){
  readers.forEach( reader => {
    $.getJSON("status/get_process_status?process="+reader, function(data){
      if (typeof data['host'] == 'undefined')
        return;
      var rd = data['host'];
      var color = data['checkin'] > CHECKIN_TIMEOUT ? 'red' : 'black';
      $("#"+rd+"_statdiv").css("color", color);
      $("#"+rd+"_status").html(GetStatus(data['status'], data['checkin']));
      $("#"+rd+"_rate").html(data['rate'].toFixed(2));
      $("#"+rd+"_check-in").html(data['checkin']);
      data['ts'] = parseInt(data['_id'].substr(0,8), 16)*1000;

      if(document.last_time_charts[rd] == undefined ||
        document.last_time_charts[rd] != data['ts']){
        document.last_time_charts[rd] = data['ts'];

        // Chart auto update
        var val = null;
        try{
          if($("#menu_variable_s").val() == "rate"){
            val = data['rate'];
          }
          else if($("#menu_variable_s").val() == "buff"){
            val = data['buffer_length'];
          }
          // Trick to only update drawing once per seven readers (careful it doesn't bite you)
          UpdateMultiChart(data['ts'], val, data['host'], data['host'] == readers[0]);
        }catch(error){
        }
      }
    }); // getJSON
  }); // forEach
}

function UpdateCrateControllers(){
  controllers.forEach( controller => {
    $.getJSON("status/get_process_status?process="+controller, data => {
      var atts = ['checkin', 'status'];
      //list_atts = ['type', 'run_number', 'pulser_freq'];
      var bool_atts = ['s_in', 'muon_veto', 'neutron_veto', 'led_trigger'];
      var c = data['host'];
      atts.forEach( att => {
        $(`#${c}_${att}`).html(att == 'status' ? GetStatus(data[att], data['checkin']) : data[att]);
      });
      var html = data['active'].reduce((html, device) => {
        var row = "<strong>"+device['type']+': </strong> ';
        row += bool_atts.reduce((tot, att) => {
          var i = device[att];
          var colors = ['red', 'green'];
          var active = ['inactive', 'active'];
          var shape = ['times', 'check'];
          return tot + `<i data-toggle="tooltip" title="${att} ${active[i]}" style="color:${colors[i]}" class="fas fa-${shape[i]}-circle"></i> `;
        }, "");
        row += "<strong>(" + device['pulser_freq'] + "Hz)</strong>";
        return html + row;
      }, "");
      if (html=="") html="no devices active";
      $('#'+c+"_devices").html(html);
    }); // getJSON
  }); // forEach
}

function UpdateCommandPanel(){
  // Fill command panel
  var recent = 0;
  var command_length = 20;
  if(typeof document.local_command_queue === "undefined")
    document.local_command_queue = [];
  if(document.local_command_queue.length !== 0){
    // Fetch all ID's newer than the first ID that hasn't been fully acknowledged   
    recent = document.local_command_queue[0]['_id'];
  }
  $.getJSON("status/get_command_queue?limit=10&id="+recent, function(data){
    var fillHTML="";
    data.forEach( doc => {
      var timestamp = parseInt(doc['_id'].substr(0,8), 16)*1000
      var date = new Date(timestamp);
      //document.local_command_queue.push(doc);

      // If this element exists then remove it cause it means
      // we might have an update so want to overwrite
      if(document.getElementById(doc['_id']) != null){
        $("#"+doc['_id']).remove();
      }

      fillHTML += '<div class="command_panel_entry panel panel-default" id="'+doc['_id']+'"><div class="panel-heading panel-hover" data-toggle="collapse" href="#collapse'+doc['_id'];
      fillHTML += '" style="padding:5px;border-bottom:0px solid #ccc"><div class="panel-title"><span data-toggle="collapse" style="color:black" ';
      fillHTML += 'href="#collapse'+doc['_id']+'">';
      fillHTML += moment(date).utc().format('YYYY-MM-DD HH:mm') + ' UTC: ';
      var tcol = "green";
      if(doc['command'] === 'stop')
        tcol = 'red';
      else if(doc['command'] === 'arm')
        tcol = 'orange';
      fillHTML += '<strong style="color:'+tcol+'">' + doc['command'] + '</strong> for detector <strong>' + doc['detector'] + '</strong> from <strong>' + doc['user'] + '</strong>';

      // See which hosts responded
      var col = "green";
      var nhosts =  '-';
      var nack = '-';
      if('host' in doc && 'acknowledged' in doc){
        nhosts = doc['host'].length;
        nack = Object.values(doc['acknowledged']).length;
        if (nhosts > nack)
          col = 'red';
        nhosts = nhosts.toString();
        nack = nack.toString();
      }
      else if('host' in doc && doc['host'].length>0 && doc['host'][0]!== null)
        nhosts = doc['host'].length.toString();
      fillHTML += "<strong style='color:"+col+"'>("+nack+"/"+nhosts+")</strong>";
      fillHTML += '</span></div></div>';
      fillHTML += '<div id="collapse'+doc['_id']+'" class="panel-collapse collapse"><div class="panel-body" style="background-color:#ccc;font-size:.75em">';
      fillHTML += JSON.stringify(doc, undefined, 4);;
      fillHTML += '</div><div class="panel-footer">';
      //                  fillHTML += 'Panel Footer';
      fillHTML += '</div></div></div></div>';
    }); // for i in data

    $("#command_panel").prepend(fillHTML);

    for(var j=data.length-1; j>=0; j-=1)// in data)
      document.local_command_queue.unshift(data[j]);

    while(document.local_command_queue.length > command_length){
      $("#"+document.local_command_queue[document.local_command_queue.length-1]['_id']).remove();
      document.local_command_queue.splice(document.local_command_queue.length-1, 1);
    }

  });

}

function UpdateMultiChart(ts, val, host, update){
  var tss = (new Date(ts)).getTime();
  if(typeof(document.RatePlot)=='undefined')
    return;
  var series = document.RatePlot.get(host);
  if(typeof series != 'undefined')
    series.addPoint([tss, val], true, update);
}

function UpdateChart(host, ts, rate, buff){
  if(host in (document.charts) && document.charts[host] != null){
    var tss = (new Date(ts)).getTime();
    document.charts[host].series[0].addPoint([tss, rate], true, true);
    document.charts[host].series[1].addPoint([tss, buff], true, true);
  }
}
