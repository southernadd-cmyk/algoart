// Seeded, renderer-independent landscape around each daily sculpture gallery.
// All positions are in metres. No geometry is generated under visitor routes.
import { makeRandom, seedFromString } from './layout-v2.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

export function distanceToArchitecture(layout,x,z){
  let nearest=Infinity;
  for(const room of layout.rooms){
    const dx=Math.max(0,Math.abs(x-room.x)-room.width/2);
    const dz=Math.max(0,Math.abs(z-room.z)-room.depth/2);
    nearest=Math.min(nearest,Math.hypot(dx,dz));
  }
  for(const hall of layout.corridors){
    const x0=hall.start.x,z0=hall.start.z;
    const x1=hall.end.x,z1=hall.end.z;
    const length2=(x1-x0)**2+(z1-z0)**2;
    const t=length2?clamp(((x-x0)*(x1-x0)+(z-z0)*(z1-z0))/length2,0,1):0;
    nearest=Math.min(nearest,Math.max(0,Math.hypot(x-x0-(x1-x0)*t,z-z0-(z1-z0)*t)-hall.halfWidth));
  }
  return nearest;
}

export const MIN_BUILDING_CLEARANCE=42; // metres between building footprints and tower/bridges
export function buildEnvironmentPlan(layout,artworkStates=[],{lowPower=false,protectedLayouts=[],approach=null}={}){
  if(!layout?.rooms?.length)throw new Error('An outdoor environment needs rooms');
  const signature=artworkStates.map(s=>(s.seed||'')+':'+(s.engine||'')+':'+(s.material||'')).join('|');
  const seed=seedFromString('PP-SCULPTURE-GARDEN-v1:'+layout.date+':'+signature);
  const random=makeRandom(seed);
  const allLayouts=[layout,...protectedLayouts.filter(p=>p?.rooms?.length)];
  const xs=allLayouts.flatMap(p=>p.rooms).map(r=>[r.x-r.width/2,r.x+r.width/2]).flat();
  const zs=allLayouts.flatMap(p=>p.rooms).map(r=>[r.z-r.depth/2,r.z+r.depth/2]).flat();
  const centerX=(Math.min(...xs)+Math.max(...xs))/2;
  const centerZ=(Math.min(...zs)+Math.max(...zs))/2;
  const size=Math.max(290,Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))+240);
  const towerDistance=(x,z)=>Math.min(...allLayouts.map(p=>distanceToArchitecture(p,x,z)));
  const approachDistance=(x,z)=>{
    if(!approach)return Infinity;
    const {doorway,outward,pathLength=26,halfWidth=3.5}=approach;
    const dx=x-doorway.x,dz=z-doorway.z;
    const along=clamp(dx*outward.x+dz*outward.z,0,pathLength+3);
    return Math.max(0,Math.hypot(dx-outward.x*along,dz-outward.z*along)-halfWidth);
  };
  const theme='urban';
  const phase=random()*Math.PI*2;
  const slope=random()*Math.PI*2;
  const baseline=-1.08;
  const heightAt=(x,z)=>{
    const distance=Math.min(towerDistance(x,z),approachDistance(x,z));
    const beyond=smooth((distance-4)/28);
    const xx=x-centerX,zz=z-centerZ;
    const big=Math.sin(xx*.047+phase)*Math.cos(zz*.038-slope)*2.65;
    const middle=Math.sin(xx*.118-slope)*Math.sin(zz*.093+phase)*.63;
    const detail=Math.sin(xx*.37+phase)*Math.cos(zz*.29+slope)*.12;
    return baseline+beyond*(.63+big+middle+detail);
  };
  const trees=[],shrubs=[],rocks=[];
  const choosePoint=(inner,outer)=>{
    const r=layout.rooms[Math.floor(random()*layout.rooms.length)];
    const angle=random()*Math.PI*2;
    const distance=inner+random()*(outer-inner);
    return {x:r.x+Math.cos(angle)*distance,z:r.z+Math.sin(angle)*distance};
  };
  const distribute=(target,count,attempts,inner,outer,clearance,minSpacing)=>{
    for(let i=0;i<attempts&&target.length<count;i++){
      const p=choosePoint(inner,outer);
      if(Math.abs(p.x-centerX)>size*.45||Math.abs(p.z-centerZ)>size*.45)continue;
      if(Math.min(towerDistance(p.x,p.z),approachDistance(p.x,p.z))<clearance)continue;
      if(target.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<minSpacing))continue;
      target.push({...p,y:heightAt(p.x,p.z),scale:.65+random()*.9,species:Math.floor(random()*3),variant:random()});
    }
  };
  distribute(trees,lowPower?33:64,2000,13,51,7,lowPower?6:5);
  distribute(shrubs,lowPower?75:160,3000,6,34,3.3,lowPower?2.2:1.65);
  distribute(rocks,lowPower?12:28,600,8,45,4,2.5);
  // Deterministic urban blocks: kept outside the museum's clearance zone.
  // Building footprints and heights change with the same edition seed.
  const buildings=[];
  if(theme==='urban'){
    const street=12, edge=size*.43;
    for(let gx=-edge;gx<=edge;gx+=street){
      for(let gz=-edge;gz<=edge;gz+=street){
        if(random()<.20)continue;
        const x=centerX+gx+(random()-.5)*2.2;
        const z=centerZ+gz+(random()-.5)*2.2;
        const width=5+random()*3.8,depth=5+random()*3.8;
        // A bounding-circle clearance protects every corridor and room.
        const footprintRadius=Math.hypot(width,depth)/2;
        // Conservative bounding-circle test guarantees at least 18 m of
        // separation from *every* dated tower level and its skybridges.
        if(towerDistance(x,z)<footprintRadius+MIN_BUILDING_CLEARANCE)continue;
        // The street-level arrival avenue remains open and visible.
        if(approachDistance(x,z)<footprintRadius+30)continue;
        const height=4+Math.pow(random(),1.6)*23;
        if(buildings.length >= (lowPower?65:130))continue;
        buildings.push({x,z,y:heightAt(x,z),width,depth,height,
          variant:random(),roof:random()>.62?1:0});
      }
    }
  }
  return {seed,theme,size,centerX,centerZ,phase,slope,lowPower,
    trees:theme==='urban'?trees.slice(0,lowPower?14:28):trees,
    shrubs:theme==='urban'?shrubs.slice(0,lowPower?8:16):shrubs,
    rocks:theme==='urban'?[]:rocks,buildings,heightAt};
}
