// public/javascripts/hosts.js
var hosts = [];

function FormatNumber(value, digits) {
  if (value === null || value === undefined) {
    return '-';
  }
  var num = Number(value);
  if (Number.isNaN(num)) {
    return '-';
  }
  return num.toFixed(digits);
}

function FormatArray(values, digits) {
  if (!Array.isArray(values)) {
    return FormatNumber(values, digits);
  }
  return values.map(value => FormatNumber(value, digits)).join(", ");
}

function SetHosts() {
  $.getJSON('hosts/template_info', data => {
    hosts = data.hosts;
    DrawMonitorCharts();
    UpdateMonitorPage();
    setInterval(UpdateMonitorPage, 5000);
  });
}

function UpdateMonitorPage(){
  hosts.forEach(host => {
    $.getJSON("hosts/get_host_status?host="+host, (data) => {
      // Set attributes
      var h = data.host;
      if (typeof h == 'undefined')
        return;
      $(`#${h}_cpu_percent`).html(FormatNumber(data['cpu_percent'], 2));
      ['cpu_count','cpu_count_logical'].forEach(att => {
        $(`#${h}_${att}`).html(FormatNumber(data[att], 2));
      });
      $(`#${h}_mem_total`).html(FormatNumber(data['virtual_memory']['total']/1e9, 2) + " GB");
      $(`#${h}_mem_used`).html(FormatNumber(data['virtual_memory']['percent'], 2) + "%").css("color", data['virtual_memory']['percent'] > 75 ? 'red' : 'black');
      $(`#${h}_swap`).html(FormatNumber(data['swap_memory']['percent'], 2) + "%").css("color", data['swap_memory']['percent'] > 75 ? 'red' : 'black');
      $(`#${h}_load`).html(FormatArray(data['load'], 2));
      $(`#${h}_drift`).html(FormatNumber(data['drift'], 2) + ' s').css("color", Math.abs(data['drift']) > 2 ? 'red' : 'black');
      [0,1].forEach(val => {
        var tempVal = data.temperature ? data.temperature[`package_id_${val}`] : null;
        var tempText = FormatNumber(tempVal, 2);
        if (tempText === '-') {
          tempText = 'n/a';
        }
        $(`#${h}_cpu${val}_temp`).html(tempText + " C");
      });
      var html = "";
      html = Object.entries(data['disk']).reduce((total, disk) => {
        total += `<div class='col-12' style='font-size:14px'><strong>`;
        total += disk[0] + "</strong></div>";
        total += `<div class='col-4' style='font-size:12px'><strong>Total: </strong></div>`;
        total += `<div class='col-8' style='font-size:12px'>`;
        total += FormatNumber(disk[1]['total']/1e9, 2) + " GB</div>";
        total += `<div class='col-4' style='font-size:12px'><strong>Used: </strong></div>`;
        total += `<div class='col-8' style='font-size:12px'>`;
        total += FormatNumber(disk[1]['percent'], 2) + "%</div>";
        return total;
      }, html);
      $(`#${h}_disk_row`).html(html);

      // Update charts
      var timestamp = data['_id'].toString().substring(0,8);
      //var ts = new Date( parseInt( timestamp, 16 ) * 1000 );
      var ts = parseInt(timestamp, 16) * 1000;
      if(typeof(document.last_time_charts) != "undefined" &&
        data.host in document.last_time_charts &&
        !isNaN(ts) && document.last_time_charts[h] != ts){
        document.last_time_charts[data.host] = ts;
        //UpdateHostOverview(ts, data);
      }
    }); // getJSON
  }); // hosts.forEach
}

function UpdateHostOverview(ts, data){
  var h = data.host;
  if(h in document.charts && document.charts[h] != null){
    for(i in document.charts[h].series){
      if(document.charts[h].series[i]['name'] == 'cpu')
        document.charts[h].series[i].addPoint([ts, data['cpu_percent']], true, true);
      else if(document.charts[h].series[i]['name'] == "mem")
        document.charts[h].series[i].addPoint([ts, data['virtual_memory']['percent']], true, true);
      else if(document.charts[h].series[i]['name'] == "swap")
        document.charts[h].series[i].addPoint([ts, data['swap_memory']['percent']], true, true);
      else if (document.charts[h].series[i]['name'] == 'temp0')
        document.charts[h].series[i].addPoint([ts, data['temperature']['package_id_0']], true, true);
      else if (document.charts[h].series[i]['name'] == 'temp1')
        document.charts[h].series[i].addPoint([ts, data['temperature']['package_id_1']], true, true);
    }
  }
}

function DrawMonitorCharts(){
  document.charts = {};
  document.last_time_charts = {};
  var resolution = $('#menu_resolution').val();
  var lookback = $('#menu_lookback').val();

  hosts.forEach(host => {
    $.getJSON(`hosts/get_host_history?lookback=${lookback}&resolution=${resolution}&host=${host}`, data => {
      var h = host;

      var div = h + "_chart";
      document.last_time_charts[h] = data[0]['data'][data[0]['data'].length-1][0];
      document.charts[host] = Highcharts.chart(
        div, {
          chart: {
            zoomType: 'x',
          },
          credits: {
            enabled: false
          },
          title: {
            text: "",
          },
          xAxis: {
            type: "datetime",
          },
          yAxis: {
            title: {
              text: "%",
            },
            min: 0,
            max: 110,
            endOnTick: false
          },
          plotOptions:{
            series: {
              lineWidth: 1
            },
          },
          legend: {
            enabled: true,
            align: "right",
            layout: "vertical"
          },
          series: data
        }); // chart
    }); // getJSON
  }); // hosts.forEach
}
