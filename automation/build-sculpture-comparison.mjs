import {mkdir,writeFile,rename} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {downloadV2Prepared} from '../gallery/sculpture-v2-test/v2-pack-loader.mjs';
import {buildSculptureAlternatives,SCULPTURE_COMPARISON_DATE as date,SCULPTURE_COMPARISON_VERSION as version} from '../gallery/gaussian-splat-lab/sculpture-assets.mjs';
const dir='gallery/gaussian-splat-lab';
await mkdir(dir,{recursive:true});
const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(45000)});
for(const [quality,budget] of [['mobile',12000],['desktop',30000]]){
 const source=await downloadV2Prepared(date,quality,{fetcher});
 const studies={};
 for(const [name,study] of Object.entries(source.studies)){
  const alt=buildSculptureAlternatives(study,budget);
  // Keep sample data compact and lossless to the chosen Float32 precision.
  alt.points=Buffer.from(new Float32Array(alt.points).buffer).toString('base64');
  studies[name]=alt;
 }
 const output=gzipSync(JSON.stringify({version,date,quality,studies}),{level:6});
 const file=dir+'/sculptures-'+date+'-'+quality+'-v'+version+'.json.gz';
 await writeFile(file+'.tmp',output);await rename(file+'.tmp',file);
 console.log('SCULPTURE_COMPARISON',quality,output.length,Object.values(studies).map(s=>({seed:s.seed,original:s.originalTriangles,simplified:s.simpleTriangles,splats:s.pointCount})));
}
