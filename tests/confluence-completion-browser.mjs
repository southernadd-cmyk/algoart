import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

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
    const {createStudy,makeRun}=await import('/confluence/collab.js?v=full-completion-01');
    const {defaultSettings}=await import('/confluence/artist-controls.js?v=full-completion-01');
    const sets=[
      ['field','rects','scribble'],
      ['geometric','network','burst'],
      ['spiral','organic','field'],
      ['rects','geometric','scribble'],
      ['rects','rects','rects']
    ];
    const results=[];
    for(const systems of sets){
      const slots=systems.map((id,i)=>({
        id:i+1,system:id,palette:'spectrum',material:'marker',
        settings:defaultSettings({id,pen:'felt',width:6})
      }));
      const study=createStudy('2331044488',slots,
        {orientation:'landscape',paper:'#f5f0e6',grain:7},100,55);
      if(study.totalTurns!==55)throw Error('Insufficient capacity for '+systems.join(','));
      const signatures=[];
      for(const equal of [false,true]){
        const planned=equal?study.equal:study.primary;
        const run=makeRun(study,75,{equal});
        const seen=new Map(study.roster.map(artist=>[artist.id,new Set()]));
        const batches=[],responses=[];
        for(let i=0;i<planned.turns.length;i++){
          const entry=planned.turns[i];
          let called=false;
          const painter={
            batch(actions){
              if(called)throw Error('Painter called twice in one turn');
              called=true;
              if(actions.length!==entry.groupQuota)
                throw Error('Quota mismatch on turn '+i+': '+actions.length+' vs '+entry.groupQuota);
              for(const action of actions){
                if(action.artist.id!==entry.id)throw Error('Artist switched mid-turn');
                const set=seen.get(entry.id);
                if(set.has(action.group))throw Error('Duplicate source gesture: '+action.group.id);
                if(!action.group.paths.length||!action.group.traces.length)
                  throw Error('No actual recorded ink in '+action.group.id);
                set.add(action.group);
                responses.push(action.changed);
              }
              batches.push(actions.length);
              // Minimal material proxy to exercise the real placement and
              // response planner without running an expensive pigment engine.
              return actions.map(action=>({
                point:action.placement.place(action.group.center),
                angle:0,radius:3,opacity:.22
              }));
            }
          };
          const summary=run.next(painter);
          if(!called||!summary||summary.gestureCount!==entry.groupQuota)
            throw Error('One scheduled turn failed to paint all gestures');
          if(summary.drawnGroups>summary.totalGroups)throw Error('Overdrawn source groups');
        }
        if(run.next()!==null)throw Error('Extra turn outside schedule');
        for(const artist of study.roster){
          const expected=new Set(artist.groups);
          const actual=seen.get(artist.id);
          if(actual.size!==expected.size||
             [...expected].some(group=>!actual.has(group)))
            throw Error('Incomplete source '+artist.name+': '+actual.size+'/'+expected.size);
        }
        const signature=[...seen.entries()].map(([id,g])=>[id,g.size]);
        signatures.push(signature);
        results.push({systems:systems.join('/'),
          schedule:equal?'equal':'phi',
          counts:planned.counts,groups:signature,batches:batches.length,
          responsive:responses.filter(Boolean).length});
      }
      if(JSON.stringify(signatures[0])!==JSON.stringify(signatures[1]))
        throw Error('φ/equal comparisons do not finish the same source drawings');
    }
    // Oil must occasionally choose an actual previous artist's line
    // over the lowest-crowding location. This is a real planner run, with
    // minimal response footprints instead of expensive material painting.
    const ids=['field','geometric','rects'];
    const oilSlots=ids.map((id,i)=>({id:i+1,system:id,
      palette:'spectrum',material:i===1?'oil':'marker',
      settings:defaultSettings({id,pen:'felt',width:6})}));
    const oilStudy=createStudy('2331044488',oilSlots,
      {orientation:'landscape',paper:'#f5f0e6',grain:7},100,55);
    const oilRun=makeRun(oilStudy,90);
    let engaged=0,oilGestures=0;
    for(let i=0;i<oilStudy.schedule.length;i++){
      oilRun.next({batch(actions){
        for(const action of actions){
          if(action.artist.material==='oil'){
            oilGestures++;
            if(action.placement.oilContact)engaged++;
          }
        }
        return actions.flatMap(action=>{
          const probes=action.group.probes;
          const stride=Math.max(1,Math.ceil(probes.length/12));
          return probes.filter((_,j)=>j%stride===0).map(probe=>({
            point:action.placement.place(probe.p),
            angle:0,radius:9,opacity:.35
          }));
        });
      }});
    }
    results.push({systems:ids.join('/'),schedule:'oil-contact',
      gestures:oilGestures,engaged,diagnostics:oilRun.oilDiagnostics()});
    return results;
  });
  for(const row of report)console.log('COMPLETE_DRAWING '+JSON.stringify(row));
  assert.equal(report.length,11,'Every mixed-engine schedule must complete plus Oil engagement audit');
  const oil=report.at(-1);
  assert(oil.gestures>0,'Oil never contributed its source gestures');
  assert(oil.engaged>0,'Oil never deliberately connected with existing artist marks');

  // Visitor control test: rotating lead is a single real button interaction.
  // The underlying artist settings and equal-turn canvas must not change.
  await page.locator('#inspector-toggle').click();
  await page.locator('#tab-shared').click();
  await page.locator('#total-turns').selectOption('5');
  await page.waitForFunction(()=>
    document.querySelector('#counter')?.textContent.trim()==='5 / 5 turns');
  const readUI=()=>page.evaluate(()=>({
    lead:document.querySelector('#lead-index').value,
    caption:[...document.querySelectorAll('#shared-turns .turn-artist strong')]
      .map(x=>Number(x.textContent)),
    equal:[...document.querySelectorAll('#equal-turns .turn-artist strong')]
      .map(x=>Number(x.textContent)),
    baseline:document.querySelector('#baseline').toDataURL(),
    artists:[...document.querySelectorAll('#roster .artist')]
      .map(card=>[...card.querySelectorAll('.artist-fields select')].map(el=>el.value))
  }));
  const initial=await readUI();
  assert.deepEqual(initial.caption,[3,1,1]);
  for(const [index,expected] of [[1,[1,3,1]],[2,[1,1,3]],[0,[3,1,1]]]){
    await page.locator('#rotate-lead').click();
    await page.waitForFunction(({index,expected})=>
      Number(document.querySelector('#lead-index').value)===index &&
      document.querySelector('#counter')?.textContent.trim()==='5 / 5 turns' &&
      [...document.querySelectorAll('#shared-turns .turn-artist strong')]
        .map(x=>Number(x.textContent)).join(',')===expected.join(','),
      {index,expected});
    const current=await readUI();
    assert.deepEqual(current.caption,expected);
    assert.deepEqual(current.equal,initial.equal,'Equal turn counts must be fixed');
    assert.equal(current.baseline,initial.baseline,
      'Equal-turn artwork must be pixel-identical after role rotation');
    assert.deepEqual(current.artists,initial.artists,
      'Rotating lead cannot change any artist system, material or palette');
    assert.equal(await page.locator('#lead-label').textContent(),'A'+(index+1)+' leads');
  }
  // Role assignment also survives a copied study link, with old links
  // defaulting to the historical A1 lead.
  await page.locator('#rotate-lead').click();
  await page.waitForFunction(()=>
    document.querySelector('#lead-index').value==='1' &&
    document.querySelector('#counter')?.textContent.trim()==='5 / 5 turns');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.locator('#share-open').click();
  await page.locator('#copy-study-link').click();
  const url=await page.evaluate(()=>navigator.clipboard.readText());
  const link=new URL(url),token=link.searchParams.get('s');
  assert(token,'Copy study link must include full study state');
  const data=JSON.parse(Buffer.from(token,'base64url').toString('utf8'));
  assert.equal(data.leadIndex,1);
  await page.goto(link.href,{waitUntil:'load'});
  await page.waitForFunction(()=>
    document.querySelector('#lead-index').value==='1' &&
    document.querySelector('#counter')?.textContent.trim()==='5 / 5 turns');
  assert.equal(await page.locator('#lead-label').textContent(),'A2 leads');
  delete data.leadIndex;
  link.searchParams.set('s',Buffer.from(JSON.stringify(data)).toString('base64url'));
  await page.goto(link.href,{waitUntil:'load'});
  await page.waitForFunction(()=>
    document.querySelector('#lead-index').value==='0' &&
    document.querySelector('#counter')?.textContent.trim()==='5 / 5 turns');
  assert.equal(await page.locator('#lead-label').textContent(),'A1 leads');
  console.log('Rotate lead UI, equal-canvas identity and share-state restoration passed');
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
