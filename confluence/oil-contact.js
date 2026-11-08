// Confluence-only, deterministic invitations for Oil to answer existing
// drawing structures. Leave the released Oil V8 brush engine untouched.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function hash(s){
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}
function at(field,p,sheet){
 const x=clamp(Math.floor(p.x/16),0,sheet.cols-1);
 const y=clamp(Math.floor(p.y/16),0,sheet.rows-1);
 return field.distances[x+y*sheet.cols];
}
export function wantsOilContact(seed,artistId,turn,pull,strength){
 const chance=(.22+.34*clamp(pull/100,0,1))*clamp(strength/100,0,1);
 return hash(seed+'|oil-contact|'+artistId+'|'+turn)/4294967296<chance;
}
export function contactFraction(group,candidate,fields,sheet){
 if(!fields.length||!group.probes?.length)return 0;
 const stride=Math.max(1,Math.ceil(group.probes.length/20));
 let count=0,near=0;
 for(let i=0;i<group.probes.length;i+=stride){
   const p=candidate.place(group.probes[i].p);
   const nearest=Math.min(...fields.map(field=>at(field,p,sheet)));
   near+=nearest<30?1:0;
   count++;
 }
 return near/Math.max(1,count);
}
export function oilContactCandidates(group,artist,fields,density,sheet,turn){
 if(!group?.probes?.length||!fields.length||group.cell)return [];
 const anchored=(group.links||[]).some(p=>
   artist.anchors.has(p.x.toFixed(4)+','+p.y.toFixed(4)));
 if(anchored)return [];
 const base=artist.pose.place;
 const centre=base(group.center);
 const samples=[];
 const seen=new Set();
 const total=sheet.cols*sheet.rows;
 const shift=hash(artist.id+'|'+turn+'|oil-sites')%Math.max(1,total);
 const step=31; // coprime to the standard 88x63 and 63x88 grids
 for(const field of fields){
   for(let j=0;j<total;j+=3){
     const idx=(shift+j*step)%total;
     if(field.distances[idx]>12)continue;
     const x=field.x[idx],y=field.y[idx];
     if(x<sheet.inset+36||x>sheet.width-sheet.inset-36||
        y<sheet.inset+36||y>sheet.height-sheet.inset-36)continue;
     const pos={x,y};
     if((density?.at(pos)||0)>2.15)continue; // never seek a black pool
     const gridKey=Math.round(x/56)+','+Math.round(y/56);
     if(seen.has(gridKey))continue;
     seen.add(gridKey);
     const d=Math.hypot(x-centre.x,y-centre.y);
     samples.push({x,y,angle:field.angle[idx],d});
   }
 }
 samples.sort((a,b)=>a.d-b.d);
 const targets=samples.slice(0,10);
 const source=group.traces?.find(trace=>trace.points.length>1)?.points||[];
 let heading=0;
 if(source.length>1){
   const a=base(source[0]),b=base(source[Math.floor(source.length*.33)]||source.at(-1));
   heading=Math.atan2(b.y-a.y,b.x-a.x);
 }
 const candidates=[];
 for(const target of targets){
   for(const [mode,extra] of [['follow',0],['cross',Math.PI/2]]){
     const angle=target.angle-heading+extra;
     const c=Math.cos(angle),s=Math.sin(angle);
     const offset=mode==='follow'?10:0;
     const x=target.x-Math.sin(target.angle)*offset;
     const y=target.y+Math.cos(target.angle)*offset;
     candidates.push({
       oilContact:mode,oilTarget:{x:target.x,y:target.y},effort:.72,
       place:p=>{
         const q=base(p);
         const dx=q.x-centre.x,dy=q.y-centre.y;
         return {x:x+c*dx-s*dy,y:y+s*dx+c*dy};
       }
     });
   }
 }
 return candidates;
}
