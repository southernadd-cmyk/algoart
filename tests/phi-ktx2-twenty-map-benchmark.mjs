// Controlled twenty-unique-texture scaling experiment. TEST artifacts only.
// Desktop GPU timings must be measured separately; GitHub uses SwiftShader.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const manifest=JSON.parse(await readFile('automation/gallery-ktx2-20-manifest.json','utf8'));
if(manifest.textures.length!==20)throw Error('Manifest must contain exactly 20 textures');
const output='phi-ktx2-twenty-map-results';
await mkdir(output,{recursive:true});

const inner=`
import * as THREE from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
const phi20=__PHI_MANIFEST__;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stat=samples=>{
 const sorted=samples.filter(Number.isFinite).sort((a,b)=>a-b);
 return {count:sorted.length,medianMs:+sorted[Math.floor(sorted.length/2)].toFixed(2),
         p95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2),
         maxMs:+sorted.at(-1).toFixed(2)};
};
window.runTwenty=async mode=>{
 const canvas=document.createElement('canvas');document.body.appendChild(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false});
 renderer.setPixelRatio(1);renderer.setSize(1000,650);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const gl=renderer.getContext();
 const ext=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 let basis=null,materials=[],geometries=[],textures=[];
 try{
  const begun=performance.now();
  if(mode==='ktx2')basis=new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2).detectSupport(renderer);
  const names=phi20.map(e=>e.id);
  textures=await Promise.all(phi20.map(async entry=>{
   const src=mode==='ktx2'?'/compressed/'+entry.id+'.ktx2':'/original/'+entry.id;
   const tex=mode==='ktx2'?await basis.loadAsync(src):await new THREE.TextureLoader().loadAsync(src);
   tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
   if(entry.kind==='color')tex.colorSpace=THREE.SRGBColorSpace;
   return tex;
  }));
  const decoded=performance.now();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c7c9c1');
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,1.6));
  const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(1,3,4);scene.add(sun);
  const camera=new THREE.OrthographicCamera(-5.5,5.5,3.6,-3.6,.1,30);camera.position.z=15;
  for(let i=0;i<20;i++){
   const entry=phi20[i],texture=textures[i];
   const params={color:entry.kind==='color'?0xffffff:0xc7c3b9,roughness:.78};
   if(entry.kind==='color')params.map=texture;
   if(entry.kind==='roughness')params.roughnessMap=texture;
   if(entry.kind==='normal'){params.normalMap=texture;params.normalScale=new THREE.Vector2(.4,.4);}
   const material=new THREE.MeshStandardMaterial(params);materials.push(material);
   const geo=new THREE.PlaneGeometry(1.9,1.25);geometries.push(geo);
   const mesh=new THREE.Mesh(geo,material);
   mesh.position.set((i%5-2)*2.12,(1.5-Math.floor(i/5))*1.7,0);
   scene.add(mesh);
  }
  renderer.render(scene,camera);gl.finish();
  const uploaded=performance.now();
  for(let i=0;i<5;i++)renderer.render(scene,camera);
  gl.finish();
  const frameMs=[];
  for(let i=0;i<24;i++){
   const then=performance.now();renderer.render(scene,camera);gl.finish();
   frameMs.push(performance.now()-then);
  }
  const tex=phi20.map((entry,i)=>{
   const t=textures[i],width=t.image?.width||t.mipmaps?.[0]?.width||null;
   const height=t.image?.height||t.mipmaps?.[0]?.height||null;
   return {id:entry.id,kind:entry.kind,width,height,
    compressed:!!t.isCompressedTexture,mips:t.mipmaps?.length||0,
    gpuBlocksBytes:t.isCompressedTexture
      ?t.mipmaps?.reduce((s,m)=>s+(m.data?.byteLength||0),0)||null:null};
  });
  const result={mode,gpu,count:tex.length,loadDecodeMs:+(decoded-begun).toFixed(2),
   gpuUploadAndCompileMs:+(uploaded-decoded).toFixed(2),
   combinedMs:+(uploaded-begun).toFixed(2),renderMs:stat(frameMs),
   rendererTextures:renderer.info.memory.textures,textures:tex};
  for(const m of materials)m.dispose();
  for(const g of geometries)g.dispose();
  for(const t of textures)t.dispose();
  basis?.dispose();renderer.dispose();
  // Retain the last rendered pixels for an optional diagnostic screenshot.
  return result;
 }catch(e){
  for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
  for(const t of textures)t.dispose();
  basis?.dispose();renderer.dispose();canvas.remove();throw e;
 }
};
window.__twentyReady=true;
`.replace('__PHI_MANIFEST__',JSON.stringify(manifest.textures.map(({id,kind})=>({id,kind}))));
const js=(await build({stdin:{contents:inner,resolveDir:process.cwd(),sourcefile:'phi-twenty-browser.js',loader:'js'},
  bundle:true,format:'iife',platform:'browser',target:'es2022',write:false,logLevel:'silent'})).outputFiles[0].text;
const originalById=Object.fromEntries(manifest.textures.map(e=>[e.id,'test/virtual-gallery/'+e.source]));
const server=createServer(async(req,res)=>{
 const name=new URL(req.url,'http://local').pathname;
 if(name==='/'){
  res.writeHead(200,{'Content-Type':'text/html'});
  res.end('<!doctype html><html><body style="margin:0"><script>'+js+'</script></body></html>');return;
 }
 let path;
 if(name.startsWith('/original/'))path=originalById[name.slice(10)];
 if(name.startsWith('/compressed/')){
  const id=name.slice(12).replace(/\.ktx2$/,'');
  if(id in originalById&&name.endsWith('.ktx2'))path='test/virtual-gallery/ktx2-20/'+id+'.ktx2';
 }
 if(name.startsWith('/basis/')&&['basis_transcoder.js','basis_transcoder.wasm'].includes(name.split('/').at(-1)))
  path='test/virtual-gallery/basis/'+name.split('/').at(-1);
 if(!path){res.writeHead(404);res.end('Unknown asset');return;}
 try{
  const contents=await readFile(path);
  const type=path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':
   path.endsWith('.ktx2')?'image/ktx2':path.endsWith('.webp')?'image/webp':'image/jpeg';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(contents);
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const sequence=['jpeg','ktx2','ktx2','jpeg'],results=[];
try{
 for(let i=0;i<sequence.length;i++){
  const mode=sequence[i],context=await browser.newContext({viewport:{width:1050,height:680}});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  try{
   await page.goto(url,{waitUntil:'load',timeout:30000});
   await page.waitForFunction(()=>window.__twentyReady,null,{timeout:15000});
   const r=await page.evaluate(m=>window.runTwenty(m),mode);
   if(r.count!==20)throw Error('Loaded '+r.count+' instead of 20');
   if(mode==='ktx2'&&!r.textures.every(t=>t.compressed))throw Error('A KTX2 map was not compressed');
   await page.screenshot({path:`${output}/${i+1}-${mode}.png`,animations:'disabled',timeout:15000});
   results.push({...r,iteration:i+1,pageErrors:errors});
   console.log('KTX20_RESULT '+JSON.stringify({...r,textures:r.textures.map(t=>({id:t.id,compressed:t.compressed,mips:t.mips,gpuBlocksBytes:t.gpuBlocksBytes}))}));
  }catch(e){
   results.push({mode,iteration:i+1,error:String(e),pageErrors:errors});
   console.log('KTX20_ERROR '+JSON.stringify(results.at(-1)));
  }
  await context.close();
 }
 const report={description:'20 unique architectural assets, 4 alternating software WebGL tests; optional assets do not appear in main tower',sequence,results,
  originalBytes:await Promise.all(Object.values(originalById).map(async p=>(await readFile(p)).byteLength)).then(x=>x.reduce((a,b)=>a+b,0)),
  compressedBytes:await Promise.all(manifest.textures.map(async p=>(await readFile('test/virtual-gallery/ktx2-20/'+p.id+'.ktx2')).byteLength)).then(x=>x.reduce((a,b)=>a+b,0))};
 await writeFile(output+'/results.json',JSON.stringify(report,null,2));
 console.log('KTX20_SUMMARY '+JSON.stringify({originalBytes:report.originalBytes,compressedBytes:report.compressedBytes,
  passes:results.filter(x=>!x.error).length,errors:results.filter(x=>x.error)}));
 if(results.some(r=>r.error))process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
