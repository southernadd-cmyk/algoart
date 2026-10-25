// Transparent, outward-facing paint quads share a texture atlas and material.
// Paint is generated in small renderer-frame steps, outside startup's critical path.
import {drawTag} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {planExteriorGraffiti,planGraffitiAtlases,towerGraffitiKey} from './exterior-graffiti-plan.mjs';
const surfaceOffset=(mark,currentFloor)=>mark.surface==='interior'?.173:mark.level===currentFloor?.202:.173;
export function graffitiPaintParts(tag){
 if(tag.form!=='bubble'&&tag.form!=='hollow')return [tag];
 const letters=new Map();tag.strokes.forEach((stroke,index)=>{const key=stroke.letterIndex;if(!letters.has(key))letters.set(key,{strokes:[],timing:[]});letters.get(key).strokes.push(stroke);if(tag.motion)letters.get(key).timing.push(tag.motion.strokes[index]);});
 // At full progress, each letter uses the same seed, coordinates and opacity
 // as the complete mark. Splitting the union by letter preserves final pixels.
 return [...letters.values()].map(({strokes,timing})=>({...tag,strokes,motion:tag.motion?{...tag.motion,strokes:timing}:null}));
}
export function graffitiGeometry(THREE,entries,size,currentFloor,tileMeters=2,atlasHeight=size){
 const positions=[],normals=[],uv=[],wallUv=[],indices=[];
 for(const {mark,x,y,width,height} of entries){
  const {normal:n,position:p,rotation}=mark,c=Math.cos(rotation),s=Math.sin(rotation);
  const right={x:n.z,y:0,z:-n.x},offset=surfaceOffset(mark,currentFloor);
  const u0=x/size,u1=(x+width)/size,v0=1-(y+height)/atlasHeight,v1=1-y/atlasHeight,base=positions.length/3;
  for(const [dx,dy,u,v] of [[-.5,-.5,u0,v0],[.5,-.5,u1,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]]){
   const along=dx*mark.width*c-dy*mark.height*s,vertical=dx*mark.width*s+dy*mark.height*c;
   const px=p.x+n.x*offset+right.x*along,py=p.y+vertical,pz=p.z+n.z*offset+right.z*along;
   positions.push(px,py,pz);normals.push(n.x,0,n.z);uv.push(u,v);
   wallUv.push(((px-mark.face.centre.x)*right.x+(pz-mark.face.centre.z)*right.z+mark.face.length/2)/tileMeters,
    (py-mark.level*6.2-mark.face.roomY)/tileMeters);
  }
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('uv1',new THREE.Float32BufferAttribute(wallUv,2));
 geometry.setAttribute('wallUv',new THREE.Float32BufferAttribute(wallUv,2));
 geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
export function createTowerGraffiti(THREE,{brick,lowPower=false,planner=planExteriorGraffiti,keyFor=towerGraffitiKey,kind='exterior'}={}){
 let key='',marks=[],pages=[],pending=[],painted=0,paintSteps=0,totalPaintMs=0,maxPaintMs=0,slowest=null,errors=[],sourceNormal=null,sharedNormal=null;
 const updateNormal=()=>{
  if(!brick.normalMap||brick.normalMap===sourceNormal)return;
  sharedNormal?.dispose();sourceNormal=brick.normalMap;sharedNormal=sourceNormal.clone();sharedNormal.channel=1;sharedNormal.needsUpdate=true;
  for(const page of pages){page.material.normalMap=sharedNormal;page.material.normalScale.copy(brick.normalScale);page.material.needsUpdate=true;}
 };
 const dispose=()=>{for(const p of pages){p.texture.dispose();p.material.dispose();}pages=[];pending=[];};
 const prepare=floors=>{
  const next=keyFor(floors);if(next===key)return;
  dispose();key=next;marks=planner(floors);painted=0;paintSteps=0;totalPaintMs=0;maxPaintMs=0;slowest=null;errors=[];
  pages=planGraffitiAtlases(marks,{lowPower}).map(plan=>{
   const canvas=document.createElement('canvas');canvas.width=plan.size;canvas.height=plan.height;
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=lowPower?1:4;
   const material=new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true,alphaTest:.015,
    roughness:.96,metalness:0,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
   material.userData.galleryPersistent=true;texture.userData.galleryPersistent=true;
   const page={...plan,canvas,context:canvas.getContext('2d'),texture,material,shader:null,dirty:false};
   // Keep the wall relief and grain visible through the deposited paint.
   // This UV is measured in wall metres, independently of the paint atlas.
   material.onBeforeCompile=shader=>{
    shader.uniforms.graffitiBrick={value:brick.map};page.shader=shader;
    shader.vertexShader='attribute vec2 wallUv;\nvarying vec2 vGraffitiWallUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGraffitiWallUv=wallUv;');
    shader.fragmentShader='uniform sampler2D graffitiBrick;\nvarying vec2 vGraffitiWallUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat wallGrain=dot(texture2D(graffitiBrick,vGraffitiWallUv).rgb,vec3(.2126,.7152,.0722));\ndiffuseColor.a*=.72+.28*clamp(wallGrain*1.6,0.,1.);');
   };
   material.customProgramCacheKey=()=> 'tower-spray-brick-v1';
   for(const entry of page.entries){const parts=graffitiPaintParts(entry.mark.tag);parts.forEach((tag,index)=>pending.push({page,entry,tag,last:index===parts.length-1}));}
   return page;
  });
  // Existing loaded normal maps can be reused immediately after a cache reset.
  for(const page of pages)if(sharedNormal){page.material.normalMap=sharedNormal;page.material.normalScale.copy(brick.normalScale);page.material.needsUpdate=true;}
  updateNormal();
 };
 return {
  addTo(parent,floors,currentFloor){
   prepare(floors);const group=new THREE.Group();group.name='tower-'+kind+'-graffiti';
   for(const page of pages){
    const geometry=graffitiGeometry(THREE,page.entries,page.size,currentFloor,brick.userData.tileMeters||2,page.height);
    const mesh=new THREE.Mesh(geometry,page.material);mesh.name=kind+'-graffiti-atlas-'+page.page;mesh.renderOrder=-1;
    mesh.onBeforeRender=()=>{updateNormal();if(page.shader)page.shader.uniforms.graffitiBrick.value=brick.map;};group.add(mesh);
   }
   parent.add(group);return group;
  },
  paintNext(){
   const job=pending.shift();if(!job)return;
   const {page,entry}=job,{mark,x,y,width,height}=entry,start=performance.now(),g=page.context,b=mark.bounds;
   try{
    g.save();g.beginPath();g.rect(x-2,y-2,width+4,height+4);g.clip();g.translate(x,y);g.scale(width/b.width,height/b.height);g.translate(-b.x,-b.y);
    try{drawTag(g,job.tag,{finish:'spray'});}finally{g.restore();}
    page.dirty=true;if(job.last){painted++;mark.tag=null;}
   }catch(error){errors.push(mark.id+': '+error.message);console.warn(kind+' paint failed',error);}
   paintSteps++;const elapsed=performance.now()-start;totalPaintMs+=elapsed;if(elapsed>maxPaintMs){maxPaintMs=elapsed;slowest={text:mark.phrase,hand:mark.hand,form:mark.form};}
   // Limit texture uploads while still showing the ground-floor marks first.
   if(paintSteps<=2||paintSteps%8===0||!pending.length)for(const p of pages)if(p.dirty){p.texture.needsUpdate=true;p.dirty=false;}
  },
  get diagnostics(){return {marks:marks.length,painted,pending:pending.length,paintSteps,pages:pages.length,totalPaintMs:Math.round(totalPaintMs),maxPaintMs:Math.round(maxPaintMs),slowest,errors:[...errors]};},
  snapshot(currentFloor){return marks.map(({tag,bounds,...mark})=>({...mark,position:{x:mark.position.x+mark.normal.x*surfaceOffset(mark,currentFloor),y:mark.position.y,z:mark.position.z+mark.normal.z*surfaceOffset(mark,currentFloor)}}));},
  dispose(){dispose();sharedNormal?.dispose();sharedNormal=null;sourceNormal=null;key='';marks=[];}
 };
}
