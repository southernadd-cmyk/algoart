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
var currentRenderMeta=null;
var CURRENT_RENDERER_VERSION=4;
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
  params.set('v',String(A.rendererVersion||CURRENT_RENDERER_VERSION));
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

  var explicitVersion=Number(params.get('v'));
  if(explicitVersion===1||explicitVersion===2||explicitVersion===3||explicitVersion===4){
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
  document.querySelectorAll('.mode-card').forEach(function(card){
    var active=card.dataset.mode===mode;
    card.classList.toggle('active',active);
    card.setAttribute('aria-pressed',active?'true':'false');
  });
}

function renderModePreviews(){
  var base=A.readSettings();
  withRendererVersion(CURRENT_RENDERER_VERSION,function(){
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
  });
}

function scheduleModePreviews(){
  clearTimeout(previewTimer);
  previewTimer=setTimeout(renderModePreviews,180);
}

document.querySelectorAll('.mode-card').forEach(function(card){
  card.addEventListener('click',function(){
    useCurrentRenderer();
    $('mode').value=card.dataset.mode;
    syncModeCards();
    regenerate();
    scheduleModePreviews();
  });
});

function regenerate(){
  var s=A.readSettings();
  var meta=A.render(canvas,s,1,showGeometry)||{};
  currentRenderMeta=meta;
  var strategy=meta.strategy?(' / '+meta.strategy):'';
  var series=SERIES[s.mode]||{code:s.mode.toUpperCase(),title:s.mode};
  $('statsText').textContent=series.code+' · '+series.title.toUpperCase()+strategy+' / '+s.seed+' / φ '+s.phiStrength+'%';
  syncRendererChip();
  syncModeCards();
  updateURL(s);
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
  scheduleModePreviews();
};

$('randomise').onclick=function(){
  useCurrentRenderer();
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

  withRendererVersion(CURRENT_RENDERER_VERSION,function(){
    cards.forEach(function(card,index){
      var seed=variationSeed(base.seed,index,variationBatch);
      var settings=Object.assign({},base,{seed:seed});
      var preview=card.querySelector('canvas');
      A.render(preview,settings,.28,false);
      card.dataset.seed=seed;
      card.querySelector('span').textContent='0'+(index+1)+' / '+seed;
    });
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
    useCurrentRenderer();
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
    useCurrentRenderer();
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
  if(key==='n')$('newSeed').click();
  if(key==='m')$('mutate').click();
  if(key==='v')openVariations();
  if(e.key==='[')setInspector(app.classList.contains('inspector-closed'),true);
});

loadSettingsFromURL();
syncModeCards();
regenerate();
setTimeout(renderModePreviews,40);
setTimeout(showEthosIfNeeded,260);

})(window.AlgoArt);
