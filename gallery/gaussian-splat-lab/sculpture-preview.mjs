import {summarizeFrameTimes,benchmarkViewMatches,pairedComparison} from './benchmark.mjs';
const VERSION=1,DATE='2026-11-26';
const labels={triangles:'Original mesh',simplified:'Simplified mesh',splats:'Sculpture splats'};
const frame=()=>new Promise(requestAnimationFrame);
export function createSculpturePreview({THREE,renderer,scene,camera,getDate,getReady,getExpected}){
 const panel=document.getElementById('spark-tower-preview');
 panel.innerHTML='<div class="spark-switch"><strong>26 Nov · Sculptures</strong><button data-mode="triangles" aria-pressed="true">Original mesh</button><button data-mode="simplified" disabled>Simplified mesh</button><button data-mode="splats" disabled>Gaussian splats</button></div><div id="spark-status" role="status">Loading original sculpture geometry…</div><details><summary>Comparison details</summary><p>Only sculpture bodies change. The gallery, original paintings, pins and plinths remain conventional meshes. Alternatives are prepared from verified V2 geometry before deployment; splat colours use source UVs and approximate baked diffuse shading.</p><button id="spark-benchmark" disabled>Benchmark all three</button> <button id="spark-export" disabled>Export JSON</button><div id="spark-results"></div></details>';
 panel.dataset.ready='true';
 const $=id=>panel.querySelector('#'+id);
 let records=[],spark=null,mode='triangles',ready=false,preparing=false,benchmark=null,measurement=null,report=null,message='Waiting for sculptures',frames=0,fps=0,last=performance.now();
 const buttons=[...panel.querySelectorAll('[data-mode]')];
 function update(){
  panel.dataset.mode=mode;
  for(const b of buttons){b.setAttribute('aria-pressed',String(b.dataset.mode===mode));b.disabled=!!benchmark||(b.dataset.mode!=='triangles'&&!ready);}
  $('spark-benchmark').disabled=!ready&&!benchmark;$('spark-benchmark').textContent=benchmark?'Cancel benchmark':'Benchmark all three';
  $('spark-export').disabled=!report;
  const count=records.reduce((s,r)=>s+(mode==='splats'?r.pointCount:mode==='simplified'?r.simpleTriangles:r.originalTriangles),0);
  $('spark-status').textContent=message+' · '+fps.toFixed(1)+' FPS'+(records.length?' · '+records.length+' sculptures · '+count.toLocaleString()+(mode==='splats'?' splats':' triangles'):'');
 }
 function switchMode(next){
  if(next!=='triangles'&&!ready)return false;
  for(const r of records){
   for(const m of r.meshes){m.mesh.geometry=next==='simplified'?m.simple:m.original;m.mesh.visible=next==='splats'?false:m.visible;}
   if(next==='splats')r.body.add(r.splat);else r.splat?.removeFromParent();
  }
  if(spark){if(next==='splats')scene.add(spark);else spark.removeFromParent();}
  mode=next;message=labels[mode]+' · architecture unchanged';update();return true;
 }
 function reset(){
  switchMode('triangles');
  for(const r of records){for(const m of r.meshes)m.simple.dispose();r.splat?.dispose?.();}
  records=[];spark?.removeFromParent();ready=false;update();
 }
 const textures=new WeakMap();
 function texturePixels(texture){
  if(!texture?.image)return null;if(textures.has(texture))return textures.get(texture);
  const image=texture.image,w=Math.min(1024,image.naturalWidth||image.width),h=Math.min(1024,image.naturalHeight||image.height);
  if(!w||!h)throw Error('Painting texture not ready');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
  const result={w,h,data:ctx.getImageData(0,0,w,h).data};textures.set(texture,result);return result;
 }
 async function prepareComparison(){
  if(preparing)return false;preparing=true;reset();
  try{
   const deadline=performance.now()+45000;let bodies=[];
   while(performance.now()<deadline){
    bodies=[];scene.traverse(o=>{if(o.isGroup&&o.userData.prepared&&o.userData.geometryRevision==='v4.2.1-v2-pigment-island-fix')bodies.push(o);});
    if(bodies.length===getExpected()&&bodies.length)break;
    message='Waiting for verified original sculptures '+bodies.length+'/'+getExpected();update();await frame();
   }
   if(!bodies.length||bodies.length!==getExpected())throw Error('Original sculpture set is incomplete');
   const quality=bodies[0].userData.quality;
   const response=await fetch(new URL('../gaussian-splat-lab/sculptures-'+DATE+'-'+quality+'-v'+VERSION+'.json.gz',document.baseURI),{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Prepared comparison assets unavailable (HTTP '+response.status+')');
   const bytesOnWire=new Uint8Array(await response.arrayBuffer());
   const pack=bytesOnWire[0]===31&&bytesOnWire[1]===139?await new Response(new Blob([bytesOnWire]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(bytesOnWire));
   if(pack.version!==VERSION||pack.date!==DATE||pack.quality!==quality)throw Error('Comparison asset manifest mismatch');
   const {SparkRenderer,SplatMesh}=await import('@sparkjsdev/spark');
   spark??=new SparkRenderer({renderer,depthTest:true,depthWrite:false});
   const z=new THREE.Vector3(0,0,1),normal=new THREE.Vector3(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion(),colour=new THREE.Color(),sampleColour=new THREE.Color(),light=new THREE.Vector3(.35,.85,.38).normalize();
   for(const body of bodies){
    const asset=pack.studies[body.userData.sourceImage],originals=body.children.filter(m=>m.isMesh);
    if(!asset||asset.originalTriangles!==body.userData.polygonTriangles||asset.meshCounts.length!==originals.length)throw Error('Prepared asset does not match original sculpture '+body.name);
    const r={body,meshes:[],pointCount:asset.pointCount,originalTriangles:asset.originalTriangles,simpleTriangles:asset.simpleTriangles,splat:null};records.push(r);
    for(const [i,mesh] of originals.entries()){
     const original=mesh.geometry,[vertices,indices]=asset.meshCounts[i],alt=asset.simplified[i];
     if(original.attributes.position.count!==vertices||original.index.count!==indices||!alt?.index.length||alt.index.some(v=>v<0||v>=vertices))throw Error('Sculpture geometry mismatch');
     const simple=original.clone();simple.setIndex(alt.index);simple.clearGroups();for(const group of alt.groups)simple.addGroup(group.start,group.count,group.materialIndex);
     r.meshes.push({mesh,original,simple,visible:mesh.visible});
    }
    const bytes=Uint8Array.from(atob(asset.points),c=>c.charCodeAt(0)),points=new Float32Array(bytes.buffer);
    if(points.length!==asset.pointCount*11)throw Error('Invalid prepared sample count');
    // Only colour lookup/packing happens here; no surface resampling or camera capture.
    for(const mesh of originals)for(const material of mesh.material)if(material.map)texturePixels(material.map);
    r.splat=new SplatMesh({raycastable:false,constructSplats(packed){
     for(let i=0;i<points.length;i+=11){
      position.fromArray(points,i);normal.fromArray(points,i+3).normalize();q.setFromUnitVectors(z,normal);
      const radius=points[i+8];scale.set(radius,radius,Math.max(.0008,radius*.12));
      const material=originals[points[i+9]].material[points[i+10]];
      colour.copy(material.color);const image=texturePixels(material.map);
      if(image){
       const x=Math.min(image.w-1,Math.max(0,Math.floor(points[i+6]*image.w))),y=Math.min(image.h-1,Math.max(0,Math.floor((1-points[i+7])*image.h))),at=(y*image.w+x)*4;
       sampleColour.setRGB(image.data[at]/255,image.data[at+1]/255,image.data[at+2]/255,THREE.SRGBColorSpace);colour.multiply(sampleColour);
      }
      colour.multiplyScalar(.65+.35*Math.max(0,normal.dot(light)));
      packed.pushSplat(position,scale,q,material.opacity,colour);
     }
    }});
    await r.splat.initialized;message='Prepared '+records.length+'/'+bodies.length+' sculpture alternatives';update();await frame();
   }
   ready=true;message='All three sculpture modes ready';update();return true;
  }catch(e){reset();message='Original meshes only · '+e.message;update();return false;}
  finally{preparing=false;}
 }
 function view(){return {date:getDate(),position:camera.getWorldPosition(new THREE.Vector3()).toArray(),quaternion:camera.getWorldQuaternion(new THREE.Quaternion()).toArray(),width:renderer.domElement.width,height:renderer.domElement.height,pixelRatio:renderer.getPixelRatio()};}
 function finish(error,value){const m=measurement;if(!m)return;measurement=null;clearTimeout(m.timeout);error?m.reject(error):m.resolve(value);}
 function afterRender(){
  const now=performance.now();frames++;if(now-last>=1000){fps=frames*1000/(now-last);frames=0;last=now;update();}
  const m=measurement;if(!m)return;
  if(benchmark?.cancelled||document.hidden||!getReady()||!benchmarkViewMatches(benchmark.reference,view())||mode!==m.mode){finish(Error('View or mode changed; repeat while stationary'));return;}
  if(now-m.start<1500)return;
  if(m.previous!==null)m.samples.push(now-m.previous);m.previous=now;
  if(now-m.start<5500)return;
  try{
   const stats=summarizeFrameTimes(m.samples);
   let screenshot=null;try{screenshot=renderer.domElement.toDataURL('image/png');}catch{}
   finish(null,{mode:m.mode,...stats,sculptures:records.length,triangles:records.reduce((s,r)=>s+(m.mode==='simplified'?r.simpleTriangles:m.mode==='triangles'?r.originalTriangles:0),0),splats:m.mode==='splats'?records.reduce((s,r)=>s+r.pointCount,0):0,resources:{...renderer.info.memory},screenshot});
  }catch(e){finish(e);}
 }
 function measure(next){
  switchMode(next);message='Benchmark · '+labels[next];update();
  return new Promise((resolve,reject)=>{measurement={mode:next,start:performance.now(),previous:null,samples:[],resolve,reject,timeout:setTimeout(()=>finish(Error('No continuous rendered frames')),20000)};});
 }
 async function runBenchmark(){
  if(benchmark){benchmark.cancelled=true;finish(Error('Cancelled'));return;}
  if(!ready||!getReady())return;
  benchmark={reference:view(),cancelled:false};report=null;const phases=[],result={date:DATE,view:benchmark.reference,phases,method:'Stationary original / simplified / splat / original; 1.5s warmup, 4s samples'};
  try{
   for(const next of ['triangles','simplified','splats','triangles'])phases.push(await measure(next));
   for(const p of phases.slice(1,3))p.comparison=pairedComparison(phases[0],phases[3],p);
  }catch(e){result.error=e.message;}
  finally{benchmark=null;switchMode('triangles');report=result;const box=$('spark-results');box.replaceChildren();
   const summary=document.createElement('p');summary.textContent=result.error?'Incomplete: '+result.error:'Benchmark complete';box.append(summary);
   for(const p of phases){
    const line=document.createElement('p');line.textContent=labels[p.mode]+' · '+p.fps.toFixed(1)+' FPS · p95 '+p.p95Ms.toFixed(1)+' ms'+(p.comparison?' · '+p.comparison.fpsGainPct.toFixed(1)+'% FPS vs baseline':'');box.append(line);
    if(p.screenshot){const a=document.createElement('a');a.href=p.screenshot;a.download='sculptures-'+p.mode+'.png';a.textContent='Save view';box.append(a);}
   }update();}
 }
 for(const b of buttons)b.onclick=()=>{if(!benchmark)switchMode(b.dataset.mode);};
 $('spark-benchmark').onclick=()=>void runBenchmark();
 $('spark-export').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...report,phases:report.phases.map(({screenshot,...p})=>p)},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sculpture-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 panel.addEventListener('pointerdown',e=>{e.stopPropagation();if(document.pointerLockElement)document.exitPointerLock?.();});
 panel.addEventListener('click',e=>e.stopPropagation());
 update();
 return {prepareComparison,reset,setArchitecture(){},beforeRender(){if(renderer.xr.isPresenting&&mode!=='triangles')switchMode('triangles');},afterRender};
}
