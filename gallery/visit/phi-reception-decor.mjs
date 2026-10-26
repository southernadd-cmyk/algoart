// Optional shared CC-BY props for the experimental reception. Loading never
// blocks the floor planner or lift. Credits are installed separately below.
const assets=new Map();
async function asset(url){
 if(!assets.has(url))assets.set(url,import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().loadAsync(url)).then(gltf=>{
  gltf.scene.traverse(o=>{if(o.geometry)o.geometry.userData.galleryPersistent=true;
   for(const m of [].concat(o.material||[])){m.userData.galleryPersistent=true;for(const v of Object.values(m))if(v?.isTexture)v.userData.galleryPersistent=true;}
  });return gltf.scene;
 }));
 return assets.get(url);
}
const modelURL=name=>new URL('../../test/virtual-gallery/models/'+name,import.meta.url).href;
function fit(THREE,model,height){
 const group=new THREE.Group();group.add(model);group.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 const scale=height/Math.max(.001,size.y);model.position.add(new THREE.Vector3(-centre.x,-box.min.y,-centre.z));group.scale.setScalar(scale);return group;
}
export function addPhiReceptionDecor(THREE,scene,furnishing,elevation){
 const holders=[];
 for(const [i,p] of furnishing.plants.entries()){
  const holder=new THREE.Group();holder.name='phi-pothos-'+i;holder.position.set(p.x,elevation,p.z);scene.add(holder);holders.push(holder);
  const pot=new THREE.Mesh(new THREE.BoxGeometry(.42,.55,.42),new THREE.MeshStandardMaterial({color:'#8a8070',roughness:.85}));pot.position.y=.275;holder.add(pot);
  const green=new THREE.Mesh(new THREE.IcosahedronGeometry(.4,1),new THREE.MeshStandardMaterial({color:'#54704b',roughness:.9}));green.position.y=.92;holder.add(green);
  asset(modelURL('pothos-plant.glb')).then(source=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   pot.visible=green.visible=false;
   const model=source.clone(true);
   model.traverse(o=>{if(o.isMesh&&o.material?.alphaMode!=='OPAQUE'&&o.material?.transparent){o.material.alphaTest=.35;o.material.transparent=false;o.material.depthWrite=true;}});
   holder.add(fit(THREE,model,1.45));holder.userData.modelLoaded=true;
  }).catch(error=>console.warn('Reception plant fallback',error));
 }
 if(furnishing.desk){
  const d=furnishing.desk,holder=new THREE.Group();holder.name='phi-reception-boxes';holder.position.set(d.x+1.7,elevation,d.z+1.35);scene.add(holder);holders.push(holder);
  asset(modelURL('cardboard-boxes.glb')).then(source=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   source.updateMatrixWorld(true);let first;source.traverse(o=>{if(!first&&o.isMesh)first=o;});
   if(!first)return;
   for(const [x,y,z,angle] of [[0,0,0,.12],[.06,.31,-.04,-.08]]){
    const mesh=first.clone();first.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);const model=fit(THREE,mesh,.31);model.position.set(x,y,z);model.rotation.y=angle;holder.add(model);
   }
   holder.userData.modelLoaded=true;
  }).catch(error=>console.warn('Reception boxes unavailable',error));
 }
 return holders;
}
export function createPhiGothicEntrance(THREE,{doorway,outward,level}){
 const root=new THREE.Group();root.name='phi-gothic-main-entrance';root.position.set(doorway.x,level,doorway.z);root.rotation.y=Math.atan2(outward.x,outward.z);
 const width=2.147,hinges=[new THREE.Group(),new THREE.Group()];
 const fallbackMaterial=new THREE.MeshStandardMaterial({color:'#514132',roughness:.85});
 const fallback=[];
 hinges.forEach((hinge,i)=>{hinge.position.x=(i?1:-1)*width/2;root.add(hinge);
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(width/2-.04,3.8,.09),fallbackMaterial);leaf.position.set((i?-1:1)*width/4,1.9,0);hinge.add(leaf);fallback.push(leaf);
 });
 asset(modelURL('gothic-entrance-door.glb')).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=source.clone(true);
  const fixed=model.getObjectByName('Entrance_Frame'),left=model.getObjectByName('Entrance_Left'),right=model.getObjectByName('Entrance_Right');
  if(!fixed||!left||!right)return;
  root.add(fixed);
  [left,right].forEach((leaf,i)=>{leaf.position.x-=hinges[i].position.x;hinges[i].add(leaf);fallback[i].visible=false;});
  root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Main entrance door fallback',error));
 let openness=0;
 return {root,update(dt,visitor){
  if(!root.parent)return;root.updateWorldMatrix(true,false);
  const local=root.worldToLocal(new THREE.Vector3(visitor.x,visitor.y,visitor.z));
  const target=Math.abs(local.z)<3.5&&Math.abs(local.x)<2?1:0;
  openness+=(target-openness)*Math.min(1,dt*3.2);
  hinges[0].rotation.y=-openness*1.64;hinges[1].rotation.y=openness*1.64;
  root.userData.openness=openness;
 }};
}

export const RECEPTION_CREDITS=[
 {title:'The gallery',lines:['PROPORTION PIECE','Daily generative art and architecture','','Built with Three.js','Three.js authors · MIT licence','','Visitors: Quaternius · CC0','Bench and lamps: Poly Haven · CC0']},
 {title:'Reception models',lines:['Door — Maria Stashko','Pothos plant — AllQuad','Cardboard boxes —','NotAnotherApocalypticCo.','','All three models: CC BY 4.0','Textures compressed for the web.','Door frame and leaves separated.']},
 {title:'Materials and fittings',lines:['Architectural textures — Poly Haven','Plaster, brick, timber and concrete','CC0','','OfficeCeiling001 — ambientCG · CC0','Twin Surface Spotlight — Innerscene','CC0','','Full sources and licences online.']}
];
export function addPhiReceptionCredits(THREE,scene,placement,elevation){
 const exhibits=[];if(!placement)return exhibits;
 for(const [i,credit] of RECEPTION_CREDITS.entries()){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=880;const g=canvas.getContext('2d');
  g.fillStyle='#eee9dc';g.fillRect(0,0,640,880);g.fillStyle='#344638';g.font='42px "AlgoArt Marker", Georgia';g.fillText(credit.title,40,88,560);
  g.strokeStyle='#b7b4a2';g.beginPath();g.moveTo(40,120);g.lineTo(600,120);g.stroke();g.font='25px Georgia';credit.lines.forEach((line,n)=>g.fillText(line,40,185+n*58,560));
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const group=new THREE.Group();group.name='phi-reception-credit-'+i;const width=.68,height=.94;
  group.position.set(placement.x+(placement.axis==='z'?(i-1)*.83:0),elevation+1.65,placement.z+(placement.axis==='x'?(i-1)*.83:0));
  group.rotation.y=placement.axis==='x'?(placement.normal.x>0?Math.PI/2:-Math.PI/2):(placement.normal.z>0?0:Math.PI);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(width+.06,height+.06,.045),new THREE.MeshStandardMaterial({color:'#3d493b',roughness:.78})));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}));face.position.z=.026;group.add(face);scene.add(group);
  exhibits.push({study:{title:credit.title,credits:credit.lines.join('\n'),image:canvas.toDataURL(),href:new URL('../../test/virtual-gallery/credits.html',import.meta.url).href},position:group.position.clone(),normal:new THREE.Vector3(placement.normal.x,0,placement.normal.z)});
 }
 return exhibits;
}
