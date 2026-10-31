const banks=new WeakMap();
export function addPhiRoomLuminaire(THREE,scene,room,elevation,ceilingHeight){
 const cell=[...(room.pieces||[])].sort((a,b)=>b.w*b.h-a.w*a.h)[0];
 if(!cell||cell.w<2||cell.h<2)return null;
 let bank=banks.get(scene);
 if(!bank){
  bank={body:new THREE.BoxGeometry(.78,.09,.78/1.61803398875),face:new THREE.BoxGeometry(.70,.012,.70/1.61803398875),
   metal:new THREE.MeshStandardMaterial({color:'#344452',roughness:.73,metalness:.24}),
   diffuser:new THREE.MeshBasicMaterial({color:'#fff1d7',toneMapped:false})};
  for(const item of Object.values(bank))item.userData.galleryPersistent=true;
  banks.set(scene,bank);
 }
 const root=new THREE.Group();root.name='phi-room-ceiling-luminaire';
 root.position.set(cell.x+cell.w*.382,elevation+ceilingHeight-.12,cell.z+cell.h*.618);
 const body=new THREE.Mesh(bank.body,bank.metal),face=new THREE.Mesh(bank.face,bank.diffuser);
 face.position.y=-.052;root.add(body,face);
 root.userData.phiRoomLuminaire={power:48,distance:Math.min(14,Math.max(6,Math.hypot(cell.w,cell.h)))};
 scene.add(root);return root;
}
