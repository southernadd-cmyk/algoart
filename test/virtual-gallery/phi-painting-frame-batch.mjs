// Only the fixed, opaque painting frames are eligible. Doors, glazing,
// labels, moving objects and artwork remain separate.
// Instancing keeps the actual BoxGeometry faces, normals and UVs unchanged.
// The brushed shader receives each original frame-local position through
// phiFrameDimensions instead of seeing the 1m shared unit-cube coordinates.
export function batchPhiPaintingFrames(THREE,scene,frames,{createMaterial}={}){
 const original=frames.length;
 if(original<2)return {active:false,original,batched:original,savedDrawCalls:0,reason:'too few frames'};
 const eligible=frames.every(frame=>{
  const shape=frame.geometry?.parameters;
  return frame.parent===scene&&frame.isMesh&&!frame.isInstancedMesh&&frame.visible&&
   frame.geometry?.type==='BoxGeometry'&&shape&&
   [shape.width,shape.height,shape.depth].every(v=>Number.isFinite(v)&&v>0)&&
   frame.material===frames[0].material;
 });
 if(!eligible||typeof createMaterial!=='function')
  return {active:false,original,batched:original,savedDrawCalls:0,reason:'unsupported geometry or material'};
 let geometry=null,material=null,batched=null;
 try{
  geometry=new THREE.BoxGeometry(1,1,1);
  const dimensions=new Float32Array(original*3);
  const composed=new THREE.Matrix4(),scale=new THREE.Matrix4();
  batched=new THREE.InstancedMesh(geometry,null,original);
  batched.name='phi-instanced-painting-frames';
  // Preserve original per-frame positioning in the unrotated floor-space;
  // the existing floor rotation is applied to this root exactly once.
  for(let i=0;i<original;i++){
   const frame=frames[i],shape=frame.geometry.parameters;
   const w=shape.width,h=shape.height,d=shape.depth;
   dimensions.set([w,h,d],i*3);
   frame.updateMatrix();
   scale.makeScale(w,h,d);
   composed.multiplyMatrices(frame.matrix,scale);
   batched.setMatrixAt(i,composed);
  }
  geometry.setAttribute('phiFrameDimensions',new THREE.InstancedBufferAttribute(dimensions,3));
  batched.instanceMatrix.needsUpdate=true;
  batched.computeBoundingSphere();
  material=createMaterial();
  if(!material?.isMaterial)throw new Error('No compatible instance-shader material');
  batched.material=material;
  scene.add(batched);
  // Originals are not touched until the entire replacement is valid.
  for(const frame of frames){scene.remove(frame);frame.geometry.dispose();}
  return {active:true,original,batched:1,savedDrawCalls:original-1,
   sharedGeometry:1,shaderLocalCoordinates:true};
 }catch(error){
  if(batched?.parent)batched.parent.remove(batched);
  geometry?.dispose();
  material?.dispose();
  console.warn('[Phi frame batch] Reverting to original painting frames',error);
  return {active:false,original,batched:original,savedDrawCalls:0,reason:String(error?.message||error)};
 }
}
