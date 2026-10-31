import {ShaderPass,CopyPass,Pass} from 'postprocessing';

// Faithful source-artwork compositing using the compositor's original image
// and its existing depth buffer: one artwork-only mask draw, no geometry
// redraw for opaque architecture, and no duplicate full scene render.
export const ART_LAYER=9,OPAQUE_DEPTH_LAYER=8;
const ART_DISPLAYS=new Set(['monitor-screen','large-monitor-video-pane','recursive-smallest-video-mosaic']);
export function isArt(o){
 return !!(o?.isMesh&&(o.userData?.phiArtOriginal||o.userData?.study||ART_DISPLAYS.has(o.name)));
}
export function isOpaqueOccluder(o){
 if(!o?.isMesh||isArt(o))return false;
 const materials=Array.isArray(o.material)?o.material:[o.material];
 return materials.length>0&&materials.every(m=>m&&!m.transparent&&!m.alphaTest&&m.depthTest!==false);
}
export function markArt(scene){
 let count=0;
 scene.traverse(o=>{
  if(isArt(o)){o.layers.enable(ART_LAYER);count++;}
 });
 return count;
}
export function createArtProtection(T,renderer,scene,camera){
 const original=new T.WebGLRenderTarget(1,1,{
  type:T.HalfFloatType,depthBuffer:false,stencilBuffer:false,
  minFilter:T.LinearFilter,magFilter:T.LinearFilter
 });
 original.texture.name='unprocessed-source-artwork';
 const copyPass=new CopyPass(original,true);
 const samples=Math.min(2,renderer.capabilities.maxSamples||0);
 const mask=new T.WebGLRenderTarget(1,1,{
  type:T.UnsignedByteType,depthBuffer:true,samples,
  minFilter:T.LinearFilter,magFilter:T.LinearFilter
 });
 mask.texture.name='artwork-visible-pixels';
 const artworkMaterial=new T.ShaderMaterial({
  side:T.DoubleSide,depthTest:true,depthWrite:true,
  toneMapped:false,transparent:false,
  uniforms:{
   sceneDepth:{value:null},resolution:{value:new T.Vector2(1,1)}
  },
  vertexShader:`void main(){
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`,
  fragmentShader:`uniform sampler2D sceneDepth;
uniform vec2 resolution;
void main(){
 // The compositor's main RenderPass depth already includes solid walls and
 // nearer artworks. Only the genuinely visible artwork pixels survive.
 float originalDepth=texture2D(sceneDepth,gl_FragCoord.xy/resolution).r;
 if(gl_FragCoord.z>originalDepth+0.00001)discard;
 gl_FragColor=vec4(1.);
}`
 });
 const shader=new T.ShaderMaterial({
  toneMapped:false,depthTest:false,depthWrite:false,
  uniforms:{
   inputBuffer:{value:null},originalBuffer:{value:original.texture},
   artworkMask:{value:mask.texture},
   exposure:{value:renderer.toneMappingExposure}
  },
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`,
  fragmentShader:`uniform sampler2D inputBuffer,originalBuffer,artworkMask;
uniform float exposure;
varying vec2 vUv;
vec3 faithfulNeutral(vec3 color) {
 const float StartCompression=0.76;
 const float Desaturation=0.15;
 color*=exposure;
 float x=min(color.r,min(color.g,color.b));
 float offset=x<0.08?x-6.25*x*x:0.04;
 color-=offset;
 float peak=max(color.r,max(color.g,color.b));
 if(peak<StartCompression)return color;
 float d=1.-StartCompression;
 float newPeak=1.-d*d/(peak+d-StartCompression);
 color*=newPeak/peak;
 float g=1.-1./(Desaturation*(peak-newPeak)+1.);
 return mix(color,vec3(newPeak),g);
}
void main(){
 vec4 processed=texture2D(inputBuffer,vUv);
 vec4 unmodified=texture2D(originalBuffer,vUv);
 vec4 art=vec4(faithfulNeutral(unmodified.rgb),unmodified.a);
 float keep=clamp(texture2D(artworkMask,vUv).r,0.,1.);
 gl_FragColor=mix(processed,art,keep);
 #include <colorspace_fragment>
}`
 });
 const pass=new ShaderPass(shader);
 const stats={protectedMeshes:0,samples,sourcePasses:1,architectureMaskPasses:0,artworkMaskPasses:1};
 let width=0,height=0;
 const maskPass=new Pass('PhiArtworkVisibilityMask');
 maskPass.needsSwap=false;
 maskPass.render=()=>capture();
 function setSceneDepth(texture){
  if(!texture)throw Error('Artwork protection requires the existing compositor depth texture');
  artworkMaterial.uniforms.sceneDepth.value=texture;
 }
 function resize(w,h){
  const nw=Math.max(1,Math.round(w*renderer.getPixelRatio()));
  const nh=Math.max(1,Math.round(h*renderer.getPixelRatio()));
  if(nw!==width||nh!==height){
   width=nw;height=nh;
   mask.setSize(nw,nh);copyPass.setSize(nw,nh);
   artworkMaterial.uniforms.resolution.value.set(nw,nh);
  }
 }
 function capture(){
  if(!artworkMaterial.uniforms.sceneDepth.value)throw Error('Source depth buffer unavailable');
  stats.protectedMeshes=markArt(scene);
  resize(innerWidth,innerHeight);
  shader.uniforms.exposure.value=renderer.toneMappingExposure;
  const target=renderer.getRenderTarget(),auto=renderer.autoClear,override=scene.overrideMaterial;
  const bg=scene.background,layers=camera.layers.mask;
  const colour=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  try{
   scene.background=null;renderer.setRenderTarget(mask);renderer.setClearColor(0,1);
   renderer.clear(true,true,true);renderer.autoClear=false;
   scene.overrideMaterial=artworkMaterial;camera.layers.set(ART_LAYER);
   renderer.render(scene,camera);
  }finally{
   scene.overrideMaterial=override;scene.background=bg;camera.layers.mask=layers;
   renderer.setRenderTarget(target);renderer.setClearColor(colour,alpha);renderer.autoClear=auto;
  }
 }
 function dispose(){
  original.dispose();mask.dispose();shader.dispose();artworkMaterial.dispose();
 }
 return {copyPass,maskPass,pass,stats,resize,capture,setSceneDepth,dispose};
}
