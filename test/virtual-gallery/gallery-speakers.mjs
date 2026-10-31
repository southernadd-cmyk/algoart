import {loadPhiDecorAsset} from './phi-model-assets.mjs';
export function planGallerySpeakers(rooms,{elevation=0,ceilingHeight=5.2}={}){
 return rooms.filter(room=>room.pieces?.length).map((room,index)=>{
  const cell=room.pieces.reduce((largest,p)=>p.w*p.h>largest.w*largest.h?p:largest);
  return {room:room.id||index,x:cell.x+cell.w*.382,z:cell.z+cell.h*.618,y:elevation+ceilingHeight+.002,diameter:.32};
 });
}
export function addGalleryCeilingSpeaker(THREE,parent,{x=0,y,z=0,diameter=.32,name='gallery-ceiling-speaker',loadAsset=loadPhiDecorAsset}){
 const root=new THREE.Group();root.name=name;root.position.set(x,y,z);parent.add(root);
 // The grille is below the ceiling; the authored housing is recessed above it.
 const fallback=new THREE.Group();root.add(fallback);
 const rim=new THREE.Mesh(new THREE.CylinderGeometry(diameter/2,diameter/2,.012,24),new THREE.MeshStandardMaterial({color:'#deded8',roughness:.86}));rim.position.y=.006;fallback.add(rim);
 const face=new THREE.Mesh(new THREE.CircleGeometry(diameter*.39,24),new THREE.MeshStandardMaterial({color:'#7b817a',roughness:.9}));face.rotation.x=Math.PI/2;face.position.y=-.0005;fallback.add(face);
 root.userData.ready=loadAsset(new URL('./models/ceiling-speaker.glb',import.meta.url).href).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=source.clone(true);model.scale.setScalar(diameter);root.add(model);fallback.visible=false;root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Ceiling speaker fallback',error));return root;
}
// All loudspeakers receive the same media element. Moving/changing a floor
// changes only the sound's location and gain, never its source or playhead.
export function createGallerySpeakerFeed(record,{positionOf=source=>source.position||source,volume=.45}={}){
 let emitters=[],lastListener=null;
 record.audio.volume=volume;
 const setVolume=value=>{volume=Math.max(0,Math.min(1,Number(value)||0));if(lastListener)update(lastListener);};
 function update(listener){
  lastListener=listener;let distance=Infinity;
  for(const source of emitters){const p=positionOf(source);distance=Math.min(distance,Math.hypot(listener.x-p.x,listener.y+1.65-p.y,listener.z-p.z));}
  const gain=distance>=36?0:1/(1+Math.max(0,distance-5)/10)**2;
  record.audio.volume=volume*gain;
  return gain;
 }
 return {record,setVolume,update,setEmitters:sources=>{emitters=sources.filter(Boolean);},snapshot:()=>({emitters:emitters.length,volume,playing:record.state().playing})};
}
