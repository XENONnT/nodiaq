// public/javascripts/options_scripts.js
var detectors_local = {};
const SCRIPT_VERSION = '20210622';

function SetDetectorsLocal(){
  $.getJSON("options/template_info", data => {
    data.detectors.forEach(det => {detectors_local[det[0]] = det[1];});
    data.extra_detectors.forEach(det => {detectors_local[det[0]] = det[1];});
    PopulateModeList("run_mode_select");
  });
}

function PopulateModeList(div){
  $.getJSON("options/options_list", function(data){
    $("#"+div).html(data.reduce((total, entry) => entry.modes.reduce((tot, mode) => tot + `<option value='${mode}'>${mode}</option>`, total + `<optgroup label='${detectors_local[entry["_id"]]}'>`), ""));
    $("#"+div).prop('disabled', false);
    $('#'+div).selectpicker();
  });
}

function FetchMode(select_div){
  mode = $('#'+select_div).val();
  $.getJSON('options/options_json?name='+mode, function(data){
    document.jsoneditor.set(data);
  });
}

function SubmitMode(){
  try{JSON.parse(JSON.stringify(document.jsoneditor.get()));}
  catch(error){alert(error);return}
  $.post("options/set_run_mode", {"doc": JSON.stringify(document.jsoneditor.get()), "version": SCRIPT_VERSION}, function(data){
    if (typeof data.res != 'undefined')
      alert(data.res);
    else
      location.reload();
  });
};

function RemoveMode(select_div){
  $.get("options/remove_run_mode?name="+$("#"+select_div).val(), function(data){
    if (typeof data.err != 'undefined') {
      alert("Delete failed: " + data.err);
      return;
    }
    if (typeof data.res != 'undefined') {
      alert(data.res);
      return;
    }
    if (typeof data.archived != 'undefined') {
      alert("Archived to: " + data.archived);
    }
    location.reload();
  });
}
