window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function $(id){return document.getElementById(id)}

var canvas=$('art');
var showGeometry=false;

var ranges=document.querySelectorAll('input[type=range]');
ranges.forEach(function(r){
  var o=r.parentElement.querySelector('output');
  function sync(){if(o)o.textContent=r.value}
  sync();
  r.addEventListener('input',sync);
});

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
  A.render(canvas,s,1,showGeometry);
  $('stats').textContent=s.mode+' · seed '+s.seed+' · φ '+s.phiStrength+'%';
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
  this.textContent=showGeometry?'Hide geometry':'Show geometry';
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

$('save').onclick=function(){
  A.exportPNG(A.readSettings(),+$('exportScale').value);
};

document.querySelectorAll('aside input, aside select').forEach(function(e){
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
});

regenerate();

})(window.AlgoArt);