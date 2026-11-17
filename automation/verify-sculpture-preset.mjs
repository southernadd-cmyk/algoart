// SHA-verified public R2 reads using the same HTTP client as the working baker.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const WORKER='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev';
const ORIGIN='https://southernadd-cmyk.github.io';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function fetchVerifiedSculpture(spec,{fetcher=fetch}={}){
 const url=new URL(spec.url);
 if(url.origin!==WORKER||url.search||url.hash||
    !/^\/sculptures-v2\/(?:v4\.2\.1-20261110|assembly-20261117)\//.test(url.pathname)||
    !/^[a-f0-9]{64}$/.test(spec.sha256))throw Error('Unapproved sculpture source URL or hash');
 const response=await fetcher(url.href,{headers:{Origin:ORIGIN},signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('Sculpture source HTTP '+response.status+': '+url.pathname);
 if(response.headers.get('access-control-allow-origin')!==ORIGIN)
   throw Error('Sculpture source has incorrect CORS');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(sha(bytes)!==spec.sha256)throw Error('Sculpture source SHA-256 mismatch');
 if(spec.bytes!==undefined&&bytes.length!==spec.bytes)throw Error('Sculpture source byte length mismatch');
 const type=url.pathname.endsWith('.json.gz')?'application/gzip':url.pathname.endsWith('.png')?'image/png':'application/json';
 if(response.headers.get('content-type')!==type)throw Error('Sculpture source MIME differs');
 return bytes;
}
async function main(){
 const root=resolve(process.argv[2]);
 const receipt=JSON.parse(await readFile(join(root,'release-publication.json'),'utf8'));
 if(!receipt.storageVerified||receipt.presetId!=='assembly-100-100-40-95')
   throw Error('Preset release has not completed its storage verification');
 const raw=await readFile(join(root,'r2-preset-catalog.json'));
 if(sha(raw)!==receipt.catalog.sha256)throw Error('Catalog receipt checksum differs');
 const catalog=JSON.parse(raw);
 const specs=[...Object.values(catalog.days).flatMap(day=>Object.values(day.qualities)),
   ...Object.values(catalog.reception),receipt.catalog];
 if(specs.length!==receipt.objects)throw Error('Public inventory differs from stored release');
 for(const spec of specs){
   if(!spec.url.startsWith(WORKER+'/sculptures-v2/assembly-20261117/'))
     throw Error('Preset public inventory contains a different release');
   await fetchVerifiedSculpture(spec);
   const response=await fetch(spec.url,{method:'HEAD',headers:{Origin:ORIGIN},signal:AbortSignal.timeout(90000)});
   if(!response.ok||Number(response.headers.get('content-length'))!==spec.bytes||
      response.headers.get('access-control-allow-origin')!==ORIGIN)
     throw Error('Public sculpture HEAD differs');
   console.log('PRESET_PUBLIC_VERIFIED',spec.url,spec.bytes);
 }
 await writeFile(join(root,'release-publication.json'),JSON.stringify({...receipt,publicVerified:true},null,2)+'\n');
 console.log('PRESET_PUBLIC_RELEASE_OK',specs.length);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
