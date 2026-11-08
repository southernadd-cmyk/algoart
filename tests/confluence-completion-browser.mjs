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

    // A low-turn allocation packs several complete source gestures into
    // each turn. Verify the real planner observes its provisional same-hand
    // marks, without painting or double-counting them, and replays exactly.
    const feedbackSlots=['field','geometric','rects'].map((id,i)=>({
      id:i+1,system:id,palette:'spectrum',material:i===1?'oil':'marker',
      settings:defaultSettings({id,pen:'felt',width:7})
    }));
    const feedbackStudy=createStudy('2520283841',feedbackSlots,
      {orientation:'landscape',paper:'#f5f0e6',grain:7},100,13);
    const trial=()=>{
      const run=makeRun(feedbackStudy,85);
      const signature=[];
      let gestures=0;
      for(const entry of feedbackStudy.primary.turns){
        run.next({batch(actions){
          if(actions.length!==entry.groupQuota)throw Error('Incomplete intra-turn batch');
          for(const action of actions){
            gestures++;
            const p=action.placement.place(action.group.center);
            signature.push([action.artist.id,action.group.id,
              p.x.toFixed(3),p.y.toFixed(3),action.reaction]);
          }
          return actions.flatMap(action=>
            action.group.probes.filter((_,i)=>i%Math.max(1,
              Math.ceil(action.group.probes.length/9))===0).map(probe=>({
              point:action.placement.place(probe.p),angle:0,
              radius:9,opacity:.38
            }))
          );
        }});
      }
      return {signature,gestures,stats:run.intraTurnDiagnostics()};
    };
    const first=trial(),repeated=trial();
    const expectedDecisions=feedbackStudy.primary.turns
      .reduce((count,entry)=>count+Math.max(0,entry.groupQuota-1),0);
    const expectedStamps=feedbackStudy.primary.turns
      .reduce((count,entry)=>count+(entry.groupQuota>1?entry.groupQuota:0),0);
    if(JSON.stringify(first)!==JSON.stringify(repeated))
      throw Error('Intra-turn planning is not deterministic for identical seeds');
    if(first.stats.decisions!==expectedDecisions||
       first.stats.stamped!==expectedStamps)
      throw Error('Gestures in a shared turn did not see their provisional ink');
    results.push({systems:'field/geometric/rects',schedule:'intra-turn',
      complete: first.gestures===feedbackStudy.roster
        .reduce((sum,artist)=>sum+artist.groups.length,0),
      deterministic:true,decisions:first.stats.decisions,
      stamps:first.stats.stamped,nearby:first.stats.nearby,
      turnsWithFeedback:first.stats.turns});
    return results;
  });
  for(const row of report)console.log('COMPLETE_DRAWING '+JSON.stringify(row));
  assert.equal(report.length,12,
    'Every mixed-engine schedule must complete plus Oil and intra-turn audits');
  const oil=report.find(row=>row.schedule==='oil-contact');
  assert(oil.gestures>0,'Oil never contributed its source gestures');
  assert(oil.engaged>0,'Oil never deliberately connected with existing artist marks');
  const intra=report.find(row=>row.schedule==='intra-turn');
  assert(intra.complete,'Intra-turn feedback lost source gestures');
  assert(intra.deterministic,'Intra-turn planning did not replay identically');
  assert(intra.stamps>0&&intra.decisions>0,
    'A multi-gesture turn did not update planning state before the next gesture');
  assert(intra.nearby>0,
    'Provisional self-ink never appeared near another same-turn gesture');

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
  assert.deepEqual(initial.caption,[2,2,1]);
  for(const [index,expected] of [[1,[1,2,2]],[2,[2,1,2]],[0,[2,2,1]]]){
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
  // The Parameters drawer is already open on Shared; switch directly
  // to Export instead of clicking the covered page-level Share shortcut.
  await page.locator('#tab-export').click();
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

  // The duplicate toolbar button uses the same lead and redraw state.
  await page.locator('#rotate-lead-toolbar').click();
  await page.waitForFunction(()=>
    document.querySelector('#lead-index').value==='1' &&
    document.querySelector('#toolbar-lead-label').textContent==='A2' &&
    document.querySelector('#counter')?.textContent.trim()==='5 / 5 turns');
  assert.deepEqual((await readUI()).caption,[1,2,2]);
  assert.deepEqual((await readUI()).equal,initial.equal);

  // The counter is hidden on a narrow phone; its following Rotate lead
  // button must still be visible, clickable and inside the drawing bar.
  await page.setViewportSize({width:390,height:844});
  const toolbar=await page.locator('#rotate-lead-toolbar').boundingBox();
  const stage=await page.locator('.transport').boundingBox();
  assert(toolbar&&stage&&toolbar.width>=55,
    'Rotate lead toolbar button must remain visible on mobile');
  assert(toolbar.x>=stage.x-1&&toolbar.x+toolbar.width<=stage.x+stage.width+1,
    'Rotate lead must not be clipped by narrow-screen transport');
  await page.locator('#rotate-lead-toolbar').click();
  await page.waitForFunction(()=>
    document.querySelector('#lead-index').value==='2' &&
    document.querySelector('#toolbar-lead-label').textContent==='A3');
  assert.deepEqual((await readUI()).caption,[2,1,2]);
  console.log('Rotate lead toolbar, mobile layout, equal-canvas identity and share-state restoration passed');
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
