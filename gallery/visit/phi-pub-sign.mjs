import {loadPhiDecorAsset} from './phi-model-assets.mjs';
// Pub Sign by johhny3D, CC BY 4.0. Original bracket, chains and board;
// adapted with baked PROPORTION PIECE handstyle and a phi background.
const modelURL=new URL('./models/proportion-piece-pub-sign.glb?v=interlocked-marker-20261028',import.meta.url).href;
export function addPhiPubSign(THREE,frontage){
 const root=new THREE.Group();root.name='phi-proportion-piece-hanging-sign';
 // Local +Z faces the square. Mount at the right of the arched entrance,
 // clear of the lamps, entrance opening and roof eaves.
 root.position.set(3.25,3.1,.08);frontage.add(root);
 root.userData.attribution='Pub Sign — johhny3D — CC BY 4.0';
 loadPhiDecorAsset(modelURL).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=source.clone(true);
  model.rotation.y=Math.PI;model.scale.setScalar(1.6);
  // Authored wall plate is at source Z=+.505; turn it toward the wall.
  model.position.z=.50538568*1.6;
  model.traverse(o=>{if(o.isMesh){
   o.material=o.material.clone();o.material.transparent=false;
   o.material.alphaTest=.35;o.material.depthWrite=true;
   o.material.roughness=.83;o.material.metalness=.12;
   o.receiveShadow=true;
  }});
  root.add(model);root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Reception hanging sign unavailable',error));
 return root;
}
