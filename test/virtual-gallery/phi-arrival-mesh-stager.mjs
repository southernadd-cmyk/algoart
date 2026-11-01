// TEST ONLY: stage destination renderables while the lift doors stay closed.
// The legacy 20-mesh / two-rAF control is unchanged unless explicitly opted
// into ?liftbatch=adaptive (or a fixed test size). The adaptive mode waits for
// an ACTUAL completed render between batches, not an arbitrary animation tick.
// Never alters geometry, artwork maps, textures, shaders, materials or lighting.
export function createPhiArrivalMeshStager({nextFrame,now=()=>performance.now()}={}){
 if(typeof nextFrame!=='function')throw TypeError('Animation-frame callback required');
 let entries=[],running=false,date=null,shown=0,batches=[],generation=0,pendingRender=null;
 const drawable=obj=>!!(obj?.isMesh||obj?.isLine||obj?.isPoints||obj?.isSprite);
 const inside=(node,root)=>{
  for(let obj=node;obj;obj=obj.parent)if(obj===root)return true;
  return false;
 };
 // Called only after phiPostFX.render() returns, so a batch genuinely made
 // it through the existing render path before another is made visible.
 function renderedFrame(ms){
  if(!pendingRender)return;
  const resolve=pendingRender;pendingRender=null;
  resolve({renderMs:Number.isFinite(ms)?ms:null});
 }
 function restore(){
  generation++;
  // Avoid leaving a reveal coroutine hung if the lift is cancelled.
  if(pendingRender){const resolve=pendingRender;pendingRender=null;resolve({cancelled:true});}
  for(const entry of entries){
   if(entry.object&&!entry.object.userData?.galleryDisposed)
    entry.object.visible=entry.visible;
  }
  entries=[];running=false;date=null;shown=0;batches=[];
 }
 function start(nextDate,roots,{exclude=null}={}){
  restore();
  date=nextDate;
  const seen=new Set();
  for(const root of roots||[]){
   if(!root?.traverse)continue;
   root.traverse(obj=>{
    if(!drawable(obj)||!obj.visible||seen.has(obj)||obj.userData?.galleryDisposed)return;
    if(exclude&&inside(obj,exclude))return;
    seen.add(obj);
    entries.push({object:obj,visible:obj.visible});
    obj.visible=false;
   });
  }
  running=true;
  return stats();
 }
 function stats(){return {date,active:running,total:entries.length,shown,hidden:entries.length-shown,batches:[...batches]};}
 // TEST ONLY: compile material variants of the actual staged destination.
 // The previous precompile skipped these hidden meshes entirely.
 // compileAsync traverses synchronously and yields a Promise for GPU completion.
 function compileHiddenDestination(compile){
  if(!running||!entries.length||typeof compile!=='function')
   return {attempted:false,promise:null,count:0};
  const version=generation;
  let count=0,promise=null;
  try{
   for(const entry of entries){
    if(entry.object&&!entry.object.userData?.galleryDisposed&&entry.object.parent){
     entry.object.visible=entry.visible;count++;
    }
   }
   promise=compile();
  }finally{
   // Restore BEFORE the first async boundary. The visitor never sees the
   // destination ahead of the 16-mesh stage, even on compiler exceptions.
   if(version===generation){
    for(const entry of entries){
     if(entry.object&&!entry.object.userData?.galleryDisposed&&entry.object.parent)
      entry.object.visible=false;
    }
   }
  }
  return {attempted:true,promise:Promise.resolve(promise),count};
 }
 // Adjust only the number of meshes whose ORIGINAL visibility is restored
 // per render; no render quality/performance tier changes are permitted.
 async function reveal({batchSize=20,mode='legacy',minBatch=6,maxBatch=24,
  onBatch=()=>{},onBatchStart=()=>{}}={}){
  if(!running)return stats();
  if(!Number.isInteger(batchSize)||batchSize<1)throw TypeError('Invalid scene batch size');
  if(!['legacy','render','adaptive'].includes(mode))throw TypeError('Invalid scene pacing mode');
  if(!Number.isInteger(minBatch)||minBatch<1||!Number.isInteger(maxBatch)||maxBatch<minBatch)
   throw TypeError('Invalid adaptive scene batch bounds');
  const version=generation;
  let size=mode==='adaptive'?Math.max(minBatch,Math.min(maxBatch,batchSize)):batchSize;
  while(shown<entries.length){
   if(generation!==version)throw Error('Scene reveal cancelled');
   const index=shown,section=entries.slice(index,index+size);
   let paintings=0;
   for(const {object,visible} of section){
    if(!object.userData?.galleryDisposed&&object.parent){
     object.visible=visible;
     if(object.userData?.phiArtOriginal)paintings++;
    }
   }
   const began=now(),id=batches.length;
   onBatchStart({index:id,count:section.length,paintings,total:entries.length,shown:index+section.length});
   let renderMs=null;
   if(mode==='legacy'){
    // Preserve the proven baseline and its two animation-frame turns.
    await nextFrame();await nextFrame();
   }else{
    // Yield until the gallery's real postFX scene render has finished.
    const result=await new Promise(resolve=>{pendingRender=resolve;});
    if(result.cancelled)throw Error('Scene reveal cancelled');
    renderMs=result.renderMs;
   }
   if(generation!==version)throw Error('Scene reveal cancelled');
   shown=index+section.length;
   if(mode==='adaptive'&&renderMs!==null){
    if(renderMs>80)size=Math.max(minBatch,Math.floor(size/2));
    else if(renderMs>40)size=Math.max(minBatch,Math.floor(size*.75));
    else if(renderMs>24)size=Math.max(minBatch,size-2);
    else if(renderMs<15)size=Math.min(maxBatch,size+4);
    else if(renderMs<24)size=Math.min(maxBatch,size+2);
   }
   const data={index:id,count:section.length,paintings,total:entries.length,shown,
    ms:+(now()-began).toFixed(1),...(renderMs!==null?{renderMs:+renderMs.toFixed(1)}:{}),
    nextBatchSize:size};
   batches.push(data);onBatch(data);
  }
  running=false;
  return stats();
 }
 return {start,reveal,restore,renderedFrame,stats,compileHiddenDestination};
}
