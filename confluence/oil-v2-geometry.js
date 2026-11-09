// Confluence Oil renderer v2: use only genuinely committed, transformed
// geometry to recover the semantic filled areas present in solo Oil V8.
// V1 never imports or calls these routines; its share links remain frozen.
import {plannedPoints} from './mark-planner.js?v=confluence-progressive-order-03';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hash(text){
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
const rgb=s=>{
  const m=String(s||'').match(/^#([0-9a-f]{6})$/i);
  return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)):[80,70,65];
};
function bounds(points){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x=Math.min(...xs),y=Math.min(...ys);
  return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
const centre=b=>({x:b.x+b.w/2,y:b.y+b.h/2});
function routeLength(points){
  let len=0;
  for(let i=1;i<points.length;i++)len+=dist(points[i-1],points[i]);
  return len;
}
function sampled(points,n=30){
  const stride=Math.max(1,Math.floor(points.length/n));
  return points.filter((_,i)=>i%stride===0||i===points.length-1);
}
// Metadata comes from the recorded original source GUIDE, but every position
// comes from the exact placement / progressive mark planner for THIS turn.
export function committedOilV2Evidence(actions,inkForMark){
  return actions.flatMap(({artist,group,placement,plans})=>
    group.traces.filter(t=>t.points.length>=2).map(t=>({
      groupId:group.fragmentParent||group.id,
      fragmentNumber:group.fragmentNumber??0,
      fragmentTotal:group.fragmentTotal??1,
      system:artist.system,
      guide:group.oilGuide||null,
      mark:t.mark,width:t.width,ink:inkForMark(artist,t.mark),
      points:plannedPoints(t.points,placement,plans.get(t.mark))
    })));
}
// Reconstitute the committed history of ONE oil hand, not other hands'
// geometry, and never plan from marks that have not been drawn yet.
function groupsFrom(history){
  const out=new Map();
  for(const trace of history){
    let group=out.get(trace.groupId);
    if(!group){group={id:trace.groupId,system:trace.system,guide:trace.guide,
      strokes:[],fragments:new Set(),inks:[]};out.set(trace.groupId,group);}
    group.strokes.push(trace.points);
    group.fragments.add(trace.fragmentNumber);
    group.inks.push(trace.ink);
  }
  return [...out.values()].map(g=>{
    const points=g.strokes.flatMap(s=>sampled(s,24));
    return {...g,points,box:bounds(points),centre:centre(bounds(points)),
      progress:g.fragments.size/Math.max(1,g.strokes.length?history.find(t=>t.groupId===g.id)?.fragmentTotal||1:1),
      ink:g.inks.at(-1)};
  });
}
function sourcePaths(history){
  return history.map((trace,index)=>({
    d:trace.points.map((p,i)=>(i?'L':'M')+p.x.toFixed(3)+' '+p.y.toFixed(3)).join(' '),
    stroke:trace.ink,width:trace.width,mark:trace.mark,
    pass:0,sourceId:trace.groupId+'|'+index
  }));
}
function semanticGuide(groups,system,sheet){
  if(system==='organic'){
    const segments=[];
    for(const group of groups){
      const points=group.strokes.flatMap(s=>sampled(s,6));
      if(points.length<2||routeLength(points)<36)continue;
      const from=points[0],to=points.at(-1);
      if(dist(from,to)<28)continue;
      segments.push({x1:from.x,y1:from.y,x2:to.x,y2:to.y,
        depth:clamp(group.guide?.depth??0,0,3),
        branch:group.guide?.branch??group.id});
    }
    return {type:'organic',segments:segments.slice(0,26)};
  }
  if(system==='spiral'){
    const points=[];const localByArm=new Map();
    for(const group of groups){
      const arm=group.guide?.arm??0;
      const sampledPoints=group.strokes.flatMap(s=>sampled(s,18));
      for(const p of sampledPoints){
        const local=localByArm.get(arm)||0;localByArm.set(arm,local+1);
        points.push({...p,arm,local});
      }
    }
    return {type:'spiral',points:points.slice(0,380)};
  }
  if(system==='geometric'){
    const items=[];
    for(const group of groups){
      const {box,centre:p}=group;
      const size=Math.max(box.w,box.h,group.guide?.size||0);
      if(size<45||group.points.length<3)continue;
      items.push({x:p.x,y:p.y,size:clamp(size,45,270),
        tier:group.guide?.tier|| (size>125?'hero':'support'),rot:0});
    }
    return {type:'constructed',items:items.slice(0,16)};
  }
  if(system==='rects'){
    const cells=[];
    for(const group of groups){
      // A fragment of a rectangle is not evidence for filling the whole
      // original cell. Require at least half of its source gestures.
      if(group.progress<.5)continue;
      const b=group.box;
      if(b.w<21||b.h<21)continue;
      const x=clamp(b.x,0,sheet.width-1),y=clamp(b.y,0,sheet.height-1);
      cells.push({x,y,w:Math.min(b.w,sheet.width-x),h:Math.min(b.h,sheet.height-y),
        depth:group.guide?.depth||0});
    }
    return {type:'rects',cells:cells.slice(0,20)};
  }
  return {type:system};
}
export function oilV2PlanCapture(history,artist,sheet,seed){
  const groups=groupsFrom(history),paths=sourcePaths(history);
  const guide=semanticGuide(groups,artist.system,sheet);
  return {capture:{paths,meta:{guide,voids:[],strategy:'confluence-oil-v2-committed-geometry'}},
    groups, guideCounts:{
      groups:groups.length,segments:guide.segments?.length||0,
      points:guide.points?.length||0,items:guide.items?.length||0,
      cells:guide.cells?.length||0
    }};
}
function compatible(a,b){
  if(a.system!==b.system)return false;
  if(a.system==='spiral'&&a.guide?.arm!==undefined&&b.guide?.arm!==undefined)
    return a.guide.arm===b.guide.arm;
  if(a.system==='organic'&&a.guide?.branch!==undefined&&b.guide?.branch!==undefined)
    return a.guide.branch===b.guide.branch||
      Math.abs((a.guide?.depth||0)-(b.guide?.depth||0))<=1;
  return true;
}
function hull(points){
  const src=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  if(src.length<3)return [];
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lo=[],hi=[];
  for(const p of src){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
  for(let i=src.length-1;i>=0;i--){const p=src[i];
    while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));
}
function polygonArea(poly){
  let area=0;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a.x*b.y-b.x*a.y;}
  return Math.abs(area)/2;
}
// When the solo V5 semantic planner has not yet accumulated enough guides,
// a conservative *real-ink* pair can still seed its genuine oilColourField.
// This is neither a flat colour overlay nor a guessed closed spiral: every
// candidate comes from two distinct committed source groups, close in space.
export function oilV2FallbackFields(groups,sheet,seed){
  const fields=[],maximum=5;
  for(let i=groups.length-1;i>=1&&fields.length<maximum;i--){
    const a=groups[i],candidates=groups.slice(0,i).filter(b=>
      compatible(a,b)&&dist(a.centre,b.centre)<250);
    candidates.sort((x,y)=>dist(x.centre,a.centre)-dist(y.centre,a.centre));
    if(!candidates.length)continue;
    const b=candidates[0],points=sampled(a.points,35).concat(sampled(b.points,35));
    const raw=hull(points);if(raw.length<3)continue;
    const center=centre(bounds(raw)),padding=clamp(dist(a.centre,b.centre)*.18+14,18,42);
    const contour=raw.map(p=>{
      const dx=p.x-center.x,dy=p.y-center.y,len=Math.hypot(dx,dy)||1;
      return{x:clamp(p.x+dx/len*padding,Math.max(9,sheet.inset*.25),sheet.width-Math.max(9,sheet.inset*.25)),
        y:clamp(p.y+dy/len*padding,Math.max(9,sheet.inset*.25),sheet.height-Math.max(9,sheet.inset*.25))};
    });
    const box=bounds(contour),area=polygonArea(contour);
    if(area<8500||area>sheet.width*sheet.height*.15||box.w<55||box.h<55)continue;
    const ids=[a.id,b.id].sort(),name='CV2-'+hash(seed+'|'+ids.join('|'));
    if(fields.some(x=>x.guideIds.some(id=>ids.includes(id))))continue;
    const palette=[rgb(a.ink),rgb(b.ink)];
    fields.push({id:name,kind:'guide-chain-colour-mass',role:'supporting',
      guideIds:ids,contour,box,x:center.x,y:center.y,width:box.w,height:box.h,
      area,palette,rgb:palette[0],paintRgb:palette[0],paintPalette:palette,
      seed:hash(name),sources:[i],sourceIndices:[i]});
  }
  return fields;
}
