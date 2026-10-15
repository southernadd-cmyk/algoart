// ALGO/ART V5 experimental shared composition interpretation.
// Material-neutral: no pigment, pressure, cut-paper or brush rendering here.
// Faithful mode is handled by the existing, unchanged material renderers.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var VERSION='v5b-plan-2',PI=Math.PI;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function between(a,b,t){return{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}
function rgb(s){
  var m=String(s||'').match(/^#([0-9a-f]{6})$/i);
  if(m)return [0,2,4].map(function(k){return parseInt(m[1].slice(k,k+2),16)});
  m=String(s||'').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(m)return [+m[1],+m[2],+m[3]];
  m=String(s||'').match(/^hsl\(\s*([\d.]+)(?:deg)?(?:\s+|,\s*)([\d.]+)%(?:\s+|,\s*)([\d.]+)%/i);
  if(!m)return null;
  var h=(+m[1]%360+360)%360/60,l=+m[3]/100,sat=+m[2]/100,
      c=(1-Math.abs(2*l-1))*sat,x=c*(1-Math.abs(h%2-1)),o=l-c/2;
  return (h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:
    h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x]).map(function(v){
      return Math.round(clamp((v+o)*255,0,255))});
}
function parsePath(src){
  var tok=String(src.d||'').match(/[MLC]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)||[],
      pts=[],i=0,cmd='',prev=null;
  function read(){return +tok[i++]}
  while(i<tok.length&&pts.length<1200){
    if(/^[MLC]$/.test(tok[i])){cmd=tok[i++];continue}
    if((cmd==='M'||cmd==='L')&&i+1<tok.length){
      prev={x:read(),y:read()};pts.push(prev);cmd='L';
    }else if(cmd==='C'&&prev&&i+5<tok.length){
      var a={x:read(),y:read()},b={x:read(),y:read()},c={x:read(),y:read()},from=prev,
          count=Math.max(5,Math.min(12,Math.round(dist(from,c)/13)));
      for(var k=1;k<=count;k++){
        var t=k/count,u=1-t;pts.push({x:u*u*u*from.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*c.x,
          y:u*u*u*from.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*c.y});
      }
      prev=c;cmd='L';
    }else break;
  }
  if(src.transform){
    var mat=String(src.transform).match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi);
    if(mat&&mat.length===6){mat=mat.map(Number);
      pts=pts.map(function(p){return{x:mat[0]*p.x+mat[2]*p.y+mat[4],
        y:mat[1]*p.x+mat[3]*p.y+mat[5]}});
    }
  }
  return pts;
}
function inVoid(x,y,voids,radius){
  for(var i=0;i<voids.length;i++){
    var v=voids[i];if(!v||!Number.isFinite(+v.x)||!Number.isFinite(+v.y)||
      !Number.isFinite(+v.w)||!Number.isFinite(+v.h))continue;
    if(x>=v.x-radius&&x<=v.x+v.w+radius&&
      y>=v.y-radius&&y<=v.y+v.h+radius)return true;
  }
  return false;
}
function hash(s){return A.hash(s)>>>0}
function seeded(s){var state=hash(s);return function(){
  state=(state+0x6D2B79F5)>>>0;
  var t=state;t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}}
function extract(paths){
  var unique=new Set(),chains=[];
  for(var i=0;i<paths.length;i++){
    var colour=rgb(paths[i].stroke);if(!colour)continue;
    var points=parsePath(paths[i]);if(points.length<2)continue;
    var length=0;for(var j=1;j<points.length;j++)length+=dist(points[j-1],points[j]);
    if(length<9)continue;
    var first=points[0],last=points[points.length-1],
        key=[Math.round(first.x/5),Math.round(first.y/5),
          Math.round(last.x/5),Math.round(last.y/5),
          Math.round(length/15),colour.join(',')].join('|');
    if(unique.has(key))continue;unique.add(key);
    var mid=points[Math.floor(points.length/2)],
        theta=Math.atan2(last.y-first.y,last.x-first.x);
    chains.push({sourceIndex:i,pts:points,first:first,last:last,mid:mid,
      length:length,width:paths[i].width||3,rgb:colour,angle:theta});
  }
  return chains;
}
function captureSource(settings,opts){
  opts=opts||{};
  var priorRecorder=A.svgRecorder,priorMeta=A.lastRenderMeta,
      priorPhi=A.phiFramingEnabled,
      rec={precise:true,paths:[],paperMarks:[]},meta;
  try{
    A.svgRecorder=rec;A.phiFramingEnabled=opts.phiFraming===true;
    meta=A.render(document.createElement('canvas'),settings,.18,false);
  }finally{
    A.svgRecorder=priorRecorder;A.lastRenderMeta=priorMeta;
    A.phiFramingEnabled=priorPhi;
  }
  return {paths:rec.paths,meta:meta,chains:extract(rec.paths)};
}
function planFromSource(source,settings,opts){
  opts=opts||{};
  var w=settings.orientation==='portrait'?1000:1400,
      h=settings.orientation==='portrait'?1400:1000,
      seed=String(settings.seed||'no-seed')+'|'+VERSION+'|'+String(settings.mode||''),
      rand=seeded(seed),voids=source.meta&&Array.isArray(source.meta.voids)?
        source.meta.voids:[],
      chains=source.chains||extract(source.paths||[]),
      candidates=[],regions=[],maxRegions=opts.maxRegions||32;
  // Choose stable, source-attached candidate centroids. Long paths dominate,
  // but short accents are retained in an independent detail layer.
  for(var i=0;i<chains.length;i++){
    var c=chains[i],stride=Math.max(1,Math.floor(c.pts.length/3));
    for(var j=0;j<c.pts.length-1;j+=stride){
      var p=c.pts[j],q=c.pts[Math.min(j+stride,c.pts.length-1)],
          angle=Math.atan2(q.y-p.y,q.x-p.x);
      if(!Number.isFinite(angle)||dist(p,q)<3)continue;
      candidates.push({x:(p.x+q.x)*.5,y:(p.y+q.y)*.5,
        angle:angle,sourceIndex:c.sourceIndex,colour:c.rgb,
        pathLength:c.length,length:dist(p,q),score:Math.min(380,c.length)*(.55+.5*rand()),
        width:c.width});
      if(candidates.length>1500)break;
    }
    if(candidates.length>1500)break;
  }
  candidates.sort(function(a,b){return b.score-a.score||
    a.sourceIndex-b.sourceIndex});
  for(i=0;i<candidates.length&&regions.length<maxRegions;i++){
    var a=candidates[i];
    if(a.x<20||a.y<20||a.x>w-20||a.y>h-20)continue;
    var neighbours=[],weighted=0,colorSum=[0,0,0];
    for(j=0;j<candidates.length&&j<900;j++){
      var b=candidates[j],d=Math.hypot(b.x-a.x,b.y-a.y);
      if(d>95)continue;
      var delta=Math.abs(Math.cos(a.angle-b.angle)),
          chroma=Math.hypot(a.colour[0]-b.colour[0],
            a.colour[1]-b.colour[1],a.colour[2]-b.colour[2]);
      if(chroma>92||delta<.42)continue;
      neighbours.push({candidate:b,dist:d});
      var weight=1/(1+d*.03);
      weighted+=weight;
      for(var k=0;k<3;k++)colorSum[k]+=b.colour[k]*weight;
      if(neighbours.length>=12)break;
    }
    if(neighbours.length<2)continue;
    var spread=Math.min(97,20+neighbours.length*4.9),
        length=clamp(a.length*.85+neighbours.length*5.0,42,185),
        breadth=clamp(spread*.9,28,88),
        tooNear=regions.some(function(v){return Math.hypot(v.x-a.x,v.y-a.y)<
          Math.max(28,Math.min(v.width,breadth)*.82)});
    if(tooNear)continue;
    // Multiple capsule-support points must stay outside reserved voids;
    // never bridge disjoint focal islands with a convex-hull fill.
    var radius=breadth*.56,
        x1=a.x-Math.cos(a.angle)*length*.42,
        y1=a.y-Math.sin(a.angle)*length*.42,
        x2=a.x+Math.cos(a.angle)*length*.42,
        y2=a.y+Math.sin(a.angle)*length*.42;
    if(inVoid(a.x,a.y,voids,radius)||inVoid(x1,y1,voids,radius)||
      inVoid(x2,y2,voids,radius))continue;
    var contour=[],shapeRand=seeded(seed+'|outline|'+a.sourceIndex+'|'+i);
    // A material-neutral, source-local area footprint; curved tapered
    // boundary is a *composition* polygon, not oil bristles or tissue tears.
    for(var edge=0;edge<2;edge++){
      for(var tIndex=0;tIndex<=10;tIndex++){
        var t=edge===0?tIndex/10:(10-tIndex)/10,
            taper=Math.pow(Math.max(.07,Math.sin(PI*t)),.30),
            tangentDistance=(t-.5)*length,
            sideDistance=(edge===0?-1:1)*breadth*.52*taper*
              (.89+.16*shapeRand());
        contour.push({
          x:+(a.x+Math.cos(a.angle)*tangentDistance-
            Math.sin(a.angle)*sideDistance).toFixed(2),
          y:+(a.y+Math.sin(a.angle)*tangentDistance+
            Math.cos(a.angle)*sideDistance).toFixed(2)
        });
      }
    }
    regions.push({id:'R'+regions.length,pass:'mass',x:+a.x.toFixed(2),
      y:+a.y.toFixed(2),angle:+a.angle.toFixed(5),
      length:+length.toFixed(2),width:+breadth.toFixed(2),
      rgb:colorSum.map(function(v){return Math.round(v/weighted)}),
      sources:[...new Set(neighbours.map(function(n){return n.candidate.sourceIndex}))].slice(0,12),
      contour:contour,density:neighbours.length,seed:hash(seed+'|region|'+a.sourceIndex+'|'+j)});
  }
  // Separate medium and accent gestures. These represent the same
  // geometry but with less broad coverage; adapters decide their material.
  var gestures=regions.map(function(v,i){return{id:'G'+i,pass:'gesture',
    parent:v.id,x:v.x,y:v.y,angle:v.angle,length:v.length*.78,
    width:v.width*.26,rgb:v.rgb,sources:v.sources.slice(),
    seed:hash(seed+'|gesture|'+i)}});
  var accents=candidates.slice(0,Math.min(16,candidates.length)).filter(function(c){
    return !inVoid(c.x,c.y,voids,6)}).map(function(c,i){
    return{id:'A'+i,pass:'accent',x:c.x,y:c.y,angle:c.angle,
      length:clamp(c.length*.54,8,46),width:Math.max(2,c.width*.65),
      rgb:c.colour,sources:[c.sourceIndex],seed:hash(seed+'|accent|'+i)}});
  return {version:VERSION,seed:settings.seed,mode:settings.mode,
    orientation:settings.orientation,width:w,height:h,phiFraming:opts.phiFraming===true,
    sourcePaths:source.paths.length,eligibleChains:chains.length,
    protectedVoids:voids.map(function(v){return{x:v.x,y:v.y,w:v.w,h:v.h}}),
    regions:regions,gestures:gestures,accents:accents,
    interpretation:'areas'};
}
A.captureCompositionV5=captureSource;
A.planCompositionV5=function(settings,opts){
  var source=captureSource(settings,opts);return planFromSource(source,settings,opts);
};
A.planCompositionV5FromSource=planFromSource;
A.compositionV5Version=VERSION;
A.compositionV5Test={parsePath:parsePath,extract:extract,inVoid:inVoid,seeded:seeded};
})(window.AlgoArt);
