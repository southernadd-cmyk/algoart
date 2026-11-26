import {planFloorSamples} from './floor-plan.mjs';
import {summarizeFrameTimes,pairedComparison,benchmarkViewMatches} from './benchmark.mjs';
// Only bundled into the isolated Spark tower. Never imported by the live renderer.
// Read back actual shaded architecture faces, then replace only those triangles.
export function architectureFaces(THREE,meshes,eye=null,limit=eye?18:Infinity){
 const candidates=[];
 for(const mesh of meshes){
  if(!mesh.parent||!mesh.visible||!mesh.isMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.opacity!==1)continue;
  const g=mesh.geometry,idx=g.index,pos=g.attributes.position;
  if(!idx||!pos||idx.count%6)continue;
  mesh.updateWorldMatrix(true,false);
  for(let at=0;at<idx.count;at+=6){
   const ids=[...new Set(Array.from({length:6},(_,i)=>idx.getX(at+i)))];
   if(ids.length!==4)continue;
   const points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(pos,id).applyMatrix4(mesh.matrixWorld));
   const a=points[0],u=points[1].clone().sub(a),edge=points[2].clone().sub(a);
   const n=u.clone().cross(edge);if(n.lengthSq()<1e-10)continue;
   n.normalize();u.normalize();const v=n.clone().cross(u);
   if(points.some(p=>Math.abs(p.clone().sub(a).dot(n))>.001))continue;
   const ux=points.map(p=>p.clone().sub(a).dot(u)),vy=points.map(p=>p.clone().sub(a).dot(v));
   const lo=Math.min(...ux),hi=Math.max(...ux),bottom=Math.min(...vy),top=Math.max(...vy);
   const width=hi-lo,height=top-bottom;
   if(width<.45||height<.45)continue;
   const centre=a.clone().addScaledVector(u,(lo+hi)/2).addScaledVector(v,(bottom+top)/2);
   const towards=eye?eye.clone().sub(centre):null;
   if(towards&&(towards.dot(n)<.12||towards.length()>15))continue;
   candidates.push({mesh,at,centre,u,v,n,width,height,distance:towards?.length()??0});
  }
 }
 return eye?candidates.sort((a,b)=>a.distance-b.distance).slice(0,limit):candidates;
}
export function remainingArchitectureIndices(index,removed){
 const out=[];for(let i=0;i<index.count;i++)if(!removed.has(i-i%6))out.push(index.getX(i));return out;
}
export function createGaussianLivePreview({THREE,renderer,scene,camera,getDate,getReady,selectBakeLights=()=>()=>{}}){
 let sources=[],spark=null,splat=null,patches=[],generation=0,busy=false,active=false,captureDate='',captureCount=0,faceCount=0,captureMs=0,last=performance.now(),frames=0,fps=0;
 let benchmark=null,measurement=null,report=null,wantHybrid=false,floorStats=null;
 const panel=document.getElementById('spark-tower-preview');
 if(!panel)throw Error('Gaussian preview controls missing from the generated tower HTML');
 panel.dataset.ready='true';
 for(const id of ['spark-triangles','spark-splats','spark-recapture','spark-reset'])panel.querySelector('#'+id).disabled=false;
 const $=id=>panel.querySelector('#'+id);
 let message='Mesh baseline · live materials and lighting';
 function update(){ $('spark-status').textContent=message+' | '+fps.toFixed(1)+' FPS'+(captureCount?' | '+captureCount.toLocaleString()+' splats / '+faceCount+'/'+floorStats?.eligibleFaces+' faces / '+Math.round(floorStats?.effectiveDensity??0)+' samples/m / '+captureMs+' ms':'');$('spark-triangles').setAttribute('aria-pressed',String(!active));$('spark-splats').setAttribute('aria-pressed',String(active));$('spark-splats').disabled=busy||!!benchmark;$('spark-recapture').disabled=busy||!!benchmark;$('spark-density').disabled=busy||!!benchmark;$('spark-benchmark').disabled=busy&&!benchmark;$('spark-benchmark').textContent=benchmark?'Cancel benchmark':'Benchmark all densities';$('spark-export').disabled=!report;panel.dataset.mode=active?'splats':'triangles';}
 function restore(){
  for(const p of patches)if(p.mesh.geometry===p.replacement)p.mesh.geometry=p.original;
  if(splat)splat.removeFromParent();
  if(spark)spark.removeFromParent();
  active=false;
 }
 function reset(){
  generation++;restore();
  for(const p of patches)p.replacement.dispose();patches=[];
  splat?.dispose?.();splat=null;captureDate='';captureCount=faceCount=captureMs=0;floorStats=null;
  message='Mesh baseline · live materials and lighting';update();
 }
 function show(){
  if(!splat||busy||getDate()!==captureDate||!getReady()||patches.some(p=>!p.mesh.parent||p.mesh.geometry!==p.original)){reset();return;}
  try{
   scene.add(spark,splat);
   for(const p of patches)p.mesh.geometry=p.replacement;
   active=true;message='Full-floor hybrid · all eligible static faces';
  }catch(e){restore();message='Spark failed; original meshes restored: '+e.message;}
  update();
 }
 function captureFace(face,px,py){
  const {mesh,centre,n,v,width,height}=face;
  const view=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.045,.075);
  view.position.copy(centre).addScaledVector(n,.06);view.up.copy(v);view.lookAt(centre);view.updateMatrixWorld(true);
  const target=new THREE.WebGLRenderTarget(px,py,{depthBuffer:true,stencilBuffer:false});
  const previousTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
  const oldColour=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),oldAuto=renderer.autoClear,background=scene.background;
  const shadowAuto=renderer.shadowMap.autoUpdate,shadowNeeds=renderer.shadowMap.needsUpdate,shadowEnabled=renderer.shadowMap.enabled;
  const masks=[];const enable=o=>{masks.push([o,o.layers.mask]);o.layers.enable(30);};
  view.layers.set(30);enable(mesh);scene.traverse(o=>{if(o.isLight)enable(o);});
  let restoreLights=()=>{};
  try{
   restoreLights=selectBakeLights(centre.clone().addScaledVector(n,.3));
   // No stale, viewer-dependent shadow maps are baked into remote rooms.
   scene.background=null;renderer.autoClear=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.shadowMap.enabled=false;
   renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear(true,true,true);
   renderer.render(scene,view);
   const bytes=new Uint8Array(px*py*4);renderer.readRenderTargetPixels(target,0,0,px,py,bytes);
   let covered=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>250)covered++;
   if(covered<px*py*.98)return null;
   return bytes;
  }finally{
   for(const [o,mask] of masks)o.layers.mask=mask;
   scene.background=background;renderer.autoClear=oldAuto;renderer.shadowMap.enabled=shadowEnabled;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;restoreLights();
   renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(oldColour,oldAlpha);target.dispose();
  }
 }
 async function capture(activate=false){
  if(busy)return;
  if(!getReady()||renderer.xr.isPresenting){message='Enter the gallery and finish the lift journey first; capture in desktop/mobile mode.';update();return;}
  reset();busy=true;const ticket=generation,date=getDate(),start=performance.now();update();
  let next=null;
  try{
   message='Loading Spark 2.4.0…';update();
   const {SparkRenderer,SplatMesh}=await import('@sparkjsdev/spark');
   if(ticket!==generation)return;
   spark??=new SparkRenderer({renderer,depthTest:true,depthWrite:false});
   // No visitor position, facing test, radius or nearby-face limit.
   const faces=architectureFaces(THREE,sources);
   const density=Number($('spark-density').value);
   const budget=matchMedia('(pointer: coarse)').matches?450000:1000000;
   const floor=planFloorSamples(faces,density,budget);
   const origin=faces.reduce((sum,f)=>sum.add(f.centre),new THREE.Vector3()).multiplyScalar(1/faces.length);
   const captures=[];let total=0;
   for(const {face,px,py} of floor.items){
    if(ticket!==generation||!getReady()||getDate()!==date)throw Error('Floor preparation interrupted');
    const bytes=captureFace(face,px,py);
    if(!bytes)throw Error('Incomplete floor bake at face '+(captures.length+1)+' of '+faces.length+'; original triangles retained');
    captures.push({face,px,py,bytes});total+=px*py;
    message='Preparing complete floor · '+captures.length+' / '+faces.length+' faces';update();
    await new Promise(requestAnimationFrame);
   }
   floorStats={eligibleFaces:faces.length,area:floor.area,requestedDensity:density,effectiveDensity:floor.effectiveDensity,budget,plannedSplats:floor.total};
   if(ticket!==generation)return;
   const pos=new THREE.Vector3(),scales=new THREE.Vector3(),colour=new THREE.Color(),q=new THREE.Quaternion();
   const basis=new THREE.Matrix4();
   next=new SplatMesh({raycastable:false,constructSplats(packed){
    for(const {face,px,py,bytes} of captures){
     const {centre,u,v,n,width,height}=face;
     q.setFromRotationMatrix(basis.makeBasis(u,v,n));
     scales.set(width/px*.66,height/py*.66,.006);
     for(let y=0;y<py;y++)for(let x=0;x<px;x++){
      const i=(y*px+x)*4;if(bytes[i+3]<251)continue;
      pos.copy(centre).sub(origin).addScaledVector(u,((x+.5)/px-.5)*width).addScaledVector(v,((y+.5)/py-.5)*height).addScaledVector(n,.004);
      colour.setRGB(bytes[i]/255,bytes[i+1]/255,bytes[i+2]/255);
      packed.pushSplat(pos,scales,q,1,colour);
     }
    }
   }});
   await next.initialized;
   if(ticket!==generation||getDate()!==date||!getReady()){next.dispose();next=null;return;}
   next.position.copy(origin);splat=next;next=null;
   const removed=new Map();
   for(const {face} of captures){if(!removed.has(face.mesh))removed.set(face.mesh,new Set());removed.get(face.mesh).add(face.at);}
   for(const [mesh,indices] of removed){
    const original=mesh.geometry,replacement=original.clone();
    replacement.clearGroups();replacement.setIndex(remainingArchitectureIndices(original.index,indices));
    patches.push({mesh,original,replacement});
   }
   captureDate=date;captureCount=splat.numSplats??total;faceCount=captures.length;captureMs=Math.round(performance.now()-start);
   message='Entire floor prepared. Walk freely or switch to triangles.';
  }catch(e){next?.dispose?.();if(ticket===generation){reset();wantHybrid=false;message='Full-floor preparation failed; original geometry retained: '+e.message;}}
  finally{busy=false;if(activate&&splat&&ticket===generation)show();else update();}
 }
 $('spark-triangles').onclick=()=>{wantHybrid=false;if(benchmark){cancelBenchmark();return;}if(busy){reset();message='Capture cancelled · original triangles';update();return;}restore();message='Triangles · original geometry and lighting';update();};
 $('spark-splats').onclick=()=>{wantHybrid=true;if(active)return;if(splat&&getDate()===captureDate&&getReady())show();else if(getReady())void capture(true);else{message='Hybrid selected · waiting for gallery floor';update();}};
 $('spark-recapture').onclick=()=>{wantHybrid=true;void capture(true);};
 $('spark-density').onchange=()=>{reset();message='Density changed · rebuilding when hybrid is selected';update();};
 $('spark-reset').onclick=()=>{wantHybrid=false;if(benchmark)cancelBenchmark();else reset();};
 function view(){
  return {date:getDate(),position:camera.getWorldPosition(new THREE.Vector3()).toArray(),quaternion:camera.getWorldQuaternion(new THREE.Quaternion()).toArray(),width:renderer.domElement.width,height:renderer.domElement.height,pixelRatio:renderer.getPixelRatio()};
 }
 function validateRun(run){
  if(benchmark!==run||run.cancelled)throw Error('Benchmark cancelled');
  if(document.hidden||!getReady()||renderer.xr.isPresenting||!benchmarkViewMatches(run.reference,view()))throw Error('View changed; stay still in the same visible gallery room');
 }
 function cancelBenchmark(){
  if(!benchmark)return;
  benchmark.cancelled=true;reset();
  if(measurement)finishMeasurement(Error('Benchmark cancelled'));
  message='Benchmark cancelled · original triangles';update();
 }
 function finishMeasurement(error,result){
  const m=measurement;if(!m)return;measurement=null;clearTimeout(m.timeout);
  if(error)m.reject(error);else m.resolve(result);
 }
 function measure(run,label,mode){
  validateRun(run);
  if(mode==='splats'&&(!active||!splat||captureCount<=0||!patches.length))throw Error('No active Gaussian conversion');
  message='Benchmark · '+label+' · warming up';update();
  return new Promise((resolve,reject)=>{
   measurement={run,label,mode,resolve,reject,start:performance.now(),previous:null,samples:[],lastResources:null,timeout:setTimeout(()=>finishMeasurement(Error('No continuous rendered frames')),20000)};
  });
 }
 // Called only after the real gallery post-processing render completes.
 function afterRender(){
  const m=measurement;if(!m)return;
  try{
   validateRun(m.run);
   if((m.mode==='splats')!==active)throw Error('Renderer changed during measurement');
   if(active&&(!splat?.parent||!spark?.parent||patches.some(p=>p.mesh.geometry!==p.replacement)))throw Error('Splat scene no longer active');
   const now=performance.now(),elapsed=now-m.start;
   if(elapsed<1500){m.previous=null;return;}
   if(m.previous===null){m.previous=now;message='Benchmark · '+m.label+' · measuring';update();return;}
   m.samples.push(now-m.previous);m.previous=now;
   if(elapsed<5500)return;
   const stats=summarizeFrameTimes(m.samples);
   // Three resource counts are not byte-accurate GPU memory measurements.
   const resources={geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
   let screenshot=null;
   try{screenshot=renderer.domElement.toDataURL('image/png');if(!screenshot.startsWith('data:image/png'))screenshot=null;}catch{}
   finishMeasurement(null,{label:m.label,mode:m.mode,...stats,resources,splats:active?captureCount:0,faces:active?faceCount:0,buildMs:active?captureMs:0,floor:active?floorStats:null,screenshot});
  }catch(e){finishMeasurement(e);}
 }
 function displayReport(result){
  const box=$('spark-results');box.replaceChildren();box.hidden=false;
  const heading=document.createElement('p');heading.textContent=result.error?'Incomplete: '+result.error:'Completed · stationary camera · 4 s measured per phase';box.append(heading);
  const table=document.createElement('table');
  const cell=(row,value,head=false)=>{const el=document.createElement(head?'th':'td');el.textContent=value;row.append(el);};
  const header=table.insertRow();for(const name of ['Mode','FPS','p95 ms','>50 ms','Splats','FPS Δ'])cell(header,name,true);
  for(const phase of result.phases){
   const row=table.insertRow();for(const value of [phase.label,phase.fps.toFixed(1),phase.p95Ms.toFixed(1),String(phase.stalls50ms),phase.splats.toLocaleString(),phase.comparison?(phase.comparison.fpsGainPct>=0?'+':'')+phase.comparison.fpsGainPct.toFixed(1)+'%':'—'])cell(row,value);
  }
  box.append(table);
  if(result.baselineWarning){const p=document.createElement('p');p.textContent='Baseline changed by over 10%; repeat the benchmark before trusting the comparison.';box.append(p);}
  const images=document.createElement('div');images.className='spark-benchmark-images';
  for(const phase of result.phases.filter(p=>p.screenshot&&p.label!=='Triangles (after)')){
   const a=document.createElement('a');a.href=phase.screenshot;a.download='gallery-'+phase.label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png';
   const img=document.createElement('img');img.src=phase.screenshot;img.alt=phase.label+' rendered view';a.append(img,document.createTextNode(phase.label));images.append(a);
  }
  if(images.children.length)box.append(images);
 }
 async function runBenchmark(){
  if(benchmark){cancelBenchmark();return;}
  if(busy||!getReady()||renderer.xr.isPresenting){message='Enter a gallery room before benchmarking';update();return;}
  const run={reference:view(),cancelled:false},oldDensity=$('spark-density').value;
  benchmark=run;wantHybrid=false;report=null;reset();$('spark-results').hidden=true;
  const result={version:1,view:run.reference,userAgent:navigator.userAgent,method:'Whole-floor hybrid; stationary real post-FX render cadence; 1.5 s warm-up and 4 s measurement; original triangles before and after; no VRAM estimate',phases:[]};
  try{
   result.phases.push(await measure(run,'Triangles (before)','triangles'));
   for(const [density,label] of [['12','Low'],['24','Medium'],['40','High']]){
    validateRun(run);$('spark-density').value=density;
    await capture(true);validateRun(run);
    if(!active||!captureCount)throw Error('Gaussian '+label+' capture did not activate: '+message);
    const phase=await measure(run,label+' splats','splats');phase.density=Number(density);result.phases.push(phase);
    restore();
   }
   reset();result.phases.push(await measure(run,'Triangles (after)','triangles'));
   const before=result.phases[0],after=result.phases.at(-1);
   for(const phase of result.phases.filter(p=>p.mode==='splats'))phase.comparison=pairedComparison(before,after,phase);
   result.baselineWarning=result.phases.some(p=>p.comparison?.baselineDriftPct>10);
  }catch(e){result.error=e.message;}
  finally{
   benchmark=null;reset();$('spark-density').value=oldDensity;report=result;
   displayReport(result);message=result.error?'Benchmark incomplete · original triangles':'Benchmark complete · original triangles restored';update();
  }
 }
 $('spark-benchmark').onclick=()=>void runBenchmark();
 $('spark-export').onclick=()=>{
  if(!report)return;const data={...report,phases:report.phases.map(({screenshot,...phase})=>phase)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='gaussian-gallery-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };

 // Pointer lock must not hide the controls or swallow their clicks.
 panel.addEventListener('pointerdown',e=>{e.stopPropagation();if(document.pointerLockElement)document.exitPointerLock?.();});
 panel.addEventListener('click',e=>e.stopPropagation());
 function tick(){
  frames++;const now=performance.now();
  if(now-last>=1000){fps=frames*1000/(now-last);frames=0;last=now;update();}
  if(active&&(getDate()!==captureDate||patches.some(p=>!p.mesh.parent)))reset();
  if(wantHybrid&&!active&&!busy&&!benchmark&&getReady()&&sources.length&&!renderer.xr.isPresenting)void capture(true);
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);update();
 return {reset(){reset();sources=[];},setArchitecture(meshes){reset();sources=meshes;},beforeRender(){if(active&&renderer.xr.isPresenting){wantHybrid=false;reset();}},afterRender};
}
