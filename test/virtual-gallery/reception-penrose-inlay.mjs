// Test-gallery-only overlay. The original Aman Bajwa cube-tile colour,
// normal and roughness textures are not modified or replaced.
// A precomputed Penrose P3 five-grid atlas introduces no geometry/draw calls.
const INLAY_URL=new URL('./textures/reception-penrose-inlay.svg?v=bold-brass-v2-20261030',import.meta.url).href;
export function installReceptionPenroseInlay(THREE,material,pieces,{lowPower=false}={}){
 if(material.userData.penroseInlayInstalled||!pieces?.length)return material;
 const minX=Math.min(...pieces.map(p=>p.x)),maxX=Math.max(...pieces.map(p=>p.x+p.w));
 const minZ=Math.min(...pieces.map(p=>p.z)),maxZ=Math.max(...pieces.map(p=>p.z+p.h));
 if(![minX,maxX,minZ,maxZ].every(Number.isFinite))return material;
 const centre=new THREE.Vector2((minX+maxX)/2,(minZ+maxZ)/2);
 const span=Math.max(maxX-minX,maxZ-minZ)+2;
 const uniforms={
  receptionPenroseMap:{value:null},receptionPenroseCentre:{value:centre},
  receptionPenroseSpan:{value:span},
  receptionPenroseBaseRepeat:{value:material.userData.tileMeters||1.8}
 };
 const inlayInfo={kind:'five-grid Penrose P3 rhombs',span,centre:[centre.x,centre.y],status:'loading'};
 material.userData.penroseInlay=inlayInfo;
 const texture=new THREE.TextureLoader().load(INLAY_URL,()=>{
  inlayInfo.status='loaded';
  if(globalThis.__phiReceptionPenroseTest)console.info('[Reception Penrose] texture loaded');
 },undefined,error=>{
  inlayInfo.status='failed';
  console.warn('Penrose inlay unavailable; retaining reception square tiles',error);
 });
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.anisotropy=lowPower?1:4;
 texture.userData.galleryPersistent=true;
 uniforms.receptionPenroseMap.value=texture;
 const oldHook=material.onBeforeCompile;
 const oldCacheKey=material.customProgramCacheKey?.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  oldHook?.(shader,renderer);
  Object.assign(shader.uniforms,uniforms);
  const anchor='#include <map_fragment>';
  if(!shader.fragmentShader.includes(anchor))throw Error('Penrose shader map anchor missing');
  shader.fragmentShader=shader.fragmentShader.replace(anchor,anchor+`
#ifdef USE_MAP
 // Existing aligned UVs encode the reception floor's local-world coordinates.
 vec2 inlayXZ=vec2(vMapUv.x,-vMapUv.y)*receptionPenroseBaseRepeat;
 vec2 inlayUV=vec2(0.5+(inlayXZ.x-receptionPenroseCentre.x)/receptionPenroseSpan,
                   0.5-(inlayXZ.y-receptionPenroseCentre.y)/receptionPenroseSpan);
 if(all(greaterThanEqual(inlayUV,vec2(0.0)))&&all(lessThanEqual(inlayUV,vec2(1.0)))){
  vec4 bronze=texture2D(receptionPenroseMap,inlayUV);
  // Graphite on light cube tiles, warm metal on darker cube tiles.
  float baseLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
  float darkTile=1.0-smoothstep(0.25,0.56,baseLuma);
  vec3 adaptiveInlay=mix(bronze.rgb,max(bronze.rgb,vec3(0.89,0.67,0.34)),darkTile*0.94);
  diffuseColor.rgb=mix(diffuseColor.rgb,adaptiveInlay,clamp(bronze.a,0.0,1.0));
 }
#endif`);
  shader.fragmentShader=shader.fragmentShader.replace('void main() {',`uniform sampler2D receptionPenroseMap;
uniform vec2 receptionPenroseCentre;
uniform float receptionPenroseSpan;
uniform float receptionPenroseBaseRepeat;
void main() {`);
 };
 material.customProgramCacheKey=()=>String(oldCacheKey?.()||'')+'|reception-penrose-v2-bold';
 material.userData.penroseInlayInstalled=true;
 // inlayInfo above tracks the texture load state.
 material.needsUpdate=true;
 return material;
}
