// Test-only destination visibility staging. The destination is initially
// built off-camera with the lift doors closed. Show its *renderable* objects
// in bounded batches, allowing a real render between batches instead of
// exposing an entire floor's textures and material variants in one frame.
// Materials, geometry, positions, art maps and post-processing remain unchanged.
export function createPhiArrivalMeshStager({nextFrame,now=()=>performance.now()}={}){
 if(typeof nextFrame!=='function')throw TypeError('Animation-frame callback required');
 let entries=[],running=false,date=null,shown=0,batches=[],generation=0;
 const drawable=obj=>!!(obj?.isMesh||obj?.isLine||obj?.isPoints||obj?.isSprite);
 const inside=(node,root)=>{
  for(let obj=node;obj;obj=obj.parent)if(obj===root)return true;
  return false;
 };
 function restore(){
  generation++;
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
 async function reveal({batchSize=20,onBatch=()=>{},onBatchStart=()=>{}}={}){
  if(!running)return stats();
  if(!Number.isInteger(batchSize)||batchSize<1)throw TypeError('Invalid scene batch size');
  const version=generation;
  for(let index=shown;index<entries.length;index+=batchSize){
   if(generation!==version)throw Error('Scene reveal cancelled');
   const section=entries.slice(index,index+batchSize);
   let painting=0;
   for(const {object,visible} of section){
    if(!object.userData?.galleryDisposed&&object.parent){
     object.visible=visible;
     if(object.userData?.phiArtOriginal)painting++;
    }
   }
   const before=now();
   onBatchStart({index:batches.length,count:section.length,paintings:painting,total:entries.length,shown:index+section.length});
   // Ensure a complete animation/render turn occurs before introducing
   // another batch. Each batch may reveal a new shader/texture variant.
   await nextFrame();
   await nextFrame();
   if(generation!==version)throw Error('Scene reveal cancelled');
   shown=index+section.length;
   const data={index:batches.length,count:section.length,paintings:painting,
    total:entries.length,shown,ms:+(now()-before).toFixed(1)};
   batches.push(data);
   onBatch(data);
  }
  running=false;
  return stats();
 }
 return {start,reveal,restore,stats};
}
