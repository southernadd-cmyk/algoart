import {ShaderPass,CopyPass} from 'postprocessing';

// Test/live faithful artwork compositing: copy the compositor's source image
// once instead of rendering the entire gallery twice.
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
  else if(isOpaqueOccluder(o))o.layers.enable(OPAQUE_DEPTH_LAYER);
 });
 return count;
}
export function createArtProtection(T,renderer,scene,camera){
 // The original image is the existing compositor RenderPass output. One GPU
 // texture blit replaces a full second scene render.
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
 const depth=new T.MeshBasicMaterial({
  color:0,side:T.DoubleSide,colorWrite:false,depthWrite:true,fog:false
 });
 const paint=new T.MeshBasicMaterial({
  color:0xffffff,side:T.DoubleSide,depthTest:true,depthWrite:false,
  depthFunc:T.LessEqualDepth,toneMapped:false,fog:false
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
// Three.js NeutralToneMapping applied to the unchanged linear scene values.
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
 const pass=new ShaderPass(shader),stats={protectedMeshes:0,samples,sourcePasses:1};
 let w=0,h=0;
 function resize(width,height){
  const nw=Math.max(1,Math.round(width*renderer.getPixelRatio()));
  const nh=Math.max(1,Math.round(height*renderer.getPixelRatio()));
  if(nw!==w||nh!==h){w=nw;h=nh;mask.setSize(w,h);copyPass.setSize(w,h);}
 }
 function capture(){
  stats.protectedMeshes=markArt(scene);
  resize(innerWidth,innerHeight);
  shader.uniforms.exposure.value=renderer.toneMappingExposure;
  const target=renderer.getRenderTarget(),auto=renderer.autoClear,override=scene.overrideMaterial;
  const bg=scene.background,layers=camera.layers.mask;
  const colour=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  try{
   scene.background=null;renderer.setRenderTarget(mask);renderer.setClearColor(0,1);
   renderer.clear(true,true,true);renderer.autoClear=false;
   scene.overrideMaterial=depth;camera.layers.set(OPAQUE_DEPTH_LAYER);
   renderer.render(scene,camera);
   scene.overrideMaterial=paint;camera.layers.set(ART_LAYER);
   renderer.render(scene,camera);
  }finally{
   scene.overrideMaterial=override;scene.background=bg;camera.layers.mask=layers;
   renderer.setRenderTarget(target);renderer.setClearColor(colour,alpha);renderer.autoClear=auto;
  }
 }
 function dispose(){
  original.dispose();mask.dispose();shader.dispose();depth.dispose();paint.dispose();
 }
 return {copyPass,pass,stats,resize,capture,dispose};
}
