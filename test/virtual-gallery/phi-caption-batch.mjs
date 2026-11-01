import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Pure layout: never request an atlas larger than the renderer's texture limit.
export function planPhiCaptionAtlases(count,{width=900,height=210,padding=16,maxTextureSize=4096}={}){
 const tileW=width+2*padding,tileH=height+2*padding;
 const maxCols=Math.floor(maxTextureSize/tileW),maxRows=Math.floor(maxTextureSize/tileH);
 if(maxCols<1||maxRows<1)return [];
 const batches=[];
 for(let start=0;start<count;){
  const n=Math.min(count-start,maxCols*maxRows);
  const cols=Math.min(maxCols,n),rows=Math.ceil(n/cols);
  const slots=Array.from({length:n},(_,i)=>({index:start+i,x:i%cols*tileW,y:Math.floor(i/cols)*tileH}));
  batches.push({width:cols*tileW,height:rows*tileH,padding,sourceWidth:width,sourceHeight:height,slots});
  start+=n;
 }
 return batches;
}
export function phiCaptionAtlasUv(u,v,slot,atlas){
 return [(slot.x+atlas.padding+u*atlas.sourceWidth)/atlas.width,
  1-(slot.y+atlas.padding+(1-v)*atlas.sourceHeight)/atlas.height];
}

// TEST-only opt-in. Merge only painting captions, never painting surfaces,
// artwork textures, custom frame shaders, lighting or moving architecture.
// The original geometry is baked with its local rotation before floor rotation.
export function batchPhiPaintingCaptions(THREE,scene,captions,{maxTextureSize=4096}={}){
 const original=captions.length;
 if(original<2)return {active:false,original,batched:0,drawCallsSaved:0};
 const layouts=planPhiCaptionAtlases(original,{maxTextureSize:Math.min(4096,maxTextureSize)});
 if(!layouts.length)return {active:false,original,batched:0,drawCallsSaved:0,reason:'texture limit'};
 const replacements=[];
 try{
  for(const layout of layouts){
   const canvas=document.createElement('canvas');
   canvas.width=layout.width;canvas.height=layout.height;
   const context=canvas.getContext('2d');
   if(!context)throw new Error('No 2D context for caption atlas');
   const parts=[];
   for(const slot of layout.slots){
    const originalMesh=captions[slot.index],source=originalMesh.material.map?.image;
    if(!source||source.width!==layout.sourceWidth||source.height!==layout.sourceHeight)
     throw new Error('Caption source dimensions differ');
    const x=slot.x+layout.padding,y=slot.y+layout.padding,w=layout.sourceWidth,h=layout.sourceHeight;
    context.drawImage(source,x,y);
    // Repeat boundary pixels into padding so filtering/mipmaps cannot blend
    // neighbouring captions. All original image pixels are left unchanged.
    const p=layout.padding;
    context.drawImage(source,0,0,w,1,x,y-p,w,p);
    context.drawImage(source,0,h-1,w,1,x,y+h,w,p);
    context.drawImage(source,0,0,1,h,x-p,y,p,h);
    context.drawImage(source,w-1,0,1,h,x+w,y,p,h);
    for(const [sx,sy,dx,dy] of [[0,0,x-p,y-p],[w-1,0,x+w,y-p],
      [0,h-1,x-p,y+h],[w-1,h-1,x+w,y+h]]){
     context.drawImage(source,sx,sy,1,1,dx,dy,p,p);
    }
    const geometry=originalMesh.geometry.clone(),uv=geometry.getAttribute('uv');
    for(let vertex=0;vertex<uv.count;vertex++){
     const [u,v]=phiCaptionAtlasUv(uv.getX(vertex),uv.getY(vertex),slot,layout);
     uv.setXY(vertex,u,v);
    }
    uv.needsUpdate=true;
    originalMesh.updateMatrix();
    geometry.applyMatrix4(originalMesh.matrix);
    parts.push(geometry);
   }
   const merged=mergeGeometries(parts,false);
   parts.forEach(geometry=>geometry.dispose());
   if(!merged)throw new Error('Caption geometry merge failed');
   merged.computeBoundingSphere();
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide});
   const mesh=new THREE.Mesh(merged,material);
   mesh.name='phi-batched-painting-captions';
   replacements.push(mesh);
  }
  for(const mesh of replacements)scene.add(mesh);
  for(const mesh of captions){
   scene.remove(mesh);
   mesh.geometry.dispose();
   mesh.material.map?.dispose();
   mesh.material.dispose();
  }
  return {active:true,original,batched:replacements.length,
   drawCallsSaved:original-replacements.length,sourceTexturesRemoved:original,
   atlasTextures:replacements.length};
 }catch(error){
  for(const mesh of replacements){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
  console.warn('[Gallery captions] Atlas batching skipped; original captions kept',error);
  return {active:false,original,batched:0,drawCallsSaved:0,reason:String(error?.message||error)};
 }
}
