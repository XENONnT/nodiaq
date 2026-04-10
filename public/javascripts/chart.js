function UpdateChart(ts, rate){
    if(document.ratechart != null)
	document.ratechart.series[0].addPoint([ts, rate], true, true);
}
function DrawChart(div){
    //{fdaq00: {x:[] y:[]}}
    ///status_history
    $.getJSON("/status_history?limit=500", function(data){
	//console.log(data);
	thedata = {};
	var hosts = Object.keys(data);
	console.log("HOSTS");
	console.log(hosts);
	for(var i in hosts){
	    var host = hosts[i];
	    thedata[host] = [];	    
	    for(var entry in data[host]){
		thedata[host].push([parseInt(data[host][entry][0]),
				    parseFloat(data[host][entry][1])]);
	    }
	}
	var series = [];
	for(var i in hosts){
	    series.push({
		"type": "area",
		"name": host,
		"data": thedata[hosts[i]]
	    })
	    if(thedata[hosts[i]] > document.last_time_chart)
		document.last_time_chart = thedata[hosts[i]];
	}

	document.ratechart = Highcharts.chart(div, {
	    chart: {
		zoomType: 'x'
	    },
	    credits: {enabled: false},
	    title: {
		text: '',
	    },
	    //subtitle: {
	    //text: document.ontouchstart === undefined ?
	    //'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
	    //},
	    xAxis: {
		type: 'datetime'
	    },
	    yAxis: {
		title: {
		    text: 'Rate [MB/s]'
		},
		min: 0.,
	    },
	    legend: {
		enabled: false
	    },
	    plotOptions: {
		area: {
		    fillColor: {
			linearGradient: {
			    x1: 0,
			    y1: 0,
			    x2: 0,
			    y2: 1
			},
			stops: [
			    [0, Highcharts.getOptions().colors[0]],
			    [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
			]
		    },
		    marker: {
			radius: 2
		    },
		    lineWidth: 1,
		    states: {
			hover: {
			    lineWidth: 1
			}
		    },
		    threshold: null
		}
	    },

	    series: series,
	    //[{
	//	type: 'area',
	//	name: 'DAQ rate',
	//	data: thedata
	  //  }]
	});
    });
}
