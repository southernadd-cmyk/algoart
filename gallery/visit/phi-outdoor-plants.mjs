import {loadPhiDecorAsset,fitPhiDecorAsset} from './phi-model-assets.mjs';
export function planPhiOutdoorPlants(plaza){
 const placements=[];
 for(const side of [-1,1])for(const along of [-13,12]){
  const across=side*(plaza.halfWidth-4.6);
  placements.push({id:side+':'+along,x:plaza.centre.x+plaza.outward.x*along+plaza.transverse.x*across,
   y:(plaza.level||0)-.08,z:plaza.centre.z+plaza.outward.z*along+plaza.transverse.z*across,
   height:1.3,yaw:Math.atan2(plaza.outward.x,plaza.outward.z)+side*.3,width:1.4,depth:1.4,kind:'plant'});
 }
 // Add larger botanical clusters along both sides of the approach on live and test.
 {
  for(const side of [-1,1])for(const along of [0,15]){
   const across=side*11.8;
   placements.push({id:'flower-border-'+side+':'+along,
    x:plaza.centre.x+plaza.outward.x*along+plaza.transverse.x*across,
    y:(plaza.level||0)-.08,
    z:plaza.centre.z+plaza.outward.z*along+plaza.transverse.z*across,
    height:1.35,yaw:Math.atan2(plaza.outward.x,plaza.outward.z),
    width:1.4,depth:1.4,kind:'plant'});
  }
 }
 return placements;
}
function isOriginalPlant(mesh,p){
 if(!mesh.isMesh||Math.hypot(mesh.position.x-p.x,mesh.position.z-p.z)>1.2)return false;
 const g=mesh.geometry;
 return g?.type==='IcosahedronGeometry'||g?.type==='BoxGeometry'&&g.parameters.width===1.75&&g.parameters.height===.69&&g.parameters.depth===1.75;
}
// Reuse real plants from Nicholas-3D's CC BY 4.0 Plants Scene Free! model.
// Each copy contains only a source plant/rock/grass group, sharing geometries and textures.
function selectSourceGroup(model,prefix){
 const clone=model.clone(true),root=clone.getObjectByName('GLTF_SceneRootNode');
 if(root){for(const child of [...root.children])if(!child.name.startsWith(prefix))root.remove(child);}
 return clone;
}
export function addPhiOutdoorPlants(THREE,scene,plaza,landscapeRoots,{loadModel=()=>loadPhiDecorAsset(new URL('./models/plants-scene-gallery-optimized.glb',import.meta.url).href)}={}){
 const placements=planPhiOutdoorPlants(plaza),holders=[],source=loadModel();
 const jobs=placements.map(p=>{
  const backups=[];for(const root of landscapeRoots)root.traverse(o=>{if(isOriginalPlant(o,p))backups.push(o);});
  const holder=new THREE.Group();holder.name='phi-outdoor-source-plants-'+p.id;holder.position.set(p.x,p.y,p.z);holder.rotation.y=p.yaw;scene.add(holder);holders.push(holder);
  holder.userData.fallbackCount=backups.length;
  return source.then(model=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   const sourceRoot=model.getObjectByName('GLTF_SceneRootNode');
   if(!sourceRoot){holder.add(fitPhiDecorAsset(THREE,model.clone(true),p.height));}
   else{
    const variants=['SmallPlantStem','YellowPlantStem','SmallPlantStem'];
    for(let i=0;i<variants.length;i++){
     const plant=fitPhiDecorAsset(THREE,selectSourceGroup(model,variants[i]),p.height*[1.85,1.5,1.25][i]);
     plant.position.set([0,-.48,.49][i],.51,[0,.32,.22][i]);
     plant.rotation.y=[0,1.7,-1.1][i]+(p.x+p.z)*.07;
     holder.add(plant);
    }
    const rocks=fitPhiDecorAsset(THREE,selectSourceGroup(model,'Rock.'),.42);
    rocks.position.set(.3,.35,-.35);holder.add(rocks);
    const grass=fitPhiDecorAsset(THREE,selectSourceGroup(model,'Grass_'),.52);
    grass.position.set(-.37,.35,.15);holder.add(grass);
   }
   for(const backup of backups)backup.visible=false;
   holder.userData.modelLoaded=true;holder.userData.replaced=backups.length;
  }).catch(error=>console.warn('Outdoor source plants fallback',error));
 });
 return {holders,obstacles:placements,ready:Promise.all(jobs)};
}
