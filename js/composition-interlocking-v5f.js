// ALGO/ART V5f: source-anchored interlocking pigment territories.
// This module wraps (never edits) the frozen V5e composition planner.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5eTest||!A.planCompositionV5FromSource)
  throw Error('V5f requires the unchanged V5e colour-field planner');
var previous=A.planCompositionV5FromSource,PI=Math.PI,TAU=2*PI,
    VERSION='v5f-interlocking-territories-1';
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function hash(v){return A.hash(String(v))>>>0}
function rounded(x){return +x.toFixed(2)}
function point(x,y){return{x:rounded(x),y:rounded(y)}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function area(poly){
  var value=0;
  for(var j=0;j<poly.length;j++){
    var a=poly[j],b=poly[(j+1)%poly.length];
    value+=a.x*b.y-b.x*a.y;
  }
  return Math.abs(value)*.5;
}
function box(poly){
  var xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),
      l=Math.min(...xs),r=Math.max(...xs),
      t=Math.min(...ys),b=Math.max(...ys);
  return{x:rounded(l),y:rounded(t),w:rounded(r-l),h:rounded(b-t)};
}
function inside(p,poly){
  var hit=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
function nearestSource(points,p){
  return points.reduce((best,q)=>distance(p,q)<distance(p,best)?q:best,points[0]);
}
function groupsFor(guide,plan){
  if(guide.type==='organic')return A.compositionV5eTest.organicGroups(guide,plan);
  if(guide.type==='spiral')return A.compositionV5eTest.trajectoryGroups(guide);
  if(guide.type==='constructed')return A.compositionV5eTest.constructedGroups(guide);
  return[];
}
// A local area is a softened, concave, source-guided paint territory,
// not an enlarged stroke, convex hull, or a contour copied from V5e.
function localTerritory(field,sourcePoints,index,count,plan){
  var r=A.makeR(String(field.seed)+'|v5f|'+index),
      ordered=sourcePoints.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
      raw=ordered[Math.min(ordered.length-1,
        Math.floor((index+.48)*ordered.length/count))],
      focal=nearestSource(ordered,raw),
      phase=TAU*(index+.32)/count,
      width=field.width,height=field.height,
      // Shift each local centre toward a different real recorded guide point.
      cx=clamp(focal.x*.72+field.x*.28+
        Math.cos(phase)*width*.082,field.box.x+width*.17,
        field.box.x+width*.83),
      cy=clamp(focal.y*.72+field.y*.28+
        Math.sin(phase)*height*.09,field.box.y+height*.17,
        field.box.y+height*.83),
      orient=Math.atan2(focal.y-field.y,focal.x-field.x);
  if(!Number.isFinite(orient))orient=phase;
  // Overlap adjacent local areas so colour can interpenetrate.
  var rx=clamp(width*r.range(.28,.38),42,205),
      ry=clamp(height*r.range(.29,.42),37,190),
      ripple=r.range(0,TAU),ripple2=r.range(0,TAU),
      poly=[];
  for(var k=0;k<40;k++){
    var t=TAU*k/40,global=t+orient*.19,
        // Different wavelengths make indentation and interruption structural,
        // rather than jittering a geometrically regular outline.
        radial=1+.145*Math.sin(3*global+ripple)+
          .104*Math.sin(5*global+ripple2)+
          .047*Math.sin(9*global-ripple*.7),
        probe=point(cx+Math.cos(t)*rx*radial,
          cy+Math.sin(t)*ry*radial);
    // Stay within the original compositional area, except modest bleed.
    var q=0;
    while(q<12&&(!inside(probe,field.contour)||
      probe.x<10||probe.y<10||
      probe.x>plan.width-10||probe.y>plan.height-10)){
      radial*=.90;
      probe=point(cx+Math.cos(t)*rx*radial,
        cy+Math.sin(t)*ry*radial);
      q++;
    }
    poly.push(probe);
  }
  if(area(poly)<2000||A.compositionV5cTest.intersectsProtected(
    poly,plan.protectedVoids))return null;
  var bb=box(poly),palette=field.palette||[field.rgb];
  return {id:field.id+'-P'+index,kind:'interlocking-paint-territory',
    parentId:field.id,sourceGuideId:field.guideId,
    anchor:point(focal.x,focal.y),sourceIndices:field.sources.slice(),
    rgb:palette[index%palette.length].slice(),contour:poly,box:bb,
    x:rounded(cx),y:rounded(cy),width:bb.w,height:bb.h,
    angle:rounded(orient),area:Math.round(area(poly)),
    seed:hash(field.seed+'|patch|'+index),sourceLinked:true};
}
function interpret(source,settings,opts){
  opts=opts||{};
  var plan=previous(source,settings,opts),
      guide=(source.meta&&source.meta.guide)||{},
      groups=groupsFor(guide,plan),
      byId=new Map(groups.map(g=>[g.id,g])),
      total=0;
  for(var i=0;i<plan.colourFields.length;i++){
    var field=plan.colourFields[i],original=byId.get(field.guideId),
        pts=original&&original.points||[];
    field.localTerritories=[];
    if(!pts.length)continue;
    var target=clamp(Math.ceil(pts.length/4),3,5);
    // Constructed guides can contain a single hero point; all local
    // centres still derive from that real source point.
    for(var k=0;k<target;k++){
      var patch=localTerritory(field,pts,k,target,plan);
      if(patch)field.localTerritories.push(patch);
    }
    total+=field.localTerritories.length;
  }
  plan.version=VERSION;
  plan.interpretation='shared-interlocking-paint-territories';
  plan.localTerritoryStats={count:total,parents:plan.colourFields.length,
    sourceLinked:plan.colourFields.every(f=>
      f.localTerritories.every(t=>t.sourceLinked&&t.sourceIndices.length>0)),
    protected:plan.protectedVoids.length};
  return plan;
}
A.compositionV5eFromSource=previous;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5fTest={localTerritory,groupsFor,area,inside};
})(window.AlgoArt);
