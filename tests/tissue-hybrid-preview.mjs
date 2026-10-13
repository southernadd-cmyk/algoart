// Four identical-composition, real-browser V4 vs experimental V5 plates.
// No publishing settings or main-branch assets are modified.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const out='tests/tissue-review';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1540,height:1280},deviceScaleFactor:1});
page.setDefaultTimeout(120000);
const faults=[];
page.on('pageerror',e=>faults.push(e.message));
const cases=[
 {name:'01-connected-landscape',mode:'network',fmt:'landscape',seed:'OIL-DEMO-CONNECTED-628',el:24,den:64,cx:52,neg:59,phi:96,rec:5,spi:51,ga:88,nest:47,curve:77,shape:65,overlap:58,rot:46},
 {name:'02-recursive-landscape',mode:'rects',fmt:'landscape',seed:'OIL-DEMO-RECURSIVE-837',el:18,den:55,cx:61,neg:65,phi:96,rec:5,spi:50,ga:91,nest:56,curve:18,shape:46,overlap:62,rot:26},
 {name:'03-growth-portrait',mode:'organic',fmt:'portrait',seed:'OIL-DEMO-GROWTH-419',el:36,den:52,cx:71,neg:52,phi:93,rec:4,spi:57,ga:94,nest:58,curve:86,shape:68,overlap:60,rot:63},
 {name:'04-orbital-portrait',mode:'field',fmt:'portrait',seed:'OIL-DEMO-ORBITAL-113',el:28,den:56,cx:72,neg:64,phi:97,rec:4,spi:48,ga:93,nest:46,curve:61,shape:68,overlap:46,rot:55}
];
try{
for(const t of cases){
 const u=new URL(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/');
 const params={v:8,tissue:4,...t,pen:'fine',th:11,wob:34,od:3,op:72,pr:36,dry:19,ln:1,ci:1,re:1,po:1,ar:1,pal:'golden',cols:4,sat:88,bri:61,paper:'#f5f0e6',grain:13};
 delete params.name;
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.AlgoArt?.lastOilMaterialStats?.tissuePaletteVersion===4 && document.querySelector('#art')?.width>=1000);
 const r=await page.evaluate(({name,isDiagnostic})=>{
   const A=window.AlgoArt,s=A.readSettings(),art=document.querySelector('#art');
   if(!A.tissueHybridOverlay)throw new Error('Experimental module not loaded');
   const plate=document.createElement('div');
   plate.id='hybrid-plate';
   Object.assign(plate.style,{background:'#f1ede7',padding:'20px',display:'flex',gap:'16px',flexWrap:'wrap',width:'1460px',boxSizing:'border-box',position:'relative',zIndex:'999999'});
   function take(title,flags,rev){
     if(rev===5){A.tissueHybridFlags=flags;A.renderOil(art,s,1,false,5);}
     const card=document.createElement('div');
     Object.assign(card.style,{width:isDiagnostic?'690px':'700px',flex:'0 0 auto',boxSizing:'border-box'});
     const label=document.createElement('div');
     label.textContent=title;
     Object.assign(label.style,{font:'bold 19px Arial,sans-serif',padding:'10px 8px',color:'#302d29'});
     const copy=document.createElement('canvas');
     copy.width=art.width;copy.height=art.height;copy.getContext('2d').drawImage(art,0,0);
     Object.assign(copy.style,{width:'100%',height:'auto',display:'block',background:'#f5f0e6',border:'1px solid #ccc7bd'});
     card.append(label,copy);plate.append(card);
     return rev===5?A.lastOilMaterialStats:null;
   }
   const before=take('V4 · baseline',null,4);
   const after=take('Hybrid V5 · all enabled',{multiply:true,tooth:true,hatching:true},5);
   const afterStats=after?.hybridStats;
   if(isDiagnostic){
     plate.replaceChildren();
     take('Tooth only',{multiply:false,tooth:true,hatching:false},5);
     take('Partial multiply only',{multiply:true,tooth:false,hatching:false},5);
     take('Long hatching only',{multiply:false,tooth:false,hatching:true},5);
     take('Hybrid · all three',{multiply:true,tooth:true,hatching:true},5);
   }
   document.body.prepend(plate);
   // Prevent page sticky bars from covering the comparison screenshot.
   plate.scrollIntoView({block:'start'});
   return{afterStats,version:after?.tissuePaletteVersion,mode:s.mode,orientation:s.orientation};
 },{name:t.name,isDiagnostic:false});
 assert.equal(r.version,5);
 assert(r.afterStats?.graphitePaths>0,'Missing graphite outline layer');
 assert(r.afterStats?.accentCount>0,'Missing crisp saturated accents');
 assert(r.afterStats?.vellumCount>0,'Missing pale vellum reserve');
 assert(r.afterStats?.multiplyCount>0,'Missing controlled multiply treatment');
 assert(r.afterStats?.hatchLines>0,'Missing rare long hatches');
 await page.locator('#hybrid-plate').screenshot({path:out+'/'+t.name+'-v4-v5.png',timeout:120000});
 console.log('PLATE',t.name,JSON.stringify(r.afterStats));
 if(t===cases[0]){
   await page.evaluate(()=>{
     const plate=document.querySelector('#hybrid-plate');
     const A=window.AlgoArt,s=A.readSettings(),art=document.querySelector('#art');
     plate.replaceChildren();
     function take(title,flags){
       A.tissueHybridFlags=flags;A.renderOil(art,s,1,false,5);
       const card=document.createElement('div');card.style.cssText='width:690px;flex:0 0 auto;';
       const label=document.createElement('div');
       label.textContent=title;label.style.cssText='font:bold 19px Arial;padding:10px 8px;color:#302d29';
       const c=document.createElement('canvas');c.width=art.width;c.height=art.height;
       c.getContext('2d').drawImage(art,0,0);
       c.style.cssText='width:100%;height:auto;display:block;border:1px solid #ccc7bd;';
       card.append(label,c);plate.append(card);
     }
     take('Tooth only',{tooth:true,multiply:false,hatching:false});
     take('Partial multiply only',{tooth:false,multiply:true,hatching:false});
     take('Hatching only',{tooth:false,multiply:false,hatching:true});
     take('Hybrid · all three',{tooth:true,multiply:true,hatching:true});
   });
   await page.locator('#hybrid-plate').screenshot({path:out+'/05-ablation-connected-landscape.png',timeout:120000});
 }
 await page.evaluate(()=>document.querySelector('#hybrid-plate')?.remove());
}
assert.deepEqual(faults,[],'Browser exceptions during rendering');
console.log('PASS: four matched V4 vs V5 test plates plus isolated-feature diagnostic');
}finally{await browser.close();}
