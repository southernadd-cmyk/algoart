// Visual-only comparison: V4 versus V5 with ONLY torn ribbon boundaries.
// No filters, multiply, accents, revised graphite, colours or other additions.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('tests/torn-edge-review',{recursive:true});
const cases=[
 {name:'01-connected-landscape',mode:'network',fmt:'landscape',seed:'OIL-DEMO-CONNECTED-628',el:24,den:64,cx:52,neg:59,phi:96,rec:5,spi:51,ga:88,nest:47,curve:77,shape:65,overlap:58,rot:46},
 {name:'02-recursive-landscape',mode:'rects',fmt:'landscape',seed:'OIL-DEMO-RECURSIVE-837',el:18,den:55,cx:61,neg:65,phi:96,rec:5,spi:50,ga:91,nest:56,curve:18,shape:46,overlap:62,rot:26},
 {name:'03-growth-portrait',mode:'organic',fmt:'portrait',seed:'OIL-DEMO-GROWTH-419',el:36,den:52,cx:71,neg:52,phi:93,rec:4,spi:57,ga:94,nest:58,curve:86,shape:68,overlap:60,rot:63},
 {name:'04-orbital-portrait',mode:'field',fmt:'portrait',seed:'OIL-DEMO-ORBITAL-113',el:28,den:56,cx:72,neg:64,phi:97,rec:4,spi:48,ga:93,nest:46,curve:61,shape:68,overlap:46,rot:55}
];
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1510,height:1200},deviceScaleFactor:1});
page.setDefaultTimeout(120000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 for(const t of cases){
  const u=new URL(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/');
  const p={v:8,tissue:4,...t,pen:'fine',th:11,wob:34,od:3,op:72,pr:36,dry:19,ln:1,ci:1,re:1,po:1,ar:1,pal:'golden',cols:4,sat:88,bri:61,paper:'#f5f0e6',grain:13};
  delete p.name;
  Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.AlgoArt?.lastOilMaterialStats?.tissuePaletteVersion===4 && document.querySelector('#art')?.width>0);
  const details=await page.evaluate(()=>{
   const A=window.AlgoArt,settings=A.readSettings(),source=document.querySelector('#art');
   const old=A.lastOilMaterialStats;
   const paper=source.getContext('2d').getImageData(4,4,1,1).data;
   const plate=document.createElement('div');plate.id='torn-review-plate';
   plate.style.cssText='background:#eee9df;display:flex;gap:15px;padding:15px;width:1470px;box-sizing:border-box;position:relative;z-index:99999';
   function card(title,original){
    const wrap=document.createElement('div');wrap.style.cssText='width:712px;flex:0 0 712px;';
    const heading=document.createElement('div');heading.textContent=title;heading.style.cssText='font:bold 21px Arial;color:#242321;padding:13px 6px';
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
    c.getContext('2d').drawImage(source,0,0);
    c.style.cssText='width:100%;height:auto;border:1px solid #c8c3b7;display:block';
    wrap.append(heading,c);plate.appendChild(wrap);
   }
   card('V4 — untouched baseline',true);
   A.renderOil(source,settings,1,false,5);
   const updated=A.lastOilMaterialStats;
   card('V5 study — torn contours ONLY',false);
   document.body.prepend(plate);
   return {old,updated,paper:Array.from(paper),name:settings.mode};
  });
  assert.equal(details.old.graphitePaths,0);
  assert.equal(details.updated.graphitePaths,0);
  assert.equal(details.updated.tissuePaletteVersion,5);
  assert.equal(details.updated.chains,details.old.chains);
  assert.deepEqual(details.updated.inkColours,details.old.inkColours);
  await page.locator('#torn-review-plate').screenshot({path:'tests/torn-edge-review/'+t.name+'-v4-v5-torn.png',timeout:120000});
  console.log('CAPTURED',t.name,details.name,'identical base palette, V4 geometry, graphite');
  await page.evaluate(()=>document.querySelector('#torn-review-plate')?.remove());
 }
 assert.deepEqual(errors,[],'No browser exceptions');
 console.log('PASS four matched torn-edge-only comparisons');
}finally{await browser.close()}
