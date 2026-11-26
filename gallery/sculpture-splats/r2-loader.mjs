import {SPLAT_FORMAT,SPLAT_FORMAT_VERSION,SPLAT_ALGORITHM,SPLAT_STRIDE,SPLAT_BUDGETS,SPLAT_GEOMETRY_REVISION,validEdition,validatePointRecords,decodePointBytes} from './format.mjs';
export const SPLAT_R2_ORIGIN='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev';
export const SPLAT_R2_PREFIX='sculptures-splats/v1/assembly-20261117';
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const require=(condition,message)=>{if(!condition)throw Error(message);};
const maxPack=45*1048576;
const base=date=>SPLAT_R2_ORIGIN+'/'+SPLAT_R2_PREFIX+'/'+date;
export function validateSplatManifest(m,date){
 require(validEdition(date)&&m?.schema==='pp-sculpture-splats-r2-manifest'&&m.version===SPLAT_FORMAT_VERSION&&m.date===date&&
  m.algorithm===SPLAT_ALGORITHM&&m.geometryRevision===SPLAT_GEOMETRY_REVISION&&m.presetId==='assembly-100-100-40-95'&&m.worker===SPLAT_R2_ORIGIN&&m.ready===true,'Invalid splat manifest');
 require(Number.isSafeInteger(m.portraits)&&m.portraits>0&&m.studies&&Object.keys(m.studies).length===m.portraits&&
  Object.entries(m.studies).every(([name,seed])=>name.length>0&&typeof seed==='string'&&seed.length>0),'Invalid splat roster');
 require(Object.keys(m.qualities||{}).sort().join(',')==='desktop,mobile','Incomplete splat qualities');
 for(const quality of ['mobile','desktop']){
  const q=m.qualities[quality];
  require(q&&hash(q.sha256)&&hash(q.sourceSha256)&&q.url===base(date)+'/'+quality+'/'+q.sha256+'.json.gz'&&
   Number.isSafeInteger(q.bytes)&&q.bytes>0&&q.bytes<=maxPack&&q.pointsPerStudy===SPLAT_BUDGETS[quality],'Unapproved splat pack link');
 }
 return m;
}
export async function fetchSplatManifest(date,{fetcher=fetch}={}){
 require(validEdition(date),'Invalid splat edition');
 const response=await fetcher(base(date)+'/manifest.json');
 require(response.ok,'Splat manifest HTTP '+response.status);
 return validateSplatManifest(await response.json(),date);
}
async function sha256(bytes){
 require(globalThis.crypto?.subtle,'SHA-256 unavailable');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function downloadSplatPack(date,quality,{sourceSha256,fetcher=fetch,manifest=null}={}){
 require(Object.hasOwn(SPLAT_BUDGETS,quality)&&hash(sourceSha256),'Expected verified mesh source hash is required');
 const m=manifest?validateSplatManifest(manifest,date):await fetchSplatManifest(date,{fetcher});
 const spec=m.qualities[quality];
 require(spec.sourceSha256===sourceSha256,'Splat pack does not match selected mesh source');
 const response=await fetcher(spec.url);
 require(response.ok,'Splat pack HTTP '+response.status);
 const bytes=await response.arrayBuffer();
 require(bytes.byteLength===spec.bytes&&await sha256(bytes)===spec.sha256,'Splat pack SHA-256 or byte length mismatch');
 require(typeof DecompressionStream!=='undefined','Gzip decoder unavailable');
 const p=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
 require(p?.schema===SPLAT_FORMAT&&p.version===SPLAT_FORMAT_VERSION&&p.algorithm===SPLAT_ALGORITHM&&
  p.geometryRevision===SPLAT_GEOMETRY_REVISION&&p.date===date&&p.quality===quality&&p.sourceSha256===sourceSha256&&
  p.stride===SPLAT_STRIDE&&p.encoding==='f32le-base64'&&p.expectedPortraits===m.portraits&&
  Object.keys(p.studies||{}).length===m.portraits,'Invalid splat pack metadata');
 for(const [name,seed] of Object.entries(m.studies)){
  const s=Object.hasOwn(p.studies,name)?p.studies[name]:null;
  require(s&&s.imageFile===name&&s.seed===seed&&hash(s.sourceGeometrySha256)&&hash(s.pointsSha256)&&
   s.pointCount===SPLAT_BUDGETS[quality]&&Number.isSafeInteger(s.originalTriangles)&&s.originalTriangles>0&&
   Array.isArray(s.meshCounts)&&s.meshCounts.every(c=>Array.isArray(c)&&c.length===2&&c.every(v=>Number.isSafeInteger(v)&&v>0)&&c[1]%3===0)&&
   s.meshCounts.reduce((n,c)=>n+c[1]/3,0)===s.originalTriangles&&Array.isArray(s.materialCounts)&&s.materialCounts.every(n=>Number.isSafeInteger(n)&&n>0),'Splat study identity mismatch');
  require(typeof s.points==='string'&&s.points.length===4*Math.ceil(s.pointCount*44/3),'Invalid encoded points length');
  const data=Uint8Array.from(atob(s.points),c=>c.charCodeAt(0));
  require(await sha256(data)===s.pointsSha256,'Splat point SHA-256 mismatch');
  s.points=decodePointBytes(data);
  validatePointRecords(s.points,s.meshCounts,s.materialCounts,s.pointCount);
 }
 return p;
}
