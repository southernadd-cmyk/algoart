// TEST ONLY: 20-unique-architectural-texture scaling benchmark.
// Does not modify the gallery or generated artwork.
import * as THREE from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';

const $=id=>document.getElementById(id);
const cases=['jpeg','ktx2','ktx2','jpeg'];
const results=[];
let manifest=null;
const median=list=>{
 const s=[...list].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]||0;
};
async function run(mode,index){
 const canvas=$('study');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const gl=renderer.getContext();
 const ext=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 const root='./';
 const suffix='?txcold='+encodeURIComponent(Date.now()+'-'+index);
 let loader=null;
 const started=performance.now();
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b5b9b3');
 const hemi=new THREE.HemisphereLight(0xffffff,0x777777,2.2);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.position.set(1,3,5);scene.add(sun);
 const camera=new THREE.OrthographicCamera(-5.7,5.7,3.65,-3.65,.1,35);camera.position.z=16;
 const meshes=[],textures=[];
 try{
  if(mode==='ktx2')loader=new KTX2Loader().setTranscoderPath('./basis/').setWorkerLimit(2).detectSupport(renderer);
  const loaded=await Promise.all(manifest.textures.map(async entry=>{
   const file=mode==='ktx2'?root+'ktx2-20/'+entry.id+'.ktx2':
    root+entry.source;
   const texture=mode==='ktx2'
    ?await loader.loadAsync(file+suffix)
    :await new THREE.TextureLoader().loadAsync(file+suffix);
   if(mode==='ktx2'&&!texture.isCompressedTexture)throw Error(entry.id+' is not GPU-compressed');
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
   if(entry.kind==='color')texture.colorSpace=THREE.SRGBColorSpace;
   return texture;
  }));
  textures.push(...loaded);
  const decoded=performance.now();
  for(let i=0;i<20;i++){
   const entry=manifest.textures[i],tex=textures[i],color=entry.kind==='color';
   const args={color:color?0xffffff:0xc0bfb7,roughness:.85};
   if(color)args.map=tex;
   else if(entry.kind==='roughness')args.roughnessMap=tex;
   else{args.normalMap=tex;args.normalScale=new THREE.Vector2(.4,.4);}
   const material=new THREE.MeshStandardMaterial(args);
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.85,1.28),material);
   mesh.position.set((i%5-2)*2.18,(1.5-Math.floor(i/5))*1.65,0);
   meshes.push(mesh);scene.add(mesh);
  }
  renderer.render(scene,camera);gl.finish();
  const uploaded=performance.now();
  const samples=[];
  for(let i=0;i<18;i++){
   const t=performance.now();renderer.render(scene,camera);gl.finish();
   samples.push(performance.now()-t);
  }
  const textureInfo=manifest.textures.map((entry,i)=>{
   const tex=textures[i];
   return {id:entry.id,kind:entry.kind,usage:entry.usage,
    compressed:!!tex.isCompressedTexture,mips:tex.mipmaps?.length||0,
    gpuBlockBytes:tex.mipmaps?.reduce((n,m)=>n+(m.data?.byteLength||0),0)||null};
  });
  return {
   index,mode,gpu,mapCount:textures.length,
   loadDecodeMs:+(decoded-started).toFixed(1),
   firstUploadMs:+(uploaded-decoded).toFixed(1),
   totalMs:+(uploaded-started).toFixed(1),
   repeatRenderMedianMs:+median(samples).toFixed(2),
   estimatedCompressedGpuBytes:mode==='ktx2'
    ?textureInfo.reduce((s,x)=>s+(x.gpuBlockBytes||0),0):null,
   rendererTextures:renderer.info.memory.textures,
   textures:textureInfo
  };
 }finally{
  for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();scene.remove(mesh);}
  for(const t of textures)t.dispose();
  loader?.dispose();renderer.dispose();
 }
}
async function start(){
 $('start').disabled=true;$('copy').disabled=true;$('rows').textContent='';$('log').textContent='';
 results.length=0;
 try{
  manifest=await fetch('./ktx2-20/manifest.json',{cache:'no-store'}).then(r=>{
   if(!r.ok)throw Error('20-texture manifest missing: '+r.status);
   return r.json();
  });
  if(manifest.count!==20||manifest.textures.length!==20)throw Error('Expected exactly 20 distinct textures');
  const totals=manifest.totals;
  $('files').textContent='20 prepared sources • '+totals.active.count+' core • '+
   totals.reception.count+' reception • '+totals.optional.count+' optional';
  for(let i=0;i<cases.length;i++){
   const mode=cases[i];$('status').textContent='Running '+(i+1)+'/4: '+mode;
   try{
    const value=await run(mode,i+1);
    results.push(value);
    const row=document.createElement('tr');
    for(const v of [i+1,mode,value.loadDecodeMs+' ms',
      value.firstUploadMs+' ms',value.totalMs+' ms',
      value.estimatedCompressedGpuBytes==null?'—':(value.estimatedCompressedGpuBytes/1048576).toFixed(2)+' MiB']){
     const cell=document.createElement('td');cell.textContent=v;row.appendChild(cell);
    }
    $('rows').appendChild(row);
    $('log').textContent+='Run '+(i+1)+': '+JSON.stringify({
     mode,loadDecodeMs:value.loadDecodeMs,totalMs:value.totalMs,
     rendererTextures:value.rendererTextures,gpu:value.gpu})+'\n';
   }catch(error){
    results.push({index:i+1,mode,error:String(error)});
    $('log').textContent+='Run '+(i+1)+' failed: '+String(error)+'\n';
   }
  }
  $('status').textContent='Finished: '+results.filter(r=>!r.error).length+'/4 runs';
  $('copy').disabled=false;
 }catch(error){$('status').textContent=String(error);}
 $('start').disabled=false;
}
$('start').addEventListener('click',start);
$('copy').addEventListener('click',()=>{
 const report={benchmark:'PROPORTION PIECE test-only 20 architectural texture A/B',
  date:new Date().toISOString(),userAgent:navigator.userAgent,
  caveat:'Synthetic material stress test. Only eight maps are used directly in the production-style test tower.',
  sequence:cases,sourceManifest:manifest?.totals||null,results};
 navigator.clipboard.writeText(JSON.stringify(report,null,2)).then(()=>{$('status').textContent='Copied JSON';});
});
