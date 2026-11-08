// Verify the Confluence Tissue renderer's pigment physics against the exact
// released solo V8 implementation, using identical transformed source marks.
// This does not assert whole-image identity: Confluence intentionally changes
// the scheduling and spatial placement of marks.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,'.'+path);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  if(path.endsWith('/'))file=resolve(file,'index.html');
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
    'cache-control':'no-store'}).end(await readFile(file));
 }catch{res.writeHead(404).end('Not found');}
});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1000,height:750}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/confluence/',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.AlgoArt?.oilMaterial==='function' &&
   typeof window.AlgoArt?.tissueKitFromPaths==='function');
 const before=await page.evaluate(async()=>{
   const {renderNativeDeposit}=await import('/confluence/native-material.js');
   window.__paintNativeV8=()=>{
     const canvas=document.createElement('canvas');
     canvas.width=420;canvas.height=300;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     const traces=[
       {ink:'#ac462d',mark:1,width:16,opacity:.72,passes:2,
         points:[{x:48,y:65},{x:95,y:87},{x:160,y:110},{x:236,y:138},{x:358,y:184}]},
       {ink:'#326a8b',mark:2,width:11,opacity:.84,passes:2,
         points:[{x:60,y:226},{x:115,y:190},{x:183,y:163},{x:251,y:147},{x:336,y:104}]},
       {ink:'#819045',mark:3,width:9,opacity:.79,passes:2,
         points:[{x:182,y:39},{x:205,y:81},{x:230,y:116},{x:275,y:174},{x:315,y:246}]}
     ];
     const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
     const artist={inks:traces.map(t=>t.ink),settings:{colourCount:3}};
     const area={x:0,y:0,w:420,h:300};
     renderNativeDeposit(ctx,'tissue',traces,artist,area,'#f5f0e6',
       'V8-PARITY-MATERIAL-2026',rgb,{width:420,height:300},
       {directPaper:true});
     return {data:ctx.getImageData(0,0,420,300).data,
       stats:{...window.AlgoArt.lastTissueV8Stats}};
   };
   const output=window.__paintNativeV8();
   window.__v8Before=output.data;
   return {variant:output.stats.variant,
     version:output.stats.tissuePaletteVersion,
     graphite:output.stats.graphitePaths||0};
 });
 assert.equal(before.variant,'layered-v8');
 assert.equal(before.version,8);
 assert(before.graphite>0,'Confluence V8 test did not draw graphite');
 await page.addScriptTag({url:origin+'/js/oil-material.js'});
 const parity=await page.evaluate(()=>{
   const after=window.__paintNativeV8();
   const left=window.__v8Before,right=after.data;
   let differingBytes=0,delta=0;
   for(let i=0;i<left.length;i++){
     if(left[i]!==right[i])differingBytes++;
     delta+=Math.abs(left[i]-right[i]);
   }
   return {differingBytes,totalDelta:delta,pixels:left.length/4,
     graphite:after.stats.graphitePaths||0,
     variant:after.stats.variant};
 });
 console.log('CONFLUENCE_TISSUE_V8_SOLO_MATERIAL_PARITY '+JSON.stringify(parity));
 assert.equal(parity.differingBytes,0,
   'Native Confluence material physics differ from the released solo Tissue V8 for identical marks');
 assert(parity.graphite>0,'Original solo material did not draw graphite');
 assert.deepEqual(errors,[],'Browser threw errors');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
