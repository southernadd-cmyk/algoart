// ALGO/ART V5h — source-guide field connections, no invented global mask.
// Ground geometry is the actual V5d semantic guide (φ-cells, branch, arm, item).
// Frozen V5e/f/g modules remain available for same-seed comparison.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5dFromSource||!A.compositionV5cTest)
  throw Error('V5h requires original V5d source guide semantics');
var fromGuides=A.compositionV5dFromSource,
    VERSION='v5h-source-guide-field-connections-1',
    PHI=(1+Math.sqrt(5))/2;
function point(x,y){return{x:+x.toFixed(2),y:+y.toFixed(2)}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function cross(o,a,b){return(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x)}
function hull(points){
  var pts=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))
    .sort((a,b)=>a.x-b.x||a.y-b.y),lo=[],hi=[];
  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)
      lo.pop();
    lo.push(p);
  }
  for(var j=pts.length-1;j>=0;j--){
    var p=pts[j];
    while(hi.length>=2&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)
      hi.pop();
    hi.push(p);
  }
  return lo.slice(0,-1).concat(hi.slice(0,-1)).map(p=>point(p.x,p.y));
}
function bounds(points){
  var xs=points.map(p=>p.x),ys=points.map(p=>p.y),
    x=Math.min(...xs),y=Math.min(...ys);
  return{x:x,y:y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
function area(p){
  var s=0;
  for(var i=0;i<p.length;i++){
    var q=p[(i+1)%p.length];
    s+=p[i].x*q.y-q.x*p[i].y;
  }
  return Math.abs(s)*.5;
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
function proximity(a,b){
  // Ranking is grounded in the recorded engine, never raster proximity alone:
  // branch identity/depth, actual trajectory arm/local index, object tiers.
  var d=dist(a,b),bias=1;
  if(a.kind==='organic-branch'){
    if(a.branch===b.branch)bias=.43;
    else if(Math.abs(a.depth-b.depth)<=1)bias=.92;
    else bias=1.5;
  }else if(a.kind==='trajectory-ribbon'){
    if(a.arm===b.arm)bias=.43;
    else bias=1.38;
    bias*=1+Math.abs(a.guideIndex-b.guideIndex)/48;
  }else if(a.kind==='constructed-focal-form'){
    if(a.tier==='hero'||b.tier==='hero')bias=.80;
  }
  return d*bias;
}
function pairFor(a,items,plan,used){
  var options=items.filter(b=>b!==a&&b.kind===a.kind)
    .map(b=>({b:b,score:proximity(a,b),gap:dist(a,b)}))
    .sort((x,y)=>x.score-y.score||x.gap-y.gap||
       x.b.guideIndex-y.b.guideIndex);
  // A connected field must be a real relation between at least TWO guides,
  // and never bridge distant unrelated parts of a whole picture.
  for(var i=0;i<options.length;i++){
    var option=options[i],b=option.b;
    var pairKey=[a.guideId,b.guideId].sort().join('|');
    if(used&&used.has(pairKey))continue;
    if(a.kind==='organic-branch'&&
       a.branch!==b.branch&&Math.abs(a.depth-b.depth)>1)continue;
    if(a.kind==='trajectory-ribbon'&&a.arm!==b.arm)continue;
    var outline=hull(a.contour.concat(b.contour));
    if(outline.length<3)continue;
    var bb=bounds(outline),canvas=plan.width*plan.height,
        total=area(outline);
    if(total>canvas*.225||bb.w>plan.width*.55||bb.h>plan.height*.58)
      continue;
    if(option.gap>Math.hypot(plan.width,plan.height)/PHI/2.35)
      continue;
    if(A.compositionV5cTest.intersectsProtected(outline,
      plan.protectedVoids))continue;
    return{b:b,contour:outline,pairKey:pairKey};
  }
  return null;
}
function occupied(contour,plan){
  var grid=12,nx=Math.ceil(plan.width/grid),ny=Math.ceil(plan.height/grid),
      bb=bounds(contour),cells=[],voids=plan.protectedVoids||[];
  for(var y=Math.max(0,Math.floor(bb.y/grid));y<
        Math.min(ny,Math.ceil((bb.y+bb.h)/grid));y++){
    for(var x=Math.max(0,Math.floor(bb.x/grid));x<
        Math.min(nx,Math.ceil((bb.x+bb.w)/grid));x++){
      var q={x:(x+.5)*grid,y:(y+.5)*grid};
      if(voids.some(v=>q.x>=v.x&&q.x<=v.x+v.w&&
        q.y>=v.y&&q.y<=v.y+v.h))continue;
      if(inside(q,contour))cells.push(y*nx+x);
    }
  }
  if(cells.length<30)return null;
  // Convex hull over TWO real guide boundaries is one filled connected
  // surface, not a stroked or enlarged source axis.
  return{cells:cells,gridCell:grid,gridWidth:nx};
}
function connectedFields(plan,opts){
  var guides=(plan.territories||[]).filter(t=>t.role==='painted'&&
    t.kind!=='rect-cell'&&t.sources&&t.sources.length);
  if(!guides.length)return[];
  var fields=[],usedPairs=new Set(),max=Math.min(9,opts.maxConnectedFields||8);
  // Source hierarchy order is retained. No global closure, Voronoi partition,
  // random splitting, or field invented without a guide connection.
  for(var i=0;i<guides.length&&fields.length<max;i++){
    var a=guides[i],relation=pairFor(a,guides,plan,usedPairs);
    if(!relation)continue;
    var b=relation.b,outline=relation.contour,
        occ=occupied(outline,plan);
    if(!occ)continue;
    usedPairs.add(relation.pairKey);
    var bb=bounds(outline),surface=occ.cells.length*144,
        provenance=[...new Set(a.sources.concat(b.sources))],
        palette=[a.rgb.slice()];
    if(Math.hypot(...a.rgb.map((v,k)=>v-b.rgb[k]))>35)
      palette.push(b.rgb.slice());
    fields.push({id:'GH'+fields.length,
      kind:'source-guide-connection',role:fields.length?'supporting':'primary',
      // Keep BOTH originating guide IDs and their exact engine semantics.
      guideIds:[a.guideId,b.guideId],
      anchorGuideIndex:a.guideIndex,
      relationKind:a.kind,
      branch:a.kind==='organic-branch'?a.branch:undefined,
      depth:a.kind==='organic-branch'?a.depth:undefined,
      arm:a.kind==='trajectory-ribbon'?a.arm:undefined,
      focalTier:a.kind==='constructed-focal-form'?a.tier:undefined,
      members:[a.id,b.id],
      sources:provenance,sourceIndices:provenance.slice(),
      contour:outline,box:bb,x:bb.x+bb.w/2,y:bb.y+bb.h/2,
      width:bb.w,height:bb.h,area:surface,
      fillFraction:+(surface/(bb.w*bb.h)).toFixed(3),
      components:1,occupiedCells:occ.cells.length,
      cells:occ.cells,gridCell:occ.gridCell,gridWidth:occ.gridWidth,
      palette:palette,rgb:a.rgb.slice(),
      seed:A.hash(plan.seed+'|v5h|'+a.guideId+'|'+b.guideId)>>>0
    });
  }
  return fields;
}
function interpret(source,settings,opts){
  opts=opts||{};
  // Read V5d directly — we do NOT build V5e's broad hull groups,
  // V5f's random patches or V5g's mega-mask and retroactively split it.
  var plan=fromGuides(source,settings,opts);
  plan.colourFields=[];plan.fieldStats={count:0};
  plan.connectedFields=connectedFields(plan,opts);
  plan.connectedStats={
    count:plan.connectedFields.length,
    totalArea:plan.connectedFields.reduce((s,f)=>s+f.area,0),
    minFillFraction:plan.connectedFields.length?
      Math.min(...plan.connectedFields.map(f=>f.fillFraction)):0,
    allSingleComponent:plan.connectedFields.every(f=>f.components===1),
    sourceLinked:plan.connectedFields.every(f=>
       f.sources.length>0&&f.guideIds.length===2),
    origin:'V5d source-guide relationships'
  };
  plan.version=VERSION;
  plan.interpretation='source-guide-connected-areas';
  return plan;
}
A.compositionV5gFromSource=A.planCompositionV5FromSource;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.renderInterpretedV5H=function(target,settings,scale,opts){
  var result=A.renderInterpretedV5G(target,settings,scale,opts);
  result.version='v5h-source-guide-geometry';return result;
};
A.renderConnectedPlanV5H=A.renderConnectedPlanV5G;
A.compositionV5Version=VERSION;
A.compositionV5hTest={connectedFields:connectedFields,
  pairFor:pairFor,occupied:occupied};
})(window.AlgoArt);
