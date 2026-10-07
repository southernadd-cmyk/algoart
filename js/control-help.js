window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

var COMMON={
  elements:'Sets the number of primary marks or positions to work with; the finished piece can contain additional strokes.',
  density:'Changes the size and visual weight of marks, rather than adding more elements.',
  complexity:'Changes the bend of curved line strokes; Elements controls how many primary marks are available.',
  negativeSpace:'Reserves quiet areas that the composition tries to avoid.',
  phiStrength:'Pulls positions, sizes and proportions toward golden-ratio relationships. Lower values allow more variation.',
  recursion:'This system does not use recursive depth as a direct composition control.',
  spiralInfluence:'This system does not use spiral influence as a direct composition control.',
  goldenAngle:'This system uses its own fixed angles; this slider does not directly set them.',
  nesting:'Adds smaller golden-ratio echoes inside selected shapes; not every shape supports nesting.',
  pen:'Chooses the ink character: each pen changes the balance of width, transparency, wobble and repeated strokes.',
  thickness:'Sets the base stroke width. The pen and the importance of a mark can adjust its final width.',
  wobble:'Adds small irregularities to stroke points, making the ink feel less precise.',
  overdraw:'Sets repeated passes over each stroke. The selected pen can adjust the number of passes.',
  opacity:'Sets how opaque the ink is. Pen type and repeated passes also affect its appearance.',
  pressure:'Varies stroke width between ink passes; higher values give more uneven weight.',
  dryness:'Increases the chance of broken ink and small gaps along strokes.',
  curveBias:'Higher values make line strokes more likely to curve; lower values favour straight strokes.',
  shapeAmount:'Raises the chance of using enabled shapes instead of simple line marks.',
  overlap:'Allows marks to sit closer together and occupy more of their allotted space.',
  rotation:'Increases the range of initial mark rotations; composition rules can align them afterwards.',
  palette:'Chooses the family of hues or monochrome tones available to the artwork.',
  colourCount:'Sets the number of available colours or tones. The composition can use fewer than this maximum.',
  saturation:'Sets colour intensity. Some palettes constrain it; Monochrome uses no saturation.',
  brightness:'Sets colour lightness. Some palettes constrain it; Monochrome uses its own tonal range.',
  paper:'Sets the background colour used on screen and in exports.',
  grain:'Adds fine light and dark speckles to the paper. PNG includes the grain; SVG keeps a flat background.',
  exportScale:'Sets the PNG pixel dimensions. Larger sizes retain the same composition with more pixels.'
};

var SYSTEMS={
  field:{
    elements:'Sets the number of arranged marks. More elements create more small supporting marks around the dominant forms.',
    density:'Changes the size of the arranged marks; Elements controls their number.',
    negativeSpace:'Reserves empty regions and encourages the arranged marks to leave them clear.',
    spiralInfluence:'Pulls candidate mark positions toward a spiral trajectory before the composition balances their spacing.',
    phiStrength:'Strengthens golden-ratio positions, size steps and shape proportions across the arranged marks.'
  },
  spiral:{
    elements:'Sets the number of sampled positions along the trajectory. Some positions become shapes, connecting strokes or gaps.',
    density:'Changes the size of marks along the trajectory, rather than the number of sampled positions.',
    complexity:'Changes the bend of curved connecting strokes and line marks; it does not add trajectory points.',
    negativeSpace:'This system does not reserve empty regions with this slider; gaps come from the trajectory family.',
    phiStrength:'Strengthens golden-ratio sizes and proportions in the marks. The trajectory family retains its own structure.',
    spiralInfluence:'Higher values keep points closer to their trajectory; lower values pull them slightly toward golden-ratio anchor positions.',
    overlap:'Allows marks to fill more of their allotted space along the trajectory; it does not directly move the path.',
    rotation:'Mark angles follow the trajectory; this slider does not directly rotate the path.'
  },
  rects:{
    elements:'Contributes to the target number of rectangular divisions, together with Recursion and Complexity.',
    density:'This system sizes its marks from the divided cells; Density does not directly scale them.',
    complexity:'Allows more, smaller divisions and raises the chance of diagonal strokes inside cells.',
    negativeSpace:'Leaves more of the divided cells empty, creating quiet areas inside the outer frame.',
    phiStrength:'Moves cell splits from equal halves toward 61.8 / 38.2 divisions and strengthens golden-ratio margins.',
    recursion:'Raises the subdivision depth limit and target cell count; cell size also limits further divisions.',
    nesting:'Raises the chance of a smaller golden-ratio rectangle inside a cell.',
    wobble:'Adds irregular ink to the divisions, capped at 18 to preserve their architectural character.',
    curveBias:'Affects diagonal strokes inside cells, capped at 8 so they stay mostly straight.',
    shapeAmount:'Raises the chance of ellipses, arcs and polygons inside cells; it does not replace the rectangular framework.',
    overlap:'Cell boundaries determine spacing here; Overlap does not directly move the divisions.',
    rotation:'Adds small tilts to cell outlines; it does not rotate the subdivision grid.'
  },
  burst:{
    elements:'Sets the number of radiating marks shared between the composition\'s hubs.',
    density:'Changes the scale of the radiating marks; Elements controls how many are allocated.',
    complexity:'Changes the bend of curved rays and line-based marks.',
    negativeSpace:'Enlarges reserved quiet regions in the VOID family; other burst families do not reserve those regions.',
    phiStrength:'Strengthens golden-ratio mark sizes and proportions around the radiating hubs.',
    goldenAngle:'Moves angular spacing from an even division of the circle toward the 137.5° golden-angle step.',
    overlap:'Relaxes spacing penalties between radiating marks, allowing them to sit closer together.',
    rotation:'Mark directions follow the rays around their hubs; this slider does not directly rotate the burst.'
  },
  network:{
    elements:'Sets the number of nodes to place; the system then chooses connections between them.',
    density:'Changes node-mark sizes. Complexity controls the number and richness of connections.',
    complexity:'Allows more neighbours and connections per node, and changes the bend of curved links.',
    negativeSpace:'Reserves quiet regions that node placement tries to avoid; links can still cross them.',
    phiStrength:'Strengthens golden-ratio node positions, sizes and preferred connection lengths.',
    spiralInfluence:'Pulls candidate node positions toward a spiral trajectory before spacing is balanced.',
    shapeAmount:'Raises the chance of visible shapes at nodes. Important nodes remain more strongly emphasised.',
    overlap:'Allows closer node spacing and more crossings between connections.',
    rotation:'Changes initial node-mark rotations; it does not rotate the whole network.'
  },
  organic:{
    elements:'Sets the branch-segment budget and, at higher values, adds more starting roots. Depth and branch length can stop growth sooner.',
    density:'Branch lengths come from the growth rules; Density does not directly scale them.',
    complexity:'Raises the chance of branching in two directions and widens the turns between branches.',
    negativeSpace:'Reserves quiet areas that branch endpoints try to avoid.',
    phiStrength:'Strengthens golden-ratio starting positions and initial lengths. Each generation still shrinks by approximately φ.',
    recursion:'Raises the allowed number of branch generations; Elements also limits the total growth.',
    nesting:'This system grows branches rather than adding nested copies of shapes.',
    wobble:'Adds irregular ink to branches, with a minimum of 42 to preserve the organic character.',
    curveBias:'Makes branch strokes more likely to curve, with a minimum of 76.',
    shapeAmount:'Raises the chance of small elliptical marks at branch endpoints.',
    overlap:'Growth rules determine branch spacing; Overlap does not directly separate the branches.',
    rotation:'Branch directions come from the growth rules; this slider does not directly rotate them.'
  },
  geometric:{
    elements:'Contributes to the number of constructed forms, together with Complexity; the composition caps the total at 34.',
    density:'Form sizes come from the selected composition family; Density does not directly scale them.',
    complexity:'Adds more constructed forms and raises the chance of supporting line accents.',
    negativeSpace:'Enlarges reserved quiet regions in the FLOAT family; other constructed families do not reserve those regions.',
    phiStrength:'Strengthens golden-ratio positions, size steps and shape proportions in the constructed forms.',
    nesting:'Raises the chance of a smaller shape or arc accent inside a dominant form.',
    wobble:'Adds irregular ink to constructed forms, capped at 16 to preserve their precise character.',
    overdraw:'Sets repeated ink passes, capped at 4 before the selected pen adjusts them.',
    curveBias:'Affects supporting line strokes, capped at 12 to keep the construction mostly straight.',
    shapeAmount:'This system chooses directly from the enabled shape types; Shape amount does not directly set their mix.',
    overlap:'The composition family sets form spacing and collisions; Overlap does not directly move them.',
    rotation:'Form angles come from the composition family; this slider does not directly rotate them.'
  },
  scribble:{
    elements:'Sets the stroke-segment budget. The system shares those strokes between its gesture anchors.',
    density:'Expands the gesture areas and increases stroke lengths; it does not add more strokes.',
    complexity:'Adds gesture anchors where the family allows them, shortens continuous runs and increases turning.',
    negativeSpace:'Reserves quiet regions and increases breaks between continuous runs of ink.',
    phiStrength:'Strengthens golden-ratio anchor positions, gesture sizes and stroke lengths.',
    nesting:'This system makes continuous gestures rather than nested copies of shapes.',
    wobble:'Adds irregular ink and directional variation, with a minimum ink wobble of 44.',
    overdraw:'Sets repeated ink passes, with a minimum of 2 before the selected pen adjusts them.',
    curveBias:'Makes gesture strokes more likely to curve, with a minimum of 58.',
    shapeAmount:'Raises the chance of occasional arcs and elliptical accents around the gestures.',
    overlap:'Gesture areas determine spacing; Overlap does not directly separate the strokes.',
    rotation:'Gesture directions come from their anchors and turning rules; this slider does not directly rotate them.'
  }
};

function helpText(mode,id,version){
  var system=SYSTEMS[mode]||{};
  if(mode==='spiral'&&version<6){
    if(id==='negativeSpace')return 'Enlarges reserved quiet regions in the VOID spiral family; other spiral families do not reserve them.';
    if(id==='spiralInfluence')return 'This spiral follows its own path rules; Spiral influence does not directly set its trajectory.';
    if(id==='goldenAngle'&&version<4)return 'Moves the angular step between spiral positions toward the 137.5° golden angle.';
  }
  if(mode==='field'&&version<4&&id==='goldenAngle')return 'Moves the angular step of candidate spiral positions toward the 137.5° golden angle.';
  return system[id]||COMMON[id]||'';
}

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
  var entry={id:input.id,button:button,hint:hint};
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

A.syncControlHelp=function(mode,version){
  entries.forEach(function(entry){entry.hint.textContent=helpText(mode,entry.id,version||6)});
  var mutate=document.getElementById('mutate'),randomise=document.getElementById('randomise');
  if(mutate)mutate.title='Makes a few small parameter adjustments and changes the seed, keeping the current system, pen and palette.';
  if(randomise)randomise.title='Chooses a new seed and randomises the sliders, system, pen and palette. Keeps the paper colour and enabled shape types.';
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
