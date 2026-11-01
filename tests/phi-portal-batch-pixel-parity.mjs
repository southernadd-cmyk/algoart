// Pixel-exact static portal-surround fixture. Does not replace real-gallery visual QA.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
 const page=await browser.newPage({viewport:{width:960,height:620},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30000});
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {batchPhiStaticArchitecture}=await import('/test/virtual-gallery/phi-static-architecture.mjs');
  const W=640,H=400;
  function render(batched){
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const renderer=new THREE.WebGLRenderer({canvas,antialias:true,
    preserveDrawingBuffer:true,powerPreference:'high-performance'});
   renderer.setSize(W,H);
   renderer.setPixelRatio(1);
   renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.NeutralToneMapping;
   renderer.toneMappingExposure=1.08;
   renderer.shadowMap.enabled=true;
   renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   const scene=new THREE.Scene();scene.background=new THREE.Color('#c2cbc5');
   const camera=new THREE.PerspectiveCamera(58,W/H,.07,210);
   camera.position.set(5.7,4.5,8.8);camera.lookAt(.1,1.5,-1.5);
   const ambient=new THREE.HemisphereLight('#eaf1ff','#72796f',1.18);scene.add(ambient);
   const sun=new THREE.DirectionalLight('#fff5e5',2.35);
   sun.position.set(-18,30,12);sun.castShadow=true;
   sun.shadow.mapSize.set(2048,2048);
   sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
   sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;
   sun.shadow.camera.near=.5;sun.shadow.camera.far=80;
   sun.shadow.camera.updateProjectionMatrix();
   scene.add(sun);
   const wallmat=new THREE.MeshStandardMaterial({color:'#d3c8b6',roughness:.95});
   const groundmat=new THREE.MeshStandardMaterial({color:'#c4ae93',roughness:.92});
   const frameMaterial=new THREE.MeshStandardMaterial({color:'#837368',roughness:.8});
   function box(w,h,d,x,y,z,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
   }
   box(12,.2,12,0,-.1,0,groundmat);
   box(12,3.6,.19,0,1.8,-4,wallmat);
   box(.19,3.6,12,-6,1.8,0,wallmat);
   const portals=[];
   for(const origin of [-2.5,1.7]){
    portals.push(box(.21,3.1,.17,origin-1,1.55,-3.88,frameMaterial));
    portals.push(box(.21,3.1,.17,origin+1,1.55,-3.88,frameMaterial));
    portals.push(box(.21,.23,2.2,origin,3.1,-3.88,frameMaterial));
   }
   const originalCount=portals.length;
   let merge=null;
   if(batched){
    merge=batchPhiStaticArchitecture(THREE,scene,portals);
    const joined=scene.children.find(c=>c.name==='phi-static-architecture-batch');
    if(joined){joined.castShadow=true;joined.receiveShadow=true;}
   }
   renderer.render(scene,camera);renderer.render(scene,camera);
   const out=document.createElement('canvas');out.width=W;out.height=H;
   const ctx=out.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(canvas,0,0);
   const data=ctx.getImageData(0,0,W,H).data;
   const result={pixels:Array.from(data),png:out.toDataURL('image/png'),
    originalCount,merge,drawCalls:renderer.info.render.calls,
    triangles:renderer.info.render.triangles};
   scene.traverse(obj=>{obj.geometry?.dispose?.();obj.material?.dispose?.()});renderer.dispose();
   return result;
  }
  const original=render(false),merged=render(true);
  let different=0,channelDifferent=0,maxDelta=0,totalDelta=0;
  for(let i=0;i<original.pixels.length;i+=4){
   let mismatch=false;
   for(let c=0;c<4;c++){
    const delta=Math.abs(original.pixels[i+c]-merged.pixels[i+c]);
    if(delta>0){mismatch=true;channelDifferent++;totalDelta+=delta;
     maxDelta=Math.max(maxDelta,delta);}
   }
   if(mismatch)different++;
  }
  return {images:{original:original.png,merged:merged.png},
   metrics:{width:W,height:H,pixels:W*H,changedPixels:different,
    changedPercent:+(different/(W*H)*100).toFixed(6),
    channelsChanged:channelDifferent,maxChannelDifference:maxDelta,totalChannelDifference:totalDelta,
    drawCallsBefore:original.drawCalls,drawCallsAfter:merged.drawCalls,
    trianglesBefore:original.triangles,trianglesAfter:merged.triangles,
    merge:merged.merge,exact:different===0}};
 });
 await mkdir('phi-portal-batch-pixel-parity',{recursive:true});
 for(const [name,img] of Object.entries(result.images))
  await writeFile('phi-portal-batch-pixel-parity/'+name+'.png',Buffer.from(img.split(',')[1],'base64'));
 await writeFile('phi-portal-batch-pixel-parity/results.json',
  JSON.stringify(result.metrics,null,2));
 console.log('PHI_PORTAL_PIXEL_PARITY '+JSON.stringify(result.metrics));
 if(!result.metrics.exact||result.metrics.merge?.savedDrawCalls!==5||
    !(result.metrics.drawCallsAfter<result.metrics.drawCallsBefore)||
    result.metrics.trianglesAfter!==result.metrics.trianglesBefore)process.exitCode=1;
}finally{await browser.close();}
