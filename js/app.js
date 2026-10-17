window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function $(id){return document.getElementById(id)}

var canvas=$('art');
var showGeometry=false;
var app=$('app');
var mobileQuery=window.matchMedia('(max-width:700px)');
var previewTimer=null;
var modePreviewStateKey=null;
var variationBatch=0;
var currentRenderMeta=null;
var currentDescription=null;
// Keep the URL parser aligned with the renderer versions implemented in generator.js.
var SUPPORTED_RENDERER_VERSIONS=Object.freeze([1,2,3,4,5,6,7,8,9]);
var CURRENT_RENDERER_VERSION=SUPPORTED_RENDERER_VERSIONS[SUPPORTED_RENDERER_VERSIONS.length-1];
A.supportedRendererVersions=SUPPORTED_RENDERER_VERSIONS;
var UNVERSIONED_FIELD_VERSION_BY_SEED={
  'AA-20261005-04-72522':2
};
A.rendererVersion=CURRENT_RENDERER_VERSION;

function useCurrentRenderer(){
  A.rendererVersion=CURRENT_RENDERER_VERSION;
}

function withRendererVersion(version,fn){
  var previous=A.rendererVersion;
  A.rendererVersion=version;
  try{return fn()}finally{A.rendererVersion=previous}
}

function syncRendererChip(){
  var chip=$('rendererChip');
  if(!chip)return;
  var legacy=A.rendererVersion<CURRENT_RENDERER_VERSION;
  chip.hidden=!legacy;
  chip.textContent=legacy?'LEGACY RENDERER V'+A.rendererVersion:'';
}

var SETTING_IDS=[
  'mode','orientation','elements','density','complexity','negativeSpace',
  'phiStrength','recursion','spiralInfluence','goldenAngle','nesting',
  'pen','thickness','wobble','overdraw','opacity','pressure','dryness',
  'curveBias','shapeAmount','overlap','rotation',
  'lines','circles','rectangles','polygons','arcs',
  'palette','colourCount','saturation','brightness','paper','grain'
];

var PARAM_KEYS={
  seed:'seed',mode:'mode',orientation:'fmt',elements:'el',density:'den',complexity:'cx',negativeSpace:'neg',
  phiStrength:'phi',recursion:'rec',spiralInfluence:'spi',goldenAngle:'ga',nesting:'nest',
  pen:'pen',thickness:'th',wobble:'wob',overdraw:'od',opacity:'op',pressure:'pr',dryness:'dry',
  curveBias:'curve',shapeAmount:'shape',overlap:'overlap',rotation:'rot',
  lines:'ln',circles:'ci',rectangles:'re',polygons:'po',arcs:'ar',
  palette:'pal',colourCount:'cols',saturation:'sat',brightness:'bri',paper:'paper',grain:'grain'
};

var SERIES={
  field:{code:'FIELD',title:'Orbital Studies'},
  spiral:{code:'SPIRAL',title:'Golden Trajectories'},
  rects:{code:'RECTS',title:'Recursive Divisions'},
  burst:{code:'BURST',title:'Radiant Systems'},
  network:{code:'NETWORK',title:'Connected Fields'},
  organic:{code:'ORGANIC',title:'Growth Systems'},
  geometric:{code:'GEOMETRIC',title:'Constructed Forms'},
  scribble:{code:'SCRIBBLE',title:'Automatic Marks'}
};

function syncRangeOutput(r){
  var o=r.parentElement&&r.parentElement.querySelector('output');
  if(o)o.textContent=r.value;
}

document.querySelectorAll('input[type=range]').forEach(function(r){
  syncRangeOutput(r);
  r.addEventListener('input',function(){syncRangeOutput(r)});
});

function setTab(name){
  document.querySelectorAll('.tab').forEach(function(btn){
    var active=btn.dataset.tab===name;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
    btn.tabIndex=active?0:-1;
  });
  document.querySelectorAll('.tab-panel').forEach(function(panel){
    panel.classList.toggle('active',panel.dataset.panel===name);
    panel.hidden=panel.dataset.panel!==name;
  });
  try{localStorage.setItem('algoart-tab',name)}catch(e){}
}

document.querySelectorAll('.tab').forEach(function(btn){
  btn.addEventListener('click',function(){setTab(btn.dataset.tab)});
  btn.addEventListener('keydown',function(e){
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    var tabs=Array.from(document.querySelectorAll('.tab'));
    var index=tabs.indexOf(btn),next=index;
    if(e.key==='ArrowRight')next=(index+1)%tabs.length;
    else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    else if(e.key==='Home')next=0;
    else if(e.key==='End')next=tabs.length-1;
    else return;
    e.preventDefault();e.stopPropagation();
    setTab(tabs[next].dataset.tab);tabs[next].focus();
  });
});

function inspectorStorageKey(){
  return mobileQuery.matches?'algoart-inspector-mobile':'algoart-inspector-desktop';
}

function setInspector(open,remember){
  app.classList.toggle('inspector-closed',!open);
  $('inspectorToggle').setAttribute('aria-expanded',open?'true':'false');
  if(remember!==false){
    try{localStorage.setItem(inspectorStorageKey(),open?'open':'closed')}catch(e){}
  }
}

$('inspectorClose').onclick=function(){setInspector(false,true)};
$('inspectorToggle').onclick=function(){setInspector(true,true)};

try{
  var savedTab=localStorage.getItem('algoart-tab');
  if(savedTab&&document.querySelector('[data-panel="'+savedTab+'"]'))setTab(savedTab);

  var savedInspector=localStorage.getItem(inspectorStorageKey());
  if(savedInspector==='closed'){
    setInspector(false,false);
  }else if(savedInspector==='open'){
    setInspector(true,false);
  }else{
    setInspector(!mobileQuery.matches,false);
  }
}catch(e){
  setInspector(!mobileQuery.matches,false);
}

function applyResponsiveInspectorState(){
  try{
    var saved=localStorage.getItem(inspectorStorageKey());
    if(saved==='open')setInspector(true,false);
    else if(saved==='closed')setInspector(false,false);
    else setInspector(!mobileQuery.matches,false);
  }catch(e){
    setInspector(!mobileQuery.matches,false);
  }
}

if(mobileQuery.addEventListener){
  mobileQuery.addEventListener('change',applyResponsiveInspectorState);
}else if(mobileQuery.addListener){
  mobileQuery.addListener(applyResponsiveInspectorState);
}

A.readSettings=function(){
  var s={seed:$('seed').value||'PHI-1618'};
  SETTING_IDS.forEach(function(id){
    var e=$(id);
    s[id]=e.type==='checkbox'?e.checked:(e.type==='range'?(A.readControlValue?A.readControlValue(e):+e.value):e.value);
  });
  return s;
};

function applySettings(settings){
  if(settings.seed!=null)$('seed').value=settings.seed;
  SETTING_IDS.forEach(function(id){
    if(settings[id]==null)return;
    var e=$(id);
    if(e.type==='checkbox'){
      e.checked=!!settings[id];
    }else{
      if(e.type==='range'&&A.setControlValue)A.setControlValue(e,settings[id]);
      else e.value=settings[id];
      if(e.type==='range')syncRangeOutput(e);
    }
  });
  syncModeCards();
}

// Historical internal name retained for the existing (unchanged) material engine.
// New Tissue & Graphite uses composition-derived colour. Historical URLs
// keep the original fixed pigment palette for archival reproducibility.
var tissuePaletteVersion=7;
var watercolourMaterialRevision='v2s';
var watercolourFitToSheet=false; // Legacy watercolour-specific fit.
var phiSheetFraming=false; // Shared optional φ source-geometry transform.
var legacyOilV1Link=false;
var legacyOilV2Link=false; // Historical Oil v1 links only; never a visible selector choice.
var oilV4Link=true; // Oil V4 is the default; explicit oil-v1/v2/v3 URLs preserve historical versions.
function oilEnabled(){return $('materialStyle').value==='tissue'}
function watercolourEnabled(){return $('materialStyle').value==='watercolour'}
function oilPaintEnabled(){return $('materialStyle').value==='oil'}
function oilPaintV2Enabled(){return oilPaintEnabled()&&legacyOilV2Link&&!legacyOilV1Link}
function oilPaintV3Enabled(){return oilPaintEnabled()&&!legacyOilV1Link&&!legacyOilV2Link&&!oilV4Link}
function oilPaintV4Enabled(){return oilPaintEnabled()&&oilV4Link&&!legacyOilV1Link&&!legacyOilV2Link}
// V2T is V2S drawing code on CPU-backed canvases; it shares V2S's fit/φ rules.
function watercolourV2SFamily(){return watercolourMaterialRevision==='v2s'||watercolourMaterialRevision==='v2t'}
function oilPaintV1Enabled(){return legacyOilV1Link===true}
function materialKey(){return $('materialStyle').value+'|'+
    (oilPaintV4Enabled()?'oil-paint-v4':oilPaintV3Enabled()?'oil-paint-v3':oilPaintV2Enabled()?'oil-paint-v2':oilPaintV1Enabled()?'oil-paint-v1':oilEnabled()?tissuePaletteVersion:watercolourEnabled()?watercolourMaterialRevision:'marker')+
    '|phi:'+phiSheetFraming+'|historic-fit:'+watercolourFitToSheet}
function syncMaterialNote(){
  var control=$('watercolourFitControl');
  // Preserve access to the historical V2S material-only fit (fit=0/1).
  // Do not display it while the mutually exclusive shared φ fit is active.
  if(control)control.hidden=!(watercolourEnabled()&&
    watercolourV2SFamily()&&!phiSheetFraming);
  var toggle=$('watercolourFit');
  if(toggle)toggle.checked=watercolourFitToSheet;
  var phiToggle=$('phiSheetFit');
  if(phiToggle){
    phiToggle.checked=phiSheetFraming;
    // V2R must be byte-stable; it has its own historical presentation.
    phiToggle.disabled=watercolourEnabled()&&watercolourMaterialRevision==='v2r';
  }
  var phiInfo=$('phiSheetInfo');
  if(phiInfo&&!phiSheetFraming)
    phiInfo.textContent='Off · original source geometry and placement.';
  var note=$('materialStyleNote');
  if(!note)return;
  note.textContent=(watercolourEnabled()
    ?'Watercolour pigments on textured paper, with wet washes, drying edges and expressive dry brushwork.'+
      (watercolourV2SFamily()?
      (phiSheetFraming?' Shared φ framing applies to the source geometry and SVG/plotter too.':
      watercolourFitToSheet?' Legacy Watercolour fit-to-sheet is ON and changes its PNG, not its source SVG.':
        ' Source scale and placement match the Marker/plotter φ composition.')+
      (watercolourMaterialRevision==='v2t'?' Watercolour V2T preview: V2S drawing on a CPU canvas backend.':'') :
      ' Archived V2R includes automatic fitting and may differ from the Marker/plotter layout.')
    :oilPaintV4Enabled()?'Oil Paint v4: consistent oil brushwork rendered on CPU-backed canvases.'
    :oilPaintV3Enabled()?'Oil Paint v3: adaptive physical bristles with canvas-tooth contact and relief following the same φ composition.'
    :oilPaintV2Enabled()?'Oil Paint v2: individually varied loaded bristles, connected colour fields and relief following the same φ composition.'
    :oilPaintV1Enabled()?'Oil Paint v1 (legacy): original loaded-bristle paint and connected colour fields. Saved V1 links retain their original appearance.'
    :oilEnabled()?'Translucent tissue matched to source Marker colours, with fine graphite and colour-matched blooms.'+
      (tissuePaletteVersion===8?' Tissue V8 preview: V7 drawing on a CPU canvas backend.':'')
    :'Marker ink with hand-drawn wobble, pressure and imperfect strokes.')+
    (phiSheetFraming?' Optional shared φ framing is on and affects all media, SVG and plotter exports.':'')+
    ' PNG saves the visible material; SVG and plotter exports retain the original marker paths.';
}
function renderArtwork(target,settings,scale,reveal){
  A.phiFramingEnabled=phiSheetFraming&&
    !(watercolourEnabled()&&watercolourMaterialRevision==='v2r');
  if(oilPaintV4Enabled())return A.renderOilPaintV4(target,settings,scale,reveal);
  if(oilPaintV3Enabled())return A.renderOilPaintV3(target,settings,scale,reveal);
  if(oilPaintV2Enabled())return A.renderOilPaintV2(target,settings,scale,reveal);
  if(oilPaintV1Enabled())return A.renderOilPaintV1(target,settings,scale,reveal);
  if(watercolourEnabled()){
    if(watercolourMaterialRevision==='v2r')
      return A.renderWatercolourV2R(target,settings,scale,reveal);
    A.watercolourV2sOptions.fitToSheet=watercolourFitToSheet&&!phiSheetFraming;
    if(watercolourMaterialRevision==='v2t')
      return A.renderWatercolourV2T(target,settings,scale,reveal);
    return A.renderWatercolourV2S(target,settings,scale,reveal);
  }
  if(oilEnabled()&&tissuePaletteVersion===8)
    return A.renderTissueV8(target,settings,scale,reveal);
  return oilEnabled()?A.renderOil(target,settings,scale,reveal,tissuePaletteVersion):
    A.render(target,settings,scale,reveal);
}

function settingsToURL(settings){
  var params=new URLSearchParams();
  params.set('v',String(A.rendererVersion||CURRENT_RENDERER_VERSION));
  Object.keys(PARAM_KEYS).forEach(function(key){
    var value=settings[key];
    // Leave historical landscape URLs unchanged, including their artwork IDs.
    if(key==='orientation'&&value!=='portrait')return;
    if(value==null)return;
    if(typeof value==='boolean')value=value?'1':'0';
    params.set(PARAM_KEYS[key],String(value));
  });
  if(phiSheetFraming&&!(watercolourEnabled()&&watercolourMaterialRevision==='v2r'))
    params.set('sheet','phi');
  if(oilPaintV4Enabled())params.set('material','oil-v4');
  else if(oilPaintV3Enabled())params.set('material','oil-v3');
  else if(oilPaintV2Enabled())params.set('material','oil-v2');
  else if(oilPaintV1Enabled())params.set('material','oil-v1');
  else if(watercolourEnabled()){
    params.set('material','watercolour-'+watercolourMaterialRevision);
    if(watercolourV2SFamily())
      params.set('fit',watercolourFitToSheet?'1':'0');
  }
  else if(oilEnabled())params.set(tissuePaletteVersion>=2?'tissue':'watercolor',
    String(tissuePaletteVersion>=2?tissuePaletteVersion:1));
  return location.pathname+'?'+params.toString()+location.hash;
}

function updateURL(settings){
  var url=settingsToURL(settings);
  var series=SERIES[settings.mode]||{title:settings.mode};
  // Identify the complete artwork state, including its renderer version.
  // Exclude the page path and fragment so the same piece keeps the same title.
  var state=url.slice(url.indexOf('?')+1).split('#')[0];
  var artworkId=A.hash(state).toString(16).toUpperCase().padStart(8,'0');
  document.title=series.title+' · '+settings.seed+' · '+artworkId+' — ALGO/ART';
  try{
    history.replaceState(null,'',url);
  }catch(e){}
}

function loadSettingsFromURL(){
  var params=new URLSearchParams(location.search);
  if(params.has('c')){
    var keys=Object.keys(PARAM_KEYS).map(function(k){return PARAM_KEYS[k]});
    var decoded=A.socialShare&&A.socialShare.expand(params.get('c'),keys);
    if(!decoded){console.warn('Invalid compact artwork link');return false;}
    params=decoded;
  }
  var settings={};
  var found=false;

  Object.keys(PARAM_KEYS).forEach(function(key){
    var short=PARAM_KEYS[key];
    if(!params.has(short))return;
    found=true;
    var value=params.get(short);
    var e=key==='seed'?$('seed'):$(key);

    if(key==='seed'){
      settings.seed=value;
    }else if(e&&e.type==='checkbox'){
      settings[key]=value==='1'||value==='true';
    }else if(e&&e.type==='range'){
      settings[key]=+value;
    }else{
      settings[key]=value;
    }
  });

  // Historical watercolor=1 and tissue=2 remain pixel-exact.
  // New tissue=3 restores distinct graphite marks over seeded colour.
  if(params.has('tissue')||params.has('watercolor')||params.has('oil')){
    var tissueCode=params.get('tissue');
    var oldCode=params.has('watercolor')?params.get('watercolor'):params.get('oil');
    var tissueRevision=tissueCode==='8'?8:tissueCode==='7'?7:(tissueCode==='6'?6:(tissueCode==='5'?5:(tissueCode==='4'?4:(tissueCode==='3'?3:(tissueCode==='2'?2:1)))));
    $('materialStyle').value=tissueRevision>=2||oldCode==='1'?'tissue':'marker';
    tissuePaletteVersion=tissueRevision;
    found=true;
  }
  // A new and unambiguous material parameter leaves historical
  // watercolor=1 and tissue=2..6 share links pixel-identical.
  if(['watercolour-v2r','watercolour-v2s','watercolour-v2t'].includes(params.get('material'))){
    $('materialStyle').value='watercolour';
    watercolourMaterialRevision=params.get('material').slice('watercolour-'.length);
    // No 'fit' on an older V2S link means the previously released image
    // used implicit fitting. Preserve those pixels and its share URL.
    watercolourFitToSheet=watercolourV2SFamily()?
      (params.has('fit')?params.get('fit')==='1':true):true;
    found=true;
  }

  if(['oil-v1','oil-v2','oil-v3','oil-v4'].includes(params.get('material'))){
    $('materialStyle').value='oil';
    legacyOilV1Link=params.get('material')==='oil-v1';
    legacyOilV2Link=params.get('material')==='oil-v2';
    oilV4Link=params.get('material')==='oil-v4';
    found=true;
  }

  // New opt-in framing exists on Marker, Tissue and Watercolour; unmarked
  // historical URLs stay pixel-for-pixel unchanged.
  phiSheetFraming=params.get('sheet')==='phi';

  var explicitVersion=Number(params.get('v'));
  if(SUPPORTED_RENDERER_VERSIONS.includes(explicitVersion)){
    A.rendererVersion=explicitVersion;
  }else if(found){
    var requestedMode=settings.mode||$('mode').value;
    var requestedSeed=settings.seed||$('seed').value;
    if(requestedMode==='field'){
      A.rendererVersion=UNVERSIONED_FIELD_VERSION_BY_SEED[requestedSeed]||1;
    }else{
      A.rendererVersion=CURRENT_RENDERER_VERSION;
    }
  }else{
    A.rendererVersion=CURRENT_RENDERER_VERSION;
  }

  if(found)applySettings(settings);
  return found;
}

function syncModeCards(){
  var mode=$('mode').value;
  if(A.syncControlHelp)A.syncControlHelp(mode,A.rendererVersion,currentRenderMeta);
  document.querySelectorAll('.mode-card').forEach(function(card){
    var active=card.dataset.mode===mode;
    card.classList.toggle('active',active);
    card.setAttribute('aria-pressed',active?'true':'false');
  });
}

function renderModePreviews(){
  var base=A.readSettings();
  // Only the system changes on selection; pen, seed, composition settings
  // and orientation are identical to the full-resolution artwork.
  // Exclude the currently selected system from the cache key: switching
  // cards does not alter what their candidate artwork would look like.
  var previewState=Object.assign({},base);
  delete previewState.mode;
  var key=JSON.stringify([CURRENT_RENDERER_VERSION,previewState,materialKey(),tissuePaletteVersion]);
  if(key===modePreviewStateKey)return;
  var previousMeta=A.lastRenderMeta,previousW=A.W,previousH=A.H,
      previousFrame=A.lastPhiSheetFrame;
  try{
    withRendererVersion(CURRENT_RENDERER_VERSION,function(){
      document.querySelectorAll('.mode-card').forEach(function(card){
        var settings=Object.assign({},base,{mode:card.dataset.mode});
        renderArtwork(card.querySelector('canvas'),settings,.1,false);
      });
    });
    modePreviewStateKey=key;
  }finally{
    // Sidebar thumbnails must never replace the selected artwork's metadata.
    A.lastRenderMeta=previousMeta;
    A.W=previousW;A.H=previousH;A.lastPhiSheetFrame=previousFrame;
  }
}

// On narrow screens, a single eight-render burst can stall touch input for
// seconds. Render exactly the same thumbnails, but yield between each one.
// A generation token prevents obsolete work from overwriting a newer state.
var mobilePreviewGeneration=0;
function renderMobileModePreviews(generation){
  if(generation!==mobilePreviewGeneration)return;
  var base=A.readSettings();
  var previewState=Object.assign({},base);
  delete previewState.mode;
  var key=JSON.stringify([CURRENT_RENDERER_VERSION,previewState,materialKey(),tissuePaletteVersion]);
  if(key===modePreviewStateKey)return;
  var cards=Array.from(document.querySelectorAll('.mode-card'));
  var index=0;
  function next(){
    if(generation!==mobilePreviewGeneration)return;
    // A change to controls invalidates the remaining thumbnails.
    var latest=A.readSettings(),state=Object.assign({},latest);
    delete state.mode;
    if(JSON.stringify([CURRENT_RENDERER_VERSION,state,materialKey(),tissuePaletteVersion])!==key)return;
    if(index>=cards.length){modePreviewStateKey=key;return;}
    var card=cards[index++];
    var oldMeta=A.lastRenderMeta,oldW=A.W,oldH=A.H,oldFrame=A.lastPhiSheetFrame;
    try{
      withRendererVersion(CURRENT_RENDERER_VERSION,function(){
        renderArtwork(card.querySelector('canvas'),Object.assign({},base,{mode:card.dataset.mode}),.1,false);
      });
    }finally{
      A.lastRenderMeta=oldMeta;A.W=oldW;A.H=oldH;A.lastPhiSheetFrame=oldFrame;
    }
    previewTimer=setTimeout(next,0);
  }
  next();
}
function scheduleModePreviews(){
  clearTimeout(previewTimer);
  var generation=++mobilePreviewGeneration;
  previewTimer=setTimeout(function(){
    if(mobileQuery.matches)renderMobileModePreviews(generation);
    else renderModePreviews();
  },180);
}

document.querySelectorAll('.mode-card').forEach(function(card){
  card.addEventListener('click',function(){
    useCurrentRenderer();
    $('mode').value=card.dataset.mode;
    syncModeCards();
    regenerate();
  });
});

var mobileExportInitialised=false;
function syncCanvasFormat(s){
  var portrait=s.orientation==='portrait';
  app.classList.toggle('orientation-portrait',portrait);
  var w=portrait?1000:1400,h=portrait?1400:1000;
  $('artworkDimensions').textContent='ARTWORK · '+w+' × '+h;
  Array.from($('exportScale').options).forEach(function(option){
    var scale=+option.value;
    option.textContent=scale+'× — '+(w*scale)+'×'+(h*scale);
    option.disabled=mobileQuery.matches&&scale>2;
  });
  // High-res 2×/3× allocations can exceed mobile WebView memory budgets.
  if(mobileQuery.matches){
    if(!mobileExportInitialised||+$('exportScale').value>2)$('exportScale').value='1';
    mobileExportInitialised=true;
  }
}

var dragPreviewTimer=null,dragPreviewPending=false,lastCommittedRenderKey=null;
A.renderTimings={previewMs:0,fullMs:0};
function scheduleDragPreview(){
  clearPreparedPNG();
  dragPreviewPending=true;
  if(dragPreviewTimer!==null)return;
  dragPreviewTimer=setTimeout(function(){
    dragPreviewTimer=null;
    var s=A.readSettings(),previousMeta=A.lastRenderMeta;
    syncCanvasFormat(s);
    var started=performance.now();
    withRendererVersion(CURRENT_RENDERER_VERSION,function(){renderArtwork(canvas,s,.35,showGeometry)});
    A.renderTimings.previewMs=performance.now()-started;
    A.lastRenderMeta=previousMeta;
  },Math.max(80,Math.min(1000,A.renderTimings.previewMs*4)));
}
function finishDragPreview(){
  if(!dragPreviewPending)return;
  useCurrentRenderer();regenerate();
}

function regenerate(){
  syncMaterialNote();
  clearPreparedPNG();
  if($('plotterPreview'))clearPlotterPreview();
  clearTimeout(dragPreviewTimer);dragPreviewTimer=null;dragPreviewPending=false;
  var s=A.readSettings();
  syncCanvasFormat(s);
  var started=performance.now();
  var meta=renderArtwork(canvas,s,1,showGeometry)||{};
  A.renderTimings.fullMs=performance.now()-started;
  lastCommittedRenderKey=JSON.stringify([A.rendererVersion,s,materialKey(),tissuePaletteVersion]);
  currentRenderMeta=meta;
  var info=$('phiSheetInfo');
  if(info&&phiSheetFraming){
    var fit=A.lastPhiSheetFrame;
    info.textContent=fit&&fit.kind==='phi-sheet'?
      'Applied · '+fit.scale.toFixed(2)+'× size; '+Math.round(fit.beforeCover*100)+
        '% → '+Math.round(fit.afterCover*100)+'% longest-axis coverage; shifted '+
        Math.round(fit.fittedCentroid.x-fit.originalCentroid.x)+'px horizontally / '+
        Math.round(fit.fittedCentroid.y-fit.originalCentroid.y)+
        'px vertically. Same paths in PNG and SVG.':
      'No adjustment · this artwork has no measurable strokes.';
  }
  var strategy=meta.strategy?(' / '+meta.strategy):'';
  var series=SERIES[s.mode]||{code:s.mode.toUpperCase(),title:s.mode};
  $('statsText').textContent=series.code+' · '+series.title.toUpperCase()+strategy+' / '+s.seed+' / φ '+s.phiStrength+'%'+(oilPaintEnabled()?' / OIL PAINT':watercolourEnabled()?' / WATERCOLOUR':oilEnabled()?' / TISSUE & GRAPHITE':'');
  syncDescription(s,meta);
  syncRendererChip();
  syncModeCards();
  updateURL(s);
  scheduleModePreviews();
}

function newSeedValue(){
  return Math.random().toString(36).slice(2,7).toUpperCase()+'-'+
    Math.floor(Math.random()*9999).toString().padStart(4,'0');
}

$('newSeed').onclick=function(){
  useCurrentRenderer();
  $('seed').value=newSeedValue();
  regenerate();
};

$('seed').addEventListener('keydown',function(e){
  if(e.key==='Enter'){
    e.preventDefault();
    useCurrentRenderer();
    regenerate();
    this.blur();
  }
});
$('seed').addEventListener('change',function(){
  useCurrentRenderer();
  regenerate();
});

function setGeometryVisible(open){
  showGeometry=!!open;
  $('geometry').textContent=showGeometry?'Hide φ':'Reveal φ';
  $('geometry').classList.toggle('active',showGeometry);
  document.querySelector('.canvas-wrap').classList.toggle('reveal-active',showGeometry);
  if(!showGeometry)hideRevealTooltip();
  regenerate();
}

$('geometry').onclick=function(){
  setGeometryVisible(!showGeometry);
};


function revealPoint(evt){
  var rect=canvas.getBoundingClientRect();
  return{
    x:(evt.clientX-rect.left)*(A.W/rect.width),
    y:(evt.clientY-rect.top)*(A.H/rect.height)
  };
}

function pointDistance(a,b){
  var dx=a.x-b.x,dy=a.y-b.y;
  return Math.sqrt(dx*dx+dy*dy);
}

function segmentDistance(p,a,b){
  var vx=b.x-a.x,vy=b.y-a.y;
  var wx=p.x-a.x,wy=p.y-a.y;
  var len2=vx*vx+vy*vy;
  if(!len2)return pointDistance(p,a);
  var t=A.clamp((wx*vx+wy*vy)/len2,0,1);
  return pointDistance(p,{x:a.x+vx*t,y:a.y+vy*t});
}

function phiTargetsForTooltip(){
  return[
    {x:A.W*A.INV,y:A.H*A.INV,name:'φ1'},
    {x:A.W*(1-A.INV),y:A.H*A.INV,name:'φ2'},
    {x:A.W*A.INV,y:A.H*(1-A.INV),name:'φ3'},
    {x:A.W*(1-A.INV),y:A.H*(1-A.INV),name:'φ4'}
  ];
}

function itemHierarchyTip(item,prefix){
  var label=item.tier==='hero'?'Hero form':(item.tier==='medium'?'Medium form':'Supporting form');
  var text;
  if(item.tier==='hero'){
    text='This is a dominant visual anchor. Its scale is pushed up, then quantised toward a φ-related size so the composition has a clear hierarchy.';
  }else if(item.tier==='medium'){
    text='This mid-scale element bridges the dominant form and the smaller marks. It helps build a φ-based size hierarchy rather than giving every object equal weight.';
  }else{
    text='This is a supporting element. Smaller marks fill rhythm and movement without competing with the main focal forms.';
  }
  return{title:(prefix?prefix+' / ':'')+label,text:text};
}

function hitRevealFeature(p){
  var meta=currentRenderMeta||{};
  var guide=meta.guide||null;
  var voids=meta.voids||[];
  var i,j;

  for(i=0;i<voids.length;i++){
    var v=voids[i];
    if(p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h){
      return{
        title:'Reserved negative space',
        text:'The generator deliberately discourages marks inside this region. Empty space is treated as part of the composition, not as unused canvas.'
      };
    }
  }

  if(guide&&guide.type==='network'){
    for(i=0;i<guide.layout.length;i++){
      var node=guide.layout[i];
      if(pointDistance(p,node)<=Math.max(22,node.size*.52)){
        return itemHierarchyTip(node,'Network node');
      }
    }
    for(i=0;i<guide.edges.length;i++){
      var edge=guide.edges[i],a=guide.layout[edge.a],b=guide.layout[edge.b];
      if(segmentDistance(p,a,b)<13){
        return edge.primary?{
          title:'Primary network backbone',
          text:'This stronger link helps establish the network’s main structure. Hero nodes are connected first, while crossings are kept deliberately low.'
        }:{
          title:'Secondary φ link',
          text:'This connection was chosen from nearby candidates using distance, hierarchy and closeness to φ-related lengths, while avoiding unnecessary crossings.'
        };
      }
    }
  }

  if(guide&&guide.type==='layout'){
    for(i=0;i<guide.layout.length;i++){
      var obj=guide.layout[i];
      if(pointDistance(p,obj)<=Math.max(22,obj.size*.52)){
        return itemHierarchyTip(obj,'Placement hierarchy');
      }
    }
  }

  if(guide&&guide.type==='spiral'){
    for(i=0;i<guide.centres.length;i++){
      if(pointDistance(p,guide.centres[i])<45){
        return{
          title:'Spiral hub',
          text:'This is the centre from which this spiral arm is constructed. Successive positions rotate by approximately '+(guide.step*180/Math.PI).toFixed(1)+'°, close to the golden-angle system selected by the current settings.'
        };
      }
    }
    for(i=1;i<guide.points.length;i++){
      var pa=guide.points[i-1],pb=guide.points[i];
      if(pa.arm!==pb.arm)continue;
      if(segmentDistance(p,pa,pb)<14){
        return{
          title:'Golden trajectory',
          text:'These plotted points advance around the hub using the golden-angle step while their radius expands across the canvas. The visible artwork is built from this hidden trajectory.'
        };
      }
    }
  }

  if(guide&&guide.type==='rects'){
    var bestCell=null,bestArea=Infinity;
    for(i=0;i<guide.cells.length;i++){
      var cell=guide.cells[i];
      if(p.x>=cell.x&&p.x<=cell.x+cell.w&&p.y>=cell.y&&p.y<=cell.y+cell.h){
        var area=cell.w*cell.h;
        if(area<bestArea){bestArea=area;bestCell=cell}
      }
    }
    if(bestCell){
      return{
        title:'Recursive division / depth '+bestCell.depth,
        text:'This region comes from repeatedly splitting larger rectangles near the golden ratio. Its depth shows how many recursive cuts were needed to reach this cell.'
      };
    }
  }

  if(guide&&guide.type==='burst'){
    for(i=0;i<guide.hubs.length;i++){
      var hub=guide.hubs[i];
      if(pointDistance(p,hub)<Math.max(42,hub.territory*.14)){
        return{
          title:'Radiant hub',
          text:'This hub organises a group of marks around one focal point. Rays rotate by golden-angle steps and their distances are quantised toward φ-scaled radii.'
        };
      }
    }
    for(i=0;i<guide.rays.length;i++){
      var ray=guide.rays[i],from=guide.hubs[ray.hub];
      if(segmentDistance(p,from,ray)<12){
        return{
          title:'φ-scaled radial path',
          text:'This construction ray shows the direction and radius used to place one burst element. The spacing expands in φ-related steps rather than uniform rings.'
        };
      }
    }
  }

  if(guide&&guide.type==='scribble'){
    for(i=0;i<guide.anchors.length;i++){
      var anchor=guide.anchors[i];
      var d=pointDistance(p,anchor);
      if(d<=anchor.radius){
        return d<25?{
          title:'Scribble anchor',
          text:'This anchor is a φ-positioned centre of activity. Its flow direction points toward the next compositional region, so the scribble has intentional movement rather than a random walk.'
        }:{
          title:'Scribble territory',
          text:'Marks are encouraged to remain inside this weighted territory. Different territories receive different amounts of drawing, creating clusters and deliberate gaps.'
        };
      }
    }
  }

  if(guide&&guide.type==='organic'){
    for(i=0;i<guide.roots.length;i++){
      if(pointDistance(p,guide.roots[i])<38){
        return{
          title:'Growth root',
          text:'The branching system starts here. Root positions are distributed using φ-based canvas regions before the growth process begins.'
        };
      }
    }
    for(i=0;i<guide.segments.length;i++){
      var seg=guide.segments[i];
      if(segmentDistance(p,{x:seg.x1,y:seg.y1},{x:seg.x2,y:seg.y2})<13){
        return{
          title:'Branch generation '+(seg.depth+1),
          text:'Each generation turns by a golden-angle-derived amount and its length decays by roughly 1/φ. That repeated ratio creates the plant-like hierarchy.'
        };
      }
    }
  }

  if(guide&&guide.type==='constructed'){
    for(i=0;i<guide.items.length;i++){
      var item=guide.items[i];
      if(pointDistance(p,item)<=Math.max(24,item.size*.52)){
        var tip=itemHierarchyTip(item,'Constructed form');
        tip.text+=' Its position and rotation are controlled by the '+guide.variant+' composition family rather than a subdivision grid.';
        return tip;
      }
    }
  }

  var targets=phiTargetsForTooltip();
  for(i=0;i<targets.length;i++){
    if(pointDistance(p,targets[i])<32){
      return{
        title:'Golden-ratio focal point '+targets[i].name,
        text:'This point sits at an intersection of the 61.8% and 38.2% divisions. The engine uses these intersections as preferred anchors when positioning major compositional weight.'
      };
    }
  }

  var xLines=[A.W*A.INV,A.W*(1-A.INV)];
  var yLines=[A.H*A.INV,A.H*(1-A.INV)];
  for(i=0;i<xLines.length;i++){
    if(Math.abs(p.x-xLines[i])<10){
      return{
        title:i===0?'61.8% vertical division':'38.2% vertical division',
        text:'This guide divides the canvas using the golden ratio. Many focal positions, boundaries and relationships are biased toward these proportions.'
      };
    }
  }
  for(i=0;i<yLines.length;i++){
    if(Math.abs(p.y-yLines[i])<10){
      return{
        title:i===0?'61.8% horizontal division':'38.2% horizontal division',
        text:'This guide divides the canvas using the golden ratio. It is part of the coordinate scaffold used to position focal areas and balance negative space.'
      };
    }
  }

  return null;
}

function hideRevealTooltip(){
  var tooltip=$('revealTooltip');
  if(tooltip)tooltip.hidden=true;
}

function showRevealTooltip(evt,tip){
  var tooltip=$('revealTooltip');
  if(!tooltip||!tip)return hideRevealTooltip();

  $('revealTooltipTitle').textContent=tip.title;
  $('revealTooltipText').textContent=tip.text;
  tooltip.hidden=false;

  var wrap=document.querySelector('.canvas-wrap');
  var rect=wrap.getBoundingClientRect();
  var localX=evt.clientX-rect.left+15;
  var localY=evt.clientY-rect.top+15;
  var w=tooltip.offsetWidth||280;
  var h=tooltip.offsetHeight||80;

  localX=A.clamp(localX,8,Math.max(8,rect.width-w-8));
  localY=A.clamp(localY,8,Math.max(8,rect.height-h-8));
  tooltip.style.left=localX+'px';
  tooltip.style.top=localY+'px';
}

function updateRevealTooltip(evt){
  if(!showGeometry)return hideRevealTooltip();
  var tip=hitRevealFeature(revealPoint(evt));
  if(tip)showRevealTooltip(evt,tip);
  else hideRevealTooltip();
}

canvas.addEventListener('pointermove',updateRevealTooltip);
canvas.addEventListener('pointerleave',hideRevealTooltip);
canvas.addEventListener('pointerdown',function(evt){
  if(showGeometry)updateRevealTooltip(evt);
});

function dismissEthos(){
  var toast=$('ethosToast');
  if(!toast||toast.hidden)return;
  toast.classList.add('ethos-out');
  try{localStorage.setItem('algoart-ethos-seen','1')}catch(e){}
  setTimeout(function(){
    toast.hidden=true;
    toast.classList.remove('ethos-out');
  },170);
}

function showEthosIfNeeded(){
  var toast=$('ethosToast');
  if(!toast)return;
  var seen=false;
  try{seen=localStorage.getItem('algoart-ethos-seen')==='1'}catch(e){}
  if(!seen)toast.hidden=false;
}

$('ethosClose').onclick=dismissEthos;
$('ethosReveal').onclick=function(){
  setGeometryVisible(true);
  dismissEthos();
};

$('mutate').onclick=function(){
  useCurrentRenderer();
  var r=A.makeR($('seed').value+'mutate'+Date.now());
  var mutable=[
    'density','complexity','negativeSpace','phiStrength','spiralInfluence',
    'nesting','wobble','curveBias','shapeAmount','overlap',
    'rotation','saturation','brightness'
  ];

  for(var i=0;i<5;i++){
    var id=r.pick(mutable),e=$(id);
    e.value=A.clamp(+e.value+r.int(-14,14),+e.min,+e.max);
    e.dispatchEvent(new Event('input'));
  }

  $('seed').value=$('seed').value.split('~')[0]+'~'+r.int(1,999);
  regenerate();
};

$('randomise').onclick=function(){
  useCurrentRenderer();
  var r=A.makeR(newSeedValue());

  document.querySelectorAll('input[type=range]').forEach(function(e){
    e.value=Math.round(+e.min+r.n()*(+e.max-+e.min));
    e.dispatchEvent(new Event('input'));
  });

  // Drawing material is a rendering choice, never a randomisable parameter.
  document.querySelectorAll('select:not(#exportScale):not(#orientation):not(#materialStyle)').forEach(function(e){
    e.selectedIndex=r.int(0,e.options.length-1);
  });

  $('seed').value=newSeedValue();
  // A new random composition uses the current Tissue & Graphite colour system
  // even when Randomise was clicked on a historical v1 share link.
  // Opt-in CPU-backend previews (Tissue V8, Watercolour V2T) stay selected.
  if(oilEnabled()&&tissuePaletteVersion!==8)tissuePaletteVersion=7;
  if(watercolourEnabled()&&watercolourMaterialRevision!=='v2t')watercolourMaterialRevision='v2s';
  syncModeCards();
  regenerate();
};

function variationSeed(base,index,batch){
  var h=A.hash(base+'|variation|'+batch+'|'+index);
  return base.split('~')[0]+'-V'+(batch+1)+'-'+String(h%100000).padStart(5,'0');
}

function renderVariations(){
  var base=A.readSettings(),selectedMeta=A.lastRenderMeta,
      selectedFrame=A.lastPhiSheetFrame,selectedW=A.W,selectedH=A.H;
  // The overlay is moved under document.body for modal focus management,
  // so it cannot inherit the portrait canvas aspect from .app.
  $('variationsOverlay').classList.toggle('orientation-portrait',base.orientation==='portrait');
  var cards=document.querySelectorAll('.variation-card');

  try{
  withRendererVersion(CURRENT_RENDERER_VERSION,function(){
    cards.forEach(function(card,index){
      var seed=variationSeed(base.seed,index,variationBatch);
      var settings=Object.assign({},base,{seed:seed});
      var preview=card.querySelector('canvas');
      renderArtwork(preview,settings,.28,false);
      card.dataset.seed=seed;
      card.querySelector('span').textContent='0'+(index+1)+' / '+seed;
    });
  });
  }finally{
    // Previewing four other seeds must never replace the selected
    // artwork's Reveal guide, φ frame or dimensions.
    A.lastRenderMeta=selectedMeta;
    A.lastPhiSheetFrame=selectedFrame;
    A.W=selectedW;A.H=selectedH;
  }
}


var activeDialog=null,dialogReturnFocus=null;
function beginDialog(overlay,closeButton){
  if(activeDialog)return false;
  dialogReturnFocus=document.activeElement;
  document.body.appendChild(overlay);
  overlay.hidden=false;
  activeDialog=overlay;
  app.inert=true;
  closeButton.focus();
  return true;
}
function endDialog(overlay,fallback){
  if(activeDialog!==overlay)return;
  overlay.hidden=true;activeDialog=null;app.inert=false;
  var target=dialogReturnFocus&&dialogReturnFocus.isConnected&&dialogReturnFocus.tabIndex>=0?dialogReturnFocus:fallback;
  dialogReturnFocus=null;
  target.focus();
}
function dialogFocusable(){
  return Array.from(activeDialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
    .filter(function(el){return !el.disabled&&el.tabIndex>=0&&el.getClientRects().length});
}
document.addEventListener('keydown',function(e){
  if(!activeDialog)return;
  if(e.key==='Escape'){
    e.preventDefault();e.stopPropagation();
    if(activeDialog===$('introSplash'))$('introEnter').click();
    else if(activeDialog===$('descriptionOverlay'))closeDescription();
    else closeVariations();
  }else if(e.key==='Tab'){
    var items=dialogFocusable(),first=items[0],last=items[items.length-1];
    if(!first){e.preventDefault();return;}
    if(e.shiftKey&&(document.activeElement===first||!activeDialog.contains(document.activeElement))){
      e.preventDefault();last.focus();
    }else if(!e.shiftKey&&(document.activeElement===last||!activeDialog.contains(document.activeElement))){
      e.preventDefault();first.focus();
    }
  }
},true);
document.addEventListener('focusin',function(e){
  if(activeDialog&&!activeDialog.contains(e.target)){
    var first=dialogFocusable()[0];if(first)first.focus();
  }
});

function openVariations(){
  if(!beginDialog($('variationsOverlay'),$('closeVariations')))return;
  variationBatch=0;
  renderVariations();
}

function closeVariations(){
  endDialog($('variationsOverlay'),$('variations'));
}

$('variations').onclick=openVariations;
$('closeVariations').onclick=closeVariations;
$('shuffleVariations').onclick=function(){
  variationBatch++;
  renderVariations();
};

document.querySelectorAll('.variation-card').forEach(function(card){
  card.addEventListener('click',function(){
    if(!card.dataset.seed)return;
    useCurrentRenderer();
    $('seed').value=card.dataset.seed;
    closeVariations();
    regenerate();
  });
});

$('variationsOverlay').addEventListener('click',function(e){
  if(e.target===$('variationsOverlay'))closeVariations();
});

function syncDescription(settings,meta){
  var s=settings||A.readSettings();
  var m=meta||currentRenderMeta||{};
  currentDescription=A.describeArtwork
    ?A.describeArtwork(s,m,oilPaintEnabled()?'oil':watercolourEnabled()?'watercolour':oilEnabled()?'tissue':'marker')
    :{
      altText:'Abstract deterministic artwork generated by ALGO/ART.',
      longDescription:'Abstract deterministic artwork generated by ALGO/ART.',
      constructionDescription:'A description is unavailable for this version of the drawing system.'
    };
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',currentDescription.altText);
  if($('descriptionAlt'))$('descriptionAlt').textContent=currentDescription.altText;
  if($('descriptionLong'))$('descriptionLong').textContent=currentDescription.longDescription;
  if($('descriptionConstruction'))$('descriptionConstruction').textContent=currentDescription.constructionDescription;
  return currentDescription;
}

function openDescription(){
  if(!beginDialog($('descriptionOverlay'),$('closeDescription')))return;
  syncDescription(A.readSettings(),currentRenderMeta);
  document.querySelector('.description-body').scrollTop=0;
}

function closeDescription(){
  endDialog($('descriptionOverlay'),$('describe'));
}

function copyAltDescription(){
  var description=syncDescription(A.readSettings(),currentRenderMeta);
  var status=$('descriptionCopyStatus');
  function done(ok){
    status.textContent=ok?'Alt text copied.':'Could not copy. Select and copy the text.';
    clearTimeout(done.timer);
    done.timer=setTimeout(function(){status.textContent=''},2200);
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(description.altText).then(function(){done(true)}).catch(function(){done(fallbackCopy(description.altText))});
  }else{
    done(fallbackCopy(description.altText));
  }
}

var exportBusy=false,preparedPNGURL=null,pngGeneration=0;
function clearPreparedPNG(){
  pngGeneration++;
  if(preparedPNGURL){
    // Allow an in-flight browser download to finish consuming the old URL.
    var oldURL=preparedPNGURL;
    setTimeout(function(){URL.revokeObjectURL(oldURL)},60000);
    preparedPNGURL=null;
  }
  $('pngReady').hidden=true;
  $('pngDownload').removeAttribute('href');
  $('pngOpen').removeAttribute('href');
  exportFeedback('');
}
$('exportScale').addEventListener('change',clearPreparedPNG);
$('savePanel').textContent=mobileQuery.matches?'PREPARE PNG':'DOWNLOAD PNG';
function exportFeedback(message){
  var label=$('exportStatus');
  if(label)label.textContent=message;
}
function savePNG(){
  if(exportBusy)return;
  exportBusy=true;
  var button=$('savePanel');
  button.disabled=true;
  exportFeedback('Preparing PNG…');
  var settings=Object.assign({},A.readSettings(),{
    oilRender:oilEnabled(),oilPaintRender:oilPaintEnabled(),
    // Previously V3 exported as 'v1', so the PNG was painted by Oil V1.
    oilPaintRevision:oilPaintV4Enabled()?'v4':oilPaintV3Enabled()?'v3':
      oilPaintV2Enabled()?'v2':'v1',
    watercolourRender:watercolourEnabled(),
    watercolourRevision:watercolourMaterialRevision,
    watercolourFitToSheet:watercolourFitToSheet,
    tissuePaletteVersion:tissuePaletteVersion
  });
  if(mobileQuery.matches){
    clearPreparedPNG();
    var generation=pngGeneration;
    exportFeedback('Preparing PNG…');
    A.preparePNG(settings,+$('exportScale').value).then(function(file){
      // Randomise/settings changes while encoding must not publish a stale PNG.
      if(generation!==pngGeneration)return;
      preparedPNGURL=URL.createObjectURL(file.blob);
      $('pngDownload').href=preparedPNGURL;
      $('pngDownload').download=file.filename;
      $('pngOpen').href=preparedPNGURL;
      $('pngReady').hidden=false;
      exportFeedback('PNG ready. Tap DOWNLOAD PNG, or open the image to save it.');
    }).catch(function(error){
      if(generation===pngGeneration)exportFeedback('PNG export failed: '+error.message);
    }).finally(function(){
      exportBusy=false;button.disabled=false;
    });
    return;
  }
  A.exportPNG(settings,+$('exportScale').value).then(function(){
    exportFeedback('PNG download requested. Check Downloads if it does not appear.');
  }).catch(function(error){
    exportFeedback('PNG export failed: '+error.message);
  }).finally(function(){
    exportBusy=false;button.disabled=false;
  });
}

function saveSVG(){
  try{
    A.exportSVG(A.readSettings());
    exportFeedback('SVG download started.');
  }catch(error){
    exportFeedback('SVG export failed: '+error.message);
  }
}

function fallbackCopy(text){
  var area=document.createElement('textarea');
  area.value=text;
  area.setAttribute('readonly','');
  area.style.position='fixed';
  area.style.opacity='0';
  document.body.appendChild(area);
  area.select();
  var ok=false;
  try{ok=document.execCommand('copy')}catch(e){}
  document.body.removeChild(area);
  return ok;
}

function copyShareLink(){
  updateURL(A.readSettings());
  var url=location.href;
  var status=$('shareStatus');

  function done(ok){
    status.textContent=ok?'Artwork link copied.':'Could not copy. Copy the address from your browser.';
    clearTimeout(done.timer);
    done.timer=setTimeout(function(){status.textContent=''},2600);
  }

  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){done(true)}).catch(function(){
      done(fallbackCopy(url));
    });
  }else{
    done(fallbackCopy(url));
  }
}

$('describe').onclick=openDescription;
$('closeDescription').onclick=closeDescription;
$('closeDescriptionBottom').onclick=closeDescription;
$('copyDescription').onclick=copyAltDescription;
$('descriptionOverlay').addEventListener('click',function(e){
  if(e.target===$('descriptionOverlay'))closeDescription();
});
$('savePanel').onclick=savePNG;
$('saveSVG').onclick=saveSVG;
$('copyLink').onclick=copyShareLink;
 
 // All social URLs are derived from the exact, current canvas settings.
 // The default COPY ARTWORK LINK retains the established full URL.
 function currentSocialIntents(){
   var settings=A.readSettings(),keys=Object.keys(PARAM_KEYS).map(function(k){return PARAM_KEYS[k]});
   updateURL(settings);
   return A.socialShare.intents(location.href,keys);
 }
 function showSocialStatus(message){
   $('socialShareStatus').textContent=message;
 }
 function previewJPEG(){
   // Exact currently visible painting, including selected paper colour,
   // material, seed and canvas framing. No re-render or seed changes.
   var src=$('art'),c=document.createElement('canvas');
   c.width=1200;c.height=630;
   var ctx=c.getContext('2d');
   ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,c.width,c.height);
   var scale=Math.min(c.width/src.width,c.height/src.height);
   ctx.drawImage(src,(c.width-src.width*scale)/2,
     (c.height-src.height*scale)/2,
     src.width*scale,src.height*scale);
   var encoded=c.toDataURL('image/jpeg',.78).split(',')[1];
   // Avoid accidentally exhausting the free hosting server.
   if(encoded.length>380000)encoded=c.toDataURL('image/jpeg',.58).split(',')[1];
   return encoded;
 }
 function preloadSocialImage(intents){
   var token=new URL(intents.artworkURL).searchParams.get('c');
   if(!token)throw Error('This artwork cannot be shared with an image preview');
   return fetch('https://algoart-composition-plugin.onrender.com/share/preload?c='+
     encodeURIComponent(token),{
       method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({jpeg:previewJPEG()})
     }).then(function(response){
       if(!response.ok)throw Error('Preview service returned '+response.status);
       return response.json();
     }).then(function(result){
       if(!result.ok)throw Error('Artwork preview not ready');
       return result;
     });
 }
 var socialSharePending=false;
 function sharePostLink(event,service){
   event.preventDefault();
   if(socialSharePending)return;
   var intents=currentSocialIntents();
   if(service==='bluesky'&&[...intents.caption].length>300){
     showSocialStatus('The artwork link is too long for Bluesky. Use Copy Artwork Link instead.');
     return;
   }
   var newTab=window.open('about:blank','_blank');
   if(newTab){
     newTab.opener=null;
     try{
       newTab.document.title='Preparing ALGO/ART artwork';
       newTab.document.body.textContent='Preparing the artwork image for '+service+'…';
     }catch(e){}
   }
   socialSharePending=true;
   var btn=event.currentTarget;
   btn.setAttribute('aria-busy','true');
   showSocialStatus('Preparing your actual artwork image for '+service+'…');
   // Do not navigate to the social composer until the image is already
   // available to its crawler. Previously fresh Render renders took
   // 14–90 seconds; platforms gave up with "image not found".
   preloadSocialImage(intents).then(function(){
     showSocialStatus('Artwork preview prepared. Opening the '+service+' draft; nothing posted automatically.');
     return intents[service];
   }).catch(function(error){
     console.warn('ALGO/ART share image preload:',error);
     showSocialStatus('Artwork preview unavailable. Opening a draft with the direct artwork link instead; you can attach a PNG from Export.');
     var caption='ALGO/ART '+intents.artworkURL;
     return service==='threads'?
       'https://www.threads.com/intent/post?text='+encodeURIComponent(caption):
       'https://bsky.app/intent/compose?text='+encodeURIComponent(caption);
   }).then(function(target){
     if(newTab&&!newTab.closed)newTab.location.replace(target);
     else window.location.assign(target);
   }).finally(function(){
     socialSharePending=false;
     btn.removeAttribute('aria-busy');
   });
 }
 $('shareThreads').addEventListener('click',function(event){sharePostLink(event,'threads')});
 $('shareBluesky').addEventListener('click',function(event){sharePostLink(event,'bluesky')});


var plotterPreviewURL=null;
function clearPlotterPreview(){
  if(plotterPreviewURL){URL.revokeObjectURL(plotterPreviewURL);plotterPreviewURL=null}
  $('plotterPreview').hidden=true;$('plotterSummary').textContent='';$('plotterStatus').textContent='';
}
function buildPlotterPreview(download){
  try{
    var settings=A.readSettings();
    var result=A.createPlotterSVG(settings,{paper:$('plotterPaper').value,margin:$('plotterMargin').value,grouping:$('plotterGrouping').value,optimize:$('plotterOptimize').checked});
    clearPlotterPreview();
    plotterPreviewURL=URL.createObjectURL(new Blob([result.preview],{type:'image/svg+xml'}));
    $('plotterPreviewImage').src=plotterPreviewURL;
    $('plotterPreview').hidden=false;
    var m=result.metadata,saved=Math.max(0,m.penTravelBeforeMm-m.penTravelAfterMm);
    $('plotterSummary').textContent=m.pageMm.join(' × ')+' mm · '+m.paths+' paths · '+m.penColours.length+' pens · '+m.penLayers+' '+(m.layerGrouping==='pens'?'pen layers':'colour runs')+' · '+m.penChanges+' pen changes'+(m.forcedPauses?' / '+m.forcedPauses+' pauses':'')+' · '+(m.penTravelAfterMm/1000).toFixed(2)+' m pen travel · '+saved.toFixed(1)+' mm saved';
    if(download)A.downloadPlotterSVG(result,settings);
  }catch(error){$('plotterStatus').textContent=error.message}
}
$('previewPlotter').onclick=function(){buildPlotterPreview(false)};
$('savePlotter').onclick=function(){buildPlotterPreview(true)};
['plotterPaper','plotterMargin','plotterGrouping','plotterOptimize'].forEach(function(id){$(id).addEventListener('change',clearPlotterPreview)});
$('plotterGrouping').addEventListener('change',function(){
  $('plotterGroupingNote').textContent=this.value==='pens'?
    'One layer per pen, light to dark. SVG labels request a pause at each pen change; AxiDraw/Inkscape hardware behaviour is untested. Swap pens and Resume if prompted. Pen numbers match faithful mode. Travel optimisation can reorder strokes within a pen. Grouping changes which colour sits on top where colours overlap.':
    'Faithful colour runs preserve overlap order, with light-to-dark Pen numbers and sequential run numbers. SVG labels request pen-change pauses; AxiDraw/Inkscape hardware behaviour is untested. Swap pens and Resume if prompted.';
  $('plotterOptimizeLabel').textContent=this.value==='pens'?
    'Reduce pen travel by reordering same-colour strokes':'Reduce pen travel without changing stroke order';
});

document.querySelectorAll('.inspector input, .inspector select').forEach(function(e){
  if(e.type==='range'){
    e.addEventListener('input',scheduleDragPreview);
    e.addEventListener('pointerup',finishDragPreview);
    e.addEventListener('pointercancel',finishDragPreview);
    e.addEventListener('blur',finishDragPreview);
  }
  e.addEventListener('change',function(){
    if(e.id==='exportScale'||e.id==='keyboardShortcuts'||e.id==='watercolourFit'||
       e.id==='phiSheetFit'||e.id.indexOf('plotter')===0)return;
    // A material toggle must preserve the selected (including legacy) composer.
    if(e.id==='materialStyle'){legacyOilV1Link=false;legacyOilV2Link=false;oilV4Link=true;}
    if(e.id==='materialStyle'&&oilEnabled())tissuePaletteVersion=7;
    if(e.id==='materialStyle'&&watercolourEnabled()){
      watercolourMaterialRevision='v2s';
      watercolourFitToSheet=false;
    }
    if(e.id!=='materialStyle')useCurrentRenderer();
    // pointerup/change ordering differs by browser. Do not commit twice.
    var alreadyCommitted=e.type==='range'&&!dragPreviewPending&&lastCommittedRenderKey===JSON.stringify([A.rendererVersion,A.readSettings(),materialKey(),tissuePaletteVersion]);
    if(!alreadyCommitted)regenerate();
  });
});

$('watercolourFit').addEventListener('change',function(){
  if(!watercolourEnabled()||!watercolourV2SFamily())return;
  watercolourFitToSheet=this.checked;
  if(this.checked)phiSheetFraming=false; // Never compound two fit transforms.
  regenerate();
});
$('phiSheetFit').addEventListener('change',function(){
  phiSheetFraming=this.checked;
  if(phiSheetFraming&&watercolourEnabled()&&watercolourV2SFamily())
    watercolourFitToSheet=false;
  regenerate();
});

var shortcutsEnabled=true;
try{shortcutsEnabled=localStorage.getItem('algoart-shortcuts')!=='off'}catch(e){}
$('keyboardShortcuts').checked=shortcutsEnabled;
function syncShortcutPreference(){
  $('shortcutLegend').hidden=!shortcutsEnabled;
  try{localStorage.setItem('algoart-shortcuts',shortcutsEnabled?'on':'off')}catch(e){}
}
$('keyboardShortcuts').addEventListener('change',function(){
  shortcutsEnabled=this.checked;syncShortcutPreference();
});
syncShortcutPreference();

window.addEventListener('keydown',function(e){
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.repeat||e.isComposing)return;
  if(activeDialog||!$('introSplash').hidden)return;
  if(!shortcutsEnabled||e.target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])'))return;
  var key=e.key.toLowerCase();
  if(key==='n')$('newSeed').click();
  else if(key==='m')$('mutate').click();
  else if(key==='v')openVariations();
  else if(key==='d')openDescription();
  else if(e.key==='[')setInspector(app.classList.contains('inspector-closed'),true);
  else return;
  e.preventDefault();
});

// Compact social URLs open the editor, never the gallery. Resolve the exact
// daily archive state, then let regenerate() restore the full canonical URL.
var requestedArtworkId=new URLSearchParams(location.search).get('art');
var loadedFromURL=loadSettingsFromURL();

function loadExactArchivedArtwork(id){
  if(!/^\d{4}-\d{2}-\d{2}-(?:(?:WL|WP|CL|CP|OL|OP|P)\d{2}|\d{2})$/.test(id))return Promise.reject(new Error('Invalid artwork ID'));
  var day=id.slice(0,10);
  return fetch('gallery/'+day+'/meta.json',{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('Archive unavailable');return r.json();})
    .then(function(meta){
      var entry=(Array.isArray(meta.entries)?meta.entries:[]).find(function(e){return e.id===id});
      if(!entry||!entry.settings||!entry.seed)throw new Error('Archived artwork missing: '+id);
      A.rendererVersion=Number(entry.rendererVersion)||CURRENT_RENDERER_VERSION;
      var archivedMaterialURL=new URL(entry.shareUrl||location.href);
      // Short ?art= links must restore the *complete* material/framing state
      // recorded in the canonical image, not only its seed and sliders.
      // In particular, sheet=phi fits Marker/Tissue/Watercolour equally.
      phiSheetFraming=archivedMaterialURL.searchParams.get('sheet')==='phi';
      var archivedTissueCode=archivedMaterialURL.searchParams.get('tissue');
      var archivedTissueVersion=archivedTissueCode==='8'?8:archivedTissueCode==='7'?7:(archivedTissueCode==='6'?6:(archivedTissueCode==='5'?5:(archivedTissueCode==='4'?4:
        (archivedTissueCode==='3'?3:(archivedTissueCode==='2'?2:1)))));
      tissuePaletteVersion=archivedTissueVersion;
      var archivedWater=archivedMaterialURL.searchParams.get('material');
      if(['watercolour-v2r','watercolour-v2s','watercolour-v2t'].includes(archivedWater)){
        watercolourMaterialRevision=archivedWater.slice('watercolour-'.length);
        watercolourFitToSheet=archivedMaterialURL.searchParams.has('fit')?
          archivedMaterialURL.searchParams.get('fit')==='1':true;
      }
      legacyOilV1Link=archivedWater==='oil-v1';
      legacyOilV2Link=archivedWater==='oil-v2';
      oilV4Link=archivedWater==='oil-v4';
      $('materialStyle').value=['oil-v1','oil-v2','oil-v3','oil-v4'].includes(archivedWater)?'oil':
        ['watercolour-v2r','watercolour-v2s','watercolour-v2t'].includes(archivedWater)
        ?'watercolour':archivedTissueVersion>=2||entry.material==='watercolor'||
          archivedMaterialURL.searchParams.get('watercolor')==='1'?'tissue':'marker';
      applySettings(Object.assign({},entry.settings,{seed:entry.seed}));
      return true;
    });
}

function loadLatestGalleryDefault(){
  if(requestedArtworkId)return loadExactArchivedArtwork(requestedArtworkId);
  if(loadedFromURL)return Promise.resolve(false);
  return fetch('gallery/archive.json',{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('archive');return r.json();})
    .then(function(archive){
      var days=Array.isArray(archive.days)?archive.days.slice():[];
      days.sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
      if(!days.length)return false;
      return fetch('gallery/'+days[0].date+'/meta.json',{cache:'no-store'})
        .then(function(r){if(!r.ok)throw new Error('meta');return r.json();})
        .then(function(meta){
          var entries=Array.isArray(meta.entries)?meta.entries:[];
          // Keep existing unparameterised landscape home-page behaviour.
          // Portrait works remain available through the gallery and share URLs.
          var latest=entries.filter(function(e){
            return e.material!=='watercolor'&&e.material!=='watercolour' &&
              (e.orientation||(e.settings&&e.settings.orientation))!=='portrait';
          }).pop()||entries[entries.length-1];
          if(!latest||!latest.settings)return false;
          A.rendererVersion=Number(latest.rendererVersion)||CURRENT_RENDERER_VERSION;
          // The default editor canvas must show the same framed picture
          // as the latest daily gallery cover (old covers remain unfitted).
          var latestURL=new URL(latest.shareUrl||location.href);
          phiSheetFraming=latestURL.searchParams.get('sheet')==='phi';
          applySettings(Object.assign({},latest.settings,{seed:latest.seed}));
          return true;
        });
    })
    .catch(function(){return false;});
}

syncModeCards();
if(!requestedArtworkId)regenerate();
loadLatestGalleryDefault().then(function(changed){
  if(changed){
    syncModeCards();
    regenerate();
  }
}).catch(function(error){
  console.error('Unable to load exact archived artwork:',error);
  var status=$('shareStatus');
  if(status)status.textContent='Unable to load this archived artwork. Please try again.';
});
(function initIntroSplash(){
  var splash=$('introSplash');
  if(!splash)return;
  var seen=false;
  try{seen=localStorage.getItem('algoart-intro-seen')==='1'}catch(e){}
  // Deep links must reveal their requested artwork without a first-visit overlay.
  var shouldOpen=!seen&&!requestedArtworkId&&!loadedFromURL;
  function closeIntro(reveal){
    endDialog(splash,$('describe'));
    try{localStorage.setItem('algoart-intro-seen','1')}catch(e){}
    if(reveal)setGeometryVisible(true);
  }
  $('introEnter').onclick=function(){closeIntro(false)};
  $('introReveal').onclick=function(){closeIntro(true)};
  if(shouldOpen)beginDialog(splash,$('introEnter'));
})();

})(window.AlgoArt);
