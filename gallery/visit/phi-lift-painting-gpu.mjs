// TEST ONLY: move the destination painting's first GPU upload into the lift
// journey, one texture per animation frame. The source image and texture
// settings are unchanged; failed pre-uploads retain the normal arrival path.
export function createPhiLiftPaintingGPUPreparer({makeTexture,upload,nextFrame,now=()=>performance.now(),onEvent=null}){
 if(!makeTexture||!upload||!nextFrame)throw new TypeError('Painting GPU preparation requires texture, upload and frame callbacks');
 let tail=Promise.resolve(),session={date:null,prepared:0,uploaded:0,failed:0,slowUploads:[]};
 const start=date=>{session={date,prepared:0,uploaded:0,failed:0,slowUploads:[]};};
 const prepare=(image,{date,isCancelled,url})=>{
  if(!image||isCancelled())return Promise.resolve(null);
  const texture=makeTexture(image);
  const generation=session;
  generation.prepared++;
  const task=tail.catch(()=>{}).then(async()=>{
   await nextFrame();
   if(isCancelled()){
    texture.dispose?.();
    return null;
   }
   const began=now();
   try{upload(texture);generation.uploaded++;}
   catch(error){
    // The regular arrival warm-up retries failed uploads after attachment.
    generation.failed++;
    console.warn('Destination painting pre-upload skipped',error);
   }
   const ms=now()-began;
   onEvent?.('painting-preupload',{date,url,ms,width:texture.image?.width||0,height:texture.image?.height||0});
   if(ms>=40 && generation.slowUploads.length<12)
    generation.slowUploads.push({ms:+ms.toFixed(1),width:texture.image?.width||0,height:texture.image?.height||0});
   return texture;
  });
  // Serialise uploads across different decoded images; never submit two on
  // the same animation frame. Rejection must not block subsequent paintings.
  tail=task.then(()=>{},()=>{});
  return task;
 };
 const stats=()=>({date:session.date,prepared:session.prepared,
  uploaded:session.uploaded,failed:session.failed,slowUploads:[...session.slowUploads]});
 return {start,prepare,stats};
}
