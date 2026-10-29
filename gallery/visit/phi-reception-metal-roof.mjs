import {tiledBoxUvs} from './architectural-materials.mjs?v=ambientcg-ceiling-20261022';
import {loadPhiDecorAsset} from './phi-model-assets.mjs';
// HB old house part 4 — Orphan RTG, CC BY 4.0. The original scanned
// roof slope is trimmed above its wall and reused on both sides of the ridge.
const roofURL=new URL('./models/reception-old-house-roof.glb',import.meta.url).href;
export function addPhiReceptionMetalRoof(THREE,scene,{bounds,elevation,ceilingHeight=5.2,brick}){
 if(!bounds)return null;
 const {minX,maxX,minZ,maxZ}=bounds,width=maxX-minX,depth=maxZ-minZ;
 if(!(width>3&&depth>3))return null;
 const roofW=width+1.9,roofD=depth+2.25,rise=2.8,eave=.72;
 const group=new THREE.Group();group.name='phi-exterior-reception-old-house-roof';
 group.position.set((minX+maxX)/2,elevation+ceilingHeight,(minZ+maxZ)/2-.425);
 group.userData.attribution='HB old house part 4 · Orphan RTG · CC BY 4.0';
 scene.add(group);
 // Brick gables follow the roof pitch and sit directly on the existing
 // end walls. World-scaled UVs keep their courses the same size as reception.
 const masonry=brick||new THREE.MeshStandardMaterial({color:'#383938',roughness:.94});
 const wallEave=eave+rise*(1-width/roofW),wallDepth=.265;
 const gable=new THREE.Shape();gable.moveTo(-width/2,0);gable.lineTo(width/2,0);
 gable.lineTo(width/2,wallEave);gable.lineTo(0,eave+rise-.04);gable.lineTo(-width/2,wallEave);gable.closePath();
 const gableGeo=new THREE.ExtrudeGeometry(gable,{depth:wallDepth,bevelEnabled:false});
 const pos=gableGeo.attributes.position,uv=gableGeo.attributes.uv,tile=masonry.userData.tileMeters||1.05;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+group.position.x)/tile,(pos.getY(i)+group.position.y)/tile);
 for(const side of [-1,1]){
  const face=new THREE.Mesh(gableGeo,masonry);face.position.z=side*depth/2+.425-wallDepth/2;
  face.name='old-house-roof-brick-gable';face.receiveShadow=true;group.add(face);
  const geo=tiledBoxUvs(new THREE.BoxGeometry(wallDepth,wallEave,depth),wallDepth,wallEave,depth,tile);
  const band=new THREE.Mesh(geo,masonry);
  band.position.set(side*width/2,wallEave/2,.425);band.name='old-house-roof-brick-eaves';band.receiveShadow=true;group.add(band);
 }
 // A narrow ridge cap closes the irregular cut edge between the two scans.
 const capMaterial=new THREE.MeshStandardMaterial({color:'#868982',roughness:.9,side:THREE.DoubleSide});
 for(const side of [-1,1]){
  const cap=new THREE.Mesh(new THREE.PlaneGeometry(.72,roofD),capMaterial);
  cap.rotation.set(-Math.PI/2,side*Math.atan2(rise,roofW/2),0);
  cap.position.set(side*.30,eave+rise-.015,0);cap.name='old-house-roof-ridge-cap';group.add(cap);
 }
 loadPhiDecorAsset(roofURL).then(source=>{
  if(!group.parent||group.userData.galleryDisposed)return;
  const box=new THREE.Box3().setFromObject(source),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
  for(const side of [-1,1]){
   const slope=new THREE.Group(),model=source.clone(true),fit=new THREE.Group();
   model.position.add(new THREE.Vector3(-centre.x,-box.min.y,-centre.z));fit.add(model);
   fit.scale.set(roofD/size.x,rise/size.y,(roofW/2+.08)/size.z);
   slope.add(fit);slope.rotation.y=side*Math.PI/2;
   slope.position.set(side*roofW/4,eave,0);slope.name='orphan-rtg-scanned-roof-slope';
   slope.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});group.add(slope);
  }
  group.userData.modelLoaded=true;
 }).catch(error=>{group.userData.loadError=String(error);console.warn('Reception roof unavailable',error);});
 return group;
}
