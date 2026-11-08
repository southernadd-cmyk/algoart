import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Real browser audit of the native vector-group capacity for ALL eight
// Confluence engines. An engine must have enough distinct recorded groups
// for a 55-turn φ-weighted study; metadata or UI counts alone cannot prove it.
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(pathname.endsWith('/'))file=resolve(file,'index.html');
    const body=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
      'cache-control':'no-store'}).end(body);
  }catch(error){res.writeHead(404).end('Not found');}
});
let browser;
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/confluence/',{waitUntil:'load'});
  const report=await page.evaluate(async()=>{
    const {systems,createStudy}=await import('/confluence/collab.js?v=capacity-audit-01');
    const {defaultSettings}=await import('/confluence/artist-controls.js?v=capacity-audit-01');
    const seeds=['2331044488','20261108','862713905'];
    const variants=[
      {name:'default',apply:s=>s},
      {name:'moderate',apply:s=>({...s,elements:30,complexity:40,recursion:3})}
    ];
    const results=[];
    for(const {id,name} of systems)for(const variant of variants)for(const seed of seeds){
      const slots=[1,2,3].map(n=>({id:n,system:id,palette:'spectrum',
        material:'marker',settings:variant.apply(defaultSettings({id,pen:'felt',width:6}))}));
      let record={system:id,name,variant:variant.name,seed};
      try{
        const study=createStudy(seed,slots,{orientation:'landscape',
          paper:'#f5f0e6',grain:7},100,55);
        record={...record,groups:study.roster.map(a=>a.groups.length),
          maxTurns:study.availableTurns.at(-1),
          requestedTurns:study.totalTurns,
          supports55:study.availableTurns.includes(55),
          supports89:study.availableTurns.includes(89)};
      }catch(e){record.error=String(e);}
      results.push(record);
    }
    return results;
  });
  for(const row of report)console.log('CAPACITY_AUDIT '+JSON.stringify(row));
  const failures=report.filter(r=>r.error||!r.supports55);
  console.log('CAPACITY_SUMMARY '+JSON.stringify({
    total:report.length,passed:report.length-failures.length,failed:failures.length,
    failures}));
  // No exceptions: all eight engines must support 55 Fibonacci turns.
  // This protects Constructed Forms and Automatic Marks from silently
  // falling back to their former 13–34-turn maximum.
  assert.equal(failures.length,0,
    'Confluence engine turn-capacity regression: '+JSON.stringify(failures));

  // Previously this genuine solo-editor handoff rendered only 8 turns:
  // A1 Constructed Forms has enough strokes; A2 Golden Trajectories had
  // just FIVE recorded groups and capped the entire 55-turn study.
  // The same user settings must keep 55 real, source-preserving turns.
  const actualQuery='v=10&seed=CWP-20261108-02-05196&mode=geometric&fmt=portrait&el=23&den=53&cx=60&neg=47&phi=93&rec=5&spi=20&ga=99&nest=53&pen=felt&th=5&wob=58&od=2&op=80&pr=33&dry=8&curve=1&shape=56&overlap=28&rot=81&ln=1&ci=1&re=1&po=1&ar=1&pal=earth&cols=8&sat=73&bri=49&paper=%23f5f0e6&grain=17&sheet=phi&material=watercolour-v2s&fit=0';
  const specific=await page.evaluate(async query=>{
    const {systems,palettes,createStudy}=await import('/confluence/collab.js');
    const {materials}=await import('/confluence/materials.js');
    const {defaultSettings}=await import('/confluence/artist-controls.js');
    const {importLeadFromURL}=await import('/confluence/import-lead.js');
    const slots=systems.slice(0,3).map((system,i)=>({
      id:i+1,system:system.id,palette:'spectrum',material:'marker',
      settings:defaultSettings(system)
    }));
    const inputs={seed:{value:''},orientation:{value:'landscape'},
      paper:{value:'#f5f0e6'},grain:{value:'11'}};
    const imported=importLeadFromURL(new URLSearchParams(query),slots[0],
      inputs,{systems,palettes,materials});
    const study=createStudy(inputs.seed.value,slots,{
      orientation:inputs.orientation.value,paper:inputs.paper.value,
      grain:Number(inputs.grain.value)
    },100,55,0);
    const totals=study.roster.map(a=>a.groups.length);
    const consumed=study.roster.map(a=>study.primary.turns
      .filter(t=>t.id===a.id).reduce((n,t)=>n+t.groupQuota,0));
    return {imported,seed:study.seed,systems:slots.map(s=>s.system),
      firstMaterial:slots[0].material,firstElements:slots[0].settings.elements,
      firstFit:slots[0].settings.fit,orientation:study.sheet.orientation,
      groups:totals,counts:study.primary.counts,consumed,
      turns:study.totalTurns,options:study.availableTurns};
  },actualQuery);
  console.log('SPARSE_GOLDEN_TRAJECTORIES_HANDOFF '+JSON.stringify(specific));
  assert.equal(specific.imported,true);
  assert.equal(specific.seed,'CWP-20261108-02-05196');
  assert.deepEqual(specific.systems,['geometric','spiral','organic']);
  assert.equal(specific.firstMaterial,'watercolour');
  assert.equal(specific.firstElements,23);
  assert.equal(specific.orientation,'portrait');
  assert.equal(specific.turns,55,
    'Sparse Constructed Forms handoff fell back below 55 turns: '+JSON.stringify(specific));
  assert(specific.options.includes(55));
  assert(specific.groups[1]>=29,
    'Golden Trajectories still has too few progressive gestures: '+JSON.stringify(specific));
  assert.deepEqual(specific.groups,specific.consumed,
    'Sparse study did not include every recorded gesture');
  assert(specific.counts.every(n=>n>0));
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
