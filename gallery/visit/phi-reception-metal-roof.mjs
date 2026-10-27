// Exterior reception entrance roof using the licensed Abandoned Scans GLB.
// Source: https://sketchfab.com/3d-models/just-a-metal-roof-for-your-project-20fc70469ccd441bb4c9732b3b6886eb
// Creator: Abandoned Scans; CC BY 4.0. The GLB is deliberately lazy-loaded.
// It is a roof above the OUTSIDE Gothic reception entrance, not an
// interior ceiling fixture or a light. No walking collision is added.
import {loadPhiDecorAsset} from './phi-model-assets.mjs';

export const RECEPTION_ROOF_ASSET='./models/metal-reception-roof.glb';

export function addPhiReceptionMetalRoof(THREE,scene,{doorway,outward,elevation}){
 const root=new THREE.Group();
 root.name='phi-exterior-reception-metal-roof';
 // Ground reception sits under further exhibition floors. This entrance
 // canopy remains external to the facade and below the floor above.
 root.position.set(doorway.x+outward.x*2.8,elevation+4.26,
                   doorway.z+outward.z*2.8);
 root.rotation.y=Math.atan2(outward.x,outward.z);
 scene.add(root);
 root.userData.modelLoaded=false;
 const url=new URL(RECEPTION_ROOF_ASSET,import.meta.url).href;
 loadPhiDecorAsset(url).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=source.clone(true);
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  const size=box.getSize(new THREE.Vector3());
  const centre=box.getCenter(new THREE.Vector3());
  if(Math.min(size.x,size.y,size.z)<.001)throw Error('Roof asset has empty bounds');
  // Sketchfab scan measures ~40 x 31.5 x 5.8 metres. Preserve the real
  // surface/roof topology, but fit the entrance's 11.4m wide x 6.1m deep
  // external canopy and 1.65m vertical clearance above the doorway.
  const holder=new THREE.Group();
  model.position.set(-centre.x,-box.min.y,-centre.z);
  holder.scale.set(11.4/size.x,1.65/size.y,6.1/size.z);
  holder.add(model);
  root.add(holder);
  root.userData.modelLoaded=true;
  root.userData.source='Abandoned Scans · Just a metal roof for your project · CC BY 4.0';
 }).catch(error=>console.warn('Optional reception exterior roof unavailable:',error));
 return root;
}
