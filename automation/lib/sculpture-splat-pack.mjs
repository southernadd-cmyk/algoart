import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildSculptureAlternatives} from '../../gallery/sculpture-splats/generator.mjs';
import {SPLAT_FORMAT,SPLAT_FORMAT_VERSION,SPLAT_ALGORITHM,SPLAT_STRIDE,SPLAT_BUDGETS,SPLAT_GEOMETRY_REVISION,validEdition,validatePointRecords,encodePointBytes} from '../../gallery/sculpture-splats/format.mjs';

export const sha256=data=>createHash('sha256').update(data).digest('hex');
export function buildSplatPack(source,{date,quality,sourceSha256}={}){
 if(!validEdition(date)||!Object.hasOwn(SPLAT_BUDGETS,quality)||!sourceSha256||!/^[a-f0-9]{64}$/.test(sourceSha256))
  throw Error('Invalid splat pack identity');
 if(source?.schema!=='pp-sculpture-v2-floor'||source.version!==2||source.date!==date||source.quality!==quality||
    source.complete!==true||source.method!=='assembly'||source.geometryRevision!==SPLAT_GEOMETRY_REVISION)
  throw Error('Invalid V2 source floor');
 const entries=Object.entries(source.studies||{}).sort(([a],[b])=>a<b?-1:a>b?1:0);
 if(entries.length!==source.expectedPortraits||!entries.length)throw Error('Incomplete V2 source floor');
 const studies=Object.create(null);
 for(const [name,study] of entries){
  if(!name||study.schema!=='pp-sculpture-v2-study'||study.version!==2||study.quality!==quality||
     study.method!=='assembly'||study.geometryRevision!==SPLAT_GEOMETRY_REVISION||study.coverage!==1||study.omittedCells!==0||
     !study.seed||!study.regionCount||study.meshes?.length<study.regionCount)
   throw Error('Invalid V2 source study '+name);
  // Daily and reception packs both use their archive key as the lookup identity.
  if(study.imageFile!==name)throw Error('V2 study image identity mismatch '+name);
  const alt=buildSculptureAlternatives(study,SPLAT_BUDGETS[quality],{includeSimplified:false});
  if(alt.originalTriangles!==study.triangleCount)throw Error('V2 triangle count mismatch '+name);
  const materialCounts=study.meshes.map(m=>m.materials?.length||0);
  const bytes=encodePointBytes(alt.points);
  validatePointRecords(alt.points,alt.meshCounts,materialCounts,alt.pointCount);
  // Every encoded record is explicitly little-endian Float32; independent of host architecture.
  studies[name]={seed:study.seed,imageFile:name,sourceFile:study.sourceFile??null,
   sourceGeometrySha256:sha256(JSON.stringify(study)),originalTriangles:alt.originalTriangles,
   meshCounts:alt.meshCounts,materialCounts,pointCount:alt.pointCount,
   pointsSha256:sha256(bytes),points:Buffer.from(bytes).toString('base64')};
 }
 const pack={schema:SPLAT_FORMAT,version:SPLAT_FORMAT_VERSION,algorithm:SPLAT_ALGORITHM,geometryRevision:SPLAT_GEOMETRY_REVISION,
  date,quality,sourceSha256,stride:SPLAT_STRIDE,encoding:'f32le-base64',expectedPortraits:entries.length,studies};
 const bytes=gzipSync(JSON.stringify(pack),{level:6});
 return {pack,bytes,sha256:sha256(bytes)};
}
