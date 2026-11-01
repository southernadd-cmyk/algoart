// TEST-only architecture and model texture compression. Never modifies artwork.
// Called in GitHub Actions after installing sharp and glTF Transform CLI.
// WebP is deliberately a lossily compressed *material* experiment, not an
// alternative to pixel-exact artworks or the original untouched GLBs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const base=path.resolve('test/virtual-gallery');
const entries=[
 ['textures/Bricks055_Color.jpg', 'textures/Bricks055_Color.webp',83],
 ['textures/Bricks055_NormalGL.jpg','textures/Bricks055_NormalGL.webp',90],
 ['textures/Bricks055_Roughness.jpg','textures/Bricks055_Roughness.webp',86]
];
const models=[
 ['models/gothic-entrance-door.glb','models/gothic-entrance-door-webp.glb',
  ['Entrance_Frame','Entrance_Left','Entrance_Right']],
 ['models/polyhaven-street-lamp-01-optimized.glb',
  'models/polyhaven-street-lamp-01-webp.glb',[]]
];
function inspectGLB(buffer){
 if(buffer.toString('ascii',0,4)!=='glTF'||buffer.readUInt32LE(4)!==2)
  throw Error('Not a glTF 2.0 GLB');
 if(buffer.readUInt32LE(8)!==buffer.byteLength)throw Error('Malformed GLB length');
 if(buffer.toString('ascii',16,20)!=='JSON')throw Error('No JSON chunk');
 return JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString('utf8'));
}
const report={kind:'TEST exterior material + GLB WebP compression',version:1,
 artworkAssetsChanged:false,modelGeometryChanged:false,assets:[],checks:[],
 technology:'WebP textures + EXT_meshopt_compression geometry; preserved node hierarchy',timestamp:null};
for(const [source,target,quality] of entries){
 const src=path.join(base,source),dst=path.join(base,target);
 const bytes=(await fs.stat(src)).size;
 await sharp(src).webp({quality,effort:5}).toFile(dst);
 const now=(await fs.stat(dst)).size;
 const metadata=await sharp(src).metadata(),newMeta=await sharp(dst).metadata();
 if(metadata.width!==newMeta.width||metadata.height!==newMeta.height)
  throw Error('Changed brick texture dimensions '+source);
 // Colour and material fidelity are assessed from the *decoded* pixels,
 // sampling at a constant width to keep CI memory bounded.
 const raw=async p=>sharp(p).resize({width:384,fit:'fill'})
  .removeAlpha().raw().toBuffer();
 const a=await raw(src),b=await raw(dst);
 if(a.length!==b.length)throw Error('Texture channels changed: '+source);
 let sum=0,maximum=0;
 for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);sum+=delta;
  if(delta>maximum)maximum=delta;}
 const meanDelta=+(sum/a.length).toFixed(3);
 if(now>=bytes*.96)throw Error('WebP is not materially smaller: '+source);
 // High-frequency tangent-space normals must not be destroyed.
 if(meanDelta>(source.includes('Normal')?8:11))
  throw Error('Unexpected material colour/normal distortion: '+source+' '+meanDelta);
 report.assets.push({source,target,kind:'brick-texture',quality,
  width:metadata.width,height:metadata.height,originalBytes:bytes,webpBytes:now,
  savedPercent:+((1-now/bytes)*100).toFixed(1),meanDecodedChannelDelta:meanDelta,
  maxDecodedChannelDelta:maximum});
}
for(const [source,target,requiredNodes] of models){
 const src=path.join(base,source),dst=path.join(base,target);
 const before=await fs.readFile(src),original=inspectGLB(before);
 const nodeNames=new Set((original.nodes||[]).map(n=>n.name).filter(Boolean));
 for(const node of requiredNodes)if(!nodeNames.has(node))
  throw Error('Original source is missing essential door node '+node);
 const intermediate=dst+'.stage.glb';
 try{
  execFileSync('./node_modules/.bin/gltf-transform',
   ['webp',src,intermediate,'--quality','82'],{stdio:'pipe',timeout:180000});
  // These GLBs are substantially geometry, not just textures. Compress
  // buffers with EXT_meshopt_compression; preserve exact scene node names.
  execFileSync('./node_modules/.bin/gltf-transform',
   ['meshopt',intermediate,dst,'--level','medium'],{stdio:'pipe',timeout:180000});
 }finally{await fs.rm(intermediate,{force:true});}
 const out=await fs.readFile(dst),after=inspectGLB(out);
 const afterNames=new Set((after.nodes||[]).map(n=>n.name).filter(Boolean));
 for(const node of requiredNodes)if(!afterNames.has(node))
  throw Error('Compressed model lost required animation node: '+node);
 if((after.meshes||[]).length!==(original.meshes||[]).length)
  throw Error('Compressed GLB changed mesh count: '+source);
 if((after.nodes||[]).length!==(original.nodes||[]).length)
  throw Error('Compressed GLB changed node count: '+source);
 if((after.accessors||[]).length!==(original.accessors||[]).length)
  throw Error('Compressed GLB changed accessor count: '+source);
 if(!(after.extensionsRequired||[]).includes('EXT_meshopt_compression'))
  throw Error('Meshopt buffer compression missing: '+source);
 // This command re-encodes images, not geometry. Any geometry transform
 // should be a separately reviewed experiment.
 if((after.extensionsRequired||[]).includes('EXT_texture_webp')===false&&
    (original.textures||[]).length)
  throw Error('Texture conversion did not emit EXT_texture_webp: '+source);
 if(out.byteLength>=before.byteLength*.96)
  throw Error('Model WebP reduction not worthwhile: '+source);
 report.assets.push({source,target,kind:'model-embedded-textures',
  originalBytes:before.length,webpBytes:out.length,
  savedPercent:+((1-out.length/before.length)*100).toFixed(1),
  meshCount:(original.meshes||[]).length,
  nodes:(original.nodes||[]).length,textures:(original.textures||[]).length,
  requiredNodesPreserved:requiredNodes});
}
report.totalOriginalBytes=report.assets.reduce((n,a)=>n+a.originalBytes,0);
report.totalWebpBytes=report.assets.reduce((n,a)=>n+a.webpBytes,0);
report.totalSavedPercent=+((1-report.totalWebpBytes/report.totalOriginalBytes)*100).toFixed(2);
await fs.writeFile(path.join(base,'material-webp-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('PHI_TEST_MATERIAL_WEBP_REPORT '+JSON.stringify(report));
