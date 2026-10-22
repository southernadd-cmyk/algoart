// The CC0 Poly Haven / Innerscene 3.87 m cast-iron lamp, cloned at each
// entrance and plaza location. All lamps share one GLB download and PBR
// material set. Existing procedural lanterns remain until the asset arrives.
let sharedLamp=null;
async function loadStreetLamp(THREE){
 if(!sharedLamp){
   sharedLamp=import('three/addons/loaders/GLTFLoader.js')
     .then(({GLTFLoader})=>new Promise((resolve,reject)=>{
       new GLTFLoader().load('./models/polyhaven-street-lamp-01.glb',
         gltf=>resolve(gltf.scene),undefined,reject);
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
 loadStreetLamp(THREE).then(asset=>{
   // Stale gallery floors are disposed during a lift ride. A completed
   // network fetch must never repopulate a previous floor or plaza.
   if(!asset||!mount.parent||mount.userData.galleryDisposed||
       parent.userData.galleryDisposed)return;
   const model=asset.scene.clone(true);
   const centre=asset.bounds.getCenter(new THREE.Vector3());
   model.scale.setScalar(scale);
   model.position.set(-centre.x*scale,-asset.bounds.min.y*scale,-centre.z*scale);
   mount.add(model);
   const lantern=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffe4a3}));
   lantern.position.y=(asset.bounds.max.y-asset.bounds.min.y)*scale*.85;
   mount.add(lantern);
   if(placeholder)placeholder.visible=false;
 });
 return mount;
}
