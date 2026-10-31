// Test-only photographic material bank. No production imports are redirected.
import {createArchitecturalMaterials as originalMaterials,tiledBoxUvs as originalBoxUvs} from '../../gallery/visit/architectural-materials.mjs';
export function tiledBoxUvs(geometry,w,h,d,tileMeters=2.5){
 if(!geometry.userData.photorealRounded)return originalBoxUvs(geometry,w,h,d,tileMeters);
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));
  const u=y>=x&&y>=z?p.getX(i):x>=z?p.getZ(i):p.getX(i);
  const v=y>=x&&y>=z?p.getZ(i):p.getY(i);
  uv.setXY(i,u/tileMeters,v/tileMeters);
 }
 uv.needsUpdate=true;return geometry;
}
export const PHOTO_ASSETS='../../test/virtual-gallery/photoreal-assets/';
export const photorealEnabled=()=>new URLSearchParams(location.search).get('environment')!=='original';
export function createArchitecturalMaterials(THREE,options){return photorealEnabled()?createPhotorealMaterialBank(THREE,options):originalMaterials(THREE,options);}
const textureCache=new Map();
function texture(THREE,url,color,lowPower){
 const key=url+':'+lowPower;
 if(textureCache.has(key))return textureCache.get(key);
 const map=new THREE.TextureLoader().load(url);
 if(color)map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.anisotropy=lowPower?2:8;
 map.userData.galleryPersistent=true;
 textureCache.set(key,map);return map;
}
export function scannedMaterial(THREE,{color='#ffffff',roughness=.8,metalness=0,tileMeters=2.25,files,lowPower=false,name}){
 const m=new THREE.MeshStandardMaterial({color,roughness,metalness});
 m.name=name;m.userData={galleryPersistent:true,tileMeters,photorealSurface:true};
 if(files){
  m.map=texture(THREE,files.color,true,lowPower);
  m.roughnessMap=texture(THREE,files.roughness,false,lowPower);
  m.normalMap=texture(THREE,files.normal,false,lowPower);
  m.normalScale.set(.38,.38);
 }
 return m;
}
const filesFor=asset=>Object.fromEntries(['color','normal','roughness'].map(s=>[s,PHOTO_ASSETS+asset+'-'+s+'.webp']));
const plasterFiles=()=>Object.fromEntries(['color','normal','roughness'].map(s=>[s,'./textures/ambientcg-painted-plaster-007/'+s+'.webp']));
export function createPhotorealReceptionFloor(THREE,{lowPower=false}={}){
 return scannedMaterial(THREE,{files:plasterFiles(),lowPower,roughness:.86,tileMeters:1.8,
  color:'#eee9de',name:'Photographic plaster with existing bronze Penrose inlay'});
}
export function createPhotorealMaterialBank(THREE,{lowPower=false}={}){
 const make=(name,files,roughness,tileMeters,color='#ffffff',metalness=0)=>
  scannedMaterial(THREE,{name,files,roughness,tileMeters,color,metalness,lowPower});
 const concrete=filesFor('concrete_floor'),wood=filesFor('wood_floor');
 const wall=make('Scanned painted plaster',plasterFiles(),.94,2.2);
 const floor=make('Scanned honed concrete',concrete,.74,2.25);
 const stone=make('Scanned limestone-toned concrete',concrete,.84,1.65,'#e4ddd0');
 const stoneBridge=make('Scanned bridge concrete',concrete,.78,2.25);stoneBridge.side=THREE.DoubleSide;
 const timber=make('Photographic oiled timber',wood,.69,2.3);
 const timberLight=make('Photographic pale timber',wood,.72,2.3,'#fff8eb');
 const timberSmoked=make('Photographic smoked timber',wood,.75,2.3,'#b9aa96');
 const timberVariants=[timber,timberLight,timberSmoked];
 const ceiling=make('Scanned acoustic ceiling',{
  color:'./textures/OfficeCeiling001_Color.jpg',normal:'./textures/OfficeCeiling001_NormalGL.jpg',roughness:'./textures/OfficeCeiling001_Roughness.jpg'
 },.96,2.6);ceiling.normalScale.set(.18,.18);
 const exteriorBrick=make('Scanned charcoal masonry',{
  color:'./textures/Bricks055_Color.jpg',normal:'./textures/Bricks055_NormalGL.jpg',roughness:'./textures/Bricks055_Roughness.jpg'
 },.93,1.05,'#555b60');exteriorBrick.normalScale.set(.42,.42);
 // Sculptural supports keep their existing finish and do not receive IBL.
 const plinth=new THREE.MeshStandardMaterial({color:'#f6f1e9',roughness:.90,metalness:0});
 const trims=new THREE.MeshStandardMaterial({color:'#625f58',roughness:.66,metalness:.15});
 for(const [m,tileMeters] of [[plinth,1.15],[trims,.8]])m.userData={galleryPersistent:true,tileMeters,photorealProtected:true};
 // Preserve the original support's photographic tint, independently of walls.
 new THREE.TextureLoader().load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plastered_wall_02/plastered_wall_02_diff_1k.jpg',source=>{
  const c=document.createElement('canvas'),limit=lowPower?384:768,scale=Math.min(1,limit/Math.max(source.image.width,source.image.height));
  c.width=Math.round(source.image.width*scale);c.height=Math.round(source.image.height*scale);
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(source.image,0,0,c.width,c.height);
  const im=g.getImageData(0,0,c.width,c.height),d=im.data;
  for(let i=0;i<d.length;i+=4){const lum=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2],v=Math.max(90,Math.min(254,241+(lum-128)*.22));d[i]=Math.min(255,v+5);d[i+1]=Math.min(255,v+2);d[i+2]=Math.max(0,v-5);}
  g.putImageData(im,0,0);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.userData.galleryPersistent=true;
  plinth.map=map;plinth.needsUpdate=true;source.dispose();
 },undefined,()=>{});
 let finish='stone';
 const floorForRoom=(date,index,count)=>{
  if(count<4)return floor;
  let seed=2166136261;for(const char of String(date)+':'+index){seed^=char.charCodeAt(0);seed=Math.imul(seed,16777619);}
  const h=(seed>>>0)%11;
  if(index===2)return timberVariants[((seed>>>6)>>>0)%3];
  return h===3?stone:(h===1||h===5)?timberVariants[((seed>>>6)>>>0)%3]:floor;
 };
 return {wall,floor,timber,timberVariants,stone,stoneBridge,ceiling,exteriorBrick,plinth,trims,lowPower,floorForRoom,
  diagnostics:{source:'Photographic PBR · Poly Haven / ambientCG CC0'},
  setFinish(next){if(['stone','timber','minimal'].includes(next))finish=next;return finish;},finishFor:()=>finish};
}
