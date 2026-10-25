import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{try{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if((await fs.stat(f)).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',mime[path.extname(f)]||'text/plain');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const errors=[],page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/test/graffiti/?word=ECHO&form=bubble');
 await page.waitForFunction(()=>document.documentElement.dataset.wall==='scan');
 const result=await page.evaluate(async()=>{
  const {createTag,drawTag}=await import('./tag-engine.mjs?v=sprayed-throwups-v7');
  const hash=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261,count=0;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);if(i%4===3&&d[i]>40)count++;}return{hash:h>>>0,count};};
  const results=[];
  for(const form of ['hollow','bubble'])for(const hand of ['loop','cut','rush','sicoer','twist','kadism'])for(const paintWidth of [.75,2,3]){
   const tag=createTag('PROPORTION',{form,hand,paintWidth,seed:'paint-proof'}),b=tag.bounds,c=document.createElement('canvas');c.width=Math.ceil(b.width)+4;c.height=Math.ceil(b.height)+4;const g=c.getContext('2d');
   const paint=(t,p=1,finish='spray')=>{g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.translate(-b.x+2,-b.y+2);drawTag(g,t,{progress:p,finish});return hash(c);};
   const final=paint(tag);paint(tag,.17);paint(tag,.63);const replay=paint(tag),copy=paint(structuredClone(tag)),marker=paint(tag,1,'marker');
   const d=g.getImageData(0,0,c.width,c.height).data;let edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(x<3||y<3||x>=c.width-3||y>=c.height-3)edge+=d[(y*c.width+x)*4+3];
   results.push({form,hand,paintWidth,final,replay,copy,marker,edge});
  }
  return results;
 });
 for(const r of result){assert.equal(r.final.hash,r.replay.hash,'replay '+r.hand);assert.equal(r.final.hash,r.copy.hash,'seed '+r.hand);assert.notEqual(r.final.hash,r.marker.hash,'finish '+r.hand);assert.equal(r.edge,0,'bounds '+r.hand+' '+r.paintWidth);assert.ok(r.final.count>50);}
 for(const form of ['hollow','bubble']){const hashes=result.filter(x=>x.form===form&&x.paintWidth===2).map(x=>x.final.hash);assert.equal(new Set(hashes).size,6);}
 await page.locator('#form').selectOption('hollow');await page.locator('#hand').selectOption('sicoer');
 assert.ok(await page.evaluate(()=>window.graffitiSpecimen.tags.every(t=>t.hand==='sicoer'&&t.form==='hollow')));
 await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.wall==='scan');
 assert.equal(await page.locator('#hand').inputValue(),'sicoer');assert.equal(await page.locator('#form').inputValue(),'hollow');
 await page.locator('[data-hand="cut"]').click();assert.equal(await page.locator('#hand').inputValue(),'cut');assert.equal(await page.locator('#form').inputValue(),'hollow');
 const firstStudy=await page.locator('[data-study]').first().getAttribute('data-study');
 await page.locator('[data-study]').first().click();assert.equal(await page.locator('#hand').inputValue(),firstStudy);assert.equal(await page.locator('#form').inputValue(),'hollow');
 // Preview is made from the actual wall canvases, after each writer choice.
 await page.evaluate(()=>{window.paintProof=document.createElement('canvas');paintProof.width=640;paintProof.height=680;paintProof.getContext('2d').fillStyle='#f4f0e7';paintProof.getContext('2d').fillRect(0,0,640,680);});
 for(const [row,hand] of ['loop','sicoer','kadism','twist'].entries()){
  await page.locator('#hand').selectOption(hand);
  await page.evaluate(({row,hand})=>{const g=paintProof.getContext('2d');for(const [col,form] of ['hollow','bubble'].entries()){const source=document.querySelector('[data-form="'+form+'"]').closest('article').querySelector('canvas');g.drawImage(source,col*320,row*170,320,142);g.fillStyle='#30312c';g.font='15px Georgia';g.fillText(hand+' · '+form,col*320+8,row*170+161);}}, {row,hand});
 }
 await fs.mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/graffiti-throwups-desktop.png',fullPage:true});
 const preview=await page.evaluate(()=>paintProof.toDataURL('image/jpeg',.72));console.log('THROWUP_PREVIEW:'+preview);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('wall').height===920);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/graffiti-throwups-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'passed',cases:result.length,checks:['writer alphabets','paint bounds at three widths','seeded pixels','partial/full playback','hollow/filled and spray/marker','URL restore','mobile layout'],errors}));
}finally{await browser.close();server.close();}
