import * as THREE from 'three';
// Generated from the actual verified sculpture pack, never camera pixels.
// Preserve each pigment region and material group in the simplified alternative.
export const SCULPTURE_SPLAT_VERSION=1;
export const SCULPTURE_SPLAT_BUDGETS=Object.freeze({mobile:12000,desktop:30000});
export const SCULPTURE_SPLAT_STRIDE=11;
export const SCULPTURE_SPLAT_ALGORITHM='v2-surface-uv-diffuse-v1';
export function simplifyRegion(mesh,cell=.016){
 const g=mesh.geometry,remap=[],buckets=new Map();
 const p=g.position,n=g.normal,uv=g.uv;
 for(let i=0;i<p.length/3;i++){
  const key=[...p.slice(i*3,i*3+3).map(v=>Math.round(v/100000/cell)),...n.slice(i*3,i*3+3).map(v=>Math.round(v/2500)),...uv.slice(i*2,i*2+2).map(v=>Math.round(v/3000))].join(',');
  if(!buckets.has(key))buckets.set(key,i);remap.push(buckets.get(key));
 }
 const index=[],groups=[];
 for(const group of g.groups){
  const start=index.length,seen=new Set();
  for(let i=group.start;i<group.start+group.count;i+=3){
   const a=remap[g.index[i]],b=remap[g.index[i+1]],c=remap[g.index[i+2]];
   if(a===b||a===c||b===c)continue;
   const key=[a,b,c].sort((a,b)=>a-b).join(',');
   if(seen.has(key))continue;seen.add(key);index.push(a,b,c);
  }
  // Never remove an entire original material region.
  if(index.length===start)for(let i=group.start;i<group.start+group.count;i++)index.push(g.index[i]);
  groups.push({start,count:index.length-start,materialIndex:group.materialIndex});
 }
 return {index,groups};
}
export function buildSculptureAlternatives(study,budget,{includeSimplified=true}={}){
 if(!Number.isSafeInteger(budget)||budget<1||!study.meshes?.length)throw Error('Invalid sculpture sample budget');
 const records=[],simplified=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3(),edge=new THREE.Vector3();
 let originalTriangles=0,simpleTriangles=0,totalArea=0;
 for(const [mi,m] of study.meshes.entries()){
  const g=m.geometry;
  originalTriangles+=g.index.length/3;
  if(includeSimplified){const alt=simplifyRegion(m);simplified.push(alt);simpleTriangles+=alt.index.length/3;}
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...m.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...m.rotation)),new THREE.Vector3(...m.scale));
  const vertex=(i,v)=>v.fromArray(g.position,i*3).multiplyScalar(1/100000).applyMatrix4(matrix);
  const faces=[];let area=0;
  for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3){
   const ids=g.index.slice(i,i+3);vertex(ids[0],a);vertex(ids[1],b);vertex(ids[2],c);
   const measure=cross.subVectors(b,a).cross(edge.subVectors(c,a)).length()/2;
   if(measure<=1e-12)continue;
   area+=measure;faces.push({ids,material:group.materialIndex,end:area});
  }
  if(!faces.length)throw Error('Degenerate pigment region '+mi);
  records.push({mi,m,matrix,faces,area});totalArea+=area;
 }
 // Give every source mesh at least four samples; proportional allocation otherwise.
 const minimum=4*records.length;if(minimum>budget)throw Error('Insufficient budget for all pigment regions');
 const remaining=budget-minimum,points=[];
 const n=new THREE.Vector3(),pos=new THREE.Vector3();
 const rnd=x=>{x=Math.imul(x^x>>>16,0x45d9f3b);x=Math.imul(x^x>>>16,0x45d9f3b);return ((x^x>>>16)>>>0)/4294967296;};
 let used=0;
 for(const [ri,r] of records.entries()){
  const count=ri===records.length-1?budget-used:4+Math.floor(remaining*r.area/totalArea);used+=count;
  const radius=Math.sqrt(r.area/count)*.8,g=r.m.geometry;
  let f=0;
  for(let j=0;j<count;j++){
   const target=(j+.5)*r.area/count;
   while(f<r.faces.length-1&&r.faces[f].end<target)f++;
   const {ids,material}=r.faces[f];
   const v=(id,out)=>out.fromArray(g.position,id*3).multiplyScalar(1/100000).applyMatrix4(r.matrix);
   v(ids[0],a);v(ids[1],b);v(ids[2],c);
   n.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();
   const t=Math.sqrt(rnd((ri+1)*100003+j*2+1)),w=rnd((ri+1)*100003+j*2+2),weights=[1-t,t*(1-w),t*w];
   pos.copy(a).multiplyScalar(weights[0]).addScaledVector(b,weights[1]).addScaledVector(c,weights[2]);
   const u=ids.reduce((s,id,i)=>s+g.uv[id*2]*weights[i]/100000,0),vCoord=ids.reduce((s,id,i)=>s+g.uv[id*2+1]*weights[i]/100000,0);
   points.push(...pos.toArray(),...n.toArray(),u,vCoord,radius,r.mi,material);
  }
 }
 return {sourceFile:study.sourceFile,seed:study.seed,originalTriangles,...(includeSimplified?{simpleTriangles,simplified}:{}),pointCount:used,points,meshCounts:study.meshes.map(m=>[m.geometry.position.length/3,m.geometry.index.length])};
}
