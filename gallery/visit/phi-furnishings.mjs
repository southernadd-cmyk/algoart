// Furniture occupies verified room space; doors, lift approaches and sculptures
// remain clear. Placement is independent of Three.js and stable per exhibition.
const inside=(room,x,z)=>room.pieces.some(p=>x>p.x&&x<p.x+p.w&&z>p.z&&z<p.z+p.h);
export function planPhiFurnishings(phi,{reception=null,lowPower=false}={}){
 const benches=[],people=[],obstacles=[];
 if(reception){
  const d=reception.desk;
  if(d){
   const rotation=Math.atan2(2.6,1),bench={x:d.x-2.6,z:d.z-1,rotation,room:d.room};benches.push(bench);
   // Keep the space behind the reception desk unoccupied; the bench visitor stays.
   people.push({...bench,yaw:rotation,bodyType:'female',variant:3,scale:1,pose:4,seat:true});
   obstacles.push({x:d.x,z:d.z,width:3.9,depth:1.5,kind:'desk'});
  }
 }else{
  const doors=[...phi.circulation.doors,...phi.circulation.bridgePortals];
  const safe=(room,x,z,r=.45)=>{
   if(![[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dz])=>inside(phi.floor.mergedRooms[room],x+dx,z+dz)))return false;
   if(Math.hypot(x-phi.circulation.lift.x,z-phi.circulation.lift.z)<3.2)return false;
   if(doors.some(d=>Math.hypot(x-(d.axis==='x'?d.at:d.centre),z-(d.axis==='z'?d.at:d.centre))<2.4+r))return false;
   if(phi.exhibition.sculptures.some(s=>Math.abs(x-s.x)<s.width/2+r+.35&&Math.abs(z-s.z)<s.depth/2+r+.35))return false;
   return true;
  };
  const paintings=[...phi.exhibition.paintings].sort((a,b)=>b.width-a.width||a.studyId-b.studyId);
  for(const art of paintings){
   if(benches.length>=(lowPower?1:2))break;
   if(benches.some(b=>b.room===art.room))continue;
   const rotation=Math.atan2(-art.normal.x,-art.normal.z),cs=Math.cos(rotation),sn=Math.sin(rotation);
   let found=null;
   for(const offset of [0,-1.6,1.6,-2.7,2.7]){
    const x=art.x+art.normal.x*3.15-art.normal.z*offset,z=art.z+art.normal.z*3.15+art.normal.x*offset;
    const corners=[[-1.28,-.75],[-1.28,.75],[1.28,-.75],[1.28,.75],[0,0]];
    if(!corners.every(([a,b])=>safe(art.room,x+a*cs+b*sn,z-a*sn+b*cs,.1)))continue;
    if(benches.some(b=>Math.hypot(x-b.x,z-b.z)<3.2))continue;
    found={x,z,rotation,room:art.room};break;
   }
   if(found)benches.push(found);
  }
  const addStanding=(room,x,z,target)=>{
   if(!safe(room,x,z,.55)||benches.some(b=>Math.hypot(x-b.x,z-b.z)<1.5)||people.some(p=>Math.hypot(x-p.x,z-p.z)<1.8))return false;
   const i=people.length;people.push({x,z,room,yaw:Math.atan2(target.x-x,target.z-z),bodyType:i%2?'female':'male',variant:i?1:4,scale:.97+i*.025,pose:i%3});return true;
  };
  for(const art of paintings){
   if(people.length>=(lowPower?1:2))break;
   for(const side of [-.65,.65]){
    if(addStanding(art.room,art.x+art.normal.x*2.1-art.normal.z*side,art.z+art.normal.z*2.1+art.normal.x*side,art))break;
   }
  }
  if(!people.length){
   for(const [room,r] of phi.floor.mergedRooms.entries())for(const p of r.pieces){
    if(people.length)break;
    const target=paintings.find(a=>a.room===room)||phi.exhibition.sculptures.find(a=>a.room===room);
    if(target)for(const a of [.382,.618,.5])for(const b of [.382,.618,.5]){
     if(people.length)break;addStanding(room,p.x+p.w*a,p.z+p.h*b,target);
    }
   }
  }
  if(benches[0]){const b=benches[0];people.push({...b,yaw:b.rotation,bodyType:people[0]?.bodyType==='male'?'female':'male',variant:2,scale:1,pose:4,seat:true});}
 }
 for(const b of benches){
  const cs=Math.abs(Math.cos(b.rotation)),sn=Math.abs(Math.sin(b.rotation));
  obstacles.push({x:b.x,z:b.z,width:1.85*cs+.68*sn,depth:1.85*sn+.68*cs,kind:'bench'});
 }
 return {benches,people,obstacles};
}
