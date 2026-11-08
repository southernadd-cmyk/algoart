import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Reproduce the user's actual monochrome Tissue / Recursive Divisions hand:
// seed AA-20261005-03-55769. Compare the exact *same planned gestures*
// rendered as the 27 separate V8 tissue passes versus a single native pass.
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
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
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.setDefaultTimeout(180000);
 await page.goto('http://127.0.0.1:'+server.address().port+'/confluence/',{waitUntil:'load'});
 await page.waitForFunction(()=>window.AlgoArt?.render&&
    document.querySelector('#counter')?.textContent.includes(' / '),
    null,{timeout:90000});
 const measurements=await page.evaluate(async()=>{
  const {systems,createStudy,makeRun,prepareCanvas}=await import('/confluence/collab.js');
  const {makePainter}=await import('/confluence/materials.js');
  const {defaultSettings}=await import('/confluence/artist-controls.js');
  const aa={
    elements:36,density:53,complexity:71,negativeSpace:41,
    seed:'AA-20261005-03-55769',phiStrength:91,recursion:4,
    spiralInfluence:63,goldenAngle:93,nesting:44,fit:false,
    pen:'fine',thickness:13,wobble:32,overdraw:3,
    opacity:70,pressure:36,dryness:19,curveBias:91,
    shapeAmount:68,overlap:65,rotation:91,
    lines:true,circles:true,rectangles:true,polygons:true,
    arcs:true,colourCount:4,saturation:86,brightness:59
  };
  const slots=[
    {id:1,system:'rects',palette:'mono',material:'tissue',settings:aa},
    {id:2,system:'spiral',palette:'spectrum',material:'marker',
      settings:defaultSettings(systems.find(s=>s.id==='spiral'))},
    {id:3,system:'organic',palette:'spectrum',material:'marker',
      settings:defaultSettings(systems.find(s=>s.id==='organic'))}
  ];
  const seed='AA-20261005-03-55769';
  const paper={orientation:'landscape',paper:'#f5f0e6',grain:13};
  const study=createStudy(seed,slots,paper,100,55,0);
  const run=makeRun(study,75);
  const batches=[];
  for(const turn of study.primary.turns){
    run.next({batch(actions){
      if(actions[0]?.artist.id===1)batches.push(actions);
      return [];
    }});
  }
  const all=batches.flat();
  const makeOutput=()=>{
    const c=document.createElement('canvas');
    const ctx=prepareCanvas(c,seed,study.sheet);
    return {canvas:c,ctx,painter:makePainter(ctx,seed,study.sheet,{roster:study.roster})};
  };
  const perTurn=makeOutput();
  for(const batch of batches)perTurn.painter.batch(batch,false);
  const fullPass=makeOutput();
  fullPass.painter.batch(all,false);
  const analyze=canvas=>{
    const {width,height}=canvas;
    const data=canvas.getContext('2d',{willReadFrequently:true})
      .getImageData(0,0,width,height).data;
    let deep=0,dark=0,grey=0,mean=0;
    for(let i=0;i<data.length;i+=4*16){
      const r=data[i],g=data[i+1],b=data[i+2];
      const lum=(.2126*r+.7152*g+.0722*b);
      mean+=lum;
      if(lum<72)deep++;
      if(lum<130)dark++;
      if(lum<200)grey++;
    }
    const n=Math.ceil(data.length/(4*16));
    return {meanLuma:+(mean/n).toFixed(2),
      deepPct:+(100*deep/n).toFixed(2),darkPct:+(100*dark/n).toFixed(2),
      greyPct:+(100*grey/n).toFixed(2)};
  };
  return {
    seed,sourceGroups:study.roster[0].groups.length,
    scheduledA1Turns:study.primary.counts[0],
    plannedTissueGestures:all.length,
    palette:study.roster[0].inks,
    perTurn:{...analyze(perTurn.canvas),stats:perTurn.painter.tissueStats()},
    singleNative:{...analyze(fullPass.canvas),stats:fullPass.painter.tissueStats()}
  };
 });
 console.log('SAVED_MONO_TISSUE_ACCUMULATION '+JSON.stringify(measurements));
 assert.equal(measurements.scheduledA1Turns,27);
 assert.equal(measurements.plannedTissueGestures,measurements.sourceGroups);
 assert.equal(measurements.perTurn.stats.nativeFullSheetPasses,27);
 assert.equal(measurements.singleNative.stats.nativeFullSheetPasses,1);
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
