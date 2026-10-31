import {galleryPreparationFrame} from '../../gallery/visit/gallery-entry-preparation.mjs';
export {trackGalleryLoading,waitForGalleryEntry} from '../../gallery/visit/gallery-entry-preparation.mjs';

// Both startup and lift arrival already wait for bounded asset preparation.
// Finalise late reflection/shadow settings before compiling their shader variants.
export async function warmGalleryEntry({renderer,scene,camera,prepare=()=>{},shadowStats,
 nextFrame=galleryPreparationFrame,now=()=>performance.now()}){
 const started=now(),refreshes=shadowStats?.refreshes||0;
 prepare();
 const textures=new Set();
 scene.traverse(object=>{for(const material of [].concat(object.material||[])){
  for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture&&!value.isVideoTexture)textures.add(value);
 }});
 const uploadStart=now();let batch=0,uploadErrors=0;
 for(const texture of textures){
  if(batch++%4===0)await nextFrame();
  try{renderer.initTexture(texture);}catch(error){uploadErrors++;console.warn('Gallery texture warm-up skipped',error);}
 }
 const uploadMs=now()-uploadStart;
 // Upload batches yield to pending model callbacks. Flush their material and
 // shadow changes again, now that those callbacks have had time to attach.
 prepare();
 const compileStart=now();
 if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
 else renderer.compile?.(scene,camera);
 const compileMs=now()-compileStart;
 const renderStart=now();renderer.render(scene,camera);const renderMs=now()-renderStart;
 await nextFrame();
 const result={textures:textures.size,uploadErrors,uploadMs,compileMs,renderMs,
  totalMs:now()-started,shadowRefreshes:(shadowStats?.refreshes||0)-refreshes};
 globalThis.__phiWarmup=result;
 return result;
}
