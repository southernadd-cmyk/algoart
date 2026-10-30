import {ShaderPass} from 'postprocessing';
// Paintings and traced sculpture marks are drawn with their original materials.
export const ART_LAYER=9;
export function isArt(o){return !!(o?.isMesh&&(o.userData?.phiArtOriginal||o.userData?.study));}
export function markArt(scene){let count=0;scene.traverse(o=>{if(isArt(o)){o.layers.enable(ART_LAYER);count++;}});return count;}
export function createArtProtection(T,renderer,scene,camera){
 const samples=Math.min(2,renderer.capabilities.maxSamples||0);
 function make(name,srgb=false){const t=new T.WebGLRenderTarget(1,1,{
  type:T.UnsignedByteType,depthBuffer:true,samples,colorSpace:srgb?T.SRGBColorSpace:T.NoColorSpace
 });t.texture.name=name;return t;}
 const original=make('unprocessed-source-artwork',true),mask=make('artwork-visible-pixels');
 const depth=new T.MeshBasicMaterial({color:0,side:T.DoubleSide,colorWrite:false,depthWrite:true,fog:false});
 const paint=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,depthTest:true,depthWrite:false,depthFunc:T.LessEqualDepth,toneMapped:false,fog:false});
 const shader=new T.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,
  uniforms:{inputBuffer:{value:null},originalBuffer:{value:original.texture},artworkMask:{value:mask.texture}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`,
  fragmentShader:`uniform sampler2D inputBuffer,originalBuffer,artworkMask;
varying vec2 vUv;
void main(){
 vec4 processed=texture2D(inputBuffer,vUv);
 vec4 originalPixel=texture2D(originalBuffer,vUv);
 float keep=clamp(texture2D(artworkMask,vUv).r,0.,1.);
 gl_FragColor=mix(processed,originalPixel,keep);
 #include <colorspace_fragment>
}`});
 const pass=new ShaderPass(shader),stats={protectedMeshes:0,samples};
 let w=0,h=0;
 function resize(width,height){
  let nw=Math.max(1,Math.round(width*renderer.getPixelRatio())),nh=Math.max(1,Math.round(height*renderer.getPixelRatio()));
  if(nw!==w||nh!==h){w=nw;h=nh;original.setSize(w,h);mask.setSize(w,h);}
 }
 function capture(){
  stats.protectedMeshes=markArt(scene);resize(innerWidth,innerHeight);
  const target=renderer.getRenderTarget(),auto=renderer.autoClear,override=scene.overrideMaterial;
  const bg=scene.background,layers=camera.layers.mask,colour=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  try{
   renderer.autoClear=true;renderer.setRenderTarget(original);renderer.render(scene,camera);
   scene.background=null;renderer.setRenderTarget(mask);renderer.setClearColor(0,1);
   renderer.clear(true,true,true);renderer.autoClear=false;
   scene.overrideMaterial=depth;camera.layers.set(0);renderer.render(scene,camera);
   scene.overrideMaterial=paint;camera.layers.set(ART_LAYER);renderer.render(scene,camera);
  }finally{
   scene.overrideMaterial=override;scene.background=bg;camera.layers.mask=layers;
   renderer.setRenderTarget(target);renderer.setClearColor(colour,alpha);renderer.autoClear=auto;
  }
 }
 return {pass,stats,resize,capture};
}
