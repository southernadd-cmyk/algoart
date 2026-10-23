// A cold Marker visit must not transfer the historical paint engines.
// A saved artwork URL must still restore the exact requested material revision.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const failures=[];
const materialModules=[
  'oil-surface','oil-material','oil-render','watercolour-v2r','watercolour-v2s',
  'oil-v1-core-a','oil-v1-core-b','oil-v1-core-c','oil-paint-v1',
  'oil-brush-v2','oil-paint-v2','oil-brush-v3','oil-paint-v3',
  'cpu-canvas','cpu-material-versions','action-painting-v1'
];
function moduleRequests(names){
  return names.filter(name=>materialModules.some(id=>name.includes('/js/'+id+'.js')));
}
function url(params){
  const u=new URL(base);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
  return u.toString();
}
async function newPage(){
  const context=await browser.newContext({viewport:{width:1200,height:850}});
  await context.addInitScript(()=>{
    localStorage.setItem('algoart-intro-seen','1');
    localStorage.setItem('algoart-ethos-seen','1');
    localStorage.setItem('algoart-inspector-desktop','open');
  });
  const page=await context.newPage();
  const requests=[];
  page.on('request',request=>{
    const u=request.url();
    if(u.includes('/js/')&&u.includes('.js'))requests.push(u);
  });
  page.on('pageerror',error=>failures.push(error.message));
  return {context,page,requests};
}
async function ready(page,seed,material){
  await page.waitForFunction(({seed,material})=>
    document.getElementById('seed')?.value===seed&&
    document.getElementById('materialStyle')?.value===material&&
    document.getElementById('creatingOverlay')?.hidden===true&&
    document.getElementById('statsText')?.textContent?.includes(' · '),
    {seed,material},{timeout:120000});
}
try{
  const first=await newPage(),p=first.page;
  await p.goto(url({v:9,seed:'LAZY-MARKER-001',mode:'rects'}),{waitUntil:'domcontentloaded'});
  await ready(p,'LAZY-MARKER-001','marker');
  assert.deepEqual(moduleRequests(first.requests),[],
    'Cold Marker visit requested historical material engines');
  assert.equal(await p.evaluate(()=>typeof window.AlgoArt.renderOilPaintV1),'undefined');
  assert.equal(await p.evaluate(()=>typeof window.AlgoArt.renderOil),'undefined');
  assert.equal(await p.evaluate(()=>window.AlgoArt.rendererVersion),9);
  const before=first.requests.length;
  await p.locator('#materialStyle').selectOption('tissue');
  await ready(p,'LAZY-MARKER-001','tissue');
  assert.equal(await p.evaluate(()=>typeof window.AlgoArt.renderOil),'function');
  assert.equal(await p.evaluate(()=>typeof window.AlgoArt.renderOilPaintV1),'undefined');
  const tissueRequests=first.requests.filter(x=>x.includes('/js/oil-render.js'));
  assert.equal(tissueRequests.length,1,'Tissue should fetch its renderer once');
  await p.locator('#materialStyle').selectOption('marker');
  await ready(p,'LAZY-MARKER-001','marker');
  await p.locator('#materialStyle').selectOption('tissue');
  await ready(p,'LAZY-MARKER-001','tissue');
  assert.equal(first.requests.filter(x=>x.includes('/js/oil-render.js')).length,1,
    'Revisiting Tissue must reuse its cached module');
  assert(first.requests.length>before);
  await first.context.close();
  console.log('PASS: cold Marker loads no material modules; Tissue loads once on demand');

  const cases=[
    {params:{v:8,seed:'LAZY-TISSUE-V6',mode:'rects',tissue:6},
      material:'tissue',check:'tissueV6'},
    {params:{v:9,seed:'LAZY-WC-V2R',mode:'network',material:'watercolour-v2r'},
      material:'watercolour',check:'watercolourV2R'},
    {params:{v:9,seed:'LAZY-WC-V2S',mode:'rects',material:'watercolour-v2s',fit:0},
      material:'watercolour',check:'watercolourV2S'},
    {params:{v:9,seed:'LAZY-OIL-V4',mode:'rects',material:'oil-v4'},
      material:'oil',check:'oilV4'},
    {params:{v:9,seed:'LAZY-OIL-V1',mode:'network',material:'oil-v1'},
      material:'oil',check:'oilV1'},
    {params:{v:9,seed:'LAZY-ACTION-V2',mode:'rects',material:'action-v2'},
      material:'action',check:'actionV2'}
  ];
  for(const c of cases){
    const {context,page,requests}=await newPage();
    await page.goto(url(c.params),{waitUntil:'domcontentloaded'});
    await ready(page,c.params.seed,c.material);
    const state=await page.evaluate(()=>({
      version:window.AlgoArt.rendererVersion,
      material:document.getElementById('materialStyle').value,
      oilV1:typeof window.AlgoArt.renderOilPaintV1,
      oilV4:typeof window.AlgoArt.renderOilPaintV4,
      waterR:typeof window.AlgoArt.renderWatercolourV2R,
      waterS:typeof window.AlgoArt.renderWatercolourV2S,
      tissue:window.AlgoArt.lastOilMaterialStats?.tissuePaletteVersion,
      action:typeof window.AlgoArt.renderActionPainting,
      loaded:window.AlgoArt.materialScriptsReady(c.material,{
        tissueRevision:c.params.tissue?Number(c.params.tissue):7,
        watercolourRevision:c.params.material?.replace('watercolour-','')||'v2s',
        oilRevision:c.params.material?.replace('oil-','')||'v4'
      })
    }));
    assert.equal(state.loaded,true,'Missing material script dependency: '+c.check);
    assert.equal(state.version,Number(c.params.v),'Old renderer must stay pinned: '+c.check);
    if(c.check==='tissueV6')assert.equal(state.tissue,6,'Tissue V6 revision changed');
    if(c.check==='watercolourV2R')assert.equal(state.waterR,'function');
    if(c.check==='watercolourV2S')assert.equal(state.waterS,'function');
    if(c.check==='oilV4')assert(state.oilV1==='function'&&state.oilV4==='function');
    if(c.check==='oilV1')assert.equal(state.oilV1,'function');
    if(c.check==='actionV2')assert.equal(state.action,'function');
    if(c.material==='action')assert(!moduleRequests(requests).some(x=>x.includes('oil-v1-core')),
      'Action painting must not fetch Oil core');
    if(c.material==='watercolour')assert(!moduleRequests(requests).some(x=>x.includes('oil-v1-core')),
      'Watercolour must not fetch Oil core');
    await context.close();
    console.log('PASS saved artwork restoration:',c.check);
  }
  assert.deepEqual(failures,[],'Uncaught errors in editor startup or scripts');
}finally{
  await browser.close();
}
