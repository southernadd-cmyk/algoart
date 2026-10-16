// Run on the performance branch with a local server on port 4173.
// Compare the checked-in renderer against the pinned main revision using
// full-resolution RGBA buffers (not lossy JPEG or human judgement).
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const base=process.env.MATERIAL_BASE_SHA||'11210e392fe1c45c6a130accba832fe7c404e736';
const original=execFileSync('git',['show',base+':js/watercolour-v2s.js'],{encoding:'utf8',maxBuffer:4*1024*1024});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  page.setDefaultTimeout(180000);
  await page.goto(root+'?v=9&seed=PERF-REFERENCE-001&mode=organic&material=watercolour-v2s',
    {waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>typeof window.AlgoArt?.renderWatercolourV2S==='function');
  const candidates=[
    {seed:'PERF-REFERENCE-001',mode:'organic',orientation:'landscape'},
    {seed:'PERF-REFERENCE-002',mode:'rects',orientation:'portrait'},
    {seed:'PERF-REFERENCE-003',mode:'network',orientation:'landscape'}
  ];
  // Snapshot production function before loading the original source:
  const results=await page.evaluate(async ({original,candidates})=>{
    const A=window.AlgoArt,optimised=A.renderWatercolourV2S;
    const raw=(c)=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
    const render=(fn,s)=>{
      const canvas=document.createElement('canvas'),start=performance.now();
      fn(canvas,s,.42,false);
      return {rgba:raw(canvas),width:canvas.width,height:canvas.height,ms:performance.now()-start};
    };
    const baseSettings=A.readSettings();
    const output=[];
    // Load historical function into the same browser context so the JS engine,
    // host machine, device pixel ratio and source generator are identical.
    (0,eval)(original);
    const historical=A.renderWatercolourV2S;
    for(const test of candidates){
      const settings={...baseSettings,...test};
      const before=render(historical,settings);
      const after=render(optimised,settings);
      let differences=0;
      if(before.width!==after.width||before.height!==after.height)differences=-1;
      else for(let i=0;i<before.rgba.length;i++)if(before.rgba[i]!==after.rgba[i])differences++;
      output.push({seed:test.seed,mode:test.mode,orientation:test.orientation,
        pixels:before.width*before.height,differences,
        baselineMs:before.ms,optimisedMs:after.ms});
    }
    A.renderWatercolourV2S=optimised;
    return output;
  },{original,candidates});
  for(const item of results)assert.equal(item.differences,0,
    'Watercolour pixels changed for '+item.seed);
  console.log('PASS watercolour exact RGBA baseline parity',JSON.stringify(results,null,2));
} finally {await browser.close();}
