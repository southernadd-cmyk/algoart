// Uploaded Aman Bajwa material, fitted to the existing reception floor.
import {neutralGalleryMaps,stageGalleryTextureCallback} from './gallery-preparation.mjs';
export function createReceptionTileMaterial(THREE,{lowPower=false}={}){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:0});
 material.name='Reception cube tiles';
 material.userData={galleryPersistent:true,tileMeters:1.8};
 const neutral=neutralGalleryMaps(THREE);
 material.map=neutral.white;material.roughnessMap=neutral.roughness;
 if(!lowPower)material.normalMap=neutral.normal;
 const loader=new THREE.TextureLoader(),pending=[];
 for(const [slot,file,color] of [['map','color',true],['roughnessMap','roughness',false],...(lowPower?[]:[['normalMap','normal',false]])]){
  pending.push(new Promise(resolve=>loader.load(new URL('./textures/bajwa-floor-tiles/'+file+'.webp',import.meta.url).href,texture=>stageGalleryTextureCallback(()=>{
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
   texture.anisotropy=lowPower?1:4;
   if(color)texture.colorSpace=THREE.SRGBColorSpace;
   texture.userData.galleryPersistent=true;material[slot]=texture;material.needsUpdate=true;resolve();
  }),undefined,()=>resolve())));
 }
 material.normalScale.set(.4,.4);
 material.userData.ready=Promise.all(pending);
 return material;
}
export function alignReceptionTileUvs(mesh){
 // One physical grid across adjoining phi floor pieces, with no pattern reset
 // at a room boundary. The whole floor can still rotate with its tower level.
 const geometry=mesh.geometry,position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),repeat=mesh.material.userData.tileMeters;
 for(let i=8;i<12;i++)uv.setXY(i,(position.getX(i)+mesh.position.x)/repeat,-(position.getZ(i)+mesh.position.z)/repeat);
 uv.needsUpdate=true;return mesh;
}
