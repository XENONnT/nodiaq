// public/javascripts/hypervisor.js
// this isn't getting an experiment-agnostic template
// deal with it
var all_hosts = ['reader0', 'reader1', 'reader2', 'reader3', 'reader4', 'reader5','reader7', 'reader8', 'reader9',
  'eb0', 'eb1', 'eb2', 'eb3', 'eb4', 'eb5', 'oldmaster'];
var all_readout = ['reader0_controller_0', 'reader0_reader_0', 'reader1_reader_0', 'reader2_reader_0'];
var all_bootstrax = ['eb0.xenon.local', 'eb1.xenon.local', 'eb3.xenon.local', 'eb4.xenon.local', 'eb5.xenon.local'];
var all_ajax = ['ajax.eb0.xenon.local', 'ajax.eb1.xenon.local', 'ajax.eb3.xenon.local', 'ajax.eb4.xenon.local', 'ajax.eb5.xenon.local'];

function ControlBase(command, action, target) {
  $.ajax({
    type: 'POST',
    url: 'hypervisor/control',
    data: {data: {command: command, action: action, target: target}},
    success: (result, status, xhr) => {},
    error: (jqXHR, text, error) => {alert("Error " + error + ": " + text);}
  });
}

function VMEControl(obj) {
  var crate = obj.getAttribute('id').slice(3,4);
  var action = obj.textContent.trim().toLowerCase();
  ControlBase('vmectl', action, crate);
}

function NIMControl(obj) {
  var crate = obj.getAttribute('id').slice(3,4);
  var action = obj.textContent.trim().toLowerCase();
  ControlBase('nimctl', action, crate);
}

function RedaxControl(obj) {
  var proc = obj.getAttribute('id').slice(0,-4);
  var action = obj.textContent.trim().toLowerCase();
  if (proc.slice(0,7) === 'readout')
    proc = 'all';
  ControlBase("redaxctl", action, proc);
}

function BootstraxControl(obj) {
  var eb = obj.getAttribute("id").slice(0,3);
  var action = obj.textContent.trim().toLowerCase();
  ControlBase('bootstraxctl', action, eb);
}

function AjaxControl(obj) {
  var eb = obj.getAttribute("id").slice(5,8);
  var action = obj.textContent.trim().toLowerCase();
  ControlBase('ajaxctl', action, eb);
}

function EBSync(obj) {
  var eb = obj.getAttribute("id").slice(0,3);
  ControlBase('ebctl', 'sync', eb);
}

function MicrostraxControl(obj) {
  var action = obj.textContent.trim().toLowerCase()
  ControlBase('microstraxctl', action, 'eb2');
}

function BootstraxAllControl(obj) {
    var action = obj.getAttribute("id").slice(14, -4);
    ControlBase('bootstraxctl', action, 'all');
}

function AjaxAllControl(obj) {
    var action = obj.getAttribute("id").slice(9, -4);
    ControlBase('ajaxctl', action, 'all');
}

function UpdateHosts() {
  var timeout = 5000;
  var svgobj = document.getElementById("svg_frame").contentDocument;
  for (var i in all_hosts) {
    $.getJSON('hosts/get_host_status?host='+all_hosts[i], (data) => {
      if (Object.entries(data).length == 0) return;
      if (typeof data.err != 'undefined') {
        console.log(data);
        return;
      }
      try{
        var p = /xenon\.local/; // ebx.xenon.local
        if (p.test(data['host']))
          data['host'] = data['host'].substr(0,3);
        if (data['checkin'] > timeout) {
          svgobj.getElementById(data['host']+"_status").style.fill='red';
        } else {
          svgobj.getElementById(data['host']+"_status").style.fill='lime';
        }
      }catch(error){
        console.log(error);
        console.log(data);
      }
    });
  }
}

function UpdateVME() {
  var timeout = 10000;
  var svgobj = document.getElementById("svg_frame").contentDocument;
  $.getJSON('hosts/get_host_status?host=crate', (data) => {
    if (Object.entries(data).length == 0) return;
    if (typeof data.err != 'undefined') {
      console.log(data);
      return;
    }
    //console.log(data);
    try{
      for (var i = 0; i < 5; i++) {
        // VME crates
        var d = data['vme'+i];
        var ON = d["IMON_0"] > 0;
        for (var ch = 0; ch < 3; ch++) {
          var imon = Math.round(10*d['IMON_'+ch])/10; // round to 0.1
          svgobj.getElementById(`vme${i}_${ch}`).textContent = imon + '/' + d['ISET_'+ch];
        }
        svgobj.getElementById("vme"+i+"_bkg").style.fill = ON ? "red" : "FF7777";
        svgobj.getElementById("vme"+i+"_btn").children[0].textContent = ON ? "OFF" : "ON";
      }
      for (var i = 0; i < 6; i++) {
        // NIM crates
        var d = data['nim'+i];
        for (var ch = 0; ch < 6; ch++) {
          var imon = Math.round(10*d['IMON_'+ch])/10; // round to 0.1
          svgobj.getElementById(`nim${i}_${ch}`).textContent = imon + '/' + d['ISET_'+ch];
        }
      }
      svgobj.getElementById("vme_timeout").style.fill=data['checkin'] > timeout ? "black" : "red";
    }catch(error){
      console.log(error);
      console.log(data);
    }
  });
}

function UpdateReadout() {
  var timeout = 5000;
  var svgobj = document.getElementById("svg_frame").contentDocument;
  for (var i in all_readout) {
    $.getJSON('hypervisor/readout_status?host='+all_readout[i], (data) => {
      if (Object.entries(data).length == 0) return;
      if (typeof data.err != 'undefined') {
        console.log(data);
        return;
      }
      try{
        var host_i = data.host[6];
        if (data.checkin > timeout) {
          svgobj.getElementById(data.host+"_status").style.fill='red';
          svgobj.getElementById(data.host+"_label").textContent="START";
        } else {
          svgobj.getElementById(data.host+"_status").style.fill='lime';
          svgobj.getElementById(data.host+"_label").textContent="STOP";
        }
      }catch(error){
        console.log(error);
        console.log(data);
      }
    });
  }
}

function UpdateBootstrax() {
  var timeout = 20000;
  var svgobj = document.getElementById("svg_frame").contentDocument;
  for (var i in all_bootstrax) {
    $.getJSON('hypervisor/eb_status?host='+all_bootstrax[i], (data) => {
      if (Object.entries(data).length == 0) return;
      if (typeof data.err != 'undefined') {
        console.log(data);
        return;
      }
      var host = data['host'].substr(5,8);
      try{
        if (data.checkin > timeout) {
          svgobj.getElementById(data.host+"_bootstrax_status").style.fill='red';
          svgobj.getElementById(data.host+"_bootstrax_label").textContent="START";
        } else {
          svgobj.getElementById(data.host+"_bootstrax_status").style.fill='lime';
          svgobj.getElementById(data.host+"_bootstrax_label").textContent="STOP";
        }
      }catch(error){
        console.log(error);
        console.log(data);
      }
    });
  }
}

function UpdateAjax() {
  var timeout = 3600*1000*1.5;
  var svgobj = document.getElementById("svg_frame").contentDocument;
  for (var i in all_ajax) {
    $.getJSON('hypervisor/eb_status?host='+all_ajax[i], (data) => {
      if (Object.entries(data).length == 0) return;
      if (typeof data.err != 'undefiend') {
        console.log(err);
        return;
      }
      var host = data['host'].substr(5,8);
      try{
        if (data.checkin > timeout) {
          svgobj.getElementById(host+"_ajax_label").textContent="START";
          svgobj.getElementById(host+"_ajax_status").style.fill="red";
        } else {
          svgobj.getElementById(host+"_ajax_label").textContent="STOP";
          svgobj.getElementById(host+"_ajax_status").style.fill="lime";
        }
      }catch(error){
        console.log(error);
        console.log(data);
      }
    });
  }
}

function UpdateLoop() {
  UpdateHosts();
  UpdateVME();
  UpdateReadout();
  UpdateBootstrax();
  UpdateAjax();
  $.getJSON('hypervisor/eb_status?host=microstrax.eb2.xenon.local', (data) => {
    if (Object.entries(data).length == 0) return;
    if (typeof data.err != 'undefined') {
      console.log(err);
      return;
    }
    var svgobj = document.getElementById("svg_frame").contentDocument;
    var timeout = 30000;
    try{
      if (data.checkin > timeout) {
        svgobj.getElementById("eb2_microstrax_label").textContent="START";
        svgobj.getElementById("eb2_microstrax_status").style.fill="red";
      } else {
        svgobj.getElementById("eb2_microstrax_label").textContent="STOP";
        svgobj.getElementById("eb2_microstrax_status").style.fill="lime";
      }
    }catch(error){
      console.log(error);
      console.log(data);
    }
  });
}

function SetupButtons() {
  var svgobj = document.getElementById("svg_frame").contentDocument;

  var redax = ["readout_start_all_btn", "readout_stop_all_btn", "reader0_controller_0_btn",
    "reader0_reader_0_btn", "reader1_reader_0_btn", "reader2_reader_0_btn"];
  for (var i in redax) {
    try{
      svgobj.getElementById(redax[i]).addEventListener("click", function() {RedaxControl(this);});
    }catch(error){
      console.log(error);
      console.log(redax[i]);
    }
  }

  var vme = ["vme0_btn", "vme1_btn", "vme2_btn", "vme3_btn", "vme4_btn", "vmea_on_btn", "vmea_off_btn"];
  for (var i in vme) {
    svgobj.getElementById(vme[i]).addEventListener("click", function() {VMEControl(this);});
  }

/*  buttons with this id don't exist yet
  var nim = ["nim0_btn", "nim1_btn", "nim2_btn", "nim3_btn", "nim4_btn", "nim5_btn", "nima_on_btn", "nima_off_btn"];
  for (var i in nim) {
    svgobj.getElementById(nim[i]).addEventListener("click", function() {NIMControl(this);});
  }
*/

  var eb = ['eb0', 'eb1', 'eb3', 'eb4', 'eb5'];
  for (var i in eb) {
    try{
      svgobj.getElementById(eb[i]+"_ajax_btn").addEventListener("click",
        function() {AjaxControl(this);});
      svgobj.getElementById(eb[i]+"_sync").addEventListener("click",
        function() {EBSync(this);});
      svgobj.getElementById(eb[i]+"_bootstrax_btn").addEventListener("click",
        function() {BootstraxControl(this);});
    }catch(error){
      console.log(error);
      console.log(eb[i]);
    }
  }

  try{
    svgobj.getElementById("eb2_sync").addEventListener("click", function() {EBSync(this);});
    svgobj.getElementById("eb2_microstrax_btn").addEventListener("click",
      function() {MicrostraxControl(this);});
  }catch(error){
    console.log(error);
    console.log("eb2");
  }

  var bs_all = ['eba_bootstrax_start_btn', 'eba_bootstrax_stop_btn']
  for (var i in bs_all) {
      try{
          svgobj.getElementById(bs_all[i]).addEventListener("click", function() {BootstraxAllControl(this);});
      }catch(error){
        console.log(error);
        console.log(bs_all[i]);
      }
  }

  var ajax_all = ['eba_ajax_start_btn', 'eba_ajax_stop_btn']
  for (var i in bs_all) {
      try{
          svgobj.getElementById(ajax_all[i]).addEventListener("click", function() {AjaxAllControl(this);});
      }catch(error){
        console.log(error);
        console.log(ajax_all[i]);
      }
  }

}
