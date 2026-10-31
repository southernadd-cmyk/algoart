// Keep all archived floor geometry across lift rides. Only the selected
// three-floor chunk needs a view which omits the currently active floor.
export function createPhiShellChunkController({floorCount,chunkSize=3,createView,disposeView,toggleFloor}) {
 if(!Number.isInteger(floorCount)||floorCount<1||!Number.isInteger(chunkSize)||chunkSize<1)
  throw new RangeError('Invalid tower shell floor or chunk count');
 const chunks=[];
 for(let start=0;start<floorCount;start+=chunkSize)
  chunks.push({start,floors:Array.from({length:Math.min(chunkSize,floorCount-start)},(_,i)=>start+i),views:new Map(),active:null});
 let activeFloor=null,created=0;
 function activate(floor){
  if(!Number.isInteger(floor)||floor<0||floor>=floorCount)throw new RangeError('Invalid archive floor');
  if(floor===activeFloor)return false;
  for(const chunk of chunks){
   const selected=chunk.floors.includes(floor)?floor:-1;
   if(chunk.active===selected)continue;
   let view=chunk.views.get(selected);
   if(!view){
    view=createView(chunk.start,chunk.floors,selected);
    chunk.views.set(selected,view);created++;
   }
   for(const [key,other] of chunk.views)other.visible=(key===selected);
   chunk.active=selected;
   // Limit GPU buffers: retain the full batch plus one masked variant.
   if(selected!==-1)for(const [key,other] of [...chunk.views]){
    if(key===-1||key===selected)continue;
    chunk.views.delete(key);disposeView(other);
   }
  }
  const previous=activeFloor;activeFloor=floor;
  toggleFloor(floor,previous);
  return true;
 }
 function dispose(){
  for(const chunk of chunks){
   for(const view of chunk.views.values())disposeView(view);
   chunk.views.clear();chunk.active=null;
  }
  activeFloor=null;
 }
 const stats=()=>({activeFloor,created,retained:chunks.reduce((n,c)=>n+c.views.size,0),chunks:chunks.length});
 return {activate,dispose,stats};
}
