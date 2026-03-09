// global settings, change those if there are changes to the daq

const readers_per_detector = {
    "tpc": ["reader7_reader_0", "reader8_reader_0"]
}

//var default_view = "tpc"
var default_view = "3d"


// initialize global variables
var cable_map = false
var board_map = false
var pmt_dict_lookup = {}
var pmt_dict = {}
var board_dict = {}
var svgObject0 = false
var svgObject1 = false
const svgns = "http://www.w3.org/2000/svg"
var links_set = new Set()
var amp_lookup = {}
var reader_list = [...readers_per_detector["tpc"]];
var pmt_rates = {}
var update_times = {}
var optical_links_zero = {"-1":0}
var pmts_per_detector = {}
var pmts_per_detector_rates = {}
var pmts_list_per_detector_template = {}
var pmts_list_per_detector_dynamic
var opt_link_rates = {}
var rates_meta
var list_pmts_initialized = []


var trendview_data_temp
var trendview_data = false
var trendview_pmts2follow = []
var trendview_interval = false
var trendview_object = false
var trendview_pmt_order = false
var playback_interval = false
var main_loop_interval = false


var timer = []
var timer_ini

var rate_total
var rate_min
var rate_max
var rate_zero
var rate_off
var pmts_to_ignore_for_rate = []

var legend_rate_min = 1
var legend_rate_max = 101
var legend_rate_diff = 100





// user customizable variables
var custom_fading_rate = .20
var custom_show_timings = false




// developer toggles


const default_pos = {
    "init": [-20, -20],
    "tpc":  [-20, -20],
    "he":   [-20, -20],
    "vme":  [-20, -20],
    "amp":  [-20, -20],
    "opt":  [-20, -20],
    "3d":  [-20, -20],
    "off":  [-20, -20]
}



// some geometrie properties
// vme
layout_global = {
    "height_offset": 15
}

const default_pmt_size = 5.5
layout_style = {
    "init":
    {
        "x0": 20,
        "y0": 35,
        "width": 360,
        "height": 200,
        "d_width": 0,
        "d_height": 10,
        "pmt_size": 5
    },    
    "vme":
    {
        "x0": 0,
        "y0": 35,
        "width": 100,
        "pmt_size": 2.4,
        "height": 53.4,
        "d_width": 0,
        "d_height": 15,
        "order":
        {
            0:[0,0],
            1:[1,0],
            2:[2,0],
            3:[2,1],
            4:[3,0],
            // 5:[1,2],
            // 6:[2,2]
            
        }
    },
    "opt":
    {
        "x0": 5,
        "y0": 35,
        "width": 56,
        "pmt_size": 3.5,
        "height": 67,
        "d_width": 10,
        "d_height": 10
    },
    "amp":
    {
        "x0": 0,
        "y0": 70,
        "width": 100,
        "pmt_size": 4.1,
        "height": 142   ,
        "d_width": 0,
        "d_height": 10,
        "order":
        {
            0:[3,0],
            1:[2,0],
            2:[1,0],
            3:[0,0]
        }
    },
    "3d":
    {
        "pmt_size": 6,
        "pmt_height": 3
    }
}

const dict_color_scheme = {
        0:   [12, 17, 120],
        500: [23, 162, 184],
        900: [6, 214, 160],
        950: [211, 158, 0],
        1000: [189, 33, 48]
}
var color_threshholds = Object.keys(dict_color_scheme)

var lut_reader_to_detecor = {}
for(let [detector, readers] of Object.entries(readers_per_detector)){
    for(reader of readers){
        lut_reader_to_detecor[reader] = detector
    }
}



function make_rgb_string_from_list(list){
    return("rgb("+list[0].toFixed(3)+","+list[1].toFixed(3)+","+list[2].toFixed(3)+")")
    
}
function make_rgb_string_text_from_list(list){
    var color_sum = (list[0]**2 + list[1]**2+list[2]**2)**(.5)
    if(color_sum > 210){
        return("black")
    }else{
        return("white")
    }
    
    
}


function monitor_toggle_pmt(channel_id){
    channel = channel_id.split("_")[2]
    
    channels = $("#field_line_plot_pmts").val().split(",")
    
    
    if(channels.indexOf("") >= 0){
        channels.splice(channels.indexOf(""), 1)
    }
    
    
    if(channels.includes(channel+"")){
        channels.splice(channels.indexOf(channel+""), 1)
        svgObject0.getElementById(channel_id).style.stroke=""
        svgObject0.getElementById(channel_id).style.strokeWidth=""
    }else{
        channels.push(channel)
        svgObject0.getElementById(channel_id).style.stroke="blue"
        svgObject0.getElementById(channel_id).style.strokeWidth="2"
    }
    channels.sort()
    $("#field_line_plot_pmts").val(channels.join(","))
}

function switch_pmt_channel_text_visibility(desired_state = "toggle"){
    // false = none
    // true = block
    // else = toggle
    
    if(desired_state === true){
        desired_state = "block"
    } else if(desired_state === false){
        desired_state = "none"
    }
    
    text_fields = svgObject1.getElementsByClassName("pmt_text")
    current_state = text_fields[0].style.display
    
    
    
    if(current_state != desired_state){
        if(current_state == "none"){
            new_state = "block"
        }else{
            new_state = "none"
        }
        
        for(el of text_fields){
            el.style.display = new_state
        }
        
    }
    
}

var lut_colors = []
var lut_text_colors = []
// using a look up table instead of a formula (might be much quicker)
for(var permil = 0; permil <= 1000; permil++){
    var color = []
    
    if(color_threshholds.includes(""+permil)){
        color = dict_color_scheme[permil]
        
        low = ""+permil
        high = color_threshholds[color_threshholds.indexOf(""+permil)+1]
        color_low = dict_color_scheme[permil]
        color_high = dict_color_scheme[high]
        diff_range = high - low
    }else{
        ratio_high  = (permil - low)/diff_range
        ration_low = 1-ratio_high
        
        color = [
            color_low[0]*ration_low + color_high[0]*ratio_high, 
            color_low[1]*ration_low + color_high[1]*ratio_high, 
            color_low[2]*ration_low + color_high[2]*ratio_high
        ]
    }
    
    lut_colors[permil] = make_rgb_string_from_list(color)
    lut_text_colors[permil] = make_rgb_string_text_from_list(color)
}


function status_bar(string_text, color = false, stroke = false){
    svgObject0.getElementById("str_status_bar").textContent = string_text
    if(color == false){
        svgObject0.getElementById("str_status_bar").style.fill = "black"
    } else {
        svgObject0.getElementById("str_status_bar").style.fill = color
    }
    if(stroke == false){
        svgObject0.getElementById("str_status_bar").style.stroke = ""
    } else {
        svgObject0.getElementById("str_status_bar").style.stroke = color
    }
}


function caclulate_board_base_pos(board, layout){
    try{
        var x = 500;
        var y = 500;
        layout_dict = layout_style[layout]
        if(!("pmt_size" in layout_dict)){
            layout_dict["pmt_size"] = default_pmt_size
        }
        
        switch(layout){
            case "vme":
                grid_pos = layout_dict["order"][board["crate"]]
                slot = board["slot"]
                break;
                
                
            case("opt"):
                grid_pos = [board["link"], parseInt(board["host"].slice(-1))]
                slot = board["opt_bd"]
            break;
            
        }
        if(slot >= 0){
            x = layout_dict["x0"] + 
                grid_pos[0] * (layout_dict["width"]+layout_dict["d_width"]) +
                slot * layout_dict["pmt_size"]*2
                + layout_dict["pmt_size"]
            y = layout_dict["y0"] + layout_dict["d_height"] +
                layout_dict["pmt_size"] +
                grid_pos[1] * (layout_dict["height"] + layout_dict["d_height"])
        }
        return([x,y])
    }catch(error){
        return([500,500])
    }
}





// having a dedicated ditionary should be faster than if statements
const pmt_tpc_scaling_factor = 1.3 * default_pmt_size/5
const pmt_mv_scaling_factor = 1
const array_pos = {
    "top": function(coords){return([100+coords[0]*pmt_tpc_scaling_factor, 145-coords[1]*pmt_tpc_scaling_factor])},
    "bottom": function(coords){return([300+coords[0]*pmt_tpc_scaling_factor, 145-coords[1]*pmt_tpc_scaling_factor])},
    "he": function(coords){return([200+coords[0]*pmt_tpc_scaling_factor, 145-coords[1]*pmt_tpc_scaling_factor])}
}

// functions that translates the pmt coordinates into svg coorinates
function tpc_pos(array, coords){
    try{
        return(array_pos[array](coords))
    } catch(error) {
        return(default_pos["tpc"])
    }
}



function calc_3d_pos(input_coords, calc){
    var coords_3d = []
    
    var scaling_x = 1.5
    var scaling_y = .75
    var scaling_z = .75
    var global_scaling = 1.1
    
    try{
        switch(calc){
            case "top":
                coords_3d = [
                    input_coords[0],
                    input_coords[1],
                    140+20
                ]
                break
            case "bottom":
                coords_3d = [
                    input_coords[0],
                    input_coords[1],
                    0
                ]
                break
        }

        coords_2d = [
            200 + coords_3d[0]*scaling_x*global_scaling,
            200 - coords_3d[1]*scaling_y*global_scaling - coords_3d[2]*scaling_z*global_scaling
        ]
        return(coords_2d)
    }catch(error){
        return(default_pos["3d"])
    }
    
}





function switch_layout(layout){
    if(!(layout in default_pos)){
        return(0)
    }
   try{
        pmt_size = layout_style[layout]["pmt_size"]
        if("pmt_height" in layout_style[layout]){
            pmt_size_height = layout_style[layout]["pmt_height"]
        }else{
            pmt_size_height = pmt_size
        }
    }catch(error){
        pmt_size = default_pmt_size
        pmt_size_height = pmt_size
    }
    
    if(pmt_size < 4){
        var font_size = 4*pmt_size/5
    } else {
        var font_size = 4
    }
    
    // move pmts around
    for(pmt_ch of list_pmts_initialized){
        pmtpos = pmt_dict[pmt_ch]["pos"][layout]
        
        var obj_pmt_circ = svgObject1.getElementById("pmt_circle_"+pmt_ch)
        obj_pmt_circ.setAttribute("cx", pmtpos[0]);
        obj_pmt_circ.setAttribute("cy", pmtpos[1]);
        obj_pmt_circ.setAttribute("rx", pmt_size);
        obj_pmt_circ.setAttribute("ry", pmt_size_height);
        
        
        var obj_pmt_text = svgObject1.getElementById("pmt_text_"+pmt_ch)
        obj_pmt_text.setAttribute("x",  pmtpos[0]);
        obj_pmt_text.setAttribute("y",  pmtpos[1]);
        
        obj_pmt_text.style.fontSize = font_size;
        
        
    }
    // hide or show decorative elements
    var decoelements_hide = svgObject1.getElementsByClassName("deco")
    for(var i = 0; i < decoelements_hide.length; i++){
        decoelements_hide[i].style.visibility = "hidden"
    }
    
    var decoelements_show = svgObject1.getElementsByClassName("deco_"+layout)
    for(var i = 0; i < decoelements_show.length; i++){
        decoelements_show[i].style.visibility = "visible"
    }
    
    return(1)
}



function initialize_pmts(){
    timer_ini = [new Date]
    // empty all variables just in case
    cable_map = false
    board_map = false
    pmt_dict = {}
    board_dict = {}
    pmt_pos = {}
    amp_lookup = {}
    links_set = new Set()
    
    
    
    
    
    console.log("loading board_map")
    $.getJSON("monitor/board_map.json",
        function(data){
            board_map = data;
            console.log("board_map loaded")
            build_pmt_layouts()
        }
    )
    
    
    console.log("loading cable_map")
    $.getJSON("monitor/cable_map.json",
        function(data){
            cable_map = data
            console.log("cable_map loaded")
            build_pmt_layouts()
        }

    )
    
    console.log("both loadings initialized")
}

function build_pmt_layouts(){
    
    
    
    
    
    // quit if not everything is loaded
    // returning 0 preventes the need for nested design
    if(cable_map == false || board_map == false){
        console.log("other map still missing")
        return(0)
    }
    timer_ini.push(new Date)
    console.log("both maps exisiting, starting to build map....")
    

    svgObject0 = document.getElementById('svg_frame1').contentDocument;
    svgObject1 = document.getElementById('svg_frame1').contentDocument.documentElement;

    status_bar("If this message is visible: reload the page", color = "red")
    

    //add listerns to svg elements
    svgObject0.getElementById("str_legend_100").addEventListener("click", function(){legend_set(which = "max")});
    svgObject0.getElementById("str_legend_000").addEventListener("click", function(){legend_set(which = "min")});
    
    
    
    
    // building quick lookup dictionaries
    // calulate boards base positions for pmt-coordiantes in different views
    console.log("building board dictionary")
    
    
    for(board of board_map){
        
        board["pos"] = {}
        
        board["pos"] = {
            "vme": caclulate_board_base_pos(board, "vme"),
            "opt": caclulate_board_base_pos(board, "opt")
        }
        links_set.add(board["host"].slice(-1)+"."+board["link"])
        board_dict[board["board"]] = board
    }
    console.log("built")
    
    {// draw all the decorations
    {//VME
    
    layout_dict = layout_style["vme"]
    x0 = layout_dict["x0"]
    y0 = layout_dict["y0"]
    width = layout_dict["width"]
    d_width = layout_dict["d_width"]
    height = layout_dict["height"]
    d_height = layout_dict["d_height"]
    
    for (const [crate, pos] of Object.entries(layout_dict["order"])) {
        
        
        
        var crate_header = document.createElementNS(svgns, 'text');
        crate_header.setAttributeNS(null, 'x', x0 + pos[0]*(width+d_width) + .5 * width);
        crate_header.setAttributeNS(null, 'y', y0 + pos[1]*(height+d_height));
        crate_header.textContent = "VME "+ crate;
        crate_header.setAttributeNS(null, "class", "deco deco_vme infotext");
        
        var crate_rect = document.createElementNS(svgns, 'rect');
        crate_rect.setAttributeNS(null, 'x', x0 + pos[0]*(width+d_width));
        crate_rect.setAttributeNS(null, 'y', y0 + pos[1]*(height+d_height)-d_height/2);
        crate_rect.setAttributeNS(null, 'width', width);
        crate_rect.setAttributeNS(null, 'height', height+d_height/2);
        crate_rect.setAttributeNS(null, "class", "deco deco_vme crate_box");
        
        svgObject1.appendChild(crate_header)
        svgObject1.appendChild(crate_rect)
        
    }
    }
    
    {// Optical links
    layout_dict = layout_style["opt"]
    x0 = layout_dict["x0"]
    y0 = layout_dict["y0"]
    width = layout_dict["width"]
    d_width = layout_dict["d_width"]
    height = layout_dict["height"]
    d_height = layout_dict["d_height"]
    
    
    
    for(let rdr_lnk of links_set.values()){
        optical_links_zero[rdr_lnk] = 0
        pos = rdr_lnk.split(".")
        
        
        var crate_header = document.createElementNS(svgns, 'text');
        crate_header.setAttributeNS(null, 'x', x0 + pos[1]*(width+d_width) + .5 * width);
        crate_header.setAttributeNS(null, 'y', y0 + pos[0]*(height+d_height));
        crate_header.textContent = rdr_lnk;
        crate_header.setAttributeNS(null, "class", "deco deco_opt infotext");
        
        var crate_rect = document.createElementNS(svgns, 'rect');
        crate_rect.setAttributeNS(null, 'x', x0 + pos[1]*(width+d_width));
        crate_rect.setAttributeNS(null, 'y', y0 + pos[0]*(height+d_height)-d_height/2);
        crate_rect.setAttributeNS(null, 'width', width);
        crate_rect.setAttributeNS(null, 'height', height+d_height/2);
        crate_rect.setAttributeNS(null, "class", "deco deco_opt crate_box");
        
        var crate_rect_indocator = document.createElementNS(svgns, 'rect');
        crate_rect_indocator.setAttributeNS(null, 'x', x0 + pos[1]*(width+d_width));
        crate_rect_indocator.setAttributeNS(null, 'y', y0 + pos[0]*(height+d_height)-d_height/2);
        crate_rect_indocator.setAttributeNS(null, 'width', width);
        crate_rect_indocator.setAttributeNS(null, 'height', 10);
        crate_rect_indocator.setAttributeNS(null, "class", "deco deco_opt layout");
        crate_rect_indocator.setAttributeNS(null, "id", "opt_indicator_field_"+rdr_lnk);
        
        var crate_rate_text = document.createElementNS(svgns, 'text');
        crate_rate_text.setAttributeNS(null, 'x', x0 + pos[1]*(width+d_width) + .98 * width);
        crate_rate_text.setAttributeNS(null, 'y', y0 + pos[0]*(height+d_height));
        crate_rate_text.textContent = "0";
        crate_rate_text.setAttributeNS(null, "class", "deco deco_opt text_info_small_right");
        crate_rate_text.setAttributeNS(null, "id", "opt_indicator_text_"+rdr_lnk);
        
        svgObject1.appendChild(crate_rect_indocator)
        svgObject1.appendChild(crate_header)
        svgObject1.appendChild(crate_rect)
        svgObject1.appendChild(crate_rate_text)
        
    }
    }
    
    
    {// Amplifiers
    layout_dict = layout_style["amp"]
    x0 = layout_dict["x0"]
    y0 = layout_dict["y0"]
    width = layout_dict["width"]
    d_width = layout_dict["d_width"]
    height = layout_dict["height"]
    d_height = layout_dict["d_height"]
    
    
    
    for(amp in [0,1,2,3]){
        pos = [0, 3-amp]
        amp_x0 = x0 + (pos[1]+1)*(width)
        
        amp_lookup[amp] = amp_x0
        
        
        var crate_header = document.createElementNS(svgns, 'text');
        crate_header.setAttributeNS(null, 'x', x0 + pos[1]*(width+d_width) + .5 * width);
        crate_header.setAttributeNS(null, 'y', y0 + pos[0]*(height+d_height));
        crate_header.textContent = amp;
        crate_header.setAttributeNS(null, "class", "deco deco_amp infotext");
        
        var crate_rect = document.createElementNS(svgns, 'rect');
        crate_rect.setAttributeNS(null, 'x', x0 + pos[1]*(width+d_width));
        crate_rect.setAttributeNS(null, 'y', y0 + pos[0]*(height+d_height)-d_height/2);
        crate_rect.setAttributeNS(null, 'width', width);
        crate_rect.setAttributeNS(null, 'height', height+d_height/2);
        crate_rect.setAttributeNS(null, "class", "deco deco_amp crate_box");
        
        
        
        svgObject1.appendChild(crate_header)
        svgObject1.appendChild(crate_rect)
        
    }    
    }
    
    
    
    {// 3D Deco
        var tpc_real_radius = 125/2 // [cm]
        var top_center = calc_3d_pos([0,0], "top")
        var bot_center = calc_3d_pos([0,0], "bottom")
        var tpc_radius = 2*((bot_center[1]-calc_3d_pos([0,tpc_real_radius], "bottom")[1]) + layout_style["3d"]["pmt_size"])
        var scaling_y = .5
        
        
        var bot_array_ellipse = document.createElementNS(svgns, 'ellipse');
        bot_array_ellipse.setAttributeNS(null, 'cx', bot_center[0]);
        bot_array_ellipse.setAttributeNS(null, 'cy', bot_center[1]);
        bot_array_ellipse.setAttributeNS(null, 'rx', tpc_radius);
        bot_array_ellipse.setAttributeNS(null, 'ry', tpc_radius * scaling_y);
        bot_array_ellipse.setAttributeNS(null, 'class', "deco deco_3d");
        bot_array_ellipse.setAttributeNS(null, 'style', "fill:none;stroke:grey;");
        
        var top_array_ellipse = document.createElementNS(svgns, 'ellipse');
        top_array_ellipse.setAttributeNS(null, 'cx', top_center[0]);
        top_array_ellipse.setAttributeNS(null, 'cy', top_center[1]);
        top_array_ellipse.setAttributeNS(null, 'rx', tpc_radius);
        top_array_ellipse.setAttributeNS(null, 'ry', tpc_radius * scaling_y);
        top_array_ellipse.setAttributeNS(null, 'class', "deco deco_3d");
        top_array_ellipse.setAttributeNS(null, 'style', "fill:none;stroke:grey;");
        
        var left_line = document.createElementNS(svgns, 'line');
        left_line.setAttributeNS(null, 'x1', top_center[0]-tpc_radius);
        left_line.setAttributeNS(null, 'x2', top_center[0]-tpc_radius);
        left_line.setAttributeNS(null, 'y1', top_center[1]);
        left_line.setAttributeNS(null, 'y2', bot_center[1]);
        left_line.setAttributeNS(null, 'class', "deco deco_3d");
        left_line.setAttributeNS(null, 'style', "stroke:grey;");
        
        var right_line = document.createElementNS(svgns, 'line');
        right_line.setAttributeNS(null, 'x1', top_center[0]+tpc_radius);
        right_line.setAttributeNS(null, 'x2', top_center[0]+tpc_radius);
        right_line.setAttributeNS(null, 'y1', top_center[1]);
        right_line.setAttributeNS(null, 'y2', bot_center[1]);
        right_line.setAttributeNS(null, 'class', "deco deco_3d");
        right_line.setAttributeNS(null, 'style', "stroke:grey");
        


        svgObject1.appendChild(bot_array_ellipse)
        svgObject1.appendChild(top_array_ellipse)
        svgObject1.appendChild(left_line)
        svgObject1.appendChild(right_line)

    
    
    }
    
    
    } // END of decorations 
    timer_ini.push(new Date)
    
    
    
    // setup all the pmts
    console.log("building pmt dictionary and creating pmts")
    // create dictionary first to access data for position etc during second iteration
    // (he-coordianates)
    for(pmt of cable_map){
        pmt_channel = [pmt["pmt"]]
        pmt_dict_lookup[pmt_channel] = pmt
    }
    
    for(pmt of cable_map){
        // calculate also positions
        pmt_channel = pmt["pmt"]
        pmt_dict[pmt_channel] = pmt
        this_board = board_dict[pmt["adc"]]
        
        try{
            pmt["reader"] = this_board["host"] + "_reader_0"
        }catch(error){
            console.log("ERROR: PMT: "+pmt_channel+"; board: "+pmt["reader"])
        }
        
        
        // start the pmt svg group to pu all the elemets inside it dynamically
        var pmt_group = document.createElementNS(svgns, 'g');
        
        
        
        
        
        // just asigning would keep a reference and folloing pmts would use old coordinates....
        pmt["pos"] = {...default_pos}
        pmt["description"] = "PMT "+ pmt_channel
        var amp_text = "AMP: " + pmt["amp_crate"] + "." + pmt["amp_slot"] + "." + pmt["amp_channel"];

        // TPC low-energy channels
        if(pmt_channel <= 493){
            try{
                var tmp_x = pmt["coords"]["pmt"][0]
                var tmp_y = pmt["coords"]["pmt"][1]
                pmt["coords"] = [tmp_x, tmp_y]
            } catch(error) {
            }
    
            pmt["pos"]["tpc"] = tpc_pos(pmt["array"], pmt["coords"])
            
            //pos["init"] = pos["tpc"]
            pmt["pos"]["init"] = [10 + (pmt_channel%38*10), 40 + Math.floor(pmt_channel/38)*10]
            pmt["pos"]["3d"] = calc_3d_pos(pmt["coords"], pmt["array"])
            
            // AMP only for TPC channels
            // otherwise the high/low energy channels will be on top of each other
            pmt["pos"]["amp"] = [
                    400 -
                    layout_style["amp"]["width"]    * (pmt["amp_crate"])-
                    2 * layout_style["amp"]["pmt_size"] * (pmt["amp_slot"])-
                    layout_style["amp"]["pmt_size"]
                ,
                    layout_style["amp"]["y0"] +
                    layout_style["amp"]["d_height"] +
                    2 * layout_style["amp"]["pmt_size"] * pmt["amp_channel"]+
                    layout_style["amp"]["pmt_size"]
                    
            ]
                
                
            
            
            
        // TPC high-energy channels
        }else if (pmt_channel <= 752){
            
            pmt["array"] = pmt["array"]+"_HE"
            // use coordinates from top in any case
            pmt["coords"] = pmt_dict_lookup[pmt_channel-500]["coords"]
            try{
                var tmp_x = pmt["coords"]["pmt"][0]
                var tmp_y = pmt["coords"]["pmt"][1]
                pmt["coords"] = [tmp_x, tmp_y]
            } catch(error) {
            }
    
            pmt["pos"]["he"] = tpc_pos("he", pmt["coords"])
            pmt["pos"]["init"] = [10 + (pmt_channel%38*10), 40 + Math.floor(pmt_channel/38)*10]
            
            

        } else if (pmt_channel <= 807){
            // 807 is highest tpc acq-mon channel
            pmt["pos"]["init"] = [10 + (pmt_channel%38*10), 40 + Math.floor(pmt_channel/38)*10]
            pmt["array"] = "aqmon_ar"
            pmt["detector"] = "aqmon_de"
            pmt["description"] = "AQC " + pmt_channel
            amp_text = "AQC: "+ pmt["aqmon"]
            // acq-monitors etc
        } else{
            continue;
            
        }
        
        
        
        // count all pmts per detector to know if some did not send data
        if(pmt["detector"] in pmts_per_detector){
            pmts_per_detector[pmt["detector"]] += 1
            pmts_list_per_detector_template[pmt["detector"]].push(pmt_channel+"")
        }else{
            pmts_per_detector[pmt["detector"]] =1
            pmts_list_per_detector_template[pmt["detector"]] = [pmt_channel+""]
        }
        // same for arrays
        if(pmt["array"] in pmts_per_detector){
            pmts_per_detector[pmt["array"]] += 1
            pmts_list_per_detector_template[pmt["array"]].push(pmt_channel+"")
        }else{
            pmts_per_detector[pmt["array"]] =1
            pmts_list_per_detector_template[pmt["array"]] = [pmt_channel+""]
        }
        
        
        
        
        // calculate positions for other views
        try{
            // VME
            pmt["pos"]["vme"] = [...this_board["pos"]["vme"]]
            pmt["pos"]["vme"][1] += pmt["adc_channel"] *2* layout_style["vme"]["pmt_size"]
        } catch(error){
            
        }
        try{
            // OPT
            pmt["pos"]["opt"] = [...this_board["pos"]["opt"]]
            pmt["pos"]["opt"][1] += pmt["adc_channel"] *2* layout_style["opt"]["pmt_size"]
            pmt["opt"] = this_board["host"].slice(-1) + "." + this_board["link"]
        } catch(error){
            pmt["opt"] = "-1"
        }
        
            
        
        
        
        // creating all the svg objects
        {
        
        var pmt_circle = document.createElementNS(svgns, 'ellipse');
        pmt_circle.setAttributeNS(null, 'cx', pmt["pos"]["init"][0]);
        pmt_circle.setAttributeNS(null, 'cy', pmt["pos"]["init"][1]);
        pmt_circle.setAttributeNS(null, 'rx', 5);
        pmt_circle.setAttributeNS(null, 'ry', 5);
        pmt_circle.setAttributeNS(null, 'class', "pmt");
        pmt_circle.setAttributeNS(null, "id", "pmt_circle_"+pmt_channel);
        pmt_circle.addEventListener("click", function(){monitor_toggle_pmt(this.id)});
        
        var pmt_text = document.createElementNS(svgns, 'text');
        pmt_text.setAttributeNS(null, 'x', pmt["pos"]["init"][0]);
        pmt_text.setAttributeNS(null, 'y', pmt["pos"]["init"][1]);
        pmt_text.textContent = ""+pmt_channel;
        pmt_text.setAttributeNS(null, "class", "pmt_text pmt_text_info");
        pmt_text.setAttributeNS(null, "id", "pmt_text_"+pmt_channel);
        
        var pmt_channel_text = document.createElementNS(svgns, 'text');
        pmt_channel_text.setAttributeNS(null, 'x', 5);
        pmt_channel_text.setAttributeNS(null, 'y', 285);
        pmt_channel_text.textContent = pmt["description"];
        pmt_channel_text.setAttributeNS(null, "class", "text_info_large hidden");
        
        
        var pmt_rate_text = document.createElementNS(svgns, 'text');
        pmt_rate_text.setAttributeNS(null, 'x', 5);
        pmt_rate_text.setAttributeNS(null, 'y', 300);
        pmt_rate_text.textContent = " no data yet";
        pmt_rate_text.setAttributeNS(null, "class", "text_info_large hidden");
        pmt_rate_text.setAttributeNS(null, "id", "text_rate_"+pmt_channel);
        
        
        var pmt_info_text1 = document.createElementNS(svgns, 'text');
        pmt_info_text1.setAttributeNS(null, 'x', 100);
        pmt_info_text1.setAttributeNS(null, 'y', 278);
        pmt_info_text1.textContent = "ADC: "+ pmt["adc"];
        pmt_info_text1.setAttributeNS(null, "class", "text_info_small hidden");

        var pmt_info_text2 = document.createElementNS(svgns, 'text');
        pmt_info_text2.setAttributeNS(null, 'x', 100);
        pmt_info_text2.setAttributeNS(null, 'y', 286);
        pmt_info_text2.setAttributeNS(null, "class", "text_info_small hidden");

        try{
            pmt_info_text2.textContent = "OPT: " + this_board["host"].slice(-1) + "." + this_board["link"] + "." + this_board["opt_bd"];
        }catch(error){
            pmt_info_text2.textContent = "OPT: board not in cable map";
            pmt_info_text2.style.fill = "red";
        }
        
        var pmt_info_text3 = document.createElementNS(svgns, 'text');
        pmt_info_text3.setAttributeNS(null, 'x', 100);
        pmt_info_text3.setAttributeNS(null, 'y', 294);
        pmt_info_text3.textContent = "VME: " + pmt["adc_crate"] + "." + pmt["adc_slot"] + "." + pmt["adc_channel"];
        pmt_info_text3.setAttributeNS(null, "class", "text_info_small hidden");
        
        
        var pmt_info_text4 = document.createElementNS(svgns, 'text');
        pmt_info_text4.setAttributeNS(null, 'x', 100);
        pmt_info_text4.setAttributeNS(null, 'y', 302);
        pmt_info_text4.textContent = amp_text
        pmt_info_text4.setAttributeNS(null, "class", "text_info_small hidden");
        
        
        
        pmt_group.appendChild(pmt_circle)
        pmt_group.appendChild(pmt_text)
        pmt_group.appendChild(pmt_channel_text)
        pmt_group.appendChild(pmt_rate_text)
        pmt_group.appendChild(pmt_info_text1)
        pmt_group.appendChild(pmt_info_text2)
        pmt_group.appendChild(pmt_info_text3)
        pmt_group.appendChild(pmt_info_text4)
        
        svgObject1.appendChild(pmt_group)
        list_pmts_initialized.push(pmt_channel)
        }
    }
    
    
    
    console.log("built")
    
    // setting up some global variables from pmt data
    // for waht ever reason it is written to later......
    for(detector of Object.keys(pmts_per_detector)){
        pmts_per_detector_rates[detector] = {
            "min": Infinity,
            "max": 0,
            "tot": 0,
            "missing": pmts_per_detector[detector],
            "zero": 0
        }
        
    }
    
    
    // set default values to text fields
    var now = new Date
    now.setMilliseconds(0)
    
    $("#field_history_start").val(now.toISOString())
    $("#field_current_timestamp").val(now.toISOString())
    $("#field_history_end").val(now.toISOString())
    
    update_pmts_to_ignore_for_rate()
    
    
    $('#layout_switcher').val(default_view)
    switch_layout(default_view)
    
    
    timer_ini.push(new Date) // end [5]
    
    timer_ini_string = "everything setup: db: "+(timer_ini[1]-timer_ini[0]).toFixed(0)+" ms, deco: "+(timer_ini[2]-timer_ini[1]).toFixed(0)+"ms, pmts: "+(timer_ini[3]-timer_ini[2]).toFixed(0)+"ms, all: "+(timer_ini[3]-timer_ini[0]).toFixed(0)+" ms"
    
    status_bar(timer_ini_string, color = "green")
    console.log(timer_ini_string)
    
    console.log("load data the first time")
    main_loop_interval = window.setInterval(
        function(){
            updates_wrapper()
        },
        1001
    )
    console.log("function interval set")
}


function updates_wrapper(){
    if(trendview_object != false){
        trendview_object.setSize(null, null);
    }
    var tpc_icon_title  = $("#tpc_status_icon").attr("title")
    var tpc_live_toggle = $("#monitor_live_toggle").is(':checked')
    
    if(tpc_live_toggle == false){
        return(0)
    }
    if(tpc_icon_title != "TPC is RUNNING"){
        // do not load if tpc is not running
        status_bar(tpc_icon_title + " ("+(new Date).toISOString()+" UTC)", color = "red")
        return(0)
    }
    timer = [new Date]
    updates_obtain_all()
}
    



function updates_obtain_all(time = false){
    
    status_bar("loading new data")
    pmt_rates = {}
    
    var missing = reader_list.length
    
    if(time == false){
        pre_reader_link = "monitor/update/"
        post_reader_link = ""
    }else{
        pre_reader_link = "monitor/update_timestamp/"
        post_reader_link = "/"+time.toISOString()
    }
    
    
    
    for(reader of reader_list){
        pmt_rates[reader] = false;
        
        $.getJSON(pre_reader_link+reader+post_reader_link,
            function(data){
                missing--
                try{
                    pmt_rates[data[0]["host"]] = data[0]
                }catch(error){}
                if(missing == 0){
                    timer.push(new Date)
                    updates_check_and_combine()
                }
            }
        )
    }
}

function updates_check_and_combine(){
    status_bar("got all new data")
    update_times = {}
    opt_link_rates = {...optical_links_zero};
    
    
    // if just copied from above it will overwrite the default dictrionary......
    // this does not work :(
    //rates_meta = {...pmts_per_detector_rates}
    
    rates_meta = {}
    pmts_list_per_detector_dynamic = {}
    for(detector of Object.keys(pmts_per_detector)){
        rates_meta[detector] = {
            "min": Infinity,
            "max": 0,
            "tot": 0,
            "missing": pmts_per_detector[detector],
            "zero": 0
        }
        
        pmts_list_per_detector_dynamic[detector] = [...pmts_list_per_detector_template[detector]]
        
    }
    
    // return(0)
    
    
    svgObject0.getElementById("str_reader_time_0").textContent = ""
    svgObject0.getElementById("str_reader_time_1").textContent = ""
    svgObject0.getElementById("str_reader_time_2").textContent = ""
    svgObject0.getElementById("str_reader_time_3").textContent = ""
    
    
    
    
    var i = -1
    for(reader of reader_list){
        i++
                
        
        
        if(pmt_rates[reader] == false){
            continue;
        }
        
    
        reader_data = pmt_rates[reader]
        //var time_now = new Date(parseInt(reader_data["_id"].substr(0,8), 16)*1000)
        var time_now = new Date(reader_data["time"])
        try{
            svgObject0.getElementById("str_reader_time_"+i).textContent = reader + ": " + reader_data["time"] + " (UTC)"
            $("#field_current_timestamp").val(reader_data["time"])
        } catch(error){
            
        }
        
        try{
            // remove channels 999, 1999, 2999
            delete reader_data["channels"]['999']
            delete reader_data["channels"]['1999']
            delete reader_data["channels"]['2999']
            
            
            // same readers  should readout the same detctor so speed up the sorting
            status_bar("working on " + detector)
            
            rates = Object.values(reader_data["channels"])

            
            // rates_meta[detector]["min"] = Math.min(rates_meta[detector]["min"], Math.min(...rates))
            // rates_meta[detector]["max"] = Math.max(rates_meta[detector]["max"], Math.max(...rates))
            
            for(let [channel, rate] of Object.entries(reader_data["channels"])){
                
                var array = pmt_dict[channel]["array"]
                var detector = pmt_dict[channel]["detector"]
                if(pmts_list_per_detector_dynamic[array].splice(
                        pmts_list_per_detector_dynamic[array].indexOf(channel+""),
                        1
                ) != channel+""){
                    console.log("failed to remove channel "+channel+" from array "+ array)
                }
                
                if(pmts_list_per_detector_dynamic[detector].splice(
                        pmts_list_per_detector_dynamic[detector].indexOf(channel+""),
                        1
                ) != channel+""){
                    console.log("failed to remove channel "+channel+" from detector "+ detector)
                }
                
                rates_meta[detector]["missing"]--
                rates_meta[array]["missing"]--
                
                try{
                    if(
                            trendview_pmts2follow.includes(channel) &&
                            !$("#monitor_trend_follow").is(":checked") &&
                            $("#monitor_live_toggle").is(':checked')
                    ){
                        if(!$("#monitor_trend_follow").is(":checked")){
                            trendview_object.series[trendview_pmt_order[channel]].addPoint({
                                    x:time_now.getTime(),
                                    y:rate
                            }, false)
                            
                            // remove if monitor_trend_max_five_minues
                            if(!$("#monitor_trend_max_five_minues").is(":checked")){
                                while(trendview_object.series[trendview_pmt_order[channel]].points.length > parseInt($("#trendview_last_values_N").val())){
                                    trendview_object.series[trendview_pmt_order[channel]].removePoint(0, false, false)
                                }
                            }
                            
                        }
                    }
                }catch(error){}
                
                
                if(rate == 0){
                    rates_meta[detector]["zero"]++
                    rates_meta[array]["zero"]++
                } else {
                    rates_meta[detector]["tot"] += rate
                    rates_meta[array]["tot"] += rate
                    
                    if(!pmts_to_ignore_for_rate.includes(channel)){
                        rates_meta[detector]["min"] = Math.min(rates_meta[detector]["min"], rate)
                        rates_meta[detector]["max"] = Math.max(rates_meta[detector]["max"], rate)
                    }
                }
                try{
                    opt_link_rates[pmt_dict[channel]["opt"]] += rate
                }catch(error){
                }
                
                try{
                    svgObject1.getElementById("text_rate_"+channel).textContent = rate + " kB/s"
                }catch(error){}
            }
            
        }catch(error){
            console.log("could not work on reader " + reader)
        }
        
    }
        
    if(rates_meta["tpc"]["min"] == Infinity){
        rates_meta["tpc"]["min"] = 0
    }    
    
    svgObject1.getElementById("str_legend_min").textContent = "min: " + rates_meta["tpc"]["min"] + " kB/s"
    svgObject1.getElementById("str_legend_max").textContent = "max: " + rates_meta["tpc"]["max"] + " kB/s"
    svgObject1.getElementById("str_legend_tot").textContent = "total: " + (rates_meta["tpc"]["tot"] /1024).toFixed(2) + " MB/s"
    svgObject1.getElementById("str_legend_minus1").textContent = "no data: " + rates_meta["tpc"]["missing"]
    svgObject1.getElementById("str_legend_zero").textContent = "zero data: " + rates_meta["tpc"]["zero"]
    
    svgObject1.getElementById("str_legend_minus1_list").textContent = "(" + rates_meta["top"]["missing"]+"/"+rates_meta["bottom"]["missing"]+"/"+rates_meta["top_HE"]["missing"]+")"
    svgObject1.getElementById("str_legend_zero_list").textContent = "(" + rates_meta["top"]["zero"]+"/"+rates_meta["bottom"]["zero"]+"/"+rates_meta["top_HE"]["zero"]+")"
    
    
    if($("#legend_auto_set").is(':checked') == true){
        legend_rate_min = rates_meta["tpc"]["min"]
        legend_rate_max = rates_meta["tpc"]["max"]
        update_color_scheme()
    }
    
    
    
    color_pmts(pmt_rates)
    
    var missing_pmts = pmts_list_per_detector_dynamic["tpc"].concat(pmts_list_per_detector_dynamic["aqmon_de"])
    for(channel of missing_pmts){
        svgObject1.getElementById("pmt_circle_"+channel).style.fill = "lightgrey"
        svgObject1.getElementById("pmt_circle_"+channel).style.fillOpacity = "1"
        svgObject1.getElementById("text_rate_"+channel).textContent = "no data"
        svgObject1.getElementById("pmt_text_"+channel).style.fill = lut_colors.slice(-1)
    }
    
    
    
    status_bar("coloring pmts")
    timer.push(new Date)
    
    
    // update optical reader datarates
    for(let [reader, rate] of Object.entries(opt_link_rates)){
        try{
            rate_permil = Math.min(1000,Math.max(0,Math.round((rate-40000)/40)))
            svgObject1.getElementById("opt_indicator_text_"+reader).textContent = Math.round(rate /10.24) / 100
            rect_obj = svgObject1.getElementById("opt_indicator_field_"+reader)
            rect_obj.style.fill = lut_colors[rate_permil]
            rect_obj.style.fillOpacity = rate_permil/1000

        }catch(error){
            
        }
    }
    
    
    
    timer.push(new Date)
    status_bar("")
    if(custom_show_timings){
        status_bar("Updated graph: db: " + (timer[1]-timer[0]).toFixed(0) +" ms, work: " + (timer[2]-timer[1]).toFixed(0) +" ms, coloring: " + (timer[3]-timer[2]).toFixed(0) +" ms, all: " + (timer[3]-timer[0]).toFixed(0) +" ms")
    }
}

function color_pmts(pmt_rates_local){
    // this funciton only colors in pmts as it is called on datarate updates and when the lenged is changed
    for(let [reader, reader_data] of Object.entries(pmt_rates_local)){
        if(reader_data != false){
            for(let [channel, rate] of Object.entries(reader_data["channels"])){
                color_channel(channel, rate)
            }
        }
    }
    
}



function color_channel(channel, rate){
    try{
        pmt_obj = svgObject1.getElementById("pmt_circle_"+channel)
        pmt_txt_obj = svgObject1.getElementById("pmt_text_"+channel)
        
        
        if($("#legend_color_scale_log").is(':checked') == true){
            permil = (Math.log(rate)-Math.log(legend_rate_min))/legend_rate_diff*1000
        }else{
            permil = (rate-legend_rate_min)/legend_rate_diff*1000
        }
        
        
        
        if(rate == -1){
            pmt_obj.style.fillOpacity = "1"
            pmt_txt_obj.style.fill = "black"
        }else if(permil < 0 && $("#monitor_fade_toggle").is(':checked')){
            // just fade away if data is below minimum
            pmt_obj.style.fillOpacity = Math.max((pmt_obj.style.fillOpacity || 1)-custom_fading_rate, 0);
            pmt_txt_obj.style.fill = "black"
        } else{
            permil = Math.round(Math.min(permil, 1000))
            permil = Math.max(permil, 0)
                
            pmt_obj.style.fillOpacity = "1"
            pmt_obj.style.fill = lut_colors[permil]
            pmt_txt_obj.style.fill = lut_text_colors[permil]
            
        }
    } catch(error){
        
        
    }
}



function legend_set(which){
    if((["min", "max"]).includes(which)){
        
        new_value = parseFloat(window.prompt("new "+{"min":"lower", "max":"upper"}[which]+" bound in kB/s (current: " + eval("legend_rate_"+which) + " kB/s)", eval("legend_rate_"+which)));
        
        if(!isNaN(new_value)){
            change_toggle("legend_auto_set", false)
            eval("legend_rate_"+which+ "="+new_value)
            
            update_color_scheme()

        }
    }
    
}



function update_color_scheme(new_min = false, new_max=false){
    if(new_min !== false){
        legend_rate_min = new_min
    }
    if(new_max != false){
        legend_rate_max = new_max
    }
    if(legend_rate_min == legend_rate_max){
        legend_rate_min -= 1
        legend_rate_max += 10
    }
    
    
    if($("#legend_color_scale_log").is(':checked') == true){
        if(legend_rate_min <= 0){
            legend_rate_min = 1
        }
        legend_rate_diff = Math.log(legend_rate_max) - Math.log(legend_rate_min)
        diff_rate = legend_rate_diff/4

        
        text_25 = Math.exp(Math.log(legend_rate_min) + diff_rate)
        text_50 = Math.exp(Math.log(legend_rate_min) + diff_rate * 2)
        text_75 = Math.exp(Math.log(legend_rate_min) + diff_rate * 3)
        
        
    } else {
        if(legend_rate_min < 0){
            legend_rate_min = 0
        }
        legend_rate_diff = legend_rate_max - legend_rate_min
        diff_rate = legend_rate_diff/4
        text_25 = legend_rate_min + diff_rate
        text_50 = legend_rate_min + diff_rate * 2
        text_75 = legend_rate_min + diff_rate * 3
    }
    
    svgObject0.getElementById("str_legend_000").textContent = legend_rate_min
    svgObject0.getElementById("str_legend_025").textContent = text_25.toFixed(0)
    svgObject0.getElementById("str_legend_050").textContent = text_50.toFixed(0)
    svgObject0.getElementById("str_legend_075").textContent = text_75.toFixed(0)
    svgObject0.getElementById("str_legend_100").textContent = legend_rate_max

    
    color_pmts(pmt_rates)
}


function update_pmts_to_ignore_for_rate(){
    pmts_to_ignore_for_rate = $("#field_ignore_pmts").val().split(",")
    status_bar("ignoring pmts: "+$("#field_ignore_pmts").val(), col = "green")
}

function change_toggle(id, desired_state){
    if($("#"+id).is(':checked') != desired_state){
        $("#"+id).parent().click()
    }
}

function force_show_timestamp(field = "field_current_timestamp"){
    change_toggle("monitor_live_toggle", false)
    updates_obtain_all(new Date($("#"+field).val()))
}


function jump_in_time(dt = 0){
    change_toggle("monitor_live_toggle", false)
    var time = new Date($("#field_current_timestamp").val())
        time.setTime(time.getTime() + dt*1000)
    $("#field_current_timestamp").val(time.toISOString())
    
    // load data for newly calculated timestring here.....
    updates_obtain_all(time)
    return(time)
}


function playback_wrapper(state = "auto"){
    if(state == "auto"){
        state = !$("#monitior_playback").is(':checked')
    }
    if(state == true && playback_interval == false){
        playback_interval = window.setInterval(
            function(){
                playback()
            },
            500
        )
    } else if(state == false){
        clearInterval(playback_interval)
        playback_interval = false
        change_toggle("monitior_playback", true)
    } else {
        
    }
}

function playback(){
    var date_now = new Date()
    var date_jump = jump_in_time(1)
    if(date_jump >= date_now){
        playback_wrapper(false)
        change_toggle("monitor_live_toggle", true)
        status_bar("reached present", "green")
        // turn of playback if reached present and switch to live view
    }
}


function usetimestamp(field){
    $("#"+field).val($("#field_current_timestamp").val())
}
function trendview_status_update(text_string){
    $("#monitor_trend_status").text(text_string);
}


function trendview_get_data_full(){
    if(trendview_test_validity() == false){
        return(0)
    }
    
    
    trendview_status_update("loading data, please standy by")
    var time_start = (new Date($("#field_history_start").val())).toISOString()
    var time_end = (new Date($("#field_history_end").val())).toISOString()
    trendview_pmts2follow = $("#field_line_plot_pmts").val().split(",")
    var missing = 0
    
    var pmts_per_reader = {}
    for(pmt of trendview_pmts2follow){
        var reader = pmt_dict[pmt]["reader"]
        
        if(Object.keys(pmts_per_reader).includes(reader)){
            pmts_per_reader[reader].push(pmt)
        } else {
            pmts_per_reader[reader] = [pmt]
            missing++
        }
    }
    
    
    
    trendview_data_temp = {}
    
    trendview_status_update("loading data, please standy by ("+missing+" readers to load)")
    for(let [reader, pmts] of Object.entries(pmts_per_reader)){
        var url = "monitor/history/"+reader+"/"+pmts.join(",")+"/"+time_start+"/"+time_end
        $.getJSON(url,
            function(data){
                missing--
                trendview_status_update(missing +" readers left")
                try{
                    trendview_data_temp[data[0]["host"]] = data
                }catch(error){}
                if(missing == 0){
                    trendview_status_update("all readers loaded")
                    trendview_work_on_data()
                }
            }
        )
    }
    return(true)
}

function trendview_work_on_data(){
    trendview_data = {}
    trendview_status_update("preparing data")
    for(pmt of trendview_pmts2follow){
        trendview_data[pmt] = []
        for(entry of trendview_data_temp[pmt_dict[pmt]["reader"]]){
            
          
            if(pmt in entry["channels"]){
                trendview_data[pmt].push([
                        (new Date(entry["time"])).getTime(),
                        entry["channels"][pmt]]
                )
            }
        }
        //trendview_data[pmt] = trendview_data[pmt].reverse()
        // reverse to prevent the ugly line
    }
    
    trendview_plot_update()
    
}




function trendview_plot_update(){
    trendview_status_update("updating plot")
    series = []
    trendview_pmt_order = {}
    if($("#monitor_trend_style").is(":checked")){
        var trendview_style = "scatter"
    }else{
        var trendview_style = "line"
    }
    
    i = -1
    for(let [pmt, data] of Object.entries(trendview_data)){
        
        
        
        i++
        trendview_pmt_order[pmt] = i
        series.push({
            name: 'pmt '+pmt,
            lineWidth: 1,
            type: trendview_style,
            data: trendview_data[pmt],
            tootltip:{
                headerFormat: '{point.key}'
            },
        })
    }
    
    trendview_object = Highcharts.chart('highcharts-figure', {

        chart: {
            zoomType: 'x',
            height: 720
        },

        title: {
            text: 'Datarate for selected channels'
        },
        yAxis: {
            title: {
                text: "datarate / kB/s",
            }
        },
       
        xAxis: {
            type: 'datetime'
        },

        series: series,
        plotOptions: {
            series: {
                tooltip: {
                    valueDecimals: 0
                },
                point: {
                    events: {
                        click: function() {
                            var timestamp = (new Date(this.options["x"])).toISOString()
                            $("#field_current_timestamp").val(timestamp);
                            trendview_status_update("showing timestamp " + timestamp)
                            force_show_timestamp();
                            setTimeout(function(){
                                trendview_status_update("")
                            }, 1000
                            )
                        }
                    }
                },
                marker: {
                    radius: 0
                },
                animation: false
            }
	}

    });
    
    trendview_status_update("")
}



function trendview_test_validity(){
    // check for pmts
    if(
            $("#field_line_plot_pmts").val().length == 0
    ){
        trendview_status_update("no pmts selected, click them in the live view.")
        return(false)
    }
    
    // check timings
    var time_start = new Date($("#field_history_start").val())
    var time_end   = new Date($("#field_history_end"  ).val())
    var dt = (time_end - time_start)
    
    if(isNaN(dt) || dt <= 0){
        trendview_status_update("check selected dates")
        return(false)
    }
        
    
    // do stuff
    return(true)
    
}



function start_follow_N_values(){
    var time_start = new Date()
    time_start.setTime(time_start.getTime()-parseInt($("#trendview_last_values_N").val())*1000)
    $("#field_history_start").val(time_start.toISOString())
    $("#field_history_end").val((new Date()).toISOString())
   

    if(trendview_test_validity() == true){
        change_toggle("monitor_trend_follow", false)
        change_toggle("monitor_trend_max_five_minues", false)
        change_toggle("monitor_trend_max_five_minues", false)
        change_toggle("monitor_live_toggle", true)
        trendview_get_data_full()
    }
    
    
}
