// Release-gate regression: canonical V1 and Confluence v2-capable build must
// paint byte-identical canvas pixels for the SAME frozen V1 share state.
// The baseline checkout is explicitly pinned; it never moves with main.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {systems} from '../confluence/collab.js';
import {defaultSettings} from '../confluence/artist-controls.js';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const original=resolve(root,'.baseline-v1');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
const app=createServer(async(req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const baseline=pathname.startsWith('/baseline/');
    if(baseline)pathname=pathname.slice('/baseline'.length);
    const base=baseline?original:root;
    let file=resolve(base,'.'+pathname);
    if(file!==base&&!file.startsWith(base+sep)){res.writeHead(403).end();return;}
    if(pathname.endsWith('/'))file=resolve(file,'index.html');
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
      'cache-control':'no-store'}).end(await readFile(file));
  }catch(e){res.writeHead(404).end('Not found');}
});
const stateFor=(seed,media,modes,turns)=>({
  v:1,seed,orientation:'landscape',paper:'#f5f0e6',grain:10,
  edgeMargin:true,strength:78,collaborationPull:90,leadIndex:0,totalTurns:turns,
  artists:modes.map((mode,i)=>{
    const system=systems.find(x=>x.id===mode);
    return {system:mode,palette:['warm','spectrum','earth'][i],
      material:media[i],settings:{...defaultSettings(system),
        elements:59,density:58,complexity:66,negativeSpace:46,
        phiStrength:83,colourCount:8,saturation:75,brightness:50,
        seed:seed+'-'+i}};
  })
});
const studies=[
  ['oil-v1',stateFor('CV1-PARITY-OIL', ['oil','oil','oil'],
    ['organic','spiral','geometric'],13)],
  ['mixed-v1',stateFor('CV1-PARITY-MIXED', ['oil','tissue','watercolour'],
    ['rects','field','spiral'],8)]
];
let browser;
try{
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+app.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  async function render(prefix,state){
    const page=await browser.newPage({viewport:{width:1400,height:940}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=origin+prefix+'/confluence/?s='+Buffer.from(JSON.stringify(state)).toString('base64url');
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>{
        if(document.getElementById('summary')?.textContent==='Could not render this study.')
          throw new Error('V1 study failed');
        const c=document.querySelector('#counter')?.textContent||'';
        const parts=c.match(new RegExp('^([0-9]+) / ([0-9]+) turns$'));
        return parts&&parts[1]===parts[2];
      },undefined,{timeout:180000});
      const result=await page.evaluate(async()=>{
        const canvas=document.querySelector('#shared');
        const c=canvas.getContext('2d',{willReadFrequently:true});
        const data=c.getImageData(0,0,canvas.width,canvas.height).data;
        const hash=await crypto.subtle.digest('SHA-256',data);
        return {width:canvas.width,height:canvas.height,
          digest:[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''),
          status:document.querySelector('#status')?.textContent||''};
      });
      assert.deepEqual(errors,[]);
      assert(!result.status.includes('renderer v2'),'Old link accidentally opted into V2');
      return result;
    }finally{await page.close();}
  }
  for(const [label,s] of studies){
    const [before,after]=await Promise.all([render('/baseline',s),render('',s)]);
    assert.deepEqual(after,before,'V1 renderer changed pixels for '+label);
    console.log('V1_PIXEL_PARITY '+label+' '+before.width+'x'+before.height+
      ' SHA256='+before.digest);
  }
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>app.close(resolve));
}
