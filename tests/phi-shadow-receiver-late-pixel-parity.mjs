// TEST-ONLY pixel parity for previously-compiled material shaders: the hard case.
// This is an isolated gallery-material fixture, not proof of byte-identical
// complete archived-floor screenshots (which contain time-based installations).
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30000});
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createPhiLightingStudy}=await import('/test/virtual-gallery/phi-room-lighting-renderer.mjs');
  const PIXELS_W=640,PIXELS_H=400;
  const instances=[];
  function make(mode){
   const canvas=document.createElement('canvas');
   canvas.width=PIXELS_W;canvas.height=PIXELS_H;
   const renderer=new THREE.WebGLRenderer({
    canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'
   });
   renderer.setPixelRatio(1);renderer.setSize(PIXELS_W,PIXELS_H);
   renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.NeutralToneMapping;
   renderer.toneMappingExposure=1.08;
   const scene=new THREE.Scene();
   scene.background=new THREE.Color('#c2cbc5');
   const camera=new THREE.PerspectiveCamera(60,PIXELS_W/PIXELS_H,.07,210);
   camera.position.set(5,4,7);camera.lookAt(0,1,0);
   const hemi=new THREE.HemisphereLight('#eaf1ff','#72796f',1.18);scene.add(hemi);
   const sun=new THREE.DirectionalLight('#fff5e5',2.35);
   sun.position.set(-18,30,12);scene.add(sun);
   // Fixed-size exhibition room: plaster walls, bronze frame, artwork and pedestal.
   const floor=new THREE.Mesh(new THREE.BoxGeometry(9,.2,8),
    new THREE.MeshStandardMaterial({color:'#b9a78e',roughness:.89,metalness:.02}));
   floor.position.set(0,-.12,0);floor.name='floor';scene.add(floor);
   const rear=new THREE.Mesh(new THREE.BoxGeometry(9,3.5,.2),
    new THREE.MeshStandardMaterial({color:'#cbbfa8',roughness:.95}));
   rear.position.set(0,1.75,-3.4);rear.name='rear plaster wall';scene.add(rear);
   const side=new THREE.Mesh(new THREE.BoxGeometry(.2,3.5,8),
    new THREE.MeshStandardMaterial({color:'#d4c9b6',roughness:.95}));
   side.position.set(-4.4,1.75,0);scene.add(side);
   const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(.58,.19,80,12),
    new THREE.MeshStandardMaterial({color:'#d3a465',roughness:.66,metalness:.17}));
   sculpture.position.set(1.6,1.23,-.9);scene.add(sculpture);
   const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.75,.8,1,24),
    new THREE.MeshStandardMaterial({color:'#e9e1d1',roughness:.92}));
   pedestal.position.set(1.6,.5,-.9);scene.add(pedestal);
   const artCanvas=document.createElement('canvas');artCanvas.width=256;artCanvas.height=256;
   const ctx=artCanvas.getContext('2d',{willReadFrequently:true});
   ctx.fillStyle='#eee6d6';ctx.fillRect(0,0,256,256);
   ctx.fillStyle='#2e5967';ctx.fillRect(30,28,115,150);
   ctx.beginPath();ctx.arc(166,137,62,0,Math.PI*2);ctx.fillStyle='#c98a50';ctx.fill();
   ctx.strokeStyle='#765e5f';ctx.lineWidth=12;ctx.strokeRect(48,45,158,164);
   const map=new THREE.CanvasTexture(artCanvas);map.colorSpace=THREE.SRGBColorSpace;
   const painting=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),
    new THREE.MeshStandardMaterial({map,roughness:.98}));
   painting.position.set(-.65,1.9,-3.24);scene.add(painting);
   const bronzeFrame=new THREE.Mesh(new THREE.BoxGeometry(2.38,2.38,.08),
    new THREE.MeshStandardMaterial({color:'#77512c',roughness:.52,metalness:.5}));
   bronzeFrame.position.set(-.65,1.9,-3.38);scene.add(bronzeFrame);
   // Two original production-style room spotlights and four pooled fill lights.
   for(const x of [-2.5,2]){
    const light=new THREE.SpotLight(0xfff3df,14,12,.70,.90,1.5);
    light.name='phi-shadow-room-light';light.position.set(x,3.25,1.2);
    light.target.position.set(x/3,0,-.7);scene.add(light,light.target);
   }
   const study=createPhiLightingStudy({
    THREE,renderer,scene,camera,sun,skipReceiverMaterialInvalidation:!!mode
   });
   // Deliberately compile with receiveShadow=false before the lighting study
   // enables receivers. This is the dangerous path for skipping needsUpdate.
   renderer.render(scene,camera);
   study.update(100);
   scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
   // Render identical static scene twice, to resolve initial shader compilation.
   renderer.render(scene,camera);renderer.render(scene,camera);
   const out=document.createElement('canvas');out.width=PIXELS_W;out.height=PIXELS_H;
   const context=out.getContext('2d',{willReadFrequently:true});
   context.drawImage(canvas,0,0);
   const data=context.getImageData(0,0,PIXELS_W,PIXELS_H).data;
   const result={
    mode:mode?'receiver-only':'control',
    png:out.toDataURL('image/png'),
    pixels:Array.from(data),
    metrics:{
     casters:study.stats.casters,
     receiverUpdates:study.stats.receiverUpdates,
     materialInvalidations:study.stats.receiverMaterialInvalidations,
     refreshes:study.stats.refreshes,
     shadowMaps:study.stats.shadowMaps,
     programs:renderer.info.programs.length,
     textures:renderer.info.memory.textures,
     geometries:renderer.info.memory.geometries
    }
   };
   instances.push({renderer,scene,map});
   return result;
  }
  const control=make(false),fast=make(true);
  const p=control.pixels,q=fast.pixels;
  let changed=0,maxDelta=0,totalDelta=0,channelChanges=0,alphaChanges=0;
  for(let i=0;i<p.length;i+=4){
   let mismatched=false;
   for(let c=0;c<4;c++){
    const d=Math.abs(p[i+c]-q[i+c]);
    if(d){mismatched=true;channelChanges++;totalDelta+=d;maxDelta=Math.max(maxDelta,d);if(c===3)alphaChanges++;}
   }
   if(mismatched)changed++;
  }
  const data={
   width:PIXELS_W,height:PIXELS_H,
   totalPixels:PIXELS_W*PIXELS_H,
   changedPixels:changed,changedPercent:100*changed/(PIXELS_W*PIXELS_H),
   channelsDiffering:channelChanges,maxChannelDifference:maxDelta,
   totalChannelDifference:totalDelta,alphaChannelsDiffering:alphaChanges,
   control:control.metrics,experimental:fast.metrics,
   exact:changed===0
  };
  const images={control:control.png,experimental:fast.png};
  for(const {renderer,scene,map} of instances){
   map.dispose();scene.traverse(o=>{o.geometry?.dispose?.();const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(m=>m?.dispose?.());});renderer.dispose();
  }
  return {data,images};
 });
 await mkdir('phi-shadow-receiver-late-audit',{recursive:true});
 for(const [name,png] of Object.entries(result.images)){
  await writeFile('phi-shadow-receiver-audit/'+name+'-fixture.png',
   Buffer.from(png.split(',')[1],'base64'));
 }
 await writeFile('phi-shadow-receiver-audit/pixel-parity.json',JSON.stringify(result.data,null,2));
 console.log('PHI_SHADOW_LATE_PIXEL_PARITY '+JSON.stringify(result.data));
 if(!result.data.exact||
    result.data.control.casters!==result.data.experimental.casters||
    result.data.control.refreshes!==result.data.experimental.refreshes||
    result.data.control.receiverUpdates!==result.data.experimental.receiverUpdates||
    result.data.control.materialInvalidations<=0||
    result.data.experimental.materialInvalidations!==0)process.exitCode=1;
}finally{await browser.close();}
