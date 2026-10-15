// ALGO/ART V5i: visible fields from the source guide graph itself.
// Material-neutral geometry. No random polygons, no giant mask union,
// no splitting a finished image, no change to live Faithful or V5c phi cells.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5dFromSource||!A.compositionV5hTest)
  throw Error('V5i needs recorded V5d guide data and frozen V5h');
const prev=A.planCompositionV5FromSource,sourceGuides=A.compositionV5dFromSource;
const PHI=(1+Math.sqrt(5))/2,VERSION='v5i-source-relationship-visible-fields-1';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pt=(x,y)=>({x:+x.toFixed(2),y:+y.toFixed(2)});
function bounds(poly){
 const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
 return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function convexOutline(points){
 const src=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),up=[],down=[];
 for(const p of src){while(up.length>1&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
 for(let k=src.length-1;k>=0;k--){
  const p=src[k];while(down.length>1&&cross(down[down.length-2],down[down.length-1],p)<=0)down.pop();down.push(p)
 }
 return up.slice(0,-1).concat(down.slice(0,-1)).map(p=>pt(p.x,p.y));
}
function polygonArea(poly){
 let sum=0;for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length];
   sum+=a.x*b.y-a.y*b.x;
 }return Math.abs(sum)*.5;
}
function inside(p,polygon){
 let yes=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }return yes;
}
function cellsFor(poly,plan,cell){
 cell=cell||10;
 const nx=Math.ceil(plan.width/cell),ny=Math.ceil(plan.height/cell),box=bounds(poly),
   voids=plan.protectedVoids||[],cells=[];
 for(let y=Math.max(0,Math.floor(box.y/cell));y<Math.min(ny,Math.ceil((box.y+box.h)/cell));y++){
  for(let x=Math.max(0,Math.floor(box.x/cell));x<Math.min(nx,Math.ceil((box.x+box.w)/cell));x++){
   const q={x:(x+.5)*cell,y:(y+.5)*cell};
   if(voids.some(v=>q.x>=v.x&&q.x<=v.x+v.w&&q.y>=v.y&&q.y<=v.y+v.h))continue;
   if(inside(q,poly))cells.push(y*nx+x);
  }
 }
 return{cells,gridCell:cell,gridWidth:nx};
}
function permitted(a,b,plan){
 if(a===b||a.kind!==b.kind)return false;
 // These are ORIGINAL semantic relationships recorded by the generator.
 // Growth: original branch ownership and parent-depth adjacency.
 if(a.kind==='organic-branch'&&a.branch!==b.branch&&
    Math.abs(a.depth-b.depth)>1)return false;
 // Trajectories: never connect distinct golden arms; consecutive order.
 if(a.kind==='trajectory-ribbon'&&a.arm!==b.arm)return false;
 const d=dist(a,b),max=Math.hypot(plan.width,plan.height)/(PHI*2.35);
 if(d>max)return false;
 if(a.kind==='trajectory-ribbon'&&
   Math.abs(a.guideIndex-b.guideIndex)>80)return false;
 return true;
}
// Golden Trajectories can use TWO directed, original-guide anchored territories
// for a related pair of spiral sections. Reach is exactly phi^-2 from EACH
// recorded arm section towards the other, leaving phi-derived negative space
// between the two territories. This does not cut up a completed colour area.
function goldenArmConnection(anchor,related){
  const reach=1/(PHI*PHI);
  const target=related.contour.map(p=>pt(
    anchor.x+(p.x-anchor.x)*reach,
    anchor.y+(p.y-anchor.y)*reach));
  return convexOutline(anchor.contour.concat(target));
}
function candidates(plan,opts){
 const guides=plan.territories.filter(t=>t.role==='painted'&&t.kind!=='rect-cell'&&
   t.sources?.length&&t.contour?.length>=4);
 const all=[],maxArea=plan.width*plan.height*.215;
 for(let i=0;i<guides.length;i++){
  const a=guides[i];
  // A connection can be made only where two independent source guides exist.
  // Consider every lawful pair before choosing which visible connections to
  // paint. Never construct regions from random seeds or a raster partition.
  for(let j=i+1;j<guides.length;j++){
   const b=guides[j];if(!permitted(a,b,plan))continue;
   const configurations=(a.kind==='trajectory-ribbon'||a.kind==='constructed-focal-form')?
     [[a,b,goldenArmConnection(a,b)],[b,a,goldenArmConnection(b,a)]]:
     [[a,b,convexOutline(a.contour.concat(b.contour))]];
   for(const [origin,other,contour] of configurations){
     const bb=bounds(contour);
     if(contour.length<4||bb.w>plan.width*.52||bb.h>plan.height*.56)continue;
     const physical=polygonArea(contour);
     if(physical>maxArea||physical<3200)continue;
     if(A.compositionV5cTest.intersectsProtected(contour,plan.protectedVoids))
       continue;
     const occupancy=cellsFor(contour,plan,10);
     if(occupancy.cells.length<35)continue;
     const pigment=[origin.rgb.slice()];
     if(Math.hypot(...origin.rgb.map((v,k)=>v-other.rgb[k]))>37)
       pigment.push(other.rgb.slice());
     all.push({a:origin,b:other,contour,box:bb,
       cellSet:new Set(occupancy.cells),
       ...occupancy,area:occupancy.cells.length*100,
       palette:pigment,rgb:origin.rgb.slice(),
       guideIds:[origin.guideId,other.guideId],
       pairKey:origin.guideId+'|'+other.guideId,
       sources:[...new Set(origin.sources.concat(other.sources))],
       centre:{x:bb.x+bb.w*.5,y:bb.y+bb.h*.5}});
   }
  }
 }
 return all;
}
function intersect(a,b){
 let n=0;
 const s=a.cellSet.size<=b.cellSet.size?a.cellSet:b.cellSet,
   t=s===a.cellSet?b.cellSet:a.cellSet;
 for(const id of s)if(t.has(id))n++;
 return n;
}
function overlapMetrics(selected){
 const covered=new Set(),n=selected.length;
 const union=[];
 for(const f of selected){let added=0;
   for(const id of f.cellSet)if(!covered.has(id)){covered.add(id);added++}
   union.push(added);
 }
 const backwards=new Set(),exposure=[];
 for(let i=n-1;i>=0;i--){
  const f=selected[i];let visible=0;
  for(const id of f.cellSet)if(!backwards.has(id)){visible++}
  for(const id of f.cellSet)backwards.add(id);
  exposure[i]=visible/f.cellSet.size;
 }
 return {exposure,unionArea:covered.size*100,visibleCount:exposure.filter(x=>x>=.65).length};
}
function selectFields(plan,opts){
 const pool=candidates(plan,opts),chosen=[],max=Math.min(9,opts.maxConnectedFields||8);
 const remaining=pool.slice();
 // This is a maximum-visibility SELECTION among pre-existing guide relations.
 // It neither cuts up nor changes ANY field boundaries. A candidate qualifies
 // when its original colour mass stays visible and does not hide earlier areas.
 while(chosen.length<max&&remaining.length){
  let best=null,bestScore=-Infinity;
  for(const candidate of remaining){
   const overlap=chosen.map(f=>intersect(f,candidate));
   const shared=overlap.reduce((sum,n)=>sum+n,0);
   const union=new Set(chosen.flatMap(f=>f.cells));
   let fresh=0;for(const v of candidate.cells)if(!union.has(v))fresh++;
   const uncovered=fresh/candidate.cells.length;
   if(uncovered<.67)continue;
   if(chosen.some((f,i)=>overlap[i]/f.cells.length>.27))continue;
   const proposed=chosen.concat(candidate);
   const exposure=overlapMetrics(proposed).exposure;
   if(exposure.some(v=>v<.66))continue;
   const distance=chosen.length?Math.min(...chosen.map(f=>dist(f.centre,candidate.centre))):0;
   const newGuideCount=candidate.guideIds.filter(id=>
     chosen.every(f=>!f.guideIds.includes(id))).length;
   const rgbDistance=chosen.length?
     Math.min(...chosen.map(f=>Math.hypot(...f.rgb.map((v,k)=>v-candidate.rgb[k])))):75;
   // Penalise the single huge field that V5h/V5g selected. The chosen
   // geometry must remain readable as multiple autonomous colour forms.
   const targetArea=Math.min(plan.width*plan.height*.016,24000);
   const usable=Math.min(fresh,220);
   const score=usable*100+
     newGuideCount*4400+Math.min(distance,250)*36+
     Math.min(rgbDistance,140)*8+
     Math.max(0,3500-Math.abs(candidate.area-targetArea)*.13)-
     shared*65-
     // Tie breaker is deterministic, anchored to real guide indices.
     (candidate.a.guideIndex+candidate.b.guideIndex)*.01;
   if(score>bestScore){best=candidate;bestScore=score}
  }
  if(!best)break;
  chosen.push(best);
  remaining.splice(remaining.indexOf(best),1);
 }
 return chosen.map((f,i)=>{
   const bb=f.box,seed=A.hash(plan.seed+'|v5i|'+f.pairKey)>>>0;
   return{id:'GI'+i,kind:'guide-connected-visible-field',role:i?'supporting':'primary',
     relationKind:f.a.kind,guideIds:f.guideIds,
     guideIndex:f.a.guideIndex,anchorGuideIndex:f.a.guideIndex,
     branch:f.a.kind==='organic-branch'?f.a.branch:undefined,
     depth:f.a.kind==='organic-branch'?f.a.depth:undefined,
     arm:f.a.kind==='trajectory-ribbon'?f.a.arm:undefined,
     focalTier:f.a.kind==='constructed-focal-form'?f.a.tier:undefined,
     members:[f.a.id,f.b.id],
     sourceIndices:f.sources.slice(),sources:f.sources.slice(),
     contour:f.contour,box:bb,x:f.centre.x,y:f.centre.y,
     width:bb.w,height:bb.h,area:f.area,
     fillFraction:+(f.area/(bb.w*bb.h)).toFixed(3),
     components:1,occupiedCells:f.cells.length,
     cells:f.cells,gridCell:f.gridCell,gridWidth:f.gridWidth,
     rgb:f.rgb,palette:f.palette,seed};
 });
}
function inspect(fields){
 const exposed=[],all=new Set();
 for(let i=fields.length-1;i>=0;i--){
  const f=fields[i];let n=0;
  for(const v of f.cells)if(!all.has(v))n++;
  exposed[i]=n/f.cells.length;
  for(const v of f.cells)all.add(v);
 }
 return{
   count:fields.length,
   visibleFields:exposed.filter(v=>v>=.65).length,
   exposedFractions:exposed.map(v=>+v.toFixed(4)),
   totalUnionArea:all.size*100,
   maxCanvasFraction:null,
   minimumVisibleFraction:exposed.length?Math.min(...exposed):0,
   sourceLinked:fields.every(f=>f.guideIds.length===2&&f.sources.length>0),
   allSingleComponent:fields.every(f=>f.components===1),
   origin:'recorded V5d guide relationships, selected for visible separation'
 };
}
function interpret(source,settings,opts){
 opts=opts||{};
 const plan=sourceGuides(source,settings,opts);
 plan.colourFields=[];plan.fieldStats={count:0};
 plan.connectedFields=selectFields(plan,opts);
 plan.connectedStats=inspect(plan.connectedFields);
 plan.connectedStats.maxCanvasFraction=plan.connectedFields.length?
  Math.max(...plan.connectedFields.map(f=>f.area/(plan.width*plan.height))):0;
 plan.version=VERSION;
 plan.interpretation='visible-source-guide-colour-areas';
 return plan;
}
A.compositionV5hFromSource=prev;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=(settings,opts)=>
  interpret(A.captureCompositionV5(settings,opts),settings,opts);
A.compositionV5iTest={candidates,selectFields,inspect,overlapMetrics};
A.renderInterpretedV5I=(target,settings,scale,opts)=>{
 const stats=A.renderInterpretedV5G(target,settings,scale,opts);
 stats.version=VERSION;return stats;
};
A.renderConnectedPlanV5I=A.renderConnectedPlanV5H;
A.compositionV5Version=VERSION;
})(window.AlgoArt);
