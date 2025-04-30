//public/javascript/equpment_script.js

function dateToYMD(date) {
  var strArray=['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var d = date.getDate();
  var m = strArray[date.getMonth()];
  var y = date.getFullYear();
  return '' + (d <= 9 ? '0' + d : d) + '. ' + m + '. ' + y;
}

function InitializeTable(DOM){

  // Get the window height minus padding (80px)
  var vh = $(window).height() - $("#header").outerHeight(true);
  var hw = $(window).width();
  $.getJSON('equipment/getEquipment', function(data){

    table = $(DOM).DataTable({
      "data": data,
      "columns": [
        { "data": "manufacturer" },
        { "data": "model" },
        { "data": "type" },
        { "data": "serial" },
        { "data": "status" },
        { "data": "purchaser" },
        {
          "className":      'details-control',
          "orderable":      false,
          "data":           null,
          "defaultContent": '<button class="btn btn-info control_btn" style="font-size:14px;padding-top:0px;padding-bottom:0px;margin-bottom:0px;" onclick="LoadDetail(this)">Details</button>'
        },
      ],
      "iDisplayLength": 50,
    });
  });
}

function LoadDetail(obj){

  var tr = $(obj).closest('tr');
  var row = table.row(tr);
  var data = row.data();
  var fill_keys = ["manufacturer", "model", "serial", "type", "location", "entry_date",
    "purchaser", "status", "comment"];
  fill_keys.forEach(key => {
    $("#detail_" + key).html(data[key]);

    if($.inArray(key, ["manufacturer", "model", "entry_date"])===-1){
      console.log(key);
      var field = key;
      if($("#edit_"+field).hasClass("fa-check")){
        $("#edit_"+field).removeClass("fa-check");
        $("#edit_"+field).addClass("fa-edit");
        $("#edit_"+field).css("color", "black");
      }
      if($("#edit_"+field).hasClass("fa-times")){
        $("#edit_"+field).removeClass("fa-times");
        $("#edit_"+field).addClass("fa-edit");
        $("#edit_"+field).css("color", "black");
      }


      $('#edit_'+key).unbind('click');
      $("#edit_"+key).click(function(){
        // oh my god javascript scoping is amazing
        var str = this.id.split("_")[1];
        MaybeUpdateItemField(data['_id'], str)});
    }
    $('#detail_modal').modal();
  });
  var html = "";
  for(var j in data['actions']){
    html += "<div class='card card body' style='padding:10px'>";
    html += "<span><strong>" + data['actions'][j]['type'] +"</strong>";
    html += " on " + dateToYMD(new Date(data['actions'][j]['date'])) + "</span>";
    html += "<p><strong>Comment: </strong>" + data['actions'][j]['comment'] + "</p>";
    html += "<p> User: <strong>";
    html += data['actions'][j]['user'] + "</strong></p>";
    html += "</div>";
  }
  $("#collapseHistory").html(html);
  console.log(data);
}

// These two functions allow updating fields in item description. The first click
// turns the field into a text entry field and adds a button, the second click makes
// the update. On success we update the local copy on the page. On failure throw alert.
function MaybeUpdateItemField(item_id, field_to_update){
  var input = $('<input />', {
    'type': 'text',
    'name': field_to_update,
    'id': 'detail_' + field_to_update,
    'value': $("#detail_"+field_to_update).text()
  });
  $("#detail_"+field_to_update).replaceWith(input);
  var newbutton = $('<i />', {
    'class': 'fa fa-arrow-right',
    'id': 'edit_' + field_to_update,
    'onclick': "UpdateItemField('" + item_id + "', '" + field_to_update + "')",
  });
  $("#edit_"+field_to_update).replaceWith(newbutton);

}

function UpdateItemField(item_id, field_to_update){
  // Transform
  var newbutton = $('<i />', {
    'class': 'fa fa-spinner fa-spin',
    'id': 'edit_' + field_to_update,
  });
  $("#edit_"+field_to_update).replaceWith(newbutton);

  $.ajax({
    type: "post",
    url: "equipment/record_update",
    data: {"id": item_id, "field": field_to_update,
      value: $("#detail_"+field_to_update).val(),
      priority: 'update_field'},
    dataType: 'json'
  }).done(function(data){
    var classs = "fa fa-check";
    var color = 'green';
    console.log(data);
    if (!data['result'] =='success'){
      classs = 'fa fa-times';
      color = 'red';
      alert("Failed to update, error: "+data.result);
    }
    var input = $('<span />', {
      'name': field_to_update,
      'id': 'detail_' + field_to_update,
      'html': $("#detail_"+field_to_update).val(),
      'text': $("#detail_"+field_to_update).val(),
    });
    $("#detail_"+field_to_update).replaceWith(input);

    var newbutton = $('<i />', {
      'class': classs,
      'style': "color:" +color,
      'id': 'edit_' + field_to_update,
    });
    $("#edit_"+field_to_update).replaceWith(newbutton);
  });
}

function SubmitNewForm(){
  var atts = ['manufacturer', 'model', 'serial', 'type',
    'location', 'status', 'purchaser', 'comment'];
  data = {};
  for(var i in atts)
    data[atts[i]] = $("#input_"+atts[i]).val();
  $.ajax({
    type: "post",
    url: "equipment/record_update",
    data: {"priority": "add_item", "data": data},
    dataType: 'json'
  }).done(function(data){
    if(data['result'] == 'success')
      alert("Adding item(s) successful! Will appear on page load.");
    else
      alert("Failed to add item, error: "+data.result);	
  });
}

