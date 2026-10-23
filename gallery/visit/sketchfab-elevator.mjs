// The licensed Sketchfab "Elevator - Game Ready" can be fitted here without
// altering the museum's route, floor picker, or automatic sliding-door logic.
// Source mesh names: DoorL_0, DoorR_1, Frame_2 (GLB verified locally).
// The asset itself is not bundled; the uploader's Free Standard agreement
// restricts redistribution as a standalone downloadable file.
const URL='./models/elevator-game-ready.glb';
let cache;
export function loadGameReadyElevator(THREE){
  if(!cache){
    cache=import('three/addons/loaders/GLTFLoader.js')
      .then(({GLTFLoader})=>new Promise((resolve,reject)=>{
        new GLTFLoader().load(URL,gltf=>resolve(gltf.scene),undefined,reject);
      }))
      .then(source=>{
        // A shared source survives lift journeys; individual clones belong
        // to one exhibition. The edition cleanup must not dispose shared GPU
        // buffers or textures when the traveller switches between floors.
        source.traverse(node=>{
          if(node.geometry)node.geometry.userData.galleryPersistent=true;
          const materials=Array.isArray(node.material)?node.material:[node.material];
          for(const material of materials){
            if(material?.isMaterial)material.userData.galleryPersistent=true;
          }
        });
        return source;
      }).catch(error=>{
        console.info('Optional Sketchfab elevator not installed; using working gallery lift');
        return null;
      });
  }
  return cache;
}
export function fitGameReadyElevator(THREE,source,{origin,rotation,width,height,depth,closure=1}){
  const model=source.clone(true);
  const left=model.getObjectByName('DoorL_0');
  const right=model.getObjectByName('DoorR_1');
  if(!left||!right)throw Error('Expected DoorL_0 and DoorR_1 in elevator GLB');
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const centre=bounds.getCenter(new THREE.Vector3());
  if(Math.min(size.x,size.y,size.z)<.1)throw Error('Invalid elevator model bounds');
  // Fitted independently in three directions: the imported model is 3.16m
  // wide, while the existing navigable lift is 2.30m. Uniform scaling would
  // also shrink the 2.96m cabin too much for a visitor.
  const sx=width/size.x,sy=height/size.y,sz=depth/size.z;
  const holder=new THREE.Group();
  holder.name='fitted-sketchfab-elevator';
  holder.position.copy(origin);
  holder.rotation.y=rotation;
  model.scale.set(sx,sy,sz);
  model.position.set(-centre.x*sx,-bounds.min.y*sy,-centre.z*sz);
  holder.add(model);
  // The supplied doors are in their OPEN position. Translate towards each
  // other to close, leaving all child details attached to the actual leaf.
  // The source pair's centre gap is roughly 0.98m prior to X fitting.
  const gap=.49,slide=.35;
  const doors=[left,right];
  for(let i=0;i<doors.length;i++){
    const leaf=doors[i];
    const direction=i===0?1:-1;
    // Extend the model's partially opened default pose into the two frame
    // pockets. At this fitted scale the clear walk-through is ~1.22m.
    leaf.userData.open=leaf.position.clone().add(
      new THREE.Vector3(-direction*slide,0,0));
    leaf.userData.closed=leaf.position.clone().add(
      new THREE.Vector3(direction*gap,0,0));
    leaf.position.copy(leaf.userData.open).lerp(leaf.userData.closed,closure);
  }
  return {holder,doors};
}
