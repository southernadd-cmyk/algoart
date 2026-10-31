import {loadPhiDecorAsset,fitPhiDecorAsset} from './phi-model-assets.mjs';
// Restore later by setting this flag true. Original models and placement logic remain intact.
export const PHI_EXTERIOR_PLANTING_ENABLED=false;
const PHI=(1+Math.sqrt(5))/2;
const PLANTER_DEPTH=1.6,PLANTER_WIDTH=PLANTER_DEPTH*PHI,SOIL_Y=.443;
export function planPhiOutdoorPlants(plaza){
 const placements=[];
 for(const side of [-1,1])for(const [row,along] of [-13,-4,5,14].entries()){
  const across=side*11.8;
  placements.push({id:side+':'+row,x:plaza.centre.x+plaza.outward.x*along+plaza.transverse.x*across,
   y:(plaza.level||0)-.08,z:plaza.centre.z+plaza.outward.z*along+plaza.transverse.z*across,
   height:2.4,yaw:Math.atan2(plaza.outward.x,plaza.outward.z),
   width:PLANTER_WIDTH,depth:PLANTER_DEPTH,kind:'plant',variant:row%2?'YellowPlantStem':'SmallPlantStem'});
 }
 return placements;
}
// Clear the original procedural groups at their former positions as well as the
// new rows. Otherwise moving an imported plant would leave its old backup behind.
function previousPlacements(plaza){
 const positions=[];
 for(const side of [-1,1])for(const [across,along] of [
  [side*(plaza.halfWidth-4.6),-13],[side*(plaza.halfWidth-4.6),12],
  [side*11.8,0],[side*11.8,15]
 ])positions.push({x:plaza.centre.x+plaza.outward.x*along+plaza.transverse.x*across,
  z:plaza.centre.z+plaza.outward.z*along+plaza.transverse.z*across});
 return positions;
}
function isOriginalPlant(mesh,p){
 if(!mesh.isMesh||Math.hypot(mesh.position.x-p.x,mesh.position.z-p.z)>1.2)return false;
 const g=mesh.geometry;
 return g?.type==='IcosahedronGeometry'||g?.type==='BoxGeometry'&&g.parameters.width===1.75&&g.parameters.height===.69&&g.parameters.depth===1.75;
}
// Select ONE complete stem and its leaves. Prefix matching previously retained
// several stems with the source scene's wide spacing, outside the planter.
function selectSourcePlant(model,prefix){
 const clone=model.clone(true),root=clone.getObjectByName('GLTF_SceneRootNode');
 if(root){
  const selected=root.children.find(child=>child.name.startsWith(prefix));
  if(!selected)throw new Error('Missing outdoor plant '+prefix);
  for(const child of [...root.children])if(child!==selected)root.remove(child);
 }
 return clone;
}
function fitPlant(THREE,model,height){
 const plant=fitPhiDecorAsset(THREE,model,height);
 const size=new THREE.Box3().setFromObject(plant).getSize(new THREE.Vector3());
 // Keep even the widest leaves inside the soil footprint; preserve proportions.
 const fit=Math.min(1,(PLANTER_WIDTH-.26)/Math.max(.001,size.x),(PLANTER_DEPTH-.26)/Math.max(.001,size.z));
 plant.scale.multiplyScalar(fit);plant.position.y=SOIL_Y;
 plant.name='phi-individual-source-plant';return plant;
}
export function addPhiOutdoorPlants(THREE,scene,plaza,landscapeRoots,{loadModel=()=>loadPhiDecorAsset(new URL('./models/plants-scene-gallery-optimized.glb',import.meta.url).href)}={}){
 // Disabled planting creates no meshes, collisions or model downloads.
 if(!PHI_EXTERIOR_PLANTING_ENABLED)return {holders:[],obstacles:[],ready:Promise.resolve([])};
 const placements=planPhiOutdoorPlants(plaza),holders=[],source=loadModel();
 const backups=new Set(),oldPositions=previousPlacements(plaza);
 for(const root of landscapeRoots)root.traverse(o=>{if([...placements,...oldPositions].some(p=>isOriginalPlant(o,p)))backups.add(o);});
 const jobs=placements.map(p=>{
  const holder=new THREE.Group();holder.name='phi-outdoor-source-plants-'+p.id;holder.position.set(p.x,p.y,p.z);holder.rotation.y=p.yaw;scene.add(holder);holders.push(holder);
  const stone=new THREE.MeshStandardMaterial({color:'#77766d',roughness:.91});
  const earth=new THREE.MeshStandardMaterial({color:'#39362e',roughness:1});
  const planter=new THREE.Mesh(new THREE.BoxGeometry(PLANTER_WIDTH,.43,PLANTER_DEPTH),stone);
  planter.name='phi-golden-rectangle-planter';planter.position.y=.215;holder.add(planter);
  const soil=new THREE.Mesh(new THREE.BoxGeometry(PLANTER_WIDTH-.13,.026,PLANTER_DEPTH-.13),earth);
  soil.name='phi-planter-soil';soil.position.y=SOIL_Y;holder.add(soil);
  holder.userData.fallbackCount=[...backups].filter(o=>isOriginalPlant(o,p)).length;
  return source.then(model=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   holder.add(fitPlant(THREE,selectSourcePlant(model,p.variant),p.height));
   for(const backup of backups)backup.visible=false;
   holder.userData.modelLoaded=true;holder.userData.replaced=holder.userData.fallbackCount;
  }).catch(error=>console.warn('Outdoor source plants fallback',error));
 });
 return {holders,obstacles:placements,ready:Promise.all(jobs)};
}
