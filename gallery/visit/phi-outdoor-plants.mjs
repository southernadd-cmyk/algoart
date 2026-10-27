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
// Staging-only botanical accents made from small shared meshes; no external assets.
function addBotanicalAccents(THREE,holder,variant){
 const greens=['#47684b','#71865e','#3e645b'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
 const petals=['#d8aa83','#c9b0c9','#dfd49c'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
 const stemMat=new THREE.MeshStandardMaterial({color:'#536b49',roughness:1});
 const leafGeo=new THREE.SphereGeometry(1,7,5),flowerGeo=new THREE.SphereGeometry(1,6,4);
 const stemGeo=new THREE.CylinderGeometry(.014,.026,1,5);
 const group=new THREE.Group();group.name='staging-flowering-foliage';holder.add(group);
 for(let i=0;i<5;i++){
  const angle=i*2.39996+variant*1.3,r=.16+.19*Math.sqrt(i);
  const h=(i%2===0?1.65:2.35)+(variant%2)*.22;
  const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
  const stem=new THREE.Mesh(stemGeo,stemMat);stem.scale.y=h;
  stem.position.set(x,h/2,z);stem.rotation.z=Math.sin(angle)*.13;group.add(stem);
  for(let j=0;j<4;j++){
   const a=angle+j*2.25,leaf=new THREE.Mesh(leafGeo,greens[(i+j+variant)%3]);
   const y=.24+j*h*.18;
   leaf.position.set(x+Math.cos(a)*.19,y,z+Math.sin(a)*.19);
   leaf.scale.set(.10,.29+(j%2)*.065,.075);
   leaf.rotation.z=-Math.cos(a)*.55;group.add(leaf);
  }
  if(i%2===variant%2){
   for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5,petal=new THREE.Mesh(flowerGeo,petals[(i+variant)%3]);
    petal.position.set(x+Math.cos(a)*.085,h+.035,z+Math.sin(a)*.085);
    petal.scale.set(.075,.045,.07);group.add(petal);
   }
  }
 }
 group.position.set(variant%2?.36:-.32,.56,variant%2?-.18:.24);
 return group;
}
export function addPhiOutdoorPlants(THREE,scene,plaza,landscapeRoots,{loadModel=()=>loadPhiDecorAsset(new URL('./models/succulent-planter.glb',import.meta.url).href)}={}){
 const placements=planPhiOutdoorPlants(plaza),holders=[],source=loadModel();
 const jobs=placements.map(p=>{
  const backups=[];for(const root of landscapeRoots)root.traverse(o=>{if(isOriginalPlant(o,p))backups.push(o);});
  const holder=new THREE.Group();holder.name='phi-outdoor-succulent-'+p.id;holder.position.set(p.x,p.y,p.z);holder.rotation.y=p.yaw;scene.add(holder);holders.push(holder);
  holder.userData.fallbackCount=backups.length;
  // Render the tall planting immediately, even when the GLB is still loading.
  if(globalThis.__phiReceptionTestRefresh)addBotanicalAccents(THREE,holder,placements.indexOf(p));
  return source.then(model=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   if(globalThis.__phiReceptionTestRefresh){
    // Group the uploaded succulent planter in staggered sizes so the four
    // civic beds do not read as four identical repeated assets.
    for(let i=0;i<3;i++){
     const plant=fitPhiDecorAsset(THREE,model.clone(true),p.height*[.94,.68,.57][i]);
     plant.position.set([0,-.54,.55][i],0,[0,.34,.22][i]);
     plant.rotation.y=[0,1.7,-1.1][i]+(p.x+p.z)*.07;
     holder.add(plant);
    }
   }else holder.add(fitPhiDecorAsset(THREE,model.clone(true),p.height));
   for(const backup of backups)backup.visible=false;
   holder.userData.modelLoaded=true;holder.userData.replaced=backups.length;
  }).catch(error=>console.warn('Outdoor succulent fallback',error));
 });
 return {holders,obstacles:placements,ready:Promise.all(jobs)};
}
