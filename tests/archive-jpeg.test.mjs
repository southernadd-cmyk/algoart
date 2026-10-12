import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {ARTWORK_JPEG_QUALITY} from '../automation/config.mjs';

// The real five-work edition that failed before publishing on 12 October.
// Generate in isolation: never add a test edition to the public gallery.
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'algoart-jpeg-regression-'));
const day='2026-10-12';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const env={...process.env,GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:'',
  ALGOART_LOCAL_URL:base,SOCIAL_DATE:day,SOCIAL_ORIENTATION:'portrait',
  SOCIAL_RENDERER_VERSION:'7',SOCIAL_COUNT:'5',SOCIAL_SEED_SALT:'',SOCIAL_FORCE_MODE:'',
  SOCIAL_OUTPUT_DIR:path.join(temp,'social'),ARCHIVE_BROWSER:'chromium',
  ARCHIVE_REPORT_DIR:path.join(temp,'report')};
function run(file,args=[]){
  return spawnSync(process.execPath,[file,...args],{env,encoding:'utf8',timeout:120000});
}
let browser;
try{
  let result=run('automation/generate-social.mjs');
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  const queuePath=path.join(env.SOCIAL_OUTPUT_DIR,day,'portrait','queue.json');
  const queue=JSON.parse(await fs.readFile(queuePath,'utf8'));
  assert.equal(queue.entries.length,5);
  const item=queue.entries[2];
  assert.equal(item.seed,'AP-20261012-03-97370');
  assert.equal(item.mode,'rects');
  result=run('tests/archive-reproduction.mjs',['--queue',queuePath]);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  let report=JSON.parse(await fs.readFile(path.join(env.ARCHIVE_REPORT_DIR,'chromium','report.json'),'utf8'));
  assert.equal(report.failures,0,'The five unchanged JPEG exports must all pass');
  assert.equal(report.entries.length,5);
  assert.ok(report.entries.every(e=>e.metrics.mean===0&&e.metrics.changed===0),
    'The same Chromium export must reproduce exactly');

  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1200}});
  const url=new URL(base);url.search=new URL(item.shareUrl).search;
  await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.AlgoArt?.lastRenderMeta);
  const bytes=await fs.readFile(path.join(path.dirname(queuePath),item.imageFile));
  const rawMean=await page.evaluate(async ({data,quality})=>{
    const art=document.getElementById('art'),img=new Image();
    img.src='data:image/jpeg;base64,'+data;await img.decode();
    const small=source=>{
      const c=document.createElement('canvas');c.width=250;c.height=350;
      c.getContext('2d').drawImage(source,0,0,250,350);
      return c.getContext('2d').getImageData(0,0,250,350).data;
    };
    const a=small(img),b=small(art);let error=0;
    for(let i=0;i<a.length;i+=4)error+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
    // The archive and browser export are identical; only the raw comparison fails.
    if(art.toDataURL('image/jpeg',quality).split(',')[1]!==data)throw Error('Fixture no longer reproduces exactly');
    return error/(250*350);
  },{data:bytes.toString('base64'),quality:ARTWORK_JPEG_QUALITY});
  assert.ok(rawMean>report.limits.mean,'Fixture must demonstrate the old compression false positive');
  await browser.close();browser=null;

  // The format correction must still reject a different composition.
  const wrongSeed='WRONG-PORTRAIT-REGRESSION-SEED';
  const wrongUrl=new URL(item.shareUrl);wrongUrl.searchParams.set('seed',wrongSeed);
  item.seed=wrongSeed;item.settings.seed=wrongSeed;item.shareUrl=wrongUrl.href;
  await fs.writeFile(queuePath,JSON.stringify(queue));
  result=run('tests/archive-reproduction.mjs',['--queue',queuePath]);
  assert.equal(result.status,1,'Changed portrait geometry must fail verification');
  report=JSON.parse(await fs.readFile(path.join(env.ARCHIVE_REPORT_DIR,'chromium','report.json'),'utf8'));
  assert.equal(report.failures,1);
  assert.equal(report.entries[2].error,'Pixel comparison failed');
  console.log('PASS: all five 2026-10-12 portraits match exactly; raw/JPEG false-positive mean '+rawMean.toFixed(3)+'; changed seed is rejected.');
}finally{
  if(browser)await browser.close();
  await fs.rm(temp,{recursive:true,force:true});
}
