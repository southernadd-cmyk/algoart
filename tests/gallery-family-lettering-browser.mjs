// Verify the new production Canvas renderer against all nine frozen letter
// grammars, and ensure that the atlas output is not a legacy handwritten font.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const requested=decodeURIComponent(req.url.split('?')[0]);
  const file=path.resolve(root,'.'+requested);
  if(!file.startsWith(root))throw Error('Unsafe path');
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');
  res.end(await fs.readFile(file));
 }catch(error){res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}});
const failures=[];
page.on('pageerror',e=>failures.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/test/graffiti/phase-d-alphabets.html',{waitUntil:'networkidle'});
 const result=await page.evaluate(async()=>{
  const {TOWER_HANDS,towerHandCycle}=await import('/gallery/visit/tower-graffiti-styles.mjs');
  const {makeTowerFamilyTag,drawTowerFamilyTag,towerGraffitiSignature,TOWER_LETTERING_REVISION}=await import('/gallery/visit/tower-family-lettering.mjs');
  const {wordSvg}=await import('/test/graffiti/family-renderer.mjs');
  const hashes=[],counts=[],images=[],markup=[];
  for(const hand of TOWER_HANDS){
   const tag=makeTowerFamilyTag('MUSHROOM',{hand,seed:'gallery-ci-'+hand,ink:'#26382f'});
   const json=JSON.parse(JSON.stringify(tag));
   if(tag.plan.letters.length!==8||json.renderer!=='az-nine-v1'||tag.text!=='MUSHROOM')throw Error('Tag data is not portable: '+hand);
   const canvas=document.createElement('canvas'),scale=1.75;
   canvas.width=Math.ceil(tag.bounds.width*scale);canvas.height=Math.ceil(tag.bounds.height*scale);
   const ctx=canvas.getContext('2d');ctx.translate(-tag.bounds.x*scale,-tag.bounds.y*scale);ctx.scale(scale,scale);
   drawTowerFamilyTag(ctx,tag,{finish:'spray'});
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let nonempty=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>25)nonempty++;
   if(nonempty<300)throw Error('No visible ink for '+hand+' ('+nonempty+')');
   const url=canvas.toDataURL('image/png');
   const img=new Image();img.src=url;await img.decode();
   images.push({hand,data:url});counts.push({hand,nonempty,bytes:url.length});
   const spec=wordSvg(hand,'MUSHROOM',{joins:true});
   markup.push({hand,paths:spec.querySelectorAll('path').length});
  }
  const test=makeTowerFamilyTag('φ',{hand:'B',seed:'phi'});
  if(test.plan.letters[0].ch!=='Φ')throw Error('Greek phi dropped from tower plan');
  const combined=towerHandCycle('2026-10-25'),unique=new Set(combined);
  if(unique.size!==9)throw Error('Family cycle repeats');
  const a=makeTowerFamilyTag('PHI',{hand:'A',seed:'same'});
  const b=makeTowerFamilyTag('PHI',{hand:'A',seed:'same'});
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Identical tower seeds are not deterministic');
  if(!towerGraffitiSignature([{id:'x',hand:'A',seed:'s'}]).includes(TOWER_LETTERING_REVISION))throw Error('Atlas revision missing');
  return {counts,images,markup,revision:TOWER_LETTERING_REVISION,cycle:combined};
 });
 const screenshots=[];
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 for(const item of result.images){
  const bytes=Buffer.from(item.data.split(',')[1],'base64');
  screenshots.push({hand:item.hand,hash:createHash('sha256').update(bytes).digest('hex')});
  await fs.writeFile(path.join(root,'artifacts/tower-az-nine-'+item.hand+'.png'),bytes);
 }
 assert.equal(result.counts.length,9);
 assert.equal(new Set(screenshots.map(q=>q.hash)).size,9,'Families draw identical PNGs');
 assert.ok(result.markup.every(x=>x.paths>5));
 assert.deepEqual(failures,[]);
 console.log(JSON.stringify({passed:true,revision:result.revision,styles:result.counts.length,ink:result.counts,cycle:result.cycle,previews:screenshots.length,errors:failures}));
}catch(error){console.error('Production alphabet atlas smoke failed:',error,failures);process.exitCode=1}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
