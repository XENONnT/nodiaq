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
    $("#"+div).html(data.reduce((total, entry) => {
      const groupLabel = detectors_local[entry["_id"]] || entry["_id"];
      const groupHtml = entry.modes.reduce(
        (tot, mode) => tot + `<option value='${mode}'>${mode}</option>`,
        `<optgroup label='${groupLabel}'>`
      );
      return total + groupHtml + "</optgroup>";
    }, ""));
    $("#"+div).prop('disabled', false);
    const $select = $('#'+div);
    if ($select.data('selectpicker')) $select.selectpicker('refresh');
    else $select.selectpicker();
  });
}

function FetchMode(select_div){
  mode = $('#'+select_div).val();
  $.getJSON('options/options_json?name=' + encodeURIComponent(mode), function(data){
    document.jsoneditor.set(data);
  });
}

function SubmitMode(){
  try{JSON.parse(JSON.stringify(document.jsoneditor.get()));}
  catch(error){alert(error);return}
  $.post("options/set_run_mode", {"doc": JSON.stringify(document.jsoneditor.get()), "version": SCRIPT_VERSION})
    .done(function(data){
      if (data && typeof data.res != 'undefined')
        alert(data.res);
      else if (data && typeof data.err != 'undefined')
        alert(data.err);
      else
        location.reload();
    })
    .fail(function(jqXHR){
      const data = jqXHR && jqXHR.responseJSON ? jqXHR.responseJSON : null;
      const message =
        (data && (data.err || data.res)) ||
        (jqXHR && jqXHR.responseText) ||
        "Failed to update config";
      alert(message);
    });
};

function RemoveMode(select_div){
  const name = $("#" + select_div).val();
  $.get("options/remove_run_mode?name=" + encodeURIComponent(name), function(data){
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
