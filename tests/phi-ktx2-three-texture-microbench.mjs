// Controlled 3-map architectural GPU texture pilot: JPEG vs KTX2.
// Software WebGL results, explicitly not representative of discrete GPUs.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

const folder='test/virtual-gallery/textures/';
const names=['Bricks055_NormalGL','Bricks055_Roughness','OfficeCeiling001_NormalGL'];
const script=`
import * as THREE from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
window.testArchitecturalTextures=async mode=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});
 renderer.setSize(512,384);renderer.setPixelRatio(1);
 const gl=renderer.getContext();
 const ext=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 const names=['Bricks055_NormalGL','Bricks055_Roughness','OfficeCeiling001_NormalGL'];
 const since=performance.now();
 let transcoder=null;
 if(mode==='ktx2')transcoder=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2).detectSupport(renderer);
 let textures=[];
 try{
  const loaded=await Promise.all(names.map(name=>mode==='ktx2'
   ?transcoder.loadAsync('/textures/'+name+'.ktx2')
   :new THREE.TextureLoader().loadAsync('/textures/'+name+'.jpg')));
  textures=loaded;
  const afterDecode=performance.now();
  for(const tex of textures){tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=2;}
  const scene=new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const l=new THREE.DirectionalLight(0xffffff,2);l.position.set(0,2,3);scene.add(l);
  const camera=new THREE.PerspectiveCamera(48,512/384,.1,50);camera.position.z=3.3;
  const brick=new THREE.Mesh(new THREE.PlaneGeometry(1.35,2.25),new THREE.MeshStandardMaterial({
   color:'#696869',roughness:.88,normalMap:textures[0],roughnessMap:textures[1],normalScale:new THREE.Vector2(.19,.19)
  }));
  brick.position.x=-.8;scene.add(brick);
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(1.35,2.25),new THREE.MeshStandardMaterial({
   color:'#dad6cc',roughness:.9,normalMap:textures[2],normalScale:new THREE.Vector2(.18,.18)
  }));
  ceiling.position.x=.8;scene.add(ceiling);
  renderer.render(scene,camera);gl.finish();
  const afterUpload=performance.now();
  for(let i=0;i<5;i++)renderer.render(scene,camera);
  gl.finish();
  const frames=[];
  for(let i=0;i<24;i++){
   const t=performance.now();
   renderer.render(scene,camera);gl.finish();
   frames.push(performance.now()-t);
  }
  frames.sort((a,b)=>a-b);
  const mem=textures.map((t,i)=>({
   name:names[i],compressed:!!t.isCompressedTexture,
   width:t.image?.width||t.mipmaps?.[0]?.width,
   height:t.image?.height||t.mipmaps?.[0]?.height,
   mips:t.mipmaps?.length||0,
   compressedBytes:t.mipmaps?.reduce((a,b)=>a+(b.data?.byteLength||0),0)||null
  }));
  const result={mode,gpu,loadDecodeMs:+(afterDecode-since).toFixed(2),
   firstUploadMs:+(afterUpload-afterDecode).toFixed(2),
   combinedMs:+(afterUpload-since).toFixed(2),
   steadyMedianMs:+frames[12].toFixed(2),
   steadyP95Ms:+frames[22].toFixed(2),
   textures:mem,rendererTextures:renderer.info.memory.textures};
  for(const m of [brick,ceiling]){m.geometry.dispose();m.material.dispose();}
  for(const t of textures)t.dispose();transcoder?.dispose();renderer.dispose();
  return result;
 }catch(error){
  for(const t of textures)t.dispose();transcoder?.dispose();renderer.dispose();throw error;
 }
};
window.__ready=true;
`;
const js=(await build({stdin:{contents:script,resolveDir:process.cwd(),sourcefile:'three-map-test.js',loader:'js'},
 bundle:true,format:'iife',platform:'browser',write:false,logLevel:'silent'})).outputFiles[0].text;
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body><script>'+js+'</script></body></html>');return;}
 let target=null;
 if(pathname.startsWith('/textures/')){
  const name=pathname.split('/').at(-1);
  if(names.some(n=>name===n+'.jpg'||name===n+'.ktx2'))target=folder+name;
 }else if(pathname==='/basis/basis_transcoder.js'||pathname==='/basis/basis_transcoder.wasm'){
  target='test/virtual-gallery'+pathname;
 }
 if(!target){res.writeHead(404);res.end();return;}
 try{
  const b=await readFile(target);
  res.writeHead(200,{'Content-Type':pathname.endsWith('.wasm')?'application/wasm':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.ktx2')?'image/ktx2':'image/jpeg','Cache-Control':'no-store'});
  res.end(b);
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const uri='http://127.0.0.1:'+server.address().port+'/';
const dir='phi-ktx2-three-map-results';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const sequence=['jpeg','ktx2','ktx2','jpeg'],results=[];
try{
 for(let i=0;i<sequence.length;i++){
  const mode=sequence[i],context=await browser.newContext({viewport:{width:600,height:480}});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(uri,{waitUntil:'load',timeout:30000});
   await page.waitForFunction(()=>window.__ready,null,{timeout:30000});
   const value=await page.evaluate(m=>window.testArchitecturalTextures(m),mode);
   results.push({...value,iteration:i+1,errors});
   console.log('MULTI_MICRO_RESULT '+JSON.stringify(results.at(-1)));
  }catch(error){results.push({mode,iteration:i+1,error:String(error),errors});console.log('MULTI_MICRO_ERROR '+JSON.stringify(results.at(-1)));}
  await context.close();
 }
 const report={environment:'GitHub ubuntu-latest, headless Chromium, SwiftShader software WebGL; 512x384 DPR1',sequence,results};
 await writeFile(dir+'/results.json',JSON.stringify(report,null,2));
 if(results.some(r=>r.error))process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
