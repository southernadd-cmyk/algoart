// Optional φ-based presentation framing shared by Marker, Tissue & Graphite,
// and Watercolour. No user-space geometry or legacy seed is mutated.
// Source geometry is transformed *before* SVG recording and material rendering.
// This is a design choice derived from φ ratios, not a mathematical law of φ.
(function(A){
'use strict';
var PHI=(1+Math.sqrt(5))/2,INV=1/PHI,INV2=1-INV;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function bounds(paths){
  var out={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(var i=0;i<paths.length;i++){
    var p=paths[i],segments=String(p.d||'').match(/[MLC][^MLC]*/gi)||[];
    var radius=(Number(p.width)||0)*.5;
    for(var j=0;j<segments.length;j++){
      var values=segments[j].slice(1).match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)||[];
      for(var k=0;k+1<values.length;k+=2){
        var x=+values[k],y=+values[k+1];
        if(!Number.isFinite(x)||!Number.isFinite(y))continue;
        out.minX=Math.min(out.minX,x-radius);
        out.maxX=Math.max(out.maxX,x+radius);
        out.minY=Math.min(out.minY,y-radius);
        out.maxY=Math.max(out.maxY,y+radius);
      }
    }
  }
  return out;
}
function plan(paths,w,h){
  var b=bounds(paths);
  if(!Number.isFinite(b.minX))return {kind:'empty',scale:1,tx:0,ty:0,
    targetCover:INV,beforeCover:0,afterCover:0};
  var bw=b.maxX-b.minX,bh=b.maxY-b.minY;
  var current=Math.max(bw/w,bh/h);
  if(!Number.isFinite(current)||current<1e-8)return {kind:'empty',
    scale:1,tx:0,ty:0,targetCover:INV,beforeCover:current,afterCover:current};
  // 1/φ content occupancy gives 1/φ² remaining for surrounding space.
  // Uniform scaling preserves all local φ ratios, angles and stroke hierarchy.
  var scale=clamp(INV/current,INV,PHI);
  if(Math.abs(scale-1)<.012)scale=1;
  var cx=(b.minX+b.maxX)*.5,cy=(b.minY+b.maxY)*.5;
  // Φ focal landmarks, not a forced centre. Move 1/φ² of the distance
  // toward the nearest golden focal node. Never move geometry beyond sheet.
  var candidates=[INV2,INV];
  var nearest=null,dist=Infinity;
  for(var xi=0;xi<2;xi++)for(var yi=0;yi<2;yi++){
    var tx=candidates[xi]*w,ty=candidates[yi]*h;
    var d=(tx-cx)*(tx-cx)+(ty-cy)*(ty-cy);
    if(d<dist){dist=d;nearest={x:tx,y:ty}}
  }
  var desiredX=cx*INV+nearest.x*INV2;
  var desiredY=cy*INV+nearest.y*INV2;
  // Keep a modest φ²-derived safety rim where it is physically possible.
  var safety=Math.min(w,h)*INV2*.1;
  var minX=safety+bw*scale*.5,maxX=w-safety-bw*scale*.5;
  var minY=safety+bh*scale*.5,maxY=h-safety-bh*scale*.5;
  var newCx=minX<=maxX?clamp(desiredX,minX,maxX):w*.5;
  var newCy=minY<=maxY?clamp(desiredY,minY,maxY):h*.5;
  var dx=newCx-cx*scale,dy=newCy-cy*scale;
  return {kind:'phi-sheet',scale:scale,tx:dx,ty:dy,
    targetCover:INV,beforeCover:current,afterCover:current*scale,
    anchor:nearest,originalCentroid:{x:cx,y:cy},
    fittedCentroid:{x:newCx,y:newCy},bounds:b};
}
function number(n){return String(+n.toFixed(5))}
function svgPath(d,fit){
  return String(d).replace(/([MLC])\s*([^MLC]*)/gi,function(_,op,values){
    var nums=values.match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)||[];
    var mapped=[];
    for(var i=0;i+1<nums.length;i+=2){
      mapped.push(number(+nums[i]*fit.scale+fit.tx));
      mapped.push(number(+nums[i+1]*fit.scale+fit.ty));
    }
    return op+' '+mapped.join(' ');
  });
}
function transformRecorded(paths,first,fit){
  for(var i=first;i<paths.length;i++){
    var p=paths[i];
    p.d=svgPath(p.d,fit);
    p.width*=fit.scale;
    if(p.dash)p.dash=p.dash.map(function(v){return v*fit.scale});
    if(p.dashOffset)p.dashOffset*=fit.scale;
  }
}
function transformVoids(voids,fit){
  return (voids||[]).map(function(v){
    return {x:v.x*fit.scale+fit.tx,y:v.y*fit.scale+fit.ty,
      w:v.w*fit.scale,h:v.h*fit.scale};
  });
}
A.phiSheetFit={PHI:PHI,INV:INV,INV2:INV2,bounds:bounds,plan:plan,
  transformRecorded:transformRecorded,transformVoids:transformVoids};
})(window.AlgoArt);
