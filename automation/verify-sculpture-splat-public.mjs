import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const ORIGIN='https://southernadd-cmyk.github.io';
const WORKER='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev';
const KEY=/^sculptures-splats\/v1\/assembly-20261117\/(?:reception|20\d{2}-\d{2}-\d{2})\/(?:(?:desktop|mobile)\/[a-f0-9]{64}\.json\.gz|manifest\.json)$/;
export async function verifyPublicSplat(item,{fetcher=fetch}={}){
 if(!KEY.test(item.key)||item.url!==WORKER+'/'+item.key||
 !/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<=0||item.bytes>45*1048576||
 item.contentType!==(item.key.endsWith('.json.gz')?'application/gzip':'application/json')||
 (item.key.endsWith('.json.gz')&&!item.key.endsWith('/'+item.sha256+'.json.gz')))
  throw Error('Invalid public splat verification descriptor');
 for(const method of ['GET','HEAD']){
  const response=await fetcher(item.url,{method,redirect:'error',headers:{Origin:ORIGIN},signal:AbortSignal.timeout(90000)});
  if(response.status!==200){
   await response.body?.cancel();
   throw Error('Public splat '+method+' HTTP '+response.status+' '+item.key);
  }
  if(response.headers.get('content-type')!==item.contentType||
     response.headers.get('access-control-allow-origin')!==ORIGIN||
     response.headers.get('content-length')!==String(item.bytes)){
   await response.body?.cancel();
   throw Error('Public splat '+method+' headers mismatch '+item.key);
  }
  if(method==='GET'){
   const data=Buffer.from(await response.arrayBuffer());
   if(data.length!==item.bytes||createHash('sha256').update(data).digest('hex')!==item.sha256)
    throw Error('Public splat SHA-256 or length mismatch '+item.key);
  }
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let input='';
 for await(const chunk of process.stdin)input+=chunk;
 const item=JSON.parse(input);
 await verifyPublicSplat(item);
 console.log('SPLAT_PUBLIC_GET_HEAD_SHA_OK',item.key,item.bytes);
}
