// Opt-in Confluence oil-v2 browser test. Existing v1 bookmarks must remain
// byte-stable; native Oil V8 must paint an ACTUAL connected filled area in v2.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {systems} from '../confluence/collab.js';
import {defaultSettings} from '../confluence/artist-controls.js';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml',
  '.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(pathname.endsWith('/'))file=resolve(file,'index.html');
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
      'cache-control':'no-store'}).end(await readFile(file));
  }catch{res.writeHead(404).end('Not found');}
});
const encode=state=>Buffer.from(JSON.stringify(state),'utf8').toString('base64url');
const artist=(id,mode,palette,material)=>({
  system:mode,palette,material,
  settings:{...defaultSettings(systems.find(s=>s.id===mode)),elements:66,
    density:58,complexity:66,negativeSpace:46,phiStrength:83,
    colourCount:8,saturation:75,brightness:50,seed:'CV2-'+id}
});
const baseline={
  v:1,seed:'CV2-PAINT-20261109',orientation:'landscape',paper:'#f5f0e6',
  grain:10,edgeMargin:true,strength:78,collaborationPull:90,leadIndex:0,
  totalTurns:21,
  artists:[artist(1,'organic','warm','oil'),
    artist(2,'spiral','spectrum','oil'),
    artist(3,'geometric','earth','oil')]
};
let browser;
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const origin='http://127.0.0.1:'+server.address().port+'/confluence/';
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'?cv=2&s='+encode({...baseline,confluenceRenderer:2}),
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>{
    if(document.getElementById('summary')?.textContent==='Could not render this study.')
      throw Error('Confluence oil-v2 failed');
    return document.getElementById('counter')?.textContent?.trim()==='21 / 21 turns';
  },null,{timeout:220000});
  const result=await page.evaluate(()=>{
    const c=document.getElementById('shared'),a=window.AlgoArt;
    return{stats:a.lastConfluenceOilV2Stats||null,
      width:c.width,height:c.height,
      versionNote:document.getElementById('status')?.textContent,
      data:c.toDataURL('image/png').length};
  });
  console.log('OIL_V2_PAINTED_FIELDS '+JSON.stringify(result));
  // Publish a screenshot even if a later coverage assertion fails, so the
  // review can inspect what the engine actually painted.
  await mkdir('confluence-oil-v2-preview',{recursive:true});
  await page.locator('#shared').screenshot({path:'confluence-oil-v2-preview/v2-all-oil-landscape.png'});
  assert.deepEqual(errors,[],'oil-v2 JavaScript errors: '+errors.join('; '));
  assert.equal(result.width,1400);
  assert.equal(result.height,1000);
  assert.match(result.versionNote,/renderer v2/);
  assert(result.stats?.turns>=4,'v2 did not process oil artists: '+JSON.stringify(result));
  assert(result.stats?.newFields>0,'v2 produced no filled connected oil fields: '+JSON.stringify(result));
  assert(result.stats?.eligibleGroups>=2,'v2 never accumulated distinct real guide groups');
  // The exact same all-oil source settings in the frozen V1 renderer.
  // This snapshot is evidence for visual review, NOT a replacement for
  // the v2 filled-geometry assertion above.
  await page.goto(origin+'?s='+encode(baseline),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    if(document.getElementById('summary')?.textContent==='Could not render this study.')
      throw Error('Confluence all-oil v1 baseline failed');
    return document.getElementById('counter')?.textContent?.trim()==='21 / 21 turns';
  },null,{timeout:220000});
  const v1=await page.evaluate(()=>{
    const c=document.getElementById('shared');
    return{width:c.width,height:c.height,previewLength:c.toDataURL('image/png').length,
      renderer:document.getElementById('status')?.textContent||''};
  });
  assert(!v1.renderer.includes('renderer v2'),'old all-oil share silently switched to v2');
  await page.locator('#shared').screenshot({path:'confluence-oil-v2-preview/v1-all-oil-landscape.png'});
  console.log('OIL_V1_BASELINE '+JSON.stringify(v1));
  // Restoration owns the version: an older saved link with no v2 flag must
  // remain on v1, even when somebody appends ?cv=2 to its URL.
  errors.length=0;
  const old={...baseline,totalTurns:5,
    artists:baseline.artists.map(a=>({...a,material:'marker'}))};
  await page.goto(origin+'?cv=2&s='+encode(old),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    if(document.getElementById('summary')?.textContent==='Could not render this study.')
      throw Error('Legacy Confluence v1 failed');
    return document.getElementById('counter')?.textContent?.trim()==='5 / 5 turns';
  },null,{timeout:90000});
  const legacy=await page.evaluate(()=>document.getElementById('status')?.textContent);
  assert(!legacy.includes('renderer v2'),'legacy share silently switched to v2');
  assert.deepEqual(errors,[],'legacy v1 JavaScript errors');
  console.log('OIL_V2_BACKWARDS_COMPATIBLE passed');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
