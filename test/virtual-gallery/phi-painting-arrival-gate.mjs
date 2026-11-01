// TEST ONLY: painting readiness is the lift-door interlock, not optional
// furnishings or a short, unrelated scene-loading timeout. Each painting is
// ready only once its attached map has successfully passed renderer.initTexture.
export function createPhiPaintingArrivalGate({
 date,expected,upload,nextFrame,now=()=>performance.now()
}){
 if(!Number.isInteger(expected)||expected<0)throw new TypeError('Expected painting count required');
 if(typeof upload!=='function'||typeof nextFrame!=='function')
  throw new TypeError('Painting arrival gate requires upload and frame callbacks');
 const entries=new Map(),errors=[];
 let ready=0,cancelled=false,uploadTail=Promise.resolve();
 const register=(id,face)=>{
  if(cancelled||entries.has(id))throw new Error('Duplicate or stale painting: '+id);
  const entry={id,face,state:'pending',error:null};
  entries.set(id,entry);
  return {
   ready(texture){
    if(cancelled||entry.state!=='pending'){texture?.dispose?.();return;}
    entry.state='uploading';
    const task=uploadTail.then(async()=>{
     await nextFrame();
     if(cancelled||!face.parent||face.userData?.galleryDisposed){
      if(face.material?.map===texture)face.material.map=null;
      texture.dispose?.();
      return;
     }
     try{
      if(face.material?.map!==texture||!texture?.isTexture||!texture.image)
       throw Error('Painting texture missing from its wall');
      upload(texture);
      entry.state='ready';ready++;
     }catch(error){
      entry.state='failed';
      entry.error=String(error?.message||error);
      errors.push({id,message:entry.error});
     }
    });
    uploadTail=task.catch(()=>{});
   },
   fail(error){
    if(cancelled||entry.state!=='pending')return;
    entry.state='failed';
    entry.error=String(error?.message||error);
    errors.push({id,message:entry.error});
   }
  };
 };
 const stats=()=>({date,expected,registered:entries.size,ready,
  pending:[...entries.values()].filter(e=>e.state!=='ready'&&e.state!=='failed').map(e=>e.id),
  failures:[...errors],complete:ready===expected&&entries.size===expected});
 const wait=async({pump=()=>{},timeoutMs=50000,onProgress=()=>{}}={})=>{
  const started=now();
  if(entries.size!==expected)throw new Error('Expected '+expected+' paintings, registered '+entries.size);
  while(!cancelled){
   if(errors.length)throw new Error('Painting could not be prepared: '+errors.map(e=>e.id+' ('+e.message+')').join(', '));
   if(ready===expected)return {...stats(),elapsedMs:+(now()-started).toFixed(1)};
   if(now()-started>=timeoutMs)
    throw new Error('Painting preparation timed out: '+ready+'/'+expected+' ready');
   pump();onProgress(stats());
   await nextFrame();
  }
  throw new Error('Painting preparation cancelled');
 };
 const cancel=()=>{cancelled=true;};
 return {register,stats,wait,cancel};
}
