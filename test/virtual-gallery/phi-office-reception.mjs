import {loadPhiDecorAsset} from './phi-model-assets.mjs';
const url=new URL('./models/modern-reception-fittings.glb',import.meta.url).href;
const load=()=>loadPhiDecorAsset(url);
function fitted(THREE,source,name,{width,height,depth}={}){
 const original=source.getObjectByName(name);if(!original)throw new Error('Missing office fitting '+name);
 const mesh=original.clone(),box=new THREE.Box3().setFromObject(mesh),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 mesh.position.add(new THREE.Vector3(-centre.x,-box.min.y,-centre.z));
 const holder=new THREE.Group();holder.add(mesh);
 const uniform=height?height/size.y:1;
 holder.scale.set(width?width/size.x:uniform,uniform,depth?depth/size.z:uniform);
 return holder;
}
export function addPhiOfficeChair(THREE,desk){
 const holder=new THREE.Group();holder.name='phi-reception-staff-chair';holder.position.set(-.55,0,1.65);desk.add(holder);
 load().then(source=>{
  if(!desk.parent||desk.userData.galleryDisposed)return;
  holder.add(fitted(THREE,source,'ReceptionTaskChair',{height:1.12}));holder.userData.modelLoaded=true;
 }).catch(error=>console.warn('Reception staff chair unavailable',error));return holder;
}
export function replacePhiPreparationTable(THREE,parent,fallback,width=1.85){
 load().then(source=>{
  if(!parent.parent||parent.userData.galleryDisposed)return;
  const model=fitted(THREE,source,'PreparationTable',{width,height:.86,depth:.66});model.name='phi-office-preparation-table';
  model.position.copy(fallback.position);parent.add(model);fallback.visible=false;
 }).catch(error=>console.warn('Reception preparation table fallback',error));
}
export function addPhiOfficeFrontage(THREE,root,oldFixtures){
 const holders=[];
 for(const side of [-1,1]){
  const holder=new THREE.Group();holder.name='phi-gallery-wall-light';holder.position.set(side*1.94,1.97,.25);root.add(holder);holders.push(holder);
 }
 load().then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  for(const holder of holders){
   // Both authored lamp parts share one origin; preserve their alignment.
   const housing=source.getObjectByName('WallLightHousing').clone();
   const glow=source.getObjectByName('WallLightGlow').clone();
   const model=new THREE.Group();model.add(housing,glow);model.scale.setScalar(.72/.63575059);holder.add(model);holder.userData.modelLoaded=true;
  }
  for(const fixture of oldFixtures)fixture.visible=false;
 }).catch(error=>console.warn('Gallery entrance light fallback',error));
 // A visitor-facing information plaque, clear of the retained arched door.
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;const g=canvas.getContext('2d');
 g.fillStyle='#e8e4d9';g.fillRect(0,0,768,512);g.fillStyle='#34433c';
 g.font='78px "AlgoArt Marker", Georgia';g.fillText('gallery reception',48,115,670);
 g.font='40px Georgia';g.fillText('Daily generative art',48,238,670);g.fillText('Exhibitions and archive lift',48,310,670);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.75),new THREE.MeshStandardMaterial({map:texture,roughness:.9}));
 plaque.name='phi-gallery-entrance-information';plaque.position.set(-3.05,1.72,.19);root.add(plaque);
 return holders;
}
