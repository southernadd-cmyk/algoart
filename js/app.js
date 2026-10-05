window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function $(id){return document.getElementById(id)}

var canvas=$('art');
var showGeometry=false;
var app=$('app');
var mobileQuery=window.matchMedia('(max-width:700px)');
var previewTimer=null;
var variationBatch=0;

var SETTING_IDS=[
  'mode','elements','density','complexity','negativeSpace',
  'phiStrength','recursion','spiralInfluence','goldenAngle','nesting',
  'pen','thickness','wobble','overdraw','opacity','pressure','dryness',
  'curveBias','shapeAmount','overlap','rotation',
  'lines','circles','rectangles','polygons','arcs',
  'palette','colourCount','saturation','brightness','paper','grain'
];

var PARAM_KEYS={
  seed:'seed',mode:'mode',elements:'el',density:'den',complexity:'cx',negativeSpace:'neg',
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
  });
  document.querySelectorAll('.tab-panel').forEach(function(panel){
    panel.classList.toggle('active',panel.dataset.panel===name);
  });
  try{localStorage.setItem('algoart-tab',name)}catch(e){}
}

document.querySelectorAll('.tab').forEach(function(btn){
  btn.addEventListener('click',function(){setTab(btn.dataset.tab)});
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
    s[id]=e.type==='checkbox'?e.checked:(e.type==='range'?+e.value:e.value);
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
      e.value=settings[id];
      if(e.type==='range')syncRangeOutput(e);
    }
  });
  syncModeCards();
}

function settingsToURL(settings){
  var params=new URLSearchParams();
  Object.keys(PARAM_KEYS).forEach(function(key){
    var value=settings[key];
    if(value==null)return;
    if(typeof value==='boolean')value=value?'1':'0';
    params.set(PARAM_KEYS[key],String(value));
  });
  return location.pathname+'?'+params.toString()+location.hash;
}

function updateURL(settings){
  try{
    history.replaceState(null,'',settingsToURL(settings));
  }catch(e){}
}

function loadSettingsFromURL(){
  var params=new URLSearchParams(location.search);
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

  if(found)applySettings(settings);
  return found;
}

function syncModeCards(){
  var mode=$('mode').value;
  document.querySelectorAll('.mode-card').forEach(function(card){
    var active=card.dataset.mode===mode;
    card.classList.toggle('active',active);
    card.setAttribute('aria-pressed',active?'true':'false');
  });
}

function renderModePreviews(){
  var base=A.readSettings();
  document.querySelectorAll('.mode-card').forEach(function(card){
    var mode=card.dataset.mode;
    var preview=Object.assign({},base,{
      mode:mode,
      seed:'SERIES-'+mode.toUpperCase(),
      elements:Math.min(28,Math.max(16,base.elements)),
      complexity:Math.min(72,base.complexity),
      overdraw:Math.min(2,base.overdraw),
      grain:0
    });
    A.render(card.querySelector('canvas'),preview,.1,false);
  });
}

function scheduleModePreviews(){
  clearTimeout(previewTimer);
  previewTimer=setTimeout(renderModePreviews,180);
}

document.querySelectorAll('.mode-card').forEach(function(card){
  card.addEventListener('click',function(){
    $('mode').value=card.dataset.mode;
    syncModeCards();
    regenerate();
    scheduleModePreviews();
  });
});

function regenerate(){
  var s=A.readSettings();
  var meta=A.render(canvas,s,1,showGeometry)||{};
  var strategy=meta.strategy?(' / '+meta.strategy):'';
  var series=SERIES[s.mode]||{code:s.mode.toUpperCase(),title:s.mode};
  $('stats').textContent=series.code+' · '+series.title.toUpperCase()+strategy+' / '+s.seed+' / φ '+s.phiStrength+'%';
  syncModeCards();
  updateURL(s);
}

function newSeedValue(){
  return Math.random().toString(36).slice(2,7).toUpperCase()+'-'+
    Math.floor(Math.random()*9999).toString().padStart(4,'0');
}

$('regenerate').onclick=regenerate;

$('newSeed').onclick=function(){
  $('seed').value=newSeedValue();
  regenerate();
};

$('geometry').onclick=function(){
  showGeometry=!showGeometry;
  this.textContent=showGeometry?'Hide φ Guides':'φ Guides';
  this.classList.toggle('active',showGeometry);
  regenerate();
};

$('mutate').onclick=function(){
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
  scheduleModePreviews();
};

$('randomise').onclick=function(){
  var r=A.makeR(newSeedValue());

  document.querySelectorAll('input[type=range]').forEach(function(e){
    e.value=Math.round(+e.min+r.n()*(+e.max-+e.min));
    e.dispatchEvent(new Event('input'));
  });

  document.querySelectorAll('select:not(#exportScale)').forEach(function(e){
    e.selectedIndex=r.int(0,e.options.length-1);
  });

  $('seed').value=newSeedValue();
  syncModeCards();
  regenerate();
  scheduleModePreviews();
};

function variationSeed(base,index,batch){
  var h=A.hash(base+'|variation|'+batch+'|'+index);
  return base.split('~')[0]+'-V'+(batch+1)+'-'+String(h%100000).padStart(5,'0');
}

function renderVariations(){
  var base=A.readSettings();
  var cards=document.querySelectorAll('.variation-card');

  cards.forEach(function(card,index){
    var seed=variationSeed(base.seed,index,variationBatch);
    var settings=Object.assign({},base,{seed:seed});
    var preview=card.querySelector('canvas');
    A.render(preview,settings,.28,false);
    card.dataset.seed=seed;
    card.querySelector('span').textContent='0'+(index+1)+' / '+seed;
  });
}

function openVariations(){
  variationBatch=0;
  $('variationsOverlay').hidden=false;
  renderVariations();
}

function closeVariations(){
  $('variationsOverlay').hidden=true;
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
    $('seed').value=card.dataset.seed;
    closeVariations();
    regenerate();
  });
});

$('variationsOverlay').addEventListener('click',function(e){
  if(e.target===$('variationsOverlay'))closeVariations();
});

function savePNG(){
  A.exportPNG(A.readSettings(),+$('exportScale').value);
}

function saveSVG(){
  A.exportSVG(A.readSettings());
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
    status.textContent=ok?'LINK COPIED / EXACT ARTWORK STATE':'COPY FAILED / SELECT URL MANUALLY';
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

$('save').onclick=savePNG;
$('savePanel').onclick=savePNG;
$('saveSVG').onclick=saveSVG;
$('copyLink').onclick=copyShareLink;

document.querySelectorAll('.inspector input, .inspector select').forEach(function(e){
  e.addEventListener('change',function(){
    if(e.id==='exportScale')return;
    regenerate();
    if(e.id==='palette'||e.id==='pen'||e.id==='phiStrength'||e.id==='complexity'){
      scheduleModePreviews();
    }
  });
});

window.addEventListener('keydown',function(e){
  if(e.target.matches('input,select'))return;
  var key=e.key.toLowerCase();
  if(key==='escape'&&!$('variationsOverlay').hidden)closeVariations();
  if(key==='g')regenerate();
  if(key==='n')$('newSeed').click();
  if(key==='m')$('mutate').click();
  if(key==='v')openVariations();
  if(e.key==='[')setInspector(app.classList.contains('inspector-closed'),true);
});

loadSettingsFromURL();
syncModeCards();
regenerate();
setTimeout(renderModePreviews,40);

})(window.AlgoArt);
