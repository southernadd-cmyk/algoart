// Decorative Wall 2 — M. Tolga Arslan / ShareTextures, source lists CC0.
// Reception wallpaper only. Opposite faces share exterior black brick.
export function createReceptionWallMaterial(THREE,{lowPower=false}={}){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0});
 material.name='Reception Decorative Wall 2';
 material.userData={galleryPersistent:true,tileMeters:2.4};
 const loader=new THREE.TextureLoader(),pending=[];
 for(const [slot,file,color] of [['map','color',true],['roughnessMap','roughness',false],...(lowPower?[]:[['normalMap','normal',false]])]){
  pending.push(new Promise(resolve=>loader.load(new URL('./textures/sharetextures-decorative-wall-2/'+file+'.webp',import.meta.url).href,texture=>{
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
   texture.anisotropy=lowPower?1:4;
   if(color)texture.colorSpace=THREE.SRGBColorSpace;
   texture.userData.galleryPersistent=true;
   material[slot]=texture;material.needsUpdate=true;resolve();
  },undefined,()=>resolve())));
 }
 material.normalScale.set(.4,.4);
 material.userData.ready=Promise.all(pending);
 return material;
}
