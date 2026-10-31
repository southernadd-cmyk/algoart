// Shared model cache and calibrated fitting, independent of the gallery UI.
const assets=new Map();
let interiorReady=Promise.resolve();
const interiorNames=new Set(['pothos-plant.glb','cardboard-boxes.glb','vintage-world-map.glb','magazine-cabinet.glb','paper-clutter.glb']);
export function deferPhiInteriorAssetsUntil(ready){interiorReady=ready;}
const packedDecorNames=new Set(['modern-reception-fittings.glb','pothos-plant.glb']);
export async function loadPhiDecorAsset(url){
 // Published gltfpack assets preserve embedded texture bytes and named nodes.
 const assetURL=new URL(url);
 if(packedDecorNames.has(assetURL.pathname.split('/').pop())&&!assetURL.pathname.includes('/models/gltfpack/')){
  assetURL.pathname=assetURL.pathname.replace('/models/','/models/gltfpack/');
  url=assetURL.href;
 }
 if(!assets.has(url))assets.set(url,(interiorNames.has(url.split('/').pop())?interiorReady:Promise.resolve()).then(()=>import('three/addons/loaders/GLTFLoader.js')).then(({GLTFLoader})=>new GLTFLoader().loadAsync(url)).then(gltf=>{
  gltf.scene.traverse(o=>{if(o.geometry)o.geometry.userData.galleryPersistent=true;
   for(const m of [].concat(o.material||[])){m.userData.galleryPersistent=true;for(const v of Object.values(m))if(v?.isTexture)v.userData.galleryPersistent=true;}
  });return gltf.scene;
 }));
 return assets.get(url);
}
export function fitPhiDecorAsset(THREE,model,height){
 const group=new THREE.Group();group.add(model);group.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 const scale=height/Math.max(.001,size.y);model.position.add(new THREE.Vector3(-centre.x,-box.min.y,-centre.z));group.scale.setScalar(scale);return group;
}

export function fitPhiWallModel(THREE,model,width){
 const group=new THREE.Group();group.add(model);group.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 model.position.add(new THREE.Vector3(-centre.x,-centre.y,-box.min.z));group.scale.setScalar(width/size.x);return group;
}
