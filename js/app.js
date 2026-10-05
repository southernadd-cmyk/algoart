window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function $(id){return document.getElementById(id)}

var canvas=$('art');
var showGeometry=false;
var app=$('app');
var mobileQuery=window.matchMedia('(max-width:700px)');

var ranges=document.querySelectorAll('input[type=range]');
ranges.forEach(function(r){
  var o=r.parentElement.querySelector('output');
  function sync(){if(o)o.textContent=r.value}
  sync();
  r.addEventListener('input',sync);
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
  var ids=[
    'mode','elements','density','complexity','negativeSpace',
    'phiStrength','recursion','spiralInfluence','goldenAngle','nesting',
    'pen','thickness','wobble','overdraw','opacity','pressure','dryness',
    'curveBias','shapeAmount','overlap','rotation',
    'lines','circles','rectangles','polygons','arcs',
    'palette','colourCount','saturation','brightness','paper','grain'
  ];
  var s={seed:$('seed').value||'PHI-1618'};
  ids.forEach(function(id){
    var e=$(id);
    s[id]=e.type==='checkbox'?e.checked:(e.type==='range'?+e.value:e.value);
  });
  return s;
};

function regenerate(){
  var s=A.readSettings();
  var meta=A.render(canvas,s,1,showGeometry)||{};
  var strategy=meta.strategy?(' / '+meta.strategy):'';
  $('stats').textContent=s.mode+strategy+' / '+s.seed+' / φ '+s.phiStrength+'%';
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
  regenerate();
};

function savePNG(){
  A.exportPNG(A.readSettings(),+$('exportScale').value);
}
$('save').onclick=savePNG;
$('savePanel').onclick=savePNG;

document.querySelectorAll('.inspector input, .inspector select').forEach(function(e){
  e.addEventListener('change',function(){
    if(e.id!=='exportScale')regenerate();
  });
});

window.addEventListener('keydown',function(e){
  if(e.target.matches('input,select'))return;
  var key=e.key.toLowerCase();
  if(key==='g')regenerate();
  if(key==='n')$('newSeed').click();
  if(key==='m')$('mutate').click();
  if(e.key==='[')setInspector(app.classList.contains('inspector-closed'),true);
});

regenerate();

})(window.AlgoArt);