import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Browser regression: Confluence must actually resize and switch orientation,
// not merely render non-functional HTML buttons.
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const server=createServer(async (req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+path);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(path.endsWith('/'))file=resolve(file,'index.html');
    const data=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
      'cache-control':'no-store'}).end(data);
  }catch(error){res.writeHead(404).end('Not found');}
});
let browser;
const errors=[];
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+port+'/confluence/',{waitUntil:'load'});
  await page.waitForFunction(()=>{
    const c=document.querySelector('#shared');
    const text=document.querySelector('#counter')?.textContent||'';
    return c?.width===1400 && text.includes(' / ') && text.endsWith(' turns') && Number(text.split('/')[1]?.trim().split(' ')[0])>0;
  },undefined,{timeout:60000});
  async function measure(label,w,h){
    await page.waitForFunction(([w,h])=>{
      const c=document.querySelector('#shared');
      return c?.width===w && c?.height===h && c.getBoundingClientRect().height>0;
    },[w,h],{timeout:60000});
    await page.waitForTimeout(150);
    const m=await page.evaluate(()=>{
      const c=document.querySelector('#shared'),box=c.getBoundingClientRect();
      const stage=document.querySelector('#canvases').getBoundingClientRect();
      return {w:c.width,h:c.height,shownW:box.width,shownH:box.height,
        left:box.left,right:box.right,top:box.top,bottom:box.bottom,
        stageW:stage.width,stageH:stage.height,stageBottom:stage.bottom,
        viewportW:innerWidth,viewportH:innerHeight,
        pageW:document.documentElement.scrollWidth,pageH:document.documentElement.scrollHeight};
    });
    assert(m.shownW>20&&m.shownH>20,label+' canvas unexpectedly tiny: '+JSON.stringify(m));
    assert(Math.abs(m.shownW/m.shownH-w/h)<.015,label+' has wrong visual aspect ratio: '+JSON.stringify(m));
    assert(m.shownW<=m.stageW+2&&m.shownH<=m.stageH+2,label+' exceeds stage: '+JSON.stringify(m));
    assert(m.left>=-2&&m.right<=m.viewportW+2&&m.top>=0&&m.bottom<=m.viewportH+2,
      label+' canvas extends beyond viewport: '+JSON.stringify(m));
    assert(m.pageW<=m.viewportW+3&&m.pageH<=m.viewportH+3,
      label+' page scroll exceeds viewport: '+JSON.stringify(m));
    console.log(label,JSON.stringify(m));
  }
  await measure('desktop landscape',1400,1000);
  await page.locator('#format-portrait').click();
  assert.equal(await page.locator('#orientation').inputValue(),'portrait');
  assert.equal(await page.locator('#format-portrait').getAttribute('aria-pressed'),'true');
  await measure('desktop portrait',1000,1400);
  await page.locator('#format-landscape').click();
  assert.equal(await page.locator('#orientation').inputValue(),'landscape');
  await measure('desktop landscape restored',1400,1000);
  await page.setViewportSize({width:390,height:844});
  await measure('mobile landscape',1400,1000);
  await page.locator('#format-portrait').click();
  await measure('mobile portrait',1000,1400);
  assert.deepEqual(errors,[],'Confluence JavaScript errors: '+errors.join('; '));
  console.log('Confluence responsive orientation smoke passed');
  // Check each of the five materials in an actual browser. Native tissue and
  // watercolour must call the same released pigment engine as the solo editor;
  // both must preserve coloured marks and leave the shared sheet free of
  // paper-coloured opaque squares.
  await page.setViewportSize({width:1280,height:850});
  await page.evaluate(()=>{
    const A=window.AlgoArt;
    window.__materialCalls={tissue:0,watercolour:0};
    const oil=A.oilMaterial,watercolour=A.watercolourV2sMaterial;
    A.oilMaterial=function(...args){
      window.__materialCalls.tissue++;
      return oil.apply(this,args);
    };
    A.watercolourV2sMaterial=function(...args){
      window.__materialCalls.watercolour++;
      return watercolour.apply(this,args);
    };
  });
  await page.locator('#inspector-toggle').click();
  await page.locator('#tab-shared').click();
  await page.locator('#total-turns').selectOption('5');
  await page.locator('#tab-artist-1').click();
  const snapshots=[];
  for(const material of ['marker','tissue','watercolour','oil','action']){
    await page.locator('#roster [data-artist="1"] select[data-field="material"]').selectOption(material);
    await page.locator('#study-form .draw-actions button[type="submit"]').click();
    await page.waitForFunction(()=>{
      const counter=document.querySelector('#counter')?.textContent?.trim();
      const status=document.querySelector('#status')?.textContent||'';
      if(status.includes('Could not render'))throw Error(status);
      return counter==='5 / 5 turns';
    },undefined,{timeout:90000});
    const evidence=await page.evaluate(()=>{
      const canvas=document.querySelector('#shared');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const image=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const paper=[245,240,230];
      let painted=0;
      for(let p=0;p<image.length;p+=20){
        if(Math.max(Math.abs(image[p]-paper[0]),
          Math.abs(image[p+1]-paper[1]),
          Math.abs(image[p+2]-paper[2]))>24)painted++;
      }
      return {painted,ratio:painted/(image.length/20),
        calls:{...window.__materialCalls},stats:{
          tissue:window.AlgoArt.lastOilMaterialStats?.tissuePaletteVersion,
          wc:window.AlgoArt.lastWatercolourExperimentStats?.referenceMaterial}};
    });
    assert(evidence.painted>20,material+' rendered no meaningful marks: '+JSON.stringify(evidence));
    assert(evidence.ratio<.65,material+' covered most of the sheet: '+JSON.stringify(evidence));
    if(material==='tissue')assert(evidence.calls.tissue>0,'Tissue never used the native V7 pipeline');
    if(material==='watercolour')assert(evidence.calls.watercolour>0,'Watercolour never used native V2S');
    console.log('material '+material+' '+JSON.stringify(evidence));
    snapshots.push({material,...evidence});
    await page.locator('#inspector-toggle').click();
    await page.locator('#tab-artist-1').click();
  }
  assert.deepEqual(errors,[],'Confluence material JavaScript errors: '+errors.join('; '));
  console.log('Confluence five-material browser smoke passed');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
