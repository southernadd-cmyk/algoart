import {loadPhiDecorAsset,fitPhiDecorAsset} from './phi-model-assets.mjs';
export function planPhiOutdoorPlants(plaza){
 const placements=[];
 for(const side of [-1,1])for(const along of [-13,12]){
  const across=side*(plaza.halfWidth-4.6);
  placements.push({id:side+':'+along,x:plaza.centre.x+plaza.outward.x*along+plaza.transverse.x*across,
   y:(plaza.level||0)-.08,z:plaza.centre.z+plaza.outward.z*along+plaza.transverse.z*across,
   height:1.3,yaw:Math.atan2(plaza.outward.x,plaza.outward.z)+side*.3,width:1.4,depth:1.4,kind:'plant'});
 }
 return placements;
}
function isOriginalPlant(mesh,p){
 if(!mesh.isMesh||Math.hypot(mesh.position.x-p.x,mesh.position.z-p.z)>1.2)return false;
 const g=mesh.geometry;
 return g?.type==='IcosahedronGeometry'||g?.type==='BoxGeometry'&&g.parameters.width===1.75&&g.parameters.height===.69&&g.parameters.depth===1.75;
}
export function addPhiOutdoorPlants(THREE,scene,plaza,landscapeRoots,{loadModel=()=>loadPhiDecorAsset(new URL('./models/succulent-planter.glb',import.meta.url).href)}={}){
 const placements=planPhiOutdoorPlants(plaza),holders=[],source=loadModel();
 const jobs=placements.map(p=>{
  const backups=[];for(const root of landscapeRoots)root.traverse(o=>{if(isOriginalPlant(o,p))backups.push(o);});
  const holder=new THREE.Group();holder.name='phi-outdoor-succulent-'+p.id;holder.position.set(p.x,p.y,p.z);holder.rotation.y=p.yaw;scene.add(holder);holders.push(holder);
  holder.userData.fallbackCount=backups.length;
  return source.then(model=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   holder.add(fitPhiDecorAsset(THREE,model.clone(true),p.height));
   for(const backup of backups)backup.visible=false;
   holder.userData.modelLoaded=true;holder.userData.replaced=backups.length;
  }).catch(error=>console.warn('Outdoor succulent fallback',error));
 });
 return {holders,obstacles:placements,ready:Promise.all(jobs)};
}
