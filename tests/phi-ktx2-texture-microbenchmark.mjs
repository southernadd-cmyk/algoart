// Controlled texture A/B only; does not change any tower code or assets.
// Runs a small WebGL scene with the same brick normal texture in JPEG/KTX2.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

const testDir='test/virtual-gallery/';
const files={
 '/tex/jpeg':testDir+'textures/Bricks055_NormalGL.jpg',
 '/tex/ktx2':testDir+'textures/Bricks055_NormalGL.ktx2',
 '/basis/basis_transcoder.js':testDir+'basis/basis_transcoder.js',
 '/basis/basis_transcoder.wasm':testDir+'basis/basis_transcoder.wasm'
};
const runtime=`
import * as THREE from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
const snap=arr=>{
 const a=[...arr].sort((x,y)=>x-y);
 return {count:a.length,median:+a[Math.floor(a.length*.5)].toFixed(2),
  p95:+a[Math.floor(a.length*.95)].toFixed(2),max:+a.at(-1).toFixed(2)};
};
window.runTextureCase=async mode=>{
 const canvas=document.createElement('canvas');document.body.appendChild(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(384,384);
 const gl=renderer.getContext();
 const t0=performance.now();let transcoder=null;
 let texture;
 try{
  if(mode==='ktx2'){
   transcoder=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2).detectSupport(renderer);
   texture=await transcoder.loadAsync('/tex/ktx2');
  }else texture=await new THREE.TextureLoader().loadAsync('/tex/jpeg');
  const loaded=performance.now();
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=2;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ddd9d0');
  scene.add(new THREE.HemisphereLight(0xffffff,0x737373,2));
  const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(1,3,4);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(50,1,.1,50);camera.position.z=3;
  const material=new THREE.MeshStandardMaterial({color:0xfaf5f0,roughness:.93,normalMap:texture,normalScale:new THREE.Vector2(.19,.19)});
  const geometry=new THREE.PlaneGeometry(2,2,1,1);
  scene.add(new THREE.Mesh(geometry,material));
  renderer.render(scene,camera);gl.finish();
  const uploaded=performance.now();
  for(let i=0;i<6;i++)renderer.render(scene,camera);
  gl.finish();
  const samples=[];
  for(let i=0;i<32;i++){
   const start=performance.now();
   renderer.render(scene,camera);gl.finish();
   samples.push(performance.now()-start);
  }
  const image=texture.image;
  const totalMipBytes=texture.mipmaps?.reduce((n,m)=>n+(m.data?.byteLength||0),0)||null;
  const result={
   mode,loadAndDecodeMs:+(loaded-t0).toFixed(2),
   firstUploadAndCompileMs:+(uploaded-loaded).toFixed(2),
   frameRenderMs:snap(samples),
   isCompressedTexture:!!texture.isCompressedTexture,
   mipLevels:texture.mipmaps?.length||0,
   width:image?.width||texture.mipmaps?.[0]?.width||null,
   height:image?.height||texture.mipmaps?.[0]?.height||null,
   uploadedCompressedMipBytes:totalMipBytes,
   rendererTextures:renderer.info.memory.textures,
   webgl2:renderer.capabilities.isWebGL2
  };
  geometry.dispose();material.dispose();texture.dispose();renderer.dispose();
  transcoder?.dispose();canvas.remove();
  return result;
 }catch(error){
  transcoder?.dispose();renderer.dispose();canvas.remove();
  throw error;
 }
};
window.__textureBenchReady=true;
`;
const built=await build({stdin:{contents:runtime,resolveDir:process.cwd(),sourcefile:'texture-browser-entry.js',loader:'js'},
 bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',logLevel:'silent'});
const js=built.outputFiles[0].text;
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const src=files[url.pathname];
 if(src){
  try{
   const contents=await readFile(src);
   res.writeHead(200,{'Content-Type':url.pathname.endsWith('wasm')?'application/wasm':
     url.pathname.endsWith('.js')?'application/javascript':
     url.pathname==='/tex/ktx2'?'image/ktx2':'image/jpeg',
     'Cache-Control':'no-store'});res.end(contents);
  }catch(e){res.writeHead(404);res.end(String(e));}
  return;
 }
 if(url.pathname==='/'){
  res.writeHead(200,{'Content-Type':'text/html'});
  res.end('<html><head><meta charset="utf-8"></head><body><script>'+js+'</script></body></html>');
 }else{res.writeHead(404);res.end('missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
await mkdir('phi-ktx2-microbench-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const sequence=['jpeg','ktx2','ktx2','jpeg'];
const results=[];
try{
 for(const [i,mode] of sequence.entries()){
  const context=await browser.newContext({viewport:{width:450,height:450},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'load',timeout:25000});
   await page.waitForFunction(()=>window.__textureBenchReady===true,null,{timeout:15000});
   const result=await Promise.race([
    page.evaluate(mode=>window.runTextureCase(mode),mode),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Texture microbenchmark exceeded 45 seconds')),45000))
   ]);
   results.push({...result,iteration:i+1,errors});
   console.log('MICRO_RESULT '+JSON.stringify(results.at(-1)));
  }catch(e){results.push({mode,iteration:i+1,error:String(e),errors});console.log('MICRO_ERROR '+JSON.stringify(results.at(-1)));}
  await context.close();
 }
 const aggregate={};
 for(const mode of ['jpeg','ktx2']){
  const rows=results.filter(x=>x.mode===mode&&!x.error);
  aggregate[mode]={runs:rows.length,
   loadAndDecodeMs:rows.map(x=>x.loadAndDecodeMs),
   firstUploadAndCompileMs:rows.map(x=>x.firstUploadAndCompileMs),
   steadyRenderMedianMs:rows.map(x=>x.frameRenderMs.median),
   steadyRenderP95Ms:rows.map(x=>x.frameRenderMs.p95),
   mipLevels:rows.map(x=>x.mipLevels),
   uploadedCompressedMipBytes:rows.map(x=>x.uploadedCompressedMipBytes)};
 }
 const report={environment:'GitHub Actions Chromium / SwiftShader software WebGL; local same-origin assets; 384px viewport',sequence,aggregate,results};
 await writeFile('phi-ktx2-microbench-results/report.json',JSON.stringify(report,null,2));
 console.log('MICRO_SUMMARY '+JSON.stringify(aggregate));
 if(results.some(x=>x.error))process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
