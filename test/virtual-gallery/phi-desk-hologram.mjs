import {appendTowerBoxBatches} from './tower-box-batches.mjs?v=preserve-metre-uv-20261022';

// Consume the exact boxes emitted by the real tower shell, including every
// floor (the full-size shell hides the active floor, this model must not).
export function addPhiDeskHologram(THREE,desk,{floorBoxes,shaftGeometry,signature='',maxHeight=.95,maxWidth=.72}={}){
 if(!desk||!floorBoxes?.length||!floorBoxes.some(f=>f.length))return null;
 const root=new THREE.Group();root.name='phi-reception-tower-hologram';
 // The front sign faces -Z; its initial R is on the desk's +X side.
 // Keep the projector inside the rounded counter, in front of the task lamp.
 root.position.set(1.55,1.126,-.40);desk.add(root);
 const solid=new THREE.MeshBasicMaterial({color:'#182c31'});
 // No extra lights, shadow passes, textures, render targets or animation loop.
 const surface=new THREE.MeshBasicMaterial({color:'#46dccc',transparent:true,opacity:.065,
  blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const outline=new THREE.LineBasicMaterial({color:'#83fff0',transparent:true,opacity:.52,
  blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
 const glow=new THREE.MeshBasicMaterial({color:'#55e8de',transparent:true,opacity:.40,
  blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const projector=new THREE.Mesh(new THREE.CylinderGeometry(.28,.30,.044,32),solid);
 projector.position.y=.022;projector.name='hologram-projector-base';root.add(projector);
 const aperture=new THREE.Mesh(new THREE.CircleGeometry(.22,32),glow);
 aperture.rotation.x=-Math.PI/2;aperture.position.y=.046;root.add(aperture);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.251,.267,48),glow);
 ring.rotation.x=-Math.PI/2;ring.position.y=.046;root.add(ring);
 const model=new THREE.Group();model.name='hologram-exact-tower-shell';root.add(model);
 const boxes=floorBoxes.flat();
 appendTowerBoxBatches(THREE,model,new Map([[surface,boxes]]));
 if(shaftGeometry){
  const shaft=new THREE.Mesh(shaftGeometry.clone(),surface);shaft.name='hologram-lift-shaft';model.add(shaft);
 }
 // Edges are generated once. Geometry and materials belong to this reception
 // edition and are released by the same cleanup as the rest of the desk.
 for(const mesh of [...model.children]){
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),outline);
  edges.name='hologram-architectural-edges';model.add(edges);
 }
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
 const scale=Math.min(maxHeight/Math.max(size.y,.001),maxWidth/Math.max(size.x,size.z,.001));
 const centre=bounds.getCenter(new THREE.Vector3());
 model.scale.setScalar(scale);
 model.position.set(-centre.x*scale,.15-bounds.min.y*scale,-centre.z*scale);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,.10,32,1,true),surface);
 beam.position.y=.099;root.add(beam);
 const diagnostics={signature,floorCount:floorBoxes.length,boxes:boxes.length,
  scale,height:size.y*scale,width:size.x*scale,depth:size.z*scale,drawCalls:model.children.length+4,
  source:'actual tower shell',aligned:true};
 root.userData.hologram=diagnostics;
 return {root,model,diagnostics,update(time){
  const pulse=.96+.04*Math.sin(time*1.4);
  surface.opacity=.065*pulse;outline.opacity=.52*pulse;glow.opacity=.40*pulse;
 }};
}
