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
  assert.equal(await page.locator('#response').count(),0,
    'Confluence must not offer a manual response-style selector');
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
          graphite:window.AlgoArt.lastOilMaterialStats?.graphitePaths,
          wc:window.AlgoArt.lastWatercolourExperimentStats?.referenceMaterial}};
    });
    assert(evidence.painted>20,material+' rendered no meaningful marks: '+JSON.stringify(evidence));
    assert(evidence.ratio<.65,material+' covered most of the sheet: '+JSON.stringify(evidence));
    if(material==='tissue'){
      assert(evidence.calls.tissue>0,'Tissue never used the native V7 pipeline');
      assert.equal(evidence.stats.tissue,7,'Tissue must use native V7');
      assert(evidence.stats.graphite>0,'Tissue V7 must also render real graphite strokes');
      // One native artist layer uses two calls (blank & actual), then a
      // second two for φ-baseline. A local patch per drawing turn would
      // call the renderer considerably more often and restart its wash.
      assert(evidence.calls.tissue>=4 && evidence.calls.tissue<=20,
        'Tissue must use a real full-sheet V7 pass for each turn: '+JSON.stringify(evidence));
    }
    if(material==='watercolour')assert(evidence.calls.watercolour>0,'Watercolour never used native V2S');
    console.log('material '+material+' '+JSON.stringify(evidence));
    snapshots.push({material,...evidence});
    await page.locator('#inspector-toggle').click();
    await page.locator('#tab-artist-1').click();
  }
  // Regression for the screenshot's rectangular colour tiles: a one-turn
  // native wash must have fully transparent artificial crop boundaries.
  // Running this in Chromium verifies the mask survives actual V2S/tissue
  // pigment computation, not merely a mocked math helper.
  for(const material of ['watercolour','tissue']){
    const crop=await page.evaluate(async kind=>{
      const {renderNativeDeposit}=await import('/confluence/native-material.js');
      const area={x:120,y:125,w:390,h:380};
      const sheet={width:1400,height:1000};
      const canvas=document.createElement('canvas');
      canvas.width=area.w;canvas.height=area.h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const points=[{x:280,y:260},{x:310,y:275},{x:340,y:296},{x:385,y:315}];
      renderNativeDeposit(ctx,kind,
        [{points,width:6,mark:1}],
        {inks:['hsl(215 80% 45%)'],settings:{colourCount:3}},
        area,'#f5f0e6','TEST-SEAM-'+kind,()=>[31,105,220],sheet);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const w=canvas.width,h=canvas.height;
      let edgeMax=0,innerCount=0,inside=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const a=data[(y*w+x)*4+3];
        if(x===0||y===0||x===w-1||y===h-1)edgeMax=Math.max(edgeMax,a);
        if(x>=80&&y>=80&&x<w-80&&y<h-80){
          inside++;if(a>15)innerCount++;
        }
      }
      return {edgeMax,innerCount,inside};
    },material);
    assert.equal(crop.edgeMax,0,material+' crop produced hard rectangular edges: '+JSON.stringify(crop));
    assert(crop.innerCount>0,material+' lost its native pigment while feathering: '+JSON.stringify(crop));
    console.log('native crop '+material+' '+JSON.stringify(crop));
  }
  // All three tissue artists must share ONE V7 atmosphere per canvas.
  // Two calls per canvas (reference + actual) and two canvases (shared
  // and equal-turn comparison) means four, regardless of artist count.
  // The material matrix leaves the drawer open after changing Artist 1.
  // Do not attempt to click the covered background toggle a second time.
  if((await page.locator('#inspector-toggle').getAttribute('aria-expanded'))!=='true')
    await page.locator('#inspector-toggle').click();
  for (const tab of ['artist-1','artist-2','artist-3']){
    await page.locator('#tab-'+tab).click();
    await page.locator('#roster [data-artist="'+tab.slice(-1)+'"] select[data-field="material"]').selectOption('tissue');
  }
  await page.evaluate(()=>{window.__materialCalls.tissue=0;});
  await page.locator('#study-form .draw-actions button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#counter')?.textContent?.trim()==='5 / 5 turns',
    undefined,{timeout:90000});
  const sharedSurface=await page.evaluate(()=>({
    calls:window.__materialCalls.tissue,
    palette:window.AlgoArt.lastOilMaterialStats?.inkColours,
    graphite:window.AlgoArt.lastOilMaterialStats?.graphitePaths
  }));
  assert.equal(sharedSurface.calls,20,
    'Five all-tissue turns should produce ten native V7 passes per canvas (paint plus reference): '+JSON.stringify(sharedSurface));
  assert(sharedSurface.palette?.length>=3,'Tissue layer lost distinct original artist colours: '+JSON.stringify(sharedSurface));
  assert(sharedSurface.graphite>0,'Tissue unified layer lost graphite: '+JSON.stringify(sharedSurface));
  console.log('unified tissue '+JSON.stringify(sharedSurface));
  // A manual Step must now run the *native V7* material pipeline, not the
  // earlier collabTissue ribbon substitute. It is a procedural check only;
  // the user will judge visual parity in the browser.
  await page.evaluate(()=>{
    window.__nativeTissueStepCount=0;
    window.__legacyTissueCalls=0;
    const A=window.AlgoArt;
    const native=A.oilMaterial,shortcut=A.collabTissue;
    A.oilMaterial=function(...args){
      window.__nativeTissueStepCount++;
      return native.apply(this,args);
    };
    A.collabTissue=function(...args){
      window.__legacyTissueCalls++;
      return shortcut.apply(this,args);
    };
  });
  // The submit handler closes the drawer. Only click Close when it is
  // actually open; Playwright must not wait on a hidden control.
  if((await page.locator('#inspector-toggle').getAttribute('aria-expanded'))==='true')
    await page.locator('#inspector-close').click();
  await page.locator('#step').click();
  await page.waitForFunction(()=>document.querySelector('#counter')?.textContent?.trim()==='1 / 5 turns',
    undefined,{timeout:20000});
  const stepCalls=await page.evaluate(()=>({
    native:window.__nativeTissueStepCount,shortcuts:window.__legacyTissueCalls
  }));
  assert(stepCalls.native>=4,'First Step did not draw full-sheet V7: '+JSON.stringify(stepCalls));
  assert.equal(stepCalls.shortcuts,0,
    'The old simplified tissue shortcut must never be used: '+JSON.stringify(stepCalls));
  console.log('actual tissue V7 first turn '+JSON.stringify(stepCalls));
  assert.deepEqual(errors,[],'Confluence material JavaScript errors: '+errors.join('; '));
  console.log('Confluence five-material browser smoke passed');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
