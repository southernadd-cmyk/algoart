// Real browser captures from the experimental procedural renderer, for review.
// These are produced by js/oil-render.js, not by an image model or mock-up.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const out='oil-check-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1480,height:1000},deviceScaleFactor:1});
const cases=[
  {name:'01-growth-portrait',mode:'organic',fmt:'portrait',seed:'OIL-DEMO-GROWTH-419',el:36,den:52,cx:71,neg:52,phi:93,rec:4,spi:57,ga:94,nest:58,curve:86,shape:68,overlap:60,rot:63},
  {name:'02-connected-landscape',mode:'network',fmt:'landscape',seed:'OIL-DEMO-CONNECTED-628',el:24,den:64,cx:52,neg:59,phi:96,rec:5,spi:51,ga:88,nest:47,curve:77,shape:65,overlap:58,rot:46},
  {name:'03-recursive-landscape',mode:'rects',fmt:'landscape',seed:'OIL-DEMO-RECURSIVE-837',el:18,den:55,cx:61,neg:65,phi:96,rec:5,spi:50,ga:91,nest:56,curve:18,shape:46,overlap:62,rot:26},
  {name:'04-orbital-portrait',mode:'field',fmt:'portrait',seed:'OIL-DEMO-ORBITAL-113',el:28,den:56,cx:72,neg:64,phi:97,rec:4,spi:48,ga:93,nest:46,curve:61,shape:68,overlap:46,rot:55}
];
for (const test of cases){
  const url=new URL(root);
  const values={v:8,watercolor:1,...test,pen:'fine',th:11,wob:34,od:3,op:72,pr:36,dry:19,ln:1,ci:1,re:1,po:1,ar:1,pal:'mono',cols:4,sat:88,bri:61,paper:'#f5f0e6',grain:13};
  delete values.name;
  for(const [k,v] of Object.entries(values))url.searchParams.set(k,String(v));
  const faults=[];
  page.on('pageerror',error=>faults.push(error.message));
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(() => document.querySelector('#statsText')?.textContent?.trim().endsWith(' / TISSUE & GRAPHITE') &&
    document.querySelector('#art')?.height === (document.querySelector('#orientation')?.value==='portrait'?1400:1000),null,{timeout:120000});
  await page.locator('#art').screenshot({path:out+'/'+test.name+'-oil.png',timeout:60000});
  // Compare v4 directly against this exact old pigment study. Preserve both
  // renders as browser artifacts; the legacy image remains v1 byte-exact.
  const newMaterial=new URL(page.url());
  newMaterial.searchParams.delete('watercolor');
  newMaterial.searchParams.set('tissue','4');
  await page.goto(newMaterial.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.AlgoArt?.lastOilMaterialStats?.tissuePaletteVersion===4,
    null,{timeout:120000});
  await page.locator('#art').screenshot({path:out+'/'+test.name+'-original-look-v4.png',timeout:60000});
  // Dispatch the exact change the checkbox produces; avoids screenshot
  // automation clicking a label twice and checks marker restoration.
  await page.evaluate(() => {
    const select=document.querySelector('#materialStyle');
    select.value='marker';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const toggleState=await page.evaluate(() => ({
    selected:document.querySelector('#materialStyle')?.value,
    stats:document.querySelector('#statsText')?.textContent,
    url:location.href,
    version:window.AlgoArt?.rendererVersion
  }));
  if(toggleState.selected!=='marker'||toggleState.stats?.trim().endsWith(' / TISSUE & GRAPHITE'))
    throw new Error(test.name+' failed to restore marker: '+JSON.stringify(toggleState)+
      ' page errors: '+JSON.stringify(faults));
  await page.locator('#art').screenshot({path:out+'/'+test.name+'-marker.png',timeout:60000});
  if(faults.length)throw new Error(test.name+': '+faults.join('; '));
  console.log('CAPTURED watercolor and restored marker',test.name);
}
await browser.close();
