// Experimental procedural oil renderer. This is a MATERIAL interpretation,
// not a ninth composition engine and not a trained/image model.
// The published V1-V8 marker renderers are left completely unchanged.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

var P={
  ground:'#f2ede2',
  lights:['#f6f0e4','#eee6d6','#e2d9c8','#f8f2e9'],
  mid:['#b7b5a6','#9bafa9','#a3a99d','#c1baa7','#c8c1ad'],
  shadow:['#475e61','#344b4b','#626256','#725746'],
  warm:['#b46e39','#c48c4f','#d4a657','#956342'],
  glaze:['#e2d2b9','#b4c3bb','#e5c398']
};
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function choice(r,arr){return arr[Math.floor(r.n()*arr.length)]}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function point(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}

// Interpret SVG-recorded marker geometry rather than classifying raster pixels.
// All paths originate from the SAME seeded composition and settings.
function samplePath(path){
  var tokens=(path.d||'').match(/[MLC]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi)||[];
  var pts=[],p=null,i=0,command='';
  function num(){return Number(tokens[i++])}
  while(i<tokens.length && pts.length<550){
    if(/^[MLC]$/.test(tokens[i])){command=tokens[i++];continue}
    if(command==='M'||command==='L'){
      if(i+1>=tokens.length)break;
      p={x:num(),y:num()};pts.push(p);
      if(command==='M')command='L';
    }else if(command==='C'&&p){
      if(i+5>=tokens.length)break;
      var a={x:num(),y:num()},b={x:num(),y:num()},c={x:num(),y:num()};
      var start=p;
      for(var t=1;t<=10;t++){
        var v=t/10,u=1-v;
        pts.push({x:u*u*u*start.x+3*u*u*v*a.x+3*u*v*v*b.x+v*v*v*c.x,
          y:u*u*u*start.y+3*u*u*v*a.y+3*u*v*v*b.y+v*v*v*c.y});
      }
      p=c;command='L';
    }else{break}
  }
  if(path.transform){
    var m=(path.transform.match(/-?(?:\d+(?:\.\d*)?|\.\d+)/g)||[]).map(Number);
    if(m.length===6)pts=pts.map(function(q){
      return{x:m[0]*q.x+m[2]*q.y+m[4],y:m[1]*q.x+m[3]*q.y+m[5]};
    });
  }
  return pts;
}

function brush(ctx,a,b,width,colour,alpha,r){
  var dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<.5)return;
  var nx=-dy/length,ny=dx/length;
  var steps=5,left=[],right=[];
  var taperA=r.range(.62,.95),taperB=r.range(.5,.92);
  for(var j=0;j<=steps;j++){
    var t=j/steps,centre=point(a,b,t);
    var end=t<.5?taperA+(1-taperA)*t*2:taperB+(1-taperB)*(1-t)*2;
    var w=width*end*(1+r.range(-.21,.21))/2;
    var drift=r.range(-width*.09,width*.09);
    left.push({x:centre.x+nx*(w+drift),y:centre.y+ny*(w+drift)});
    right.push({x:centre.x-nx*(w-drift),y:centre.y-ny*(w-drift)});
  }
  ctx.save();ctx.globalAlpha=clamp(alpha,0,1);ctx.fillStyle=colour;
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  for(j=1;j<left.length;j++)ctx.lineTo(left[j].x,left[j].y);
  for(j=right.length-1;j>=0;j--)ctx.lineTo(right[j].x,right[j].y);
  ctx.closePath();ctx.fill();ctx.restore();
}

function inVoid(x,y,voids){
  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    if(x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h)return true;
  }
  return false;
}
function inkBand(ctx,a,b,weight,r,rich){
  var dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(len<2)return;
  var nx=-dy/len,ny=dx/len;
  var w=clamp(weight,12,90);
  var plus=r.range(-1,1);
  var shadow=choice(r,P.shadow);
  var mid=choice(r,P.mid);
  // Light, wide facets and a narrow dark spine share the exact same direction.
  brush(ctx,{x:a.x+nx*w*.18,y:a.y+ny*w*.18},
    {x:b.x+nx*w*.18,y:b.y+ny*w*.18},w*2.5,mid,r.range(.31,.69),r);
  brush(ctx,{x:a.x-nx*w*.25,y:a.y-ny*w*.25},
    {x:b.x-nx*w*.25,y:b.y-ny*w*.25},w*(rich?.78:.4),shadow,r.range(.45,.82),r);
  brush(ctx,{x:a.x+nx*w*.56,y:a.y+ny*w*.56},
    {x:b.x+nx*w*.56,y:b.y+ny*w*.56},w*r.range(.6,1.3),
    choice(r,P.lights),r.range(.55,.93),r);
  if(r.chance(.72))brush(ctx,
    {x:a.x+nx*w*(.24+plus*.2),y:a.y+ny*w*(.24+plus*.2)},
    {x:b.x+nx*w*(.24+plus*.2),y:b.y+ny*w*(.24+plus*.2)},
    w*r.range(.1,.3),choice(r,P.warm),r.range(.42,.84),r);
}

function oilPaint(ctx,w,h,paths,meta,seed,quality){
  var r=A.makeR(seed+'|procedural-oil-painter|1');
  var voids=meta.voids||[];
  ctx.fillStyle=P.ground;ctx.fillRect(0,0,w,h);
  var budget=quality<.4?.36:(quality<.8?.65:1);
  var i,j,k;

  // Scumbled plaster-like ground: independent of palette/marker ink.
  for(i=0;i<Math.floor(650*budget);i++){
    var x=r.range(-80,w+80),y=r.range(-80,h+80);
    var angle=r.range(-.6,.6);
    var length=r.range(42,265),width=r.range(12,105);
    brush(ctx,{x:x,y:y},{x:x+length*Math.cos(angle),y:y+length*Math.sin(angle)},
      width,choice(r,P.lights),r.range(.05,.36),r);
  }

  var lines=[];
  for(i=0;i<paths.length;i++){
    var ps=samplePath(paths[i]);
    if(ps.length<2)continue;
    var length=0;
    for(j=1;j<ps.length;j++)length+=dist(ps[j-1],ps[j]);
    if(length<5)continue;
    // Coalesce adjacent points before applying brush geometry. This keeps
    // dense ellipse curves from producing thousands of redundant paint dabs.
    var simplified=[ps[0]],last=ps[0],spacing=quality<.4?32:17;
    for(var pi=1;pi<ps.length;pi++){
      if(dist(ps[pi],last)>=spacing||pi===ps.length-1){
        simplified.push(ps[pi]);last=ps[pi];
      }
    }
    if(simplified.length>=2)lines.push({pts:simplified,length:length,width:paths[i].width||4});
  }
  // Bound the total number of independently painted paths for browser use.
  var stride=Math.max(1,Math.ceil(lines.length/(quality<.4?55:220)));
  var selected=lines.filter(function(_,index){return index%stride===0});
  // Large contiguous painted territories grow FROM the source mark geometry.
  for(i=0;i<selected.length;i++){
    var line=selected[i],pts=line.pts;
    for(j=1;j<pts.length;j++){
      var a=pts[j-1],b=pts[j],d=dist(a,b);
      if(d<4)continue;
      var count=Math.max(1,Math.ceil(d/110));
      for(k=0;k<count;k++){
        var p=point(a,b,k/count),q=point(a,b,(k+1)/count);
        if(inVoid((p.x+q.x)/2,(p.y+q.y)/2,voids)&&r.chance(.75))continue;
        var dx=q.x-p.x,dy=q.y-p.y,mag=Math.hypot(dx,dy);
        var nx=-dy/mag,ny=dx/mag;
        var side=r.range(-1,1),shift=r.range(10,95)*side;
        var offsetA={x:p.x+nx*shift,y:p.y+ny*shift};
        var offsetB={x:q.x+nx*shift,y:q.y+ny*shift};
        brush(ctx,offsetA,offsetB,r.range(38,155),
          r.chance(.58)?choice(r,P.lights):choice(r,P.mid),
          r.range(.18,.56),r);
        if(r.chance(.27))brush(ctx,p,q,r.range(15,85),
          choice(r,P.glaze),r.range(.15,.42),r);
      }
    }
  }

  // Geometry-aligned dark ridges and thick directional paint.
  for(i=0;i<selected.length;i++){
    line=selected[i];pts=line.pts;
    var importance=clamp(line.length/200,.45,2.2);
    for(j=1;j<pts.length;j++){
      a=pts[j-1];b=pts[j];d=dist(a,b);
      if(d<2)continue;
      count=Math.max(1,Math.ceil(d/55));
      for(k=0;k<count;k++){
        p=point(a,b,k/count);q=point(a,b,(k+1)/count);
        if(inVoid((p.x+q.x)/2,(p.y+q.y)/2,voids)&&r.chance(.65))continue;
        inkBand(ctx,p,q,clamp(r.range(12,32)*importance,9,70),r,r.chance(.37));
      }
    }
  }

  // Small palette-knife flecks at source-derived nodes and intersections.
  var centres=[];
  for(i=0;i<selected.length;i++){
    pts=selected[i].pts;
    if(!pts.length)continue;
    centres.push(pts[0],pts[pts.length-1],pts[Math.floor(pts.length/2)]);
  }
  var step=Math.max(1,Math.ceil(centres.length/(quality<.4?60:260)));
  for(i=0;i<centres.length;i+=step){
    var centre=centres[i];
    if(inVoid(centre.x,centre.y,voids)&&r.chance(.8))continue;
    var flecks=r.int(2,7);
    for(j=0;j<flecks;j++){
      var fx=centre.x+r.range(-34,34),fy=centre.y+r.range(-34,34);
      var length2=r.range(5,37),ang=r.range(0,Math.PI*2);
      brush(ctx,{x:fx,y:fy},
        {x:fx+Math.cos(ang)*length2,y:fy+Math.sin(ang)*length2},
        r.range(3,16),r.chance(.57)?choice(r,P.warm):choice(r,P.lights),
        r.range(.5,.97),r);
    }
  }

  // Canvas grain: faint deterministic surface relief, never image noise.
  ctx.save();
  for(i=0;i<Math.floor(2300*budget);i++){
    ctx.globalAlpha=r.range(.025,.12);
    ctx.fillStyle=r.chance(.55)?'#ffffff':'#5e5b51';
    ctx.fillRect(r.range(0,w),r.range(0,h),r.range(.45,2.5),r.range(.4,2.3));
  }
  ctx.restore();
}

// Offscreen composition capture deliberately passes the UNMODIFIED settings
// to the published renderer. No "oil" field reaches randomSettings(), so
// the source geometry does not move when this display-only option is toggled.
A.renderOil=function(target,s,scale,showGeometry){
  scale=scale||1;
  var w=s.orientation==='portrait'?1000:1400,h=s.orientation==='portrait'?1400:1000;
  var scratch=document.createElement('canvas');
  var oldRecorder=A.svgRecorder,rec={precise:true,paths:[],paperMarks:[]};
  var meta;
  try{
    A.svgRecorder=rec;
    meta=A.render(scratch,s,Math.min(1,Math.max(.1,scale)),false);
  }finally{
    A.svgRecorder=oldRecorder;
  }
  target.width=w*scale;target.height=h*scale;
  var ctx=target.getContext('2d');
  if(scale!==1)ctx.scale(scale,scale);
  oilPaint(ctx,w,h,rec.paths,meta,s.seed+'|'+s.mode+'|'+A.rendererVersion,scale);
  if(showGeometry)A.geometryOverlay(ctx,s,meta);
  A.lastRenderMeta=meta;
  return meta;
};
})(window.AlgoArt);
