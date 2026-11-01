// Defined once: shadow-surface scans may visit thousands of objects.
const validPhiShadowMaterial=m=>!!m&&(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial)&&(!m.transparent||m.alphaTest>0);
export function isPhiShadowSurface(object){
 if(!object.isMesh||object.isReflector||object.name==='phi-spiral-reflecting-water')return false;
 return Array.isArray(object.material)
  ?object.material.length>0&&object.material.every(validPhiShadowMaterial)
  :validPhiShadowMaterial(object.material);
}
export function staticPhiShadowCaster(mesh){
 if(!isPhiShadowSurface(mesh)||mesh.isSkinnedMesh)return false;
 for(let p=mesh;p;p=p.parent){
  if(p.isSkinnedMesh||/visitor|mannequin|Entrance_Left|Entrance_Right|lift.*(door|cabin)|moving/i.test(p.name||''))return false;
 }
 return true;
}
export function createPhiLightingStudy({THREE,renderer,scene,camera,sun}){
 const stats={enabled:true,shadowMaps:2,refreshes:0,casters:0,roomLight:null,luminaires:0,fillLights:4};
 if(new URLSearchParams(location.search).get('lighting')==='original')return {stats:{enabled:false},update(){},editionChanged(){}};
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 sun.castShadow=true;sun.shadow.autoUpdate=false;sun.shadow.mapSize.set(2048,2048);
 sun.shadow.bias=-.00008;sun.shadow.normalBias=.035;
 Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:.5,far:240});sun.shadow.camera.updateProjectionMatrix();
 const originalSun=sun.position.clone(),originalTarget=sun.target.position.clone();scene.add(sun.target);
 const shadow=new THREE.SpotLight().shadow;shadow.autoUpdate=false;shadow.mapSize.set(1024,1024);
 shadow.bias=-.00008;shadow.normalBias=.025;shadow.camera.near=.15;shadow.camera.far=14;
 const fillLights=Array.from({length:4},()=>{const light=new THREE.PointLight('#fff0d6',0,12,2);light.name='phi-pooled-room-fill';light.castShadow=false;scene.add(light);return light;});
 const viewer=new THREE.Vector3(),point=new THREE.Vector3();
 // Reuse fixed-size insertion buffers instead of allocating and sorting
 // every luminaire's world-position vector on each lighting update.
 const closestRoots=[null,null,null,null];
 const closestDistances=[Infinity,Infinity,Infinity,Infinity];
 let roomLights=[],luminaires=[],selected=null,previousShadow=null,lastScan=-Infinity,lastPick=-Infinity,signature=-1,force=true;
 function refresh(light){light.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;stats.refreshes++;}
 function update(now=performance.now()){
  if(force||now-lastScan>1500){
   lastScan=now;roomLights.length=0;luminaires.length=0;let nextSignature=0,casters=0;
   scene.traverse(mesh=>{
    if(mesh.isSpotLight&&mesh.name==='phi-shadow-room-light')roomLights.push(mesh);
    if(mesh.userData.phiRoomLuminaire)luminaires.push(mesh);
    if(!isPhiShadowSurface(mesh))return;
    if(!mesh.receiveShadow){
     mesh.receiveShadow=true;
     if(Array.isArray(mesh.material)){for(const material of mesh.material)material.needsUpdate=true;}
     else if(mesh.material)mesh.material.needsUpdate=true;
    }
    mesh.castShadow=staticPhiShadowCaster(mesh);
    if(mesh.castShadow){casters++;nextSignature=(Math.imul(nextSignature,31)+mesh.id+mesh.geometry.id)|0;}
   });
   if(force||nextSignature!==signature){refresh(sun);if(selected)refresh(selected);signature=nextSignature;}
   stats.casters=casters;stats.luminaires=luminaires.length;force=false;
  }
  if(now-lastPick<250)return;lastPick=now;camera.getWorldPosition(viewer);
  closestRoots.fill(null);closestDistances.fill(Infinity);
  for(const root of luminaires){
   const dist=root.getWorldPosition(point).distanceToSquared(viewer);
   for(let i=0;i<closestRoots.length;i++){
    if(dist>=closestDistances[i])continue;
    for(let j=closestRoots.length-1;j>i;j--){
     closestRoots[j]=closestRoots[j-1];closestDistances[j]=closestDistances[j-1];
    }
    closestRoots[i]=root;closestDistances[i]=dist;
    break;
   }
  }
  fillLights.forEach((light,i)=>{
   const root=closestRoots[i];
   if(!root){light.intensity=0;return;}
   light.position.copy(root.getWorldPosition(point));light.position.y-=.22;
   light.intensity=root.userData.phiRoomLuminaire.power/(i===0?1:1.61803398875);
   light.distance=root.userData.phiRoomLuminaire.distance;
  });
  let nearest=null,distance=Infinity;
  for(const light of roomLights){const d=light.getWorldPosition(point).distanceToSquared(viewer);if(d<distance&&light.intensity>0){distance=d;nearest=light;}}
  if(nearest!==selected){
   if(selected){selected.castShadow=false;selected.shadow=previousShadow;}
   selected=nearest;
   if(selected){previousShadow=selected.shadow;selected.shadow=shadow;selected.castShadow=true;refresh(selected);}
   stats.roomLight=selected?.id??null;
  }
 }
 function editionChanged(elevation){
  sun.position.copy(originalSun);sun.position.y+=elevation;
  sun.target.position.copy(originalTarget);sun.target.position.y+=elevation;
  sun.updateMatrixWorld();sun.target.updateMatrixWorld();force=true;lastPick=-Infinity;
 }
 window.__phiLightingStudy=stats;
 return {stats,update,editionChanged};
}
