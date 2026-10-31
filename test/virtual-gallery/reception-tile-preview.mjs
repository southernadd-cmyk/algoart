// Uploaded Aman Bajwa material, fitted to the existing reception floor.
// Warm matte plaster beneath the existing bronze Penrose inlay.
// Keep a mapped surface (USE_MAP) and the unchanged 1.8 m world-space UV grid:
// installReceptionPenroseInlay depends on both for its original alignment.
export function createReceptionTileMaterial(THREE,{lowPower=false}={}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4;
  const grain=((((x*73856093)^(y*19349663))>>>8)&255)/255-.5;
  const mottling=2.1*Math.sin(x*Math.PI/64)*Math.cos(y*Math.PI/64)+grain*3.2;
  image.data[i]=238+mottling;image.data[i+1]=233+mottling;
  image.data[i+2]=222+mottling;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 const map=new THREE.CanvasTexture(canvas);
 map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.anisotropy=lowPower?1:2;
 map.userData.galleryPersistent=true;
 const material=new THREE.MeshStandardMaterial({color:0xffffff,map,roughness:.96,metalness:0});
 material.name='Reception plaster with bronze Penrose inlay';
 material.userData={galleryPersistent:true,tileMeters:1.8};
 return material;
}
export function alignReceptionTileUvs(mesh){
 // One physical grid across adjoining phi floor pieces, with no pattern reset
 // at a room boundary. The whole floor can still rotate with its tower level.
 const geometry=mesh.geometry,position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),repeat=mesh.material.userData.tileMeters;
 for(let i=8;i<12;i++)uv.setXY(i,(position.getX(i)+mesh.position.x)/repeat,-(position.getZ(i)+mesh.position.z)/repeat);
 uv.needsUpdate=true;return mesh;
}
