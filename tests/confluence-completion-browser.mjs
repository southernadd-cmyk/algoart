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
        if(run.next(painter)!==null)throw Error('Extra turn outside schedule');
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
    return results;
  });
  for(const row of report)console.log('COMPLETE_DRAWING '+JSON.stringify(row));
  assert.equal(report.length,10,'Every mixed-engine pair of schedules must complete');
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
