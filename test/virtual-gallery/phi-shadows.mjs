// Staging only: reuse existing illumination and cache static shadow maps.
export function isPhiShadowSurface(object){
 if(!object.isMesh||object.isReflector||object.name==='phi-spiral-reflecting-water')return false;
 const materials=[].concat(object.material||[]);
 return materials.length>0&&materials.every(m=>(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial)&&(!m.transparent||m.alphaTest>0));
}

export function createPhiShadows({THREE,renderer,scene,camera,lowPower=false}){
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const stats={enabled:true,roomLights:0,mapRefreshes:0,casters:0,mapSize:lowPower?1024:2048};
 const configured=new WeakSet(),originalShadows=new WeakMap();
 const slots=Array.from({length:2},()=>({light:null,shadow:new THREE.SpotLight().shadow}));
 for(const slot of slots){
  slot.shadow.mapSize.set(lowPower?512:1024,lowPower?512:1024);
  slot.shadow.bias=-.00008;slot.shadow.normalBias=.025;
  slot.shadow.camera.near=.15;slot.shadow.camera.far=14;
 }
 let sun=null,sunPosition=null,sunTarget=null,elevation=0,lastScan=-Infinity,lastSignature='',force=true;
 const viewer=new THREE.Vector3(),position=new THREE.Vector3();
 function update(now=performance.now()){
  if(!force&&now-lastScan<250)return;
  lastScan=now;scene.updateMatrixWorld(true);camera.getWorldPosition(viewer);
  const roomLights=[];let signature='',casters=0;
  scene.traverse(o=>{
   if(o.isDirectionalLight&&!sun){
    sun=o;sun.castShadow=true;sun.shadow.mapSize.set(stats.mapSize,stats.mapSize);
    sunPosition=sun.position.clone();sunTarget=sun.target.position.clone();
    Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:.5,far:160});
    sun.shadow.bias=-.00008;sun.shadow.normalBias=.035;sun.shadow.camera.updateProjectionMatrix();
   }
   if(o.isSpotLight&&o.name==='phi-shadow-room-light')roomLights.push(o);
   if(!isPhiShadowSurface(o))return;
   if(!configured.has(o)){
    o.castShadow=true;o.receiveShadow=true;configured.add(o);
    // Receiving shadows changes the material program; warm before entry.
    for(const material of [].concat(o.material))material.needsUpdate=true;
   }
   casters++;
   const e=o.matrixWorld.elements;
   signature+=o.id+':'+(o.visible?1:0)+':'+e[12].toFixed(2)+','+e[13].toFixed(2)+','+e[14].toFixed(2)+';';
  });
  if(sun){
   // Translate both ends together: illumination direction stays unchanged as
   // the visitor changes floor, while its shadow camera follows that floor.
   sun.position.copy(sunPosition);sun.position.y+=elevation;
   sun.target.position.copy(sunTarget);sun.target.position.y+=elevation;
   sun.updateMatrixWorld();sun.target.updateMatrixWorld();
  }
  roomLights.sort((a,b)=>a.getWorldPosition(position).distanceToSquared(viewer)-b.getWorldPosition(position).distanceToSquared(viewer));
  for(let i=0;i<slots.length;i++){
   const slot=slots[i],next=roomLights[i]||null;
   if(slot.light!==next){
    if(slot.light){slot.light.castShadow=false;slot.light.shadow=originalShadows.get(slot.light);}
    if(next){originalShadows.set(next,next.shadow);next.shadow=slot.shadow;next.castShadow=true;}
    slot.light=next;force=true;
   }
  }
  // Camera movement within a room does not regenerate its shadow texture.
  // Deferred models and floor changes do; the two map slots survive lift rides.
  if(force||signature!==lastSignature){
   renderer.shadowMap.needsUpdate=true;stats.mapRefreshes++;lastSignature=signature;force=false;
  }
  stats.roomLights=slots.filter(s=>s.light).length;stats.casters=casters;
 }
 return {stats,update,editionChanged(nextElevation){elevation=nextElevation;force=true;},dispose(){
  for(const slot of slots){if(slot.light){slot.light.castShadow=false;slot.light.shadow=originalShadows.get(slot.light);}slot.shadow.dispose();}
  if(sun){sun.castShadow=false;sun.shadow.dispose();}renderer.shadowMap.enabled=false;
 }};
}
