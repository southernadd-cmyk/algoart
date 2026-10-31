// Muted Penrose P3 floors for selected exhibition rooms in live and test.
// Existing PBR concrete floors are retained. UV-aligned inlays add no geometry.
const URL_INLAY=new URL('./textures/reception-penrose-inlay.svg?v=bold-brass-v2-20261030',import.meta.url).href;
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function chooseGalleryPenroseRooms(rooms,date){
 const eligible=(rooms||[]).map((r,index)=>({index,area:(r.pieces||[]).reduce((v,p)=>v+p.w*p.h,0)})).filter(x=>x.area>=22);
 const count=Math.min(2,Math.max(eligible.length?1:0,Math.round(eligible.length*.27)));
 return eligible.sort((a,b)=>hash(date+':penrose:'+a.index)-hash(date+':penrose:'+b.index)||a.index-b.index)
  .slice(0,count).map(x=>x.index).sort((a,b)=>a-b);
}
export function pieceRoomIndex(piece,rooms){
 const x=piece.x+piece.w/2,z=piece.z+piece.h/2;
 for(let i=0;i<(rooms?.length||0);i++)for(const q of rooms[i].pieces||[])
  if(x>=q.x-1e-4&&x<=q.x+q.w+1e-4&&z>=q.z-1e-4&&z<=q.z+q.h+1e-4)return i;
 return -1;
}
let material=null,uniforms=null;
export function prepareGalleryPenroseMaterial(THREE,base,pieces,{lowPower=false}={}){
 if(!base?.map||!pieces?.length)return null;
 const minX=Math.min(...pieces.map(p=>p.x)),maxX=Math.max(...pieces.map(p=>p.x+p.w));
 const minZ=Math.min(...pieces.map(p=>p.z)),maxZ=Math.max(...pieces.map(p=>p.z+p.h));
 if(![minX,maxX,minZ,maxZ].every(Number.isFinite))return null;
 if(!material){
  material=base.clone();material.name='Gallery Penrose — subtle stone and brass';
  material.userData={...base.userData,galleryPersistent:true,tileMeters:base.userData.tileMeters};
  uniforms={penroseMap:{value:null},penroseCentre:{value:new THREE.Vector2(0,0)},
   penroseSpan:{value:1},penroseRepeat:{value:base.userData.tileMeters||2.25},
   penroseStrength:{value:lowPower?.23:.29},penroseReady:{value:0}};
  const state={kind:'aperiodic five-grid rhombs',status:'loading'};
  material.userData.galleryPenrose=state;
  const texture=new THREE.TextureLoader().load(URL_INLAY,()=>{
   uniforms.penroseReady.value=1;state.status='loaded';
  },undefined,error=>{
   uniforms.penroseReady.value=0;state.status='failed';
   console.warn('Penrose floor image unavailable: using original concrete',error);
  });
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.anisotropy=lowPower?1:2;
  texture.userData.galleryPersistent=true;
  uniforms.penroseMap.value=texture;
  const hook=material.onBeforeCompile,key=material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
   hook?.(shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   const anchor='#include <map_fragment>';
   if(!shader.fragmentShader.includes(anchor))throw Error('Gallery Penrose shader map anchor missing');
   shader.fragmentShader=shader.fragmentShader.replace(anchor,anchor+`
#ifdef USE_MAP
 vec2 inlayXZ=vec2(vMapUv.x,-vMapUv.y)*penroseRepeat;
 vec2 inlayUV=vec2(0.5+(inlayXZ.x-penroseCentre.x)/penroseSpan,
                   0.5-(inlayXZ.y-penroseCentre.y)/penroseSpan);
 if(penroseReady>0.5&&all(greaterThanEqual(inlayUV,vec2(0.0)))&&all(lessThanEqual(inlayUV,vec2(1.0)))){
  vec4 inlay=texture2D(penroseMap,inlayUV);
  vec3 muted=mix(inlay.rgb,vec3(0.44,0.41,0.36),0.38);
  diffuseColor.rgb=mix(diffuseColor.rgb,muted,clamp(inlay.a*penroseStrength,0.0,1.0));
 }
#endif`);
   shader.fragmentShader=shader.fragmentShader.replace('void main() {',`uniform sampler2D penroseMap;
uniform vec2 penroseCentre;
uniform float penroseSpan;
uniform float penroseRepeat;
uniform float penroseStrength;
uniform float penroseReady;
void main() {`);
  };
  material.customProgramCacheKey=()=>String(key?.()||'')+'|gallery-penrose-muted-v1';
  material.needsUpdate=true;
 }
 // Reuse the same GPU material across lift stops; map/normal/roughness are
 // resynced with the photographic gallery finish when another date loads.
 for(const p of ['map','normalMap','roughnessMap'])
  if(material[p]!==base[p]){material[p]=base[p];material.needsUpdate=true;}
 uniforms.penroseCentre.value.set((minX+maxX)/2,(minZ+maxZ)/2);
 uniforms.penroseSpan.value=Math.max(maxX-minX,maxZ-minZ)+2;
 uniforms.penroseRepeat.value=base.userData.tileMeters||2.25;
 return material;
}
