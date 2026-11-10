// Offline re-bake for the ISOLATED test exhibition tower.
// Never reads, writes, or triggers the production /gallery/YYYY/3d/sculptures.json.gz.
// Every archive portrait used by the real tower gets desktop + mobile HYBRID
// mesh data; missing or malformed input stops the build (no silent fallback).
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const args=process.argv.slice(2),arg=name=>{
 const i=args.indexOf(name);return i<0?null:args[i+1];
};
const all=args.includes('--all'),single=arg('--date');
if(!all&&!/^\d{4}-\d{2}-\d{2}$/.test(single||''))
 throw Error('Use --all or --date YYYY-MM-DD');
const baseUrl=process.env.GALLERY_BAKE_URL||'http://127.0.0.1:4173/';
const outDir='gallery/visit/test-sculpture-packs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const dates=(await fs.readdir('gallery',{withFileTypes:true}))
 .filter(e=>e.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(e.name))
 .map(e=>e.name).sort().filter(d=>all||d===single);
if(!dates.length)throw Error('No archived dates selected');
const browser=await chromium.launch({headless:true,args:[
 '--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const archivePortraits=(html,meta)=>{
 // This is the SAME portrait classification as the real tower's readArchive:
 // card.dataset.orientation === portrait OR image height > width.
 const byImage=new Map(meta.entries.map(e=>[e.imageFile,e]));
 const cards=[...html.matchAll(/<article\b[^>]*class="[^"]*\bart-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi)];
 const result=[],seen=new Set();
 for(const [fragment] of cards){
  const tag=fragment.match(/<article\b[^>]*>/i)?.[0]||'';
  const img=fragment.match(/<img\b[^>]*>/i)?.[0]||'';
  const src=img.match(/\bsrc="([^"]+)"/i)?.[1]?.replace(/&amp;/g,'&');
  const width=Number(img.match(/\bwidth="(\d+)"/i)?.[1]||0);
  const height=Number(img.match(/\bheight="(\d+)"/i)?.[1]||0);
  const orientation=tag.match(/\bdata-orientation="([^"]+)"/i)?.[1];
  const portrait=orientation==='portrait'||height>width;
  if(!portrait)continue;
  if(!src)throw Error('Portrait card lacks image src');
  const file=decodeURIComponent(src.split('/').pop().split('?')[0]);
  const entry=byImage.get(file);
  if(!entry)throw Error('Archive portrait missing metadata: '+file);
  if(entry.material==='confluence'||/\/confluence\//.test(entry.shareUrl||''))continue;
  if(seen.has(file))throw Error('Duplicate archive portrait: '+file);
  seen.add(file);
  result.push(entry);
 }
 if(!cards.length||cards.length!==meta.entries.length)
  throw Error('Archive card/meta parity failure: '+cards.length+' vs '+meta.entries.length);
 return result;
};
const manifest={
 version:2,method:'hybrid',mount:'museum-pin',format:'quantised-13-byte-vertex-gzip',
 source:'archived-painting-v10-and-historical',generatedBy:'automation/bake-test-sculpture-tower.mjs',
 dates:{},totalPortraits:0,totalVariants:0,totalCompressedBytes:0
};
let errors=[];
try{
 const page=await browser.newPage({viewport:{width:920,height:740}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{
  if(message.type()==='error')errors.push(message.text().slice(0,320));
 });
 await page.goto(new URL('gallery/visit/sculpture-test-bake.html',baseUrl).href,{
  waitUntil:'domcontentloaded',timeout:60000
 });
 await page.waitForFunction(()=>window.hybridTowerBakerReady===true,undefined,
  {timeout:60000});
 await fs.mkdir(outDir,{recursive:true});
 for(const date of dates){
  const root=path.join('gallery',date);
  const [meta,html]=await Promise.all([
   readJson(path.join(root,'meta.json')),
   fs.readFile(path.join(root,'index.html'),'utf8')
  ]);
  const items=archivePortraits(html,meta);
  const pack={
   version:2,date,method:'hybrid',mount:'museum-pin',
   format:'hybrid-indexed-13b-u32-v2',
   portraitCount:items.length,studies:{}
  };
  for(const item of items){
   const filename=path.join(root,item.imageFile);
   const original=await fs.readFile(filename).catch(error=>{
    throw Error('Missing original archived portrait '+filename+': '+error.message);
   });
   const variants={sourceSha256:sha(original),material:item.material||'marker',
    seed:item.seed,imageFile:item.imageFile};
   for(const quality of ['mobile','desktop']){
    const baked=await page.evaluate(async({date,item,quality})=>
      window.bakeHybridTowerStudy({date,item,quality}),{date,item,quality});
    if(!baked.packed||!baked.vertices||!baked.hasFront||!baked.hasBack||
        !baked.hasSides||baked.method!=='hybrid'||baked.mount!=='museum-pin')
      throw Error(date+'/'+item.imageFile+'/'+quality+': geometry integrity failure');
    if(baked.seed!==item.seed||baked.sourceImage!==item.imageFile)
      throw Error(date+'/'+item.imageFile+'/'+quality+': source identity mismatch');
    variants[quality]=baked;
    manifest.totalVariants++;
   }
   pack.studies[item.imageFile]=variants;
  }
  if(Object.keys(pack.studies).length!==items.length)
   throw Error(date+': not all tower-eligible portraits were baked');
  const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(pack)),{level:9});
  const dest=path.join(outDir,date+'.json.gz');
  await fs.writeFile(dest,bytes);
  const record={portraits:items.length,variants:items.length*2,
   compressedBytes:bytes.length,sha256:sha(bytes)};
  manifest.dates[date]=record;
  manifest.totalPortraits+=items.length;
  manifest.totalCompressedBytes+=bytes.length;
  console.log('BAKED',date,JSON.stringify(record));
  if(errors.length)throw Error('Bake renderer errors: '+errors.join('; '));
 }
 await fs.writeFile(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 if(all&&manifest.totalPortraits<25)
  throw Error('Refusing incomplete historical tower rebake: only '+manifest.totalPortraits);
 console.log('SCULPTURE_TEST_TOWER_BAKE_OK',JSON.stringify({
  days:Object.keys(manifest.dates).length,
  portraits:manifest.totalPortraits,
  variants:manifest.totalVariants,
  MiB:Math.round(manifest.totalCompressedBytes/1024/1024*100)/100
 }));
}finally{await browser.close();}
