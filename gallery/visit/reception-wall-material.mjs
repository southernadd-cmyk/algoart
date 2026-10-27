// Decorative Wall 2 — M. Tolga Arslan / ShareTextures, source lists CC0.
// PaintedPlaster007 — ambientCG, CC0. Both finishes are reception-only.
export function createReceptionWallMaterial(THREE,{lowPower=false,finish='wallpaper'}={}){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0});
 // Test reception: replace the neutral wallpaper with the existing painted plaster.
 // Keep the public tower and separately authored blue walls unchanged.
 const testReception=globalThis.location?.pathname?.includes('/test/virtual-gallery/');
 const painted=finish==='painted-plaster'||(testReception&&finish==='wallpaper');
 const directory=painted?'ambientcg-painted-plaster-007':'sharetextures-decorative-wall-2';
 material.name=painted?'Reception PaintedPlaster007':'Reception Decorative Wall 2';
 material.userData={galleryPersistent:true,tileMeters:2.4};
 const loader=new THREE.TextureLoader(),pending=[];
 for(const [slot,file,color] of [['map','color',true],['roughnessMap','roughness',false],...(lowPower?[]:[['normalMap','normal',false]])]){
  pending.push(new Promise(resolve=>loader.load(new URL('./textures/'+directory+'/'+file+'.webp',import.meta.url).href,texture=>{
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
