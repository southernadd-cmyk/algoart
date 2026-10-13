window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

var COMMON={
  materialStyle:'Choose Marker drawing or Tissue & Graphite. The same composition is used for both. PNG exports show the chosen material; SVG exports retain underlying marker paths.',
  elements:'Adds more marks to the composition.',
  density:'Makes the marks larger or smaller.',
  complexity:'Bends curved line strokes more strongly.',
  negativeSpace:'Leaves more room for the paper to show through.',
  phiStrength:'Pulls sizes and positions closer to golden-ratio relationships.',
  recursion:'Adds more rounds of division or growth.',
  spiralInfluence:'Pulls positions toward a spiral path.',
  goldenAngle:'Moves spacing toward the 137.5° golden angle.',
  nesting:'Adds smaller golden-ratio echoes inside larger shapes.',
  pen:'Chooses the underlying marker tool, such as fine, broad, dry or highlighter. Tissue & Graphite uses the same composition with its own material finish.',
  thickness:'Sets the width of the underlying marker strokes.',
  wobble:'Adds small imperfections to the ink.',
  overdraw:'Repeats underlying marker strokes. The selected tool also affects the number of passes.',
  opacity:'Makes the ink more solid or more transparent.',
  pressure:'Varies the weight of the underlying strokes.',
  dryness:'Adds breaks and gaps to the underlying marker strokes.',
  curveBias:'Higher values favour curved strokes; lower values favour straight ones.',
  shapeAmount:'Adds more of the enabled shapes among the line marks.',
  overlap:'Lets marks sit closer together and fill more of their allotted space.',
  rotation:'Varies the angles of individual marks.',
  palette:'Chooses a family of colours or monochrome tones.',
  colourCount:'Offers more colours or tones for the composition to use.',
  saturation:'Makes colours more vivid. Some palettes keep their own limits.',
  brightness:'Makes colours lighter or darker. Some palettes keep their own limits.',
  paper:'Changes the background colour.',
  grain:'Adds fine speckles to the paper. PNG keeps this texture; SVG uses a flat background.',
  exportScale:'Chooses the PNG image size. More pixels keep fine ink detail at larger sizes.'
};

var SYSTEMS={
  field:{
    elements:'Adds more supporting marks around the dominant forms.',
    negativeSpace:'Leaves quiet areas between the arranged marks.',
    spiralInfluence:'Pulls the arranged marks toward a spiral path.',
    phiStrength:'Brings mark positions, sizes and proportions closer to φ.'
  },
  spiral:{
    elements:'Adds more positions along the path for shapes and connecting strokes.',
    complexity:'Bends the connecting strokes and line marks more strongly.',
    phiStrength:'Brings mark sizes and proportions closer to φ.',
    spiralInfluence:'Keeps marks closer to their path. Lower values pull them toward nearby φ anchors.',
    overlap:'Lets the marks fill more of the space along the path.'
  },
  rects:{
    elements:'Controls division amount rather than an exact cell count. Division depth, Detail and minimum cell size determine how many cells can be built.',
    complexity:'Makes finer divisions and adds more diagonal strokes.',
    negativeSpace:'Leaves more cells empty inside the frame.',
    phiStrength:'Moves divisions from equal halves toward 61.8 / 38.2 proportions.',
    recursion:'Lets the rectangles divide through more rounds.',
    nesting:'Adds smaller golden-ratio rectangles inside the cells.',
    wobble:'Adds imperfect ink to the outlines, kept gentle with a maximum of 18.',
    curveBias:'Lets diagonal strokes curve slightly, with a maximum of 8.',
    shapeAmount:'Adds ellipses, arcs and polygons inside the cells.',
    rotation:'Adds a slight tilt to the cell outlines.'
  },
  burst:{
    elements:'Adds more radiating marks around the hubs.',
    complexity:'Bends curved rays and line marks more strongly.',
    negativeSpace:'Leaves more quiet space between the radiating marks.',
    phiStrength:'Brings the radiating mark sizes and proportions closer to φ.',
    goldenAngle:'Moves ray spacing from equal steps toward the 137.5° golden angle.',
    overlap:'Lets radiating marks sit closer together.'
  },
  network:{
    elements:'Adds more nodes for the network to connect.',
    density:'Makes the shapes at the nodes larger or smaller.',
    complexity:'Adds more neighbours and links to each node.',
    negativeSpace:'Leaves quiet areas between nodes. Links can still cross them.',
    phiStrength:'Brings node positions, sizes and link lengths closer to φ.',
    spiralInfluence:'Pulls node positions toward a spiral path.',
    shapeAmount:'Draws more shapes at the nodes, keeping the main nodes prominent.',
    overlap:'Lets nodes sit closer together and allows more crossing links.',
    rotation:'Varies the angles of the shapes at the nodes.'
  },
  organic:{
    elements:'Allows more branch strokes and, at higher values, more starting roots.',
    complexity:'Adds more forks and wider turns to the branches.',
    negativeSpace:'Leaves quiet areas that growing branches try to avoid.',
    phiStrength:'Brings starting positions and lengths closer to φ. New branches shrink by roughly φ.',
    recursion:'Lets branches grow through more rounds.',
    wobble:'Adds imperfect ink to the branches, with a minimum of 42.',
    curveBias:'Favours curved branches, with a minimum of 76.',
    shapeAmount:'Adds small elliptical marks at branch tips.'
  },
  geometric:{
    elements:'Sets the number of main constructed forms, up to 34. Detail also sets the minimum available count and adds supporting accents.',
    complexity:'Adds more forms and supporting line accents.',
    negativeSpace:'Leaves more quiet space around the floating forms.',
    phiStrength:'Brings form positions, sizes and proportions closer to φ.',
    nesting:'Adds smaller shapes or arcs inside dominant forms.',
    wobble:'Adds imperfect ink to the forms, kept gentle with a maximum of 16.',
    overdraw:'Draws over each stroke again, up to 4 passes before the selected marker tool adjusts them.',
    curveBias:'Lets supporting strokes curve slightly, with a maximum of 12.'
  },
  scribble:{
    elements:'Adds more strokes across the gestures.',
    density:'Expands the gestures and lengthens their strokes.',
    complexity:'Adds more gesture centres, shorter runs and sharper turns.',
    negativeSpace:'Leaves quiet areas and more pauses between runs of ink.',
    phiStrength:'Brings gesture positions, sizes and stroke lengths closer to φ.',
    wobble:'Adds uneven ink and wandering turns, with a minimum ink wobble of 44.',
    overdraw:'Draws over each stroke again, with at least 2 passes before the selected marker tool adjusts them.',
    curveBias:'Favours flowing curves, with a minimum of 58.',
    shapeAmount:'Adds occasional arcs and elliptical accents around the gestures.'
  }
};

var LABELS={density:'Scale',complexity:'Bend',negativeSpace:'Empty space',phiStrength:'Additional φ pull',recursion:'Depth',spiralInfluence:'Spiral pull',goldenAngle:'Golden-angle spacing',nesting:'Inner shapes',curveBias:'Curved strokes',rotation:'Angle variation'};
var SYSTEM_LABELS={
  field:{elements:'Marks'},
  spiral:{elements:'Path positions',spiralInfluence:'Follow path'},
  rects:{elements:'Division amount',complexity:'Detail',recursion:'Division depth',rotation:'Tilt'},
  burst:{elements:'Radiating marks'},
  network:{elements:'Nodes',complexity:'Connections',density:'Node scale',shapeAmount:'Node shapes'},
  organic:{elements:'Growth',complexity:'Branching',recursion:'Growth depth',shapeAmount:'Tip marks'},
  geometric:{elements:'Forms',complexity:'Detail'},
  scribble:{elements:'Strokes',density:'Gesture scale',complexity:'Gesture detail',shapeAmount:'Accents'}
};

// Presentation only. Profile names describe the *source marks* converted
// into tissue and graphite, not seven new brushes or changes to artwork data.
var TISSUE_PROFILES={
  felt:'Balanced marks',
  fine:'Fine contours',
  broad:'Wide bands',
  highlighter:'Flat-edged bands',
  dry:'Broken marks',
  paint:'Dense marks',
  scribble:'Loose gestures'
};
var TISSUE_LABELS={
  pen:'Source mark profile',
  thickness:'Source stroke width',
  wobble:'Source irregularity',
  overdraw:'Source repetitions',
  opacity:'Source transparency',
  pressure:'Width variation',
  dryness:'Source break-up'
};
var TISSUE_HELP={
  pen:'Selects the underlying mark profile used to build the tissue layout. These are not literal pens or watercolour brushes. The profile affects source stroke width, shape and repetition; Tissue & Graphite supplies its own visual finish.',
  thickness:'Sets the width of the underlying source strokes; this is not the thickness of the tissue paper.',
  wobble:'Introduces irregularities into the source mark geometry used to form tissue shapes.',
  overdraw:'Repeats source strokes before they are converted to tissue geometry. Near-identical marks may be combined by the tissue renderer.',
  opacity:'Sets the transparency of underlying source ink. Tissue & Graphite applies its own pigment translucency instead of using marker ink opacity directly.',
  pressure:'Varies the width of source strokes. This is not pressure applied to a graphite pencil.',
  dryness:'Adds gaps and breaks to source strokes at higher values. This does not simulate a separate dry brush.'
};
var penControl=document.getElementById('pen'),MARKER_PROFILES={};
if(penControl)Array.prototype.forEach.call(penControl.options,function(option){
  MARKER_PROFILES[option.value]=option.textContent;
});

// Presentation only: retain every setting and its value for existing artwork URLs.
var INACTIVE={
  field:['recursion','goldenAngle'],
  spiral:['recursion','goldenAngle','negativeSpace','rotation'],
  rects:['density','spiralInfluence','goldenAngle','overlap'],
  burst:['recursion','spiralInfluence','rotation'],
  network:['recursion','goldenAngle'],
  organic:['density','spiralInfluence','goldenAngle','nesting','overlap','rotation'],
  geometric:['density','recursion','spiralInfluence','goldenAngle','shapeAmount','overlap','rotation'],
  scribble:['recursion','spiralInfluence','goldenAngle','nesting','overlap','rotation']
};

function inactiveControl(mode,id,version,meta){
  var hidden=(INACTIVE[mode]||[]).indexOf(id)!==-1;
  if((mode==='field'||mode==='network')&&id==='goldenAngle'&&version<4)hidden=false;
  if(mode==='spiral'&&version<6){
    if(id==='negativeSpace')hidden=false;
    if(id==='spiralInfluence')hidden=true;
    if(id==='goldenAngle')hidden=version>=4;
  }
  if(meta&&meta.guide){
    if(mode==='burst'&&meta.guide.type==='burst'&&id==='negativeSpace')hidden=meta.guide.variant!=='VOID';
    if(mode==='geometric'&&meta.guide.type==='constructed'&&id==='negativeSpace')hidden=meta.guide.variant!=='FLOAT';
    if(mode==='spiral'&&version<6&&meta.guide.type==='spiral'&&id==='negativeSpace')hidden=meta.guide.variant!=='VOID';
  }
  return hidden;
}

function helpText(mode,id,version){
  if(mode==='organic'&&version>=8&&id==='elements')return 'Allows more branch strokes and up to four starting roots, with multiple forms more frequent in landscape.';
  if(mode==='organic'&&version>=8&&id==='phiStrength')return 'Brings trunk lengths closer to powers of φ. Roots already use golden-angle directions and golden edge positions. At 0% the structure still uses φ.';
  if(mode==='spiral'&&version<6&&id==='negativeSpace')return 'Leaves quiet areas between the spiral marks.';
  var description=(SYSTEMS[mode]||{})[id]||COMMON[id]||'';
  return id==='phiStrength'?description+' At 0%, this additional pull is removed, but the underlying composition still uses φ.':description;
}


/* Keep original artwork settings separate from the effective slider display.
   The seed includes raw settings, so normalising old links would change the art. */
var RANGE_LIMITS={
  rects:{wobble:[0,18],curveBias:[0,8]},
  organic:{wobble:[42,100],curveBias:[76,100]},
  geometric:{wobble:[0,16],curveBias:[0,12],overdraw:[1,4]},
  scribble:{wobble:[44,100],curveBias:[58,100],overdraw:[2,10]}
};
var rangeStates={};
A.readControlValue=function(input){
  var state=rangeStates[input.id];
  return state?state.raw:+input.value;
};
A.setControlValue=function(input,value){
  var state=rangeStates[input.id];
  if(!state){input.value=value;return;}
  var bounded=Math.max(state.min,Math.min(state.max,+value));
  state.raw=state.min+Math.round((bounded-state.min)/state.step)*state.step;
  displayRange(input,state);
};
function displayRange(input,state){
  var mode=document.getElementById('mode').value;
  var limits=(RANGE_LIMITS[mode]||{})[input.id]||[state.min,state.max];
  var value=state.raw;
  if(mode==='geometric'&&input.id==='elements'){
    var detail=A.readControlValue(document.getElementById('complexity'));
    limits=[Math.max(7,Math.round(7+state.min*.15+detail*.075)),Math.min(34,Math.round(7+state.max*.15+detail*.075))];
    value=Math.min(34,Math.round(7+state.raw*.15+detail*.075));
  }
  input.min=limits[0];input.max=limits[1];
  input.value=Math.max(limits[0],Math.min(limits[1],value));
  var output=input.parentElement.querySelector('output');
  if(output)output.textContent=input.value;
}
document.querySelectorAll('input[type=range]').forEach(function(input){
  var state=rangeStates[input.id]={min:+input.min,max:+input.max,step:+input.step||1,raw:+input.value};
  input.addEventListener('input',function(){
    var mode=document.getElementById('mode').value;
    state.raw=+input.value;
    if(mode==='geometric'&&input.id==='elements'){
      var detail=A.readControlValue(document.getElementById('complexity'));
      state.raw=Math.max(state.min,Math.min(state.max,Math.round((+input.value-7-detail*.075)/.15)));
    }
    if(input.id==='complexity')displayRange(document.getElementById('elements'),rangeStates.elements);
  });
});

var entries=[],active=null,pinned=false,hideTimer=null;

function closeHelp(){
  clearTimeout(hideTimer);
  if(active)active.hint.hidden=true;
  active=null;
  pinned=false;
}

function placeHelp(entry){
  var anchor=entry.button.getBoundingClientRect();
  var box=entry.hint.getBoundingClientRect();
  var width=window.innerWidth,height=window.innerHeight;
  var left=Math.max(12,Math.min(anchor.right-box.width,width-box.width-12));
  var top=anchor.bottom+8;
  if(top+box.height>height-12)top=anchor.top-box.height-8;
  entry.hint.style.left=left+'px';
  entry.hint.style.top=Math.max(12,top)+'px';
}

function openHelp(entry){
  clearTimeout(hideTimer);
  if(active!==entry){closeHelp();active=entry;}
  entry.hint.hidden=false;
  placeHelp(entry);
}

function scheduleClose(entry){
  clearTimeout(hideTimer);
  hideTimer=setTimeout(function(){
    if(active!==entry||pinned||document.activeElement===entry.button||entry.button.matches(':hover')||entry.hint.matches(':hover'))return;
    closeHelp();
  },140);
}

document.querySelectorAll('.control').forEach(function(row){
  var input=row.querySelector('input,select'),label=row.querySelector('label');
  if(!input||!label||!COMMON[input.id])return;
  label.htmlFor=input.id;
  var wrap=document.createElement('span');
  wrap.className='control-label';
  row.insertBefore(wrap,label);
  wrap.appendChild(label);
  var button=document.createElement('button');
  button.type='button';
  button.className='control-help';
  button.textContent='?';
  button.setAttribute('aria-label','About '+label.textContent.trim());
  wrap.appendChild(button);
  var hint=document.createElement('div');
  hint.id='control-help-'+input.id;
  hint.className='control-hint';
  hint.setAttribute('role','tooltip');
  hint.hidden=true;
  document.body.appendChild(hint);
  button.setAttribute('aria-describedby',hint.id);
  var previous=input.getAttribute('aria-describedby');
  input.setAttribute('aria-describedby',previous?previous+' '+hint.id:hint.id);
  var entry={id:input.id,row:row,label:label,name:label.textContent.trim(),button:button,hint:hint};
  entries.push(entry);
  button.addEventListener('pointerenter',function(e){if(e.pointerType!=='touch')openHelp(entry)});
  button.addEventListener('pointerleave',function(){scheduleClose(entry)});
  button.addEventListener('focus',function(){openHelp(entry)});
  button.addEventListener('blur',function(){if(active===entry){pinned=false;scheduleClose(entry)}});
  button.addEventListener('click',function(){
    if(active===entry&&pinned){closeHelp();return;}
    openHelp(entry);
    pinned=true;
  });
  hint.addEventListener('pointerenter',function(){clearTimeout(hideTimer)});
  hint.addEventListener('pointerleave',function(){scheduleClose(entry)});
});

var shapeChecks=Array.prototype.map.call(document.querySelectorAll('.checks input'),function(input){
  return{id:input.id,label:input.parentElement,name:input.parentElement.lastChild.textContent.trim()};
});

A.syncControlHelp=function(mode,version,meta){
  version=version||6;
  var palette=document.getElementById('palette');
  var monochrome=palette&&palette.value==='mono';
  var tissue=document.getElementById('materialStyle')?.value==='tissue';
  // Change only visible text. Never replace option nodes or their stable
  // values: the existing seed, URL, saved images and exports use these IDs.
  if(penControl)Array.prototype.forEach.call(penControl.options,function(option){
    option.textContent=tissue?(TISSUE_PROFILES[option.value]||MARKER_PROFILES[option.value]):
      MARKER_PROFILES[option.value];
  });
  var controlsNote=document.getElementById('materialControlsNote');
  if(controlsNote)controlsNote.textContent=tissue?
    'These settings shape the source marks used to arrange the tissue and graphite. Profiles describe those marks, not physical brushes or highlighters. Tissue PNGs apply their own material finish; SVG and plotter exports use the underlying marker paths.':
    'Choose Marker or Tissue & Graphite in Compose. Marker tools control the visible ink strokes. Tissue & Graphite converts their source paths into torn-paper and graphite artwork; SVG and plotter exports use marker paths.';
  entries.forEach(function(entry){
    var rangeInput=document.getElementById(entry.id);
    if(rangeStates[entry.id])displayRange(rangeInput,rangeStates[entry.id]);
    entry.row.hidden=inactiveControl(mode,entry.id,version,meta)||(monochrome&&(entry.id==='saturation'||entry.id==='brightness'));
    entry.label.textContent=monochrome&&entry.id==='colourCount'?'Tones':
      (tissue&&TISSUE_LABELS[entry.id]||((SYSTEM_LABELS[mode]||{})[entry.id]||LABELS[entry.id]||entry.name));
    entry.button.setAttribute('aria-label','About '+entry.label.textContent);
    entry.hint.textContent=tissue&&entry.id==='grain'?'Tissue & Graphite has its own paper finish. This grain setting applies to Marker drawing.':
      (tissue&&TISSUE_HELP[entry.id]||helpText(mode,entry.id,version));
    if(active===entry&&entry.row.hidden)closeHelp();
  });
  shapeChecks.forEach(function(check){
    var hidden=mode==='organic'||(mode==='scribble'&&(check.id==='rectangles'||check.id==='polygons'));
    if(mode==='scribble'&&check.id==='lines'&&meta&&meta.guide&&meta.guide.type==='scribble')hidden=meta.guide.variant!=='RIBBON';
    check.label.hidden=hidden;
    check.label.lastChild.textContent=' '+(mode==='scribble'&&check.id==='lines'?'Links':check.name);
  });
  var checks=document.querySelector('.checks');
  if(checks)checks.hidden=shapeChecks.every(function(check){return check.label.hidden});
  var mutate=document.getElementById('mutate'),randomise=document.getElementById('randomise');
  if(mutate)mutate.title='Try a few small changes. Keep the current system, material, '+(tissue?'source mark profile':'mark-making tool')+' and palette.';
  if(randomise)randomise.title='Try a new seed, system, '+(tissue?'source mark profile':'mark-making tool')+', palette and slider settings. Keep the selected material, paper colour and shape choices.';
  if(active)placeHelp(active);
};
A.closeControlHelp=closeHelp;

document.addEventListener('click',function(e){
  if(active&&!active.button.contains(e.target)&&!active.hint.contains(e.target))closeHelp();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&active){closeHelp();e.preventDefault();e.stopPropagation();}
});
window.addEventListener('resize',closeHelp);
window.addEventListener('scroll',closeHelp,true);
A.syncControlHelp(document.getElementById('mode').value,6);

})(window.AlgoArt);
