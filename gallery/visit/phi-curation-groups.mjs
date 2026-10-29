import {classifyStudyMaterial} from './phi-curation-refinement.mjs';
// Theme-aware assignment to already validated exhibition positions.
// Never move a wall, pedestal, doorway or viewing corridor.
const dimensions=['engine','material','palette'];
const value=x=>typeof x==='string'?x.trim().toLowerCase():'';
export function studyCurationTraits(study){
 let params=study.material?.params||{};
 try{if(study.href)params=Object.fromEntries(new URL(study.href,'https://example.invalid').searchParams);}catch{}
 const explicit=value(params.material);
 const savedMaterial=value(study.material?.type||study.material);
 const material=classifyStudyMaterial(params,savedMaterial,explicit);
 return {engine:value(study.engine||params.mode),material,
   palette:value(study.palette||params.pal||params.palette)};
}

export function groupPhiExhibition(paintings,sculptures,studies){
 const byId=new Map(studies.map(s=>[s.id,s]));
 const slots=[...paintings,...sculptures];
 const traits=new Map(studies.map(s=>[s.id,studyCurationTraits(s)]));
 const frequencies=Object.fromEntries(dimensions.map(d=>[d,new Map()]));
 for(const p of slots)for(const d of dimensions){
  const key=traits.get(p.studyId)?.[d];
  if(key)frequencies[d].set(key,(frequencies[d].get(key)||0)+1);
 }
 // A property shared by the entire floor cannot distinguish a group.
 const weight=(d,key)=>key&&frequencies[d].get(key)>1?
   1-frequencies[d].get(key)/Math.max(1,slots.length):0;
 const rooms=[...new Set(slots.map(p=>p.room))].sort((a,b)=>a-b);
 function describe(room){
  const members=slots.filter(p=>p.room===room),options=[];
  for(const dimension of dimensions){
   const keys=[...new Set(members.map(p=>traits.get(p.studyId)?.[dimension]).filter(Boolean))].sort();
   for(const key of keys){
    const matching=members.filter(p=>traits.get(p.studyId)?.[dimension]===key);
    const n=matching.length;
    if(n<2||!weight(dimension,key))continue;
    const paintingsCount=matching.filter(p=>!byId.get(p.studyId)?.portrait).length;
    // Reward a coherent majority and conversations across painting/sculpture.
    const score=weight(dimension,key)*(n*(n-1)/Math.max(1,members.length-1)+
      .35*Math.min(paintingsCount,n-paintingsCount));
    options.push({dimension,value:key,count:n,score,studyIds:matching.map(p=>p.studyId)});
   }
  }
  options.sort((a,b)=>b.score-a.score||dimensions.indexOf(a.dimension)-dimensions.indexOf(b.dimension)||a.value.localeCompare(b.value));
  return {room,studyIds:members.map(p=>p.studyId),theme:options[0]||null,
   score:(options[0]?.score||0)+.15*(options[1]?.score||0)};
 }
 const score=()=>rooms.reduce((sum,room)=>sum+describe(room).score,0);
 const baselineScore=score();let current=baselineScore,swaps=0;
 const informative=dimensions.some(d=>[...frequencies[d]].some(([key])=>weight(d,key)>0));
 const aspect=s=>Number(s.aspect)||(s.portrait?1/1.4:1.4);
 function compatible(a,b){
  const sa=byId.get(a.studyId),sb=byId.get(b.studyId);
  if(!sa||!sb||!!sa.portrait!==!!sb.portrait)return false;
  // Equal aspect keeps every validated frame's dimensions and image proportions.
  return sa.portrait||Math.abs(aspect(sa)-aspect(sb))<1e-6;
 }
 const swap=(a,b)=>{[a.studyId,b.studyId]=[b.studyId,a.studyId];};
 // Bounded deterministic best-improvement search; only tiny daily collections.
 for(let pass=0;informative&&pass<Math.min(48,slots.length*2);pass++){
  const roomScores=new Map(rooms.map(room=>[room,describe(room).score]));
  let best=null,bestScore=current;
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
   const a=slots[i],b=slots[j];
   if(a.room===b.room||!compatible(a,b))continue;
   swap(a,b);
   const candidate=current-roomScores.get(a.room)-roomScores.get(b.room)+describe(a.room).score+describe(b.room).score;
   swap(a,b);
   if(candidate>bestScore+1e-9){best=[a,b];bestScore=candidate;}
  }
  if(!best)break;
  swap(...best);current=bestScore;swaps++;
 }
 return {version:1,method:'engine-material-palette',baselineScore,score:current,swaps,
  rooms:rooms.map(room=>{
   const description=describe(room);
   // Count the final placements, including sculptures, independently of the
   // majority theme used to optimise assignment.
   const composition=Object.fromEntries(dimensions.map(d=>{
    const counts=new Map();
    for(const id of description.studyIds){
     const key=traits.get(id)?.[d]||'';
     counts.set(key,(counts.get(key)||0)+1);
    }
    return [d,[...counts].map(([value,count])=>({value,count}))
     .sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value))];
   }));
   return {...description,composition};
  })};
}
