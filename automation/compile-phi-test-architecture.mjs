// Deterministically bake a single archived TEST floor into independently
// fetchable room geometry packages; never writes anything under gallery/visit/.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
import {compilePhiRoomPackage,phiRoomPackageFingerprint}
 from '../test/virtual-gallery/phi-compiled-room-package.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const date=process.argv[2]||'2026-10-20';
const archive=JSON.parse(await readFile(join(root,'gallery/tower-layouts.json'),'utf8'));
const idx=archive.floors.findIndex(f=>f.date===date);
if(idx<0)throw Error('Unknown archived floor: '+date);
const meta=JSON.parse(await readFile(join(root,'gallery',date,'meta.json'),'utf8'));
const studies=meta.entries.map((e,i)=>({id:i,portrait:e.orientation==='portrait',
 aspect:e.orientation==='portrait'?1000/1400:1400/1000,
 material:e.material||'marker',engine:e.mode||'field',title:e.title||''}));
const phi=buildPhiRendererPlan(date,studies);
if(!phi.checks.connected||!phi.checks.unique||phi.checks.unplaced)
 throw Error('Cannot package invalid phi plan');
const elevation=(idx+1)*6.2,roomCount=phi.floor.mergedRooms.length;
const fingerprint=phiRoomPackageFingerprint(phi,date,elevation);
const dest=join(root,'test/virtual-gallery/precompiled',date);
await mkdir(dest,{recursive:true});
const rooms=[];
for(let room=0;room<roomCount;room++){
 const pack=compilePhiRoomPackage(phi,date,elevation,room);
 const filename='room-'+room+'.json';
 const body=JSON.stringify(pack);
 await writeFile(join(dest,filename),body+'\n');
 rooms.push({room,url:filename,bytes:Buffer.byteLength(body),
  pieces:pack.pieces,triangles:Object.values(pack.geometries).reduce((n,g)=>n+g.triangles,0)});
}
const manifest={version:1,date,elevation,fingerprint,
 roomCount,rooms,scope:'room floor and ceiling surfaces only',
 materialTiling:'exact vertex/normal/UV reconstruction; no material substitution'};
await writeFile(join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('PHI_PRECOMPILED_ARCHITECTURE '+JSON.stringify({
 date,roomCount,elevation,bytes:rooms.reduce((sum,r)=>sum+r.bytes,0),
 triangles:rooms.reduce((sum,r)=>sum+r.triangles,0),
 fingerprintValid:true,output:dest
}));
