// Headless smoke test for the exact 11 November daily Confluence pair.
// Local-only: creates no gallery edition, public asset, upload or social post.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {systems,palettes} from '../confluence/collab.js';
import {defaultSettings} from '../confluence/artist-controls.js';
import {makeDailyConfluencePlan} from '../automation/confluence-daily-variation.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(pathname.endsWith('/'))file=resolve(file,'index.html');
    const bytes=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
      'cache-control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end('Not Found');}
});
let browser;
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port+'/confluence/';
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const day='2026-11-11';
  for(let i=0;i<2;i++){
    const orientation=i%2===0?'portrait':'landscape';
    const seed='CFL-20261111-'+String(i+1).padStart(2,'0');
    const plan=makeDailyConfluencePlan(day,seed,{
      systems,materials:['marker','tissue','watercolour','oil','action'],
      palettes:Object.keys(palettes),defaultSettings
    });
    const record={v:1,confluenceRenderer:2,seed,orientation,paper:'#f5f0e6',
      grain:plan.grain,edgeMargin:true,strength:plan.strength,
      collaborationPull:plan.collaborationPull,leadIndex:plan.leadIndex,
      totalTurns:34,artists:plan.artists.map(a=>({
        system:a.system,palette:a.palette,material:a.material,settings:a.settings
      }))};
    const encoded=Buffer.from(JSON.stringify(record),'utf8').toString('base64url');
    assert(encoded.length<10000,'Shared state exceeds bookmark limit');
    errors.length=0;
    await page.goto(base+'?s='+encoded,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>{
      if(document.getElementById('summary')?.textContent==='Could not render this study.')
        throw Error('Confluence painter failed');
      const match=(document.getElementById('counter')?.textContent||'').match(/^(\d+)\s*\/\s*(\d+)\s+turns$/);
      return match&&Number(match[2])>0&&match[1]===match[2]&&
        document.querySelector('.progress')?.getAttribute('aria-valuenow')==='100';
    },null,{timeout:240000});
    assert.deepEqual(errors,[],'Browser errors: '+errors.join(' | '));
    const data=await page.locator('#shared').evaluate(canvas=>{
      const sample=document.createElement('canvas');
      sample.width=96;sample.height=96;
      const ctx=sample.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(canvas,0,0,96,96);
      const pixels=ctx.getImageData(0,0,96,96).data;
      let marked=0,min=255,max=0;
      for(let j=0;j<pixels.length;j+=4){
        const r=pixels[j],g=pixels[j+1],b=pixels[j+2];
        const v=(r+g+b)/3;
        min=Math.min(min,v);max=Math.max(max,v);
        if(Math.max(Math.abs(r-245),Math.abs(g-240),Math.abs(b-230))>35)marked++;
      }
      return {w:canvas.width,h:canvas.height,coverage:marked/9216,
        contrast:max-min,jpegLength:canvas.toDataURL('image/jpeg',.86).length};
    });
    assert.deepEqual([data.w,data.h],orientation==='portrait'?[1000,1400]:[1400,1000]);
    assert(data.coverage>=.003 && data.contrast>=30 && data.jpegLength>20000,
      'Empty or invalid random daily Confluence painting: '+seed+' '+JSON.stringify(data));
    console.log('DAILY CONFLUENCE PAIR OK '+JSON.stringify({seed,orientation,
      artists:plan.artists.map(a=>[a.system,a.material,a.palette]),...data}));
  }
}finally{
  await browser?.close();
  await new Promise(ok=>server.close(ok));
}
