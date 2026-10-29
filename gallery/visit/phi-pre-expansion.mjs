// Production φ-aware pre-expansion: relocate frames without reducing display size.
import {INV_PHI} from './phi-architecture.mjs';
import {wallPhiPreference} from './phi-curation-refinement.mjs';
const EPS=1e-6;
const at=(w,u)=>w.axis==='x'?{x:w.at+w.normal.x*.2,z:u}:{x:u,z:w.at+w.normal.z*.2};
const inside=(r,x,z)=>r.pieces.some(p=>x>p.x+1e-4&&x<p.x+p.w-1e-4&&z>p.z+1e-4&&z<p.z+p.h-1e-4);
const doorGap=(p,d)=>Math.hypot(p.x-(d.axis==='x'?d.at:d.centre),p.z-(d.axis==='x'?d.centre:d.at));
export function preExpandPhiPaintings(hang,sculptures,floor,circulation,physical,adherence,expand){
 if(!(adherence>0))return {moves:0};
 const surfaces=new Map(hang.surfaces.map(w=>[w.id,w])),paintings=hang.paintings;
 const doors=[...circulation.doors,...(circulation.bridgePortals||[])];
 const baseline={paintings:paintings.map(p=>({...p})),surfaces:hang.surfaces};
 expand(baseline,sculptures);
 const minWidths=new Map(baseline.paintings.map(p=>[p.studyId,p.width]));
 const starts=new Map(paintings.map(p=>[p.studyId,p.u]));
 const steps=[1,.8,.6,.4,.2,.1];
 function eligible(proposals){
  for(const p of paintings){
   const w=surfaces.get(p.surfaceId),u=proposals.get(p.studyId)??p.u,width=minWidths.get(p.studyId);
   if(!w||u-width/2<w.lo-EPS||u+width/2>w.hi+EPS)return false;
   if(Math.abs(u-starts.get(p.studyId))>1.5+EPS)return false;
   const pos=at(w,u);
   if(doors.some(d=>doorGap(pos,d)<.70))return false;
   if(!inside(floor.mergedRooms[p.room],pos.x+w.normal.x*2,pos.z+w.normal.z*2))return false;
   if(sculptures.some(s=>s.room===p.room&&
    (p.axis==='x'?Math.abs(s.x-p.at):Math.abs(s.z-p.at))<2.35&&
    Math.abs((p.axis==='x'?s.z:s.x)-u)<width/2+.67))return false;
   for(const q of paintings){
    if(p===q||p.surfaceId!==q.surfaceId)continue;
    const v=proposals.get(q.studyId)??q.u;
    if(Math.abs(u-v)-(width+minWidths.get(q.studyId))/2<.55-EPS)return false;
   }
  }
  const trial={paintings:paintings.map(p=>{
   const w=surfaces.get(p.surfaceId),u=proposals.get(p.studyId)??p.u;
   return {...p,u,...at(w,u)};
  }),surfaces:hang.surfaces};
  expand(trial,sculptures);
  return trial.paintings.every(p=>p.width+EPS>=minWidths.get(p.studyId));
 }
 const score=proposals=>paintings.reduce((sum,p)=>
  sum+wallPhiPreference(surfaces.get(p.surfaceId),proposals.get(p.studyId)??p.u),0);
 let moves=0;
 for(const wallId of new Set(paintings.map(p=>p.surfaceId))){
  const group=paintings.filter(p=>p.surfaceId===wallId),wall=surfaces.get(wallId);
  if(!wall)continue;
  const targets=[wall.lo+wall.length*INV_PHI,wall.hi-wall.length*INV_PHI],candidates=[];
  if(group.length>1)for(const target of targets)for(const p of group)for(const step of steps){
   const offset=(target-p.u)*adherence*step;
   if(Math.abs(offset)<=1.5+EPS)candidates.push(new Map(group.map(q=>[q.studyId,q.u+offset])));
  }
  for(const p of group)for(const target of targets)for(const step of steps){
   const u=p.u+(target-p.u)*adherence*step;
   if(Math.abs(u-starts.get(p.studyId))<=1.5+EPS)candidates.push(new Map([[p.studyId,u]]));
  }
  let best=null,gain=0,originalScore=score(new Map());
  for(const proposal of candidates){
   const improvement=score(proposal)-originalScore;
   if(improvement<=gain+1e-5||!eligible(proposal))continue;
   best=proposal;gain=improvement;
  }
  if(best)for(const [id,u] of best){
   const p=paintings.find(p=>p.studyId===id);
   if(Math.abs(p.u-u)<EPS)continue;
   p.u=u;Object.assign(p,at(wall,u));moves++;
  }
 }
 return {moves};
}
