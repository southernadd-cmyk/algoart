// Experimental: compilation-only view of original destination objects.
// No reparenting, cloning, visibility, material or geometry changes.
export async function warmPhiLiftDestination({renderer,scene,camera,objects,nextFrame,onStage}){
 const started=performance.now(),seen=new Set(),textures=new Set();
 const roots=[...objects];
 const view={
  traverse(fn){
   seen.clear();
   for(const root of roots)root.traverse(object=>{
    if(seen.has(object)||object.userData?.galleryDisposed)return;
    seen.add(object);fn(object);
   });
  },
  // All lights already belong to targetScene: do not count them twice.
  traverseVisible(){}
 };
 if(!renderer.compileAsync)throw Error('Destination precompile requires compileAsync');
 await renderer.compileAsync(view,camera,scene);
 const compileMs=performance.now()-started;
 view.traverse(object=>{
  for(const material of [].concat(object.material||[]))
   for(const value of Object.values(material))
    if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);
 });
 const uploadStart=performance.now();let batch=0;
 for(const texture of textures){
  if(batch++%4===0)await nextFrame();
  renderer.initTexture(texture);
 }
 const result={textures:textures.size,compileMs,uploadMs:performance.now()-uploadStart,
  totalMs:performance.now()-started,failedUploads:0,skipFinalRender:true};
 onStage?.('warmup-details',result);
 return result;
}
