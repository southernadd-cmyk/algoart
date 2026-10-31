// Production lift-arrival renderer staging. Preserve the destination's exact
// geometry, textures, shaders, materials, lights, painting pixels and final
// visibility. Only first-render visibility is spread across animation frames.
// Adapted from the tested fixed-size staging path; adaptive mode is excluded.
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
  for(const {object,visible} of entries)
   if(object&&!object.userData?.galleryDisposed)object.visible=visible;
  entries=[];running=false;date=null;shown=0;batches=[];
 }
 function start(nextDate,roots,{exclude=null}={}){
  restore();
  date=nextDate;
  const seen=new Set();
  for(const root of roots||[]){
   if(!root?.traverse)continue;
   root.traverse(object=>{
    if(!drawable(object)||!object.visible||seen.has(object)||object.userData?.galleryDisposed)return;
    if(exclude&&inside(object,exclude))return;
    seen.add(object);entries.push({object,visible:object.visible});
    object.visible=false;
   });
  }
  running=true;
  return stats();
 }
 function stats(){
  return {date,active:running,total:entries.length,shown,
   hidden:entries.length-shown,batches:[...batches]};
 }
 async function reveal({batchSize=16,onBatch=()=>{},onBatchStart=()=>{}}={}){
  if(!running)return stats();
  if(!Number.isInteger(batchSize)||batchSize<1)throw TypeError('Invalid scene batch size');
  const version=generation;
  for(let index=shown;index<entries.length;index+=batchSize){
   if(generation!==version)throw Error('Scene reveal cancelled');
   const section=entries.slice(index,index+batchSize);
   let paintings=0;
   for(const {object,visible} of section){
    if(!object.userData?.galleryDisposed&&object.parent){
     object.visible=visible;
     if(object.userData?.phiArtOriginal)paintings++;
    }
   }
   const began=now();
   onBatchStart({index:batches.length,count:section.length,
    paintings,total:entries.length,shown:index+section.length});
   // Identical to the successfully tested two-frame fixed-size scheduling:
   // no shader or GPU quality tier is changed; each batch is fully revealed
   // before the next one is introduced.
   await nextFrame();await nextFrame();
   if(generation!==version)throw Error('Scene reveal cancelled');
   shown=index+section.length;
   const data={index:batches.length,count:section.length,paintings,
    total:entries.length,shown,ms:+(now()-began).toFixed(1)};
   batches.push(data);
   onBatch(data);
  }
  running=false;
  return stats();
 }
 return {start,reveal,restore,stats};
}
