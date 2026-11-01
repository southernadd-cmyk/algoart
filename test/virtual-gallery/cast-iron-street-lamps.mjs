// The CC0 Poly Haven / Innerscene 3.87 m cast-iron lamp, cloned at each
// entrance and plaza location. All lamps share one GLB download and PBR
// material set. Existing procedural lanterns remain until the asset arrives.
let sharedLamp=null;
let detailedLampsEnabled=false;
const pendingLamps=[];
async function loadStreetLamp(THREE){
 if(!sharedLamp){
   sharedLamp=import('three/addons/loaders/GLTFLoader.js')
     .then(({GLTFLoader})=>new Promise((resolve,reject)=>{
       const loader=new GLTFLoader();
     // Preserve the original optimised GLB as a reliable fallback.
     // The optional WebP file has unchanged geometry and shared PBR materials.
     const original='./models/polyhaven-street-lamp-01-optimized.glb';
     const webp=new URLSearchParams(location.search).get('materialwebp')==='1';
     const candidate=webp?'./models/polyhaven-street-lamp-01-webp.glb':original;
     loader.load(candidate,gltf=>resolve(gltf.scene),undefined,error=>{
       if(webp){
         console.warn('TEST lamp WebP unavailable; using original optimised GLB',error);
         loader.load(original,gltf=>resolve(gltf.scene),undefined,reject);
       }else reject(error);
     });
     }))
     .then(scene=>{
       scene.traverse(node=>{
         if(!node.isMesh)return;
         if(node.geometry)node.geometry.userData.galleryPersistent=true;
         for(const mat of (Array.isArray(node.material)?node.material:[node.material]))
           if(mat)mat.userData.galleryPersistent=true;
       });
       const bounds=new THREE.Box3().setFromObject(scene);
       const height=bounds.max.y-bounds.min.y;
       if(!Number.isFinite(height)||height<.1||height>30)
         throw Error('Street lamp dimensions invalid: '+height);
       return {scene,bounds};
     }).catch(error=>{
       console.warn('Detailed entrance street lamp unavailable; fallback retained:',error);
       return null;
     });
 }
 return sharedLamp;
}
export function placeCastIronStreetLamp(THREE,parent,groundPosition,placeholder,{scale=0.84,rotation=0}={}){
 if(!parent||!groundPosition)return null;
 const mount=new THREE.Group();
 mount.position.copy(groundPosition);
 mount.rotation.y=rotation;
 mount.name='cast-iron-street-lamp';
 parent.add(mount);
 const attach=()=>loadStreetLamp(THREE).then(asset=>{
   // Stale gallery floors are disposed during a lift ride. A completed
   // network fetch must never repopulate a previous floor or plaza.
   if(!asset||!mount.parent||mount.userData.galleryDisposed||
       parent.userData.galleryDisposed)return;
   const model=asset.scene.clone(true);
   const centre=asset.bounds.getCenter(new THREE.Vector3());
   model.scale.setScalar(scale);
   model.position.set(-centre.x*scale,-asset.bounds.min.y*scale,-centre.z*scale);
   mount.add(model);
   if(placeholder)placeholder.visible=false;
 });
 if(detailedLampsEnabled)attach();
 else pendingLamps.push(attach);
 return mount;
}

// Called only after essential exhibits have been staged; detailed lamp models
// must not compete with gallery startup downloads or first-frame rendering.
export function enableDetailedStreetLamps(){
 if(detailedLampsEnabled)return;
 detailedLampsEnabled=true;
 for(const attach of pendingLamps.splice(0))attach();
}
