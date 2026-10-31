// Opt-in staging-only gltfpack experiment. The source GLBs are never edited.
// If gltfpack cannot safely process an asset, stage an exact original copy
// and report the failure. Live never reads models/gltfpack/.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const candidates=[
 {name:'plants-scene-gallery-optimized.glb',requiredNames:['GLTF_SceneRootNode'],requiredPrefixes:['SmallPlantStem','YellowPlantStem']},
 {name:'modern-reception-fittings.glb',requiredNames:['ReceptionTaskChair','PreparationTable','WallLightHousing','WallLightGlow'],requiredPrefixes:[]},
 {name:'pothos-plant.glb',requiredNames:[],requiredPrefixes:[]}
];
export const sourceDir='gallery/visit/models';
export const outputDir='gallery/visit/models/gltfpack';
export const flags=['-kn','-km','-ke']; // No simplification, meshopt, or lossy texture conversion.
export function readGLB(file){
 const data=readFileSync(file);
 if(data.length<20||data.toString('utf8',0,4)!=='glTF'||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)
  throw Error('Invalid GLB header: '+basename(file));
 const jsonLen=data.readUInt32LE(12);
 if(data.toString('utf8',16,20)!=='JSON')throw Error('Missing GLB JSON');
 const doc=JSON.parse(data.toString('utf8',20,20+jsonLen));
 let binary=null,ptr=20+jsonLen;
 while(ptr+8<=data.length){
  const length=data.readUInt32LE(ptr),kind=data.toString('utf8',ptr+4,ptr+8);
  if(kind.startsWith('BIN'))binary=data.subarray(ptr+8,ptr+8+length);
  ptr+=8+length;
 }
 const imageHashes=[];
 for(const image of doc.images||[]){
  if(image.uri)throw Error('External textures not supported in this pilot');
  const view=doc.bufferViews?.[image.bufferView];
  if(!binary||!view)throw Error('Missing embedded image data');
  imageHashes.push(createHash('sha256').update(binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)).digest('hex'));
 }
 return {doc,imageHashes:imageHashes.sort(),
  names:new Set((doc.nodes||[]).map(n=>n.name).filter(Boolean)),
  materialNames:new Set((doc.materials||[]).map(n=>n.name).filter(Boolean)),
  trianglePrimitives:(doc.meshes||[]).flatMap(m=>m.primitives||[]).filter(p=>p.mode===undefined||p.mode===4).length};
}
export function checkEquivalent(src,dst,required){
 const original=readGLB(src),packed=readGLB(dst);
 for(const name of required.requiredNames)if(!packed.names.has(name))throw Error('Named node removed: '+name);
 for(const prefix of required.requiredPrefixes)if(![...packed.names].some(n=>n.startsWith(prefix)))throw Error('Missing plant subtree prefix: '+prefix);
 for(const name of original.materialNames)if(!packed.materialNames.has(name))throw Error('Named material changed: '+name);
 if(JSON.stringify(original.imageHashes)!==JSON.stringify(packed.imageHashes))
  throw Error('Source texture bytes changed; refusing lossy or altered images');
 if((original.doc.animations||[]).length!==(packed.doc.animations||[]).length)
  throw Error('Animation count changed');
 if(!(packed.doc.meshes||[]).length)throw Error('No meshes in output');
 const ext=packed.doc.extensionsRequired||[];
 if(ext.includes('EXT_meshopt_compression')||ext.includes('KHR_draco_mesh_compression')||ext.includes('KHR_texture_basisu'))
  throw Error('Output needs a decoder unavailable in the shared asset loader');
 return {
  sourceMeshCount:(original.doc.meshes||[]).length,outputMeshCount:(packed.doc.meshes||[]).length,
  sourceNodes:(original.doc.nodes||[]).length,outputNodes:(packed.doc.nodes||[]).length,
  sourceImageCount:original.imageHashes.length,outputImageCount:packed.imageHashes.length,
  sourceMaterialCount:original.materialNames.size,outputMaterialCount:packed.materialNames.size,
  extensions:ext
 };
}
export function packAssets({base=process.cwd(),binary=join(base,'node_modules/.bin/gltfpack')}={}){
 const source=resolve(base,sourceDir),output=resolve(base,outputDir);
 mkdirSync(output,{recursive:true});
 const report={purpose:'Test-only gltfpack A/B; original model paths unchanged',
  library:'gltfpack',version:'1.3.0',flags,created:new Date().toISOString(),candidates:[]};
 for(const candidate of candidates){
  const from=join(source,candidate.name),to=join(output,candidate.name);
  const sourceBytes=statSync(from).size;
  let optimized=false,reason='',meta={};
  try{
   if(!existsSync(binary))throw Error('gltfpack executable unavailable');
   const result=spawnSync(binary,['-i',from,'-o',to,...flags],{encoding:'utf8',timeout:120000,maxBuffer:2e6});
   if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr?.trim()||'gltfpack exited '+result.status);
   meta=checkEquivalent(from,to,candidate);
   optimized=true;
  }catch(error){
   reason=String(error.message||error);
   copyFileSync(from,to);
  }
  const outputBytes=statSync(to).size;
  report.candidates.push({name:candidate.name,optimized,reason:optimized?undefined:reason,
   originalBytes:sourceBytes,stagedBytes:outputBytes,
   savingsBytes:sourceBytes-outputBytes,savingsPercent:Number((100*(sourceBytes-outputBytes)/sourceBytes).toFixed(1)),...meta});
  process.stdout.write(candidate.name+': '+(optimized?'gltfpack':'source fallback')+' '+sourceBytes+' -> '+outputBytes+' bytes'+(reason?' ('+reason+')':'')+'\n');
 }
 const reportFile=join(output,'report.json');
 writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 process.stdout.write('Pilot report: '+reportFile+'\n');
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 packAssets();
}
