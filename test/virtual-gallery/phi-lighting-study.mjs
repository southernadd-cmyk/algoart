import {isPhiShadowSurface} from './phi-shadows.mjs';
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
 let roomLights=[],luminaires=[],selected=null,previousShadow=null,lastScan=-Infinity,lastPick=-Infinity,signature=-1,force=true;
 function refresh(light){light.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;stats.refreshes++;}
 function update(now=performance.now()){
  if(force||now-lastScan>1500){
   lastScan=now;roomLights=[];luminaires=[];let nextSignature=0,casters=0;
   scene.traverse(mesh=>{
    if(mesh.isSpotLight&&mesh.name==='phi-shadow-room-light')roomLights.push(mesh);
    if(mesh.userData.phiRoomLuminaire)luminaires.push(mesh);
    if(!isPhiShadowSurface(mesh))return;
    if(!mesh.receiveShadow){mesh.receiveShadow=true;for(const material of [].concat(mesh.material))material.needsUpdate=true;}
    mesh.castShadow=staticPhiShadowCaster(mesh);
    if(mesh.castShadow){casters++;nextSignature=(Math.imul(nextSignature,31)+mesh.id+mesh.geometry.id)|0;}
   });
   if(force||nextSignature!==signature){refresh(sun);if(selected)refresh(selected);signature=nextSignature;}
   stats.casters=casters;stats.luminaires=luminaires.length;force=false;
  }
  if(now-lastPick<250)return;lastPick=now;camera.getWorldPosition(viewer);
  const ranked=luminaires.map(root=>({root,position:root.getWorldPosition(new THREE.Vector3())})).sort((a,b)=>a.position.distanceToSquared(viewer)-b.position.distanceToSquared(viewer));
  fillLights.forEach((light,i)=>{const entry=ranked[i];if(!entry){light.intensity=0;return;}
   light.position.copy(entry.position);light.position.y-=.22;
   light.intensity=entry.root.userData.phiRoomLuminaire.power/(i===0?1:1.61803398875);
   light.distance=entry.root.userData.phiRoomLuminaire.distance;
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
