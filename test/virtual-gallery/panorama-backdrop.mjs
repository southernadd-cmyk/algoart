// Progressive outdoor panorama. Use the Day Environment HDRI 101 tone-mapped
// equirectangular JPEG, not an EXR or the circular preview image.
// Safe default: the existing procedurally coloured sky stays until image load.
let cached = new Map();
export function loadSquarePanorama(THREE,scene,{sky,clouds,lowPower=false}={}){
  // The currently supplied source is 1K: do not request nonexistent 2K/4K assets.
  const path='./assets/day-environment-hdri-101-1k.jpg';
  const backup=path;
  const use=(texture)=>{
    // Level swaps recreate the environment: do not mutate an old scene.
    if(!sky?.parent || sky.parent!==scene)return;
    texture.mapping=THREE.EquirectangularReflectionMapping;
    texture.colorSpace=THREE.SRGBColorSpace;
    scene.background=texture;
    sky.visible=false;
    if(clouds)clouds.visible=false;
    // Fog would erase the backdrop at distance. Forecourt and architecture remain.
    scene.fog=null;
  };
  const load=(url,allowFallback)=>{
    if(!cached.has(url)){
      cached.set(url,new Promise((resolve,reject)=>{
        new THREE.TextureLoader().load(url,resolve,undefined,reject);
      }));
    }
    cached.get(url).then(use).catch(()=>{
      // Files are optional during the staged rollout; missing assets must never
      // break the exhibition or block the initial view.
      if(allowFallback && url!==backup)load(backup,false);
    });
  };
  load(path,true);
}
