// Real CC0 Innerscene twin-surface spotlights. Load once, clone after entry,
// and leave the functional gallery light pool independent of the model fetch.
// The model has its ceiling plate at local Y = ~0.198m, lens toward Y=0.
let modelPromise;
export function placeTwinSpotlight(THREE,mount,target,placeholder){
  if(!modelPromise){
    modelPromise=import('three/addons/loaders/GLTFLoader.js')
      .then(({GLTFLoader})=>new Promise((resolve,reject)=>{
        new GLTFLoader().load('./models/twin-surface-spotlight.glb',
          gltf=>resolve(gltf.scene),undefined,reject);
      }))
      .then(scene=>{
        // Geometry and material are shared by every fixture clone and reused
        // on lift floor changes; gallery disposal must not free them.
        scene.traverse(node=>{
          if(node.isMesh){
            if(node.geometry)node.geometry.userData.galleryPersistent=true;
            const mats=Array.isArray(node.material)?node.material:[node.material];
            mats.forEach(mat=>{if(mat)mat.userData.galleryPersistent=true;});
          }
        });
        return {scene,top:new THREE.Box3().setFromObject(scene).max.y};
      })
      .catch(error=>{
        console.warn('Twin-spot fixture unavailable; using procedural lamp:',error);
        return null;
      });
  }
  modelPromise.then(asset=>{
    if(!asset||!mount.parent||mount.userData.galleryDisposed)return;
    const model=asset.scene.clone(true);
    // The supplied source model is already aimed downward. Translate only
    // its mounting plate to the room ceiling; do not turn it upside down.
    model.position.y=-asset.top;
    model.rotation.y=Math.atan2(target.x-mount.position.x,target.z-mount.position.z);
    mount.add(model);
    if(placeholder)placeholder.visible=false;
  });
}
