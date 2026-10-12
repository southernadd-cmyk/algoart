// Real Chromium capture and reversible material test. Artifacts show v1 vs v2.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const folder='watercolor-v2-check-results';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1480,height:1050},deviceScaleFactor:1});
const cases=[
  {name:'growth-landscape',mode:'organic',fmt:'landscape',seed:'WET-WASH-GROWTH-L',
    el:35,den:62,cx:71,neg:49,phi:93,rec:4,spi:57,ga:94,nest:59,rot:63},
  {name:'connected-portrait',mode:'network',fmt:'portrait',seed:'WET-WASH-FIELD-P',
    el:24,den:58,cx:65,neg:59,phi:96,rec:5,spi:51,ga:88,nest:47,rot:46},
  {name:'recursive-landscape',mode:'rects',fmt:'landscape',seed:'WET-WASH-RECT-L',
    el:20,den:50,cx:62,neg:60,phi:96,rec:5,spi:50,ga:91,nest:56,rot:26}
];
const faults=[];
page.on('pageerror',error=>faults.push(error.message));
function urlFor(test,revision){
  const url=new URL(root);
  const values={v:8,watercolor:revision,...test,curve:76,shape:64,overlap:62,
    pen:'fine',th:11,wob:34,od:3,op:72,pr:36,dry:19,
    ln:1,ci:1,re:1,po:1,ar:1,pal:'mono',cols:4,sat:88,bri:61,
    paper:'#f5f0e6',grain:13};
  delete values.name;
  for(const [k,v] of Object.entries(values))url.searchParams.set(k,String(v));
  return url.href;
}
async function capture(test,revision){
  await page.goto(urlFor(test,revision),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(v=>
    document.querySelector('#statsText')?.textContent?.endsWith(' / WATERCOLOR') &&
    document.querySelector('#oilRender')?.checked &&
    document.querySelector('#art')?.height===(document.querySelector('#orientation')?.value==='portrait'?1400:1000) &&
    (v===2?window.AlgoArt?.lastWatercolorV2Stats?.version===2:
      window.AlgoArt?.lastOilMaterialStats?.version===4),revision,{timeout:120000});
  const bytes=await page.locator('#art').screenshot({
    path:folder+'/'+test.name+'-watercolor-v'+revision+'.png',timeout:60000
  });
  return createHash('sha256').update(bytes).digest('hex');
}
try{
  for(const sample of cases){
    const old=await capture(sample,1);
    const fresh=await capture(sample,2);
    assert.notEqual(old,fresh,'v2 should visibly differ from v1: '+sample.name);
    const repeated=await capture(sample,2);
    assert.equal(repeated,fresh,'v2 should be byte-reproducible: '+sample.name);
    await page.evaluate(()=>{
      const toggle=document.querySelector('#oilRender');
      toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await page.waitForFunction(()=>
      !document.querySelector('#statsText')?.textContent?.endsWith(' / WATERCOLOR'));
    await page.locator('#art').screenshot({
      path:folder+'/'+sample.name+'-marker.png',timeout:60000
    });
    console.log('PASS',sample.name,'stable v1 and v2, reversible to marker');
  }
  assert.deepEqual(faults,[],'Browser errors');
}finally{await browser.close()}
