import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {PHOTO_ASSETS} from './photoreal-materials.mjs';

// Artwork, sculptures, source screens and holograms remain outside the finish pass.
export function protectedExhibit(object){
 for(let p=object;p;p=p.parent){
  if(p.userData?.phiArtOriginal||p.userData?.study||p.userData?.permanentPlazaSculpture||
   /Traced material sculpture|phi-reception-growth-systems|hologram|living-monitors|monitor-bank|rear-wall-monitors/i.test(p.name||''))return true;
 }
 return false;
}
export const PHOTO_FX=Object.freeze({brightness:0,contrast:0,saturation:0,
 bloomIntensity:.18,bloomThreshold:1.1,bloomRadius:.22,aoIntensity:.75,aoRadius:.16,
 vignette:.10,vignetteOffset:.5,grain:0,bokeh:0,glowMode:'installations',dofMode:'off',aoSamples:8});

export function photorealBox(w,h,d){
 const geometry=new RoundedBoxGeometry(w,h,d,1,Math.min(.012,Math.min(w,h,d)*.12));
 geometry.userData.photorealRounded=true;return geometry;
}

export function installPhotorealComparison(enabled){
 const panel=document.getElementById('phi-post-fx');if(!panel)return;
 panel.open=false;
 const label=document.createElement('label');label.style.cssText='display:grid;gap:6px;padding:10px 12px;font-weight:600';
 label.textContent='Environment';
 const select=document.createElement('select');select.setAttribute('aria-label','Test tower environment');
 select.style.cssText='padding:8px;background:white;color:#243943;border:1px solid #697a79';
 for(const [value,text] of [['photoreal','Photoreal environment'],['original','Architectural baseline']]){
  const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
 }
 select.value=enabled?'photoreal':'original';
 select.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('environment',select.value);location.href=url.href;});
 label.append(select);panel.querySelector('summary').after(label);
}

export function createPhotorealEnvironment({THREE,renderer,scene,finishes,postFX}){
 const stats=window.__phiPhotoreal={enabled:true,materials:0,protectedMeshes:0,environment:'preparing',errors:[]};
 for(const object of scene.children)if(object.isHemisphereLight)object.intensity*=.65;
 // Environment maps are assigned per physical material. Setting scene.environment
 // would also relight the sculptures, which are explicitly outside this experiment.
 const generator=new THREE.PMREMGenerator(renderer);
 const room=new RoomEnvironment();
 const interiorTarget=generator.fromScene(room,.04);room.dispose();
 const interior=interiorTarget.texture;interior.userData.galleryPersistent=true;
 let outdoor=null,panorama=null,lastScan=-Infinity;
 const processed=new WeakSet();
 const physical=m=>m&&(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial);
 const bank=new Set([finishes.wall,finishes.floor,finishes.stone,finishes.stoneBridge,finishes.ceiling,...finishes.timberVariants,finishes.exteriorBrick]);
 const finish=(m)=>{
  if(!physical(m)||m.userData.photorealProtected||processed.has(m))return;
  // A fixed map avoids lifting and rotating the entire environment each frame.
  m.envMap=m===finishes.exteriorBrick&&outdoor?outdoor:interior;
  m.envMapIntensity=m===finishes.exteriorBrick?.7:.48;
  m.needsUpdate=true;processed.add(m);stats.materials++;
 };
 bank.forEach(finish);
 if(postFX){Object.assign(postFX.settings.architectural,PHOTO_FX);postFX.setPreset('architectural');}
 const panel=document.getElementById('phi-post-fx');if(panel)panel.open=false;
 // The original photograph is reused for the skyline and exterior reflections.
 // There are no runtime HDR downloads, per-frame cube captures or path tracing.
 new THREE.TextureLoader().load('./assets/day-environment-hdri-101-2k.jpg',raw=>{
  try{
   raw.colorSpace=THREE.SRGBColorSpace;raw.mapping=THREE.EquirectangularReflectionMapping;
   panorama=raw;const target=generator.fromEquirectangular(raw);outdoor=target.texture;
   outdoor.userData.galleryPersistent=true;stats.environment='photographic panorama + interior reflection probe';
   finishes.exteriorBrick.envMap=outdoor;finishes.exteriorBrick.needsUpdate=true;
   generator.dispose();lastScan=-Infinity;
  }catch(error){stats.errors.push(String(error));generator.dispose();}
 },undefined,error=>{stats.errors.push(String(error));generator.dispose();});
 // Existing props are upgraded once as they arrive, including deferred GLBs.
 // Scan at most once per 1.5s, matching the existing static-shadow refresh cadence.
 function update(now=performance.now()){
  if(now-lastScan<1500)return;lastScan=now;
  let protectedCount=0;
  scene.traverse(object=>{
   if(!object.isMesh)return;
   if(protectedExhibit(object)){protectedCount++;return;}
   if(object.name==='procedural-city-backdrop'){object.visible=false;return;}
   const materials=[].concat(object.material||[]);
   for(const m of materials)finish(m);
  });
  stats.protectedMeshes=protectedCount;
  if(panorama){
   scene.background=panorama;scene.backgroundBlurriness=.025;scene.backgroundIntensity=1;
   // The enclosing gradient sky would otherwise cover the photograph.
   for(const object of scene.children){
    if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters?.radius===178)object.visible=false;
   }
  }
 }
 return {stats,update,prepare(){lastScan=-Infinity;update();},editionChanged(){lastScan=-Infinity;update();}};
}

export function refinePhotorealGlass(material){
 // Fresnel reflections come from the reflection probe; avoid an extra full
 // scene transmission pass for every glazed walkway and elevator pane.
 material.color.set('#eef5f2');material.roughness=.075;material.metalness=.0;
 material.opacity=.18;material.depthWrite=false;material.needsUpdate=true;
}

// Scanned civic paving replaces the generated texture in the exterior module.
export function photographicPaving(THREE,material,repeatX,repeatY,lowPower=false){
 const loader=new THREE.TextureLoader();
 for(const [slot,suffix] of [['map','color'],['normalMap','normal'],['roughnessMap','roughness']]){
  const map=loader.load(PHOTO_ASSETS+'concrete_floor-'+suffix+'.webp');
  if(slot==='map')map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeatX,repeatY);map.anisotropy=lowPower?2:8;
  map.userData.galleryPersistent=true;material[slot]=map;
 }
 material.color.set('#ffffff');material.roughness=.82;
 material.normalScale.set(.34,.34);material.needsUpdate=true;
}
