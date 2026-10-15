// V5o experiment: broad source-connected pigment masses. Composition geometry
// is derived ONLY from recorded V5d guides and their meaningful relations.
// This does not raster-segment a finished image or change faithful V7.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5jTest||!A.compositionV5iTest||!A.planCompositionV5FromSource)
  throw Error('V5o requires recorded V5d/V5i guides and V5j pigments');
const previous=A.planCompositionV5FromSource;
const PHI=(1+Math.sqrt(5))/2, VERSION='v5o-expanded-source-connections-1';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hull(points){
 const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),
   cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),
   lower=[],upper=[];
 for(const p of sorted){
   while(lower.length>1&&cross(lower[lower.length-2],lower.at(-1),p)<=0)lower.pop();
   lower.push(p);
 }
 for(let i=sorted.length-1;i>=0;i--){
   const p=sorted[i];
   while(upper.length>1&&cross(upper[upper.length-2],upper.at(-1),p)<=0)upper.pop();
   upper.push(p);
 }
 return lower.slice(0,-1).concat(upper.slice(0,-1)).map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2)}));
}
function bounds(poly){
 const xx=poly.map(p=>p.x),yy=poly.map(p=>p.y),
   x=Math.min(...xx),y=Math.min(...yy);
 return {x,y,w:Math.max(...xx)-x,h:Math.max(...yy)-y};
}
function area(poly){
 let v=0;for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];v+=a.x*b.y-b.x*a.y;
 }
 return Math.abs(v)/2;
}
function inside(p,poly){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a.y>p.y)!==(b.y>p.y)&&p.x<
     (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }
 return yes;
}
function occupancy(poly,plan){
 const step=10,nx=Math.ceil(plan.width/step),
   ny=Math.ceil(plan.height/step),rect=bounds(poly),cells=[];
 for(let y=Math.max(0,Math.floor(rect.y/step));y<Math.min(ny,Math.ceil((rect.y+rect.h)/step));y++)
 for(let x=Math.max(0,Math.floor(rect.x/step));x<Math.min(nx,Math.ceil((rect.x+rect.w)/step));x++){
  const p={x:(x+.5)*step,y:(y+.5)*step};
  if((plan.protectedVoids||[]).some(v=>
    p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h))continue;
  if(inside(p,poly))cells.push(y*nx+x);
 }
 return {cells,gridCell:step,gridWidth:nx};
}
function linked(a,b,plan){
 if(a===b||a.kind!==b.kind||a.role!=='painted'||b.role!=='painted')
   return false;
 const d=dist(a,b),limit=Math.hypot(plan.width,plan.height)/(PHI*1.70);
 if(d>limit)return false;
 if(a.kind==='organic-branch')return
   a.branch===b.branch||
   (Math.abs(a.depth-b.depth)<=1&&Math.abs(a.guideIndex-b.guideIndex)<=9);
 if(a.kind==='trajectory-ribbon')return
   a.arm===b.arm&&Math.abs(a.guideIndex-b.guideIndex)<=100;
 if(a.kind==='constructed-focal-form')return
   a.tier==='hero'||b.tier==='hero'||d<limit*.65;
 return false;
}
function candidates(plan){
 const guides=(plan.territories||[]).filter(g=>g.role==='painted'&&
   g.kind!=='rect-cell'&&g.sources?.length&&g.contour?.length>=4);
 const framed=(plan.territories||[]).filter(g=>g.role==='framed'&&
   g.kind!=='rect-cell'&&g.contour?.length>=4);
 const chosen=[],seen=new Set(),maxArea=plan.width*plan.height;
 const eligible=(group)=>{
  const key=group.map(g=>g.guideId).sort().join('|');
  if(seen.has(key))return;
  seen.add(key);
  if(group.length<2||group.length>4)return;
  const contour=hull(group.flatMap(g=>g.contour));
  if(contour.length<3)return;
  const b=bounds(contour),physical=area(contour),
    fraction=physical/maxArea;
  // True linked masses can be larger than old V5i 2-3% territories,
  // but must not swallow an entire portrait or its retained voids.
  if(fraction<.035||fraction>.155||b.w>plan.width*.69||
       b.h>plan.height*.72)return;
  if(A.compositionV5cTest.intersectsProtected(contour,plan.protectedVoids))return;
  // Framed guide centres are explicitly NOT part of the painted mass.
  if(framed.some(f=>inside({x:f.x,y:f.y},contour)))return;
  const occ=occupancy(contour,plan);
  if(occ.cells.length<210)return;
  const involved=new Set(group.map(g=>g.guideId)),
    support=group.map(g=>g.sources||[]).flat(),
    seed=A.hash(plan.seed+'|v5o|'+key)>>>0,
    cx=b.x+b.w/2,cy=b.y+b.h/2;
  chosen.push({id:key,guideIds:group.map(g=>g.guideId),
    sources:[...new Set(support)],contour,box:b,
    x:cx,y:cy,area:occ.cells.length*100,seed,
    cells:occ.cells,...occ,
    rgb:group[0].rgb.slice(),
    palette:group.map(g=>g.rgb.slice()),fraction,
    guideCount:group.length});
 };
 // Connect actual existing edges of the source graph. Three/four-guide
 // chains are only allowed if each next node relates to a member already
 // selected; none can jump between distinct golden arms.
 for(let i=0;i<guides.length;i++)
 for(let j=i+1;j<guides.length;j++){
   const a=guides[i],b=guides[j];
   if(!linked(a,b,plan))continue;
   eligible([a,b]);
   for(let k=j+1;k<guides.length;k++){
     const c=guides[k];
     if(!linked(a,c,plan)&&!linked(b,c,plan))continue;
     eligible([a,b,c]);
     for(let m=k+1;m<guides.length;m++){
       const d=guides[m];
       if(linked(a,d,plan)||linked(b,d,plan)||linked(c,d,plan))
         eligible([a,b,c,d]);
     }
   }
 }
 return chosen;
}
function enrich(source,settings,opts){
 opts=opts||{};
 const plan=previous(source,settings,opts),
   original=plan.connectedFields||[];
 if(!original.length){plan.broadConnectionStats={count:0};return plan}
 const pool=candidates(plan),existing=new Set(original.flatMap(f=>f.guideIds)),
   unionOfOriginal=new Set(original.flatMap(f=>f.cells)),
   large=[],occupied=new Set(),target=Math.min(5,opts.maxBroadConnections||4);
 const footprint=c=>new Set(c.cells);
 const ratio=(a,b)=>{let count=0;
   for(const x of a)if(b.has(x))count++;
   return count/a.size;
 };
 const ranked=pool.map(c=>{
   const cells=footprint(c);
   let novelty=0;for(const x of cells)if(!unionOfOriginal.has(x))novelty++;
   const unique=c.guideIds.filter(g=>!existing.has(g)).length;
   const size=c.area/(plan.width*plan.height);
   return {...c,set:cells,novelty:novelty/cells.size,
      score:size*135+unique*2.8+c.guideCount*1.5+
        novelty/cells.size*3.3};
 }).filter(c=>c.novelty>=.28).sort((a,b)=>b.score-a.score||
    a.id.localeCompare(b.id));
 for(const c of ranked){
   if(large.length>=target)break;
   if(large.some(old=>ratio(c.set,old.set)>.49||
     ratio(old.set,c.set)>.63))continue;
   if(large.length>0&&c.guideIds.every(g=>
     large.some(old=>old.guideIds.includes(g))))continue;
   large.push(c);
 }
 // Larger, source-owned spans lie BELOW the old small connected fields;
 // they support composition without painting over all local details.
 const broad=large.map((c,i)=>{
   const guideIds=c.guideIds.slice();
   return {id:'GO'+i,kind:'guide-chain-colour-mass',
      role:i?'supporting':'primary',relationKind:plan.guideStats.kind,
      guideIds,sourceIndices:c.sources.slice(),sources:c.sources.slice(),
      contour:c.contour,box:c.box,x:c.x,y:c.y,width:c.box.w,height:c.box.h,
      area:c.area,fillFraction:c.area/(c.box.w*c.box.h),
      components:1,occupiedCells:c.cells.length,
      cells:c.cells,gridCell:c.gridCell,gridWidth:c.gridWidth,
      rgb:c.rgb,palette:c.palette,seed:c.seed,guideCount:c.guideCount,
      geometricSource:'existing painted V5d guide contours and semantic graph'};
 });
 plan.connectedFields=broad.concat(original);
 plan.materialStats=A.compositionV5jTest.assign(plan.connectedFields);
 plan.broadConnectionStats={
   count:broad.length,candidates:pool.length,
   originalCount:original.length,totalCount:plan.connectedFields.length,
   originalUnion:unionOfOriginal.size*100,
   newSpans:broad.map(f=>({id:f.id,guideIds:f.guideIds,
     fraction:+(f.area/(plan.width*plan.height)).toFixed(4),
     sourceCount:f.sources.length,guideCount:f.guideCount})),
   maxSpanFraction:broad.length?Math.max(...broad.map(f=>
     f.area/(plan.width*plan.height))):0};
 plan.connectedStats={...plan.connectedStats,
   count:plan.connectedFields.length,broadCount:broad.length,
   totalUnionArea:(new Set(plan.connectedFields.flatMap(f=>f.cells))).size*100,
   sourceLinked:plan.connectedFields.every(f=>f.guideIds.length>=2&&
     f.sources.length>0)};
 plan.version=VERSION;
 plan.interpretation='source-connected-broad-guide-chains';
 return plan;
}
A.compositionV5jFromSource=previous;
A.planCompositionV5FromSource=enrich;
A.planCompositionV5=(settings,opts)=>enrich(A.captureCompositionV5(settings,opts),settings,opts);
A.compositionV5oTest={candidates,linked,occupancy,area,hull};
A.compositionV5Version=VERSION;
})(window.AlgoArt);
