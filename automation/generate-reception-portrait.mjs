// An original, deterministic portrait Recursive Divisions artwork rendered
// through the actual PROPORTION PIECE editor, not a rotated landscape image.
// Writes a matched PNG and canonical editor link to test-only asset locations.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const seed='PP-RECEPTION-RECTS-P-20261110';
const filename='recursive-divisions-portrait.png';
const stage=resolve('gallery/sculpture-v2-test/reception');
const dest=resolve(process.env.V2_RECEPTION_OUT||'artifacts/sculpture-v2-reception');
const original=JSON.parse(await readFile('gallery/visit/data/reception-growth-systems.json','utf8'));
const desired=new URL(original.href);
assert.equal(desired.searchParams.get('mode'),'rects');
desired.searchParams.set('seed',seed);
desired.searchParams.set('fmt','portrait');
// Retain the actual historic Recursive Divisions engine vocabulary and
// painting sliders, but give this new permanent exhibit its own composition.
assert.equal(desired.searchParams.get('material'),'oil-v6');
await mkdir(stage,{recursive:true});await mkdir(dest,{recursive:true});
const browser=await chromium.launch({
  headless:true,args:['--disable-dev-shm-usage','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
let result;
try{
  const page=await browser.newPage({viewport:{width:1300,height:980},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const local=new URL('http://127.0.0.1:4173/');
  local.search=desired.search;
  await page.goto(local.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(expected=>{
    const art=document.querySelector('#art');
    const overlay=document.querySelector('#creatingOverlay');
    return art?.width===1000&&art?.height===1400&&
      document.querySelector('#seed')?.value===expected&&
      document.querySelector('#orientation')?.value==='portrait'&&
      window.AlgoArt?.renderTimings?.fullMs>0&&
      (!overlay||overlay.hidden)&&
      document.querySelector('#statsText')?.textContent.includes('Recursive Divisions');
  },seed,{timeout:120000});
  assert.deepEqual(errors,[],'Editor produced browser errors');
  result=await page.evaluate(()=>{
    const art=document.querySelector('#art');
    const data=art.getContext('2d',{willReadFrequently:true})
      .getImageData(0,0,art.width,art.height).data;
    let changed=0;
    for(let y=0;y<art.height;y+=12)for(let x=0;x<art.width;x+=12){
      const k=(y*art.width+x)*4;
      const delta=Math.abs(data[k]-245)+Math.abs(data[k+1]-240)+
        Math.abs(data[k+2]-230);
      if(delta>38)changed++;
    }
    return {
      dataUrl:art.toDataURL('image/png'),width:art.width,height:art.height,
      seed:document.querySelector('#seed').value,
      orientation:document.querySelector('#orientation').value,
      mode:document.querySelector('#mode').value,
      material:document.querySelector('#materialStyle').value,
      sampledInk:changed,editorUrl:location.href,
      rendererVersion:window.AlgoArt?.rendererVersion
    };
  });
}finally{await browser.close();}
assert.equal(result.width,1000);
assert.equal(result.height,1400);
assert.equal(result.orientation,'portrait');
assert.equal(result.mode,'rects');
assert.equal(result.material,'oil');
assert.equal(result.seed,seed);
assert.ok(result.sampledInk>130,
  'Generated portrait lacks enough visible Recursive Divisions pigment');
const png=Buffer.from(result.dataUrl.split(',')[1],'base64');
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16),1000);
assert.equal(png.readUInt32BE(20),1400);
const sha=createHash('sha256').update(png).digest('hex');
const href=new URL('https://southernadd-cmyk.github.io/algoart/');
href.search=new URL(result.editorUrl).search;
assert.equal(href.searchParams.get('seed'),seed);
assert.equal(href.searchParams.get('fmt'),'portrait');
assert.equal(href.searchParams.get('mode'),'rects');
assert.equal(href.searchParams.get('material'),'oil-v6');
const source={
  schema:'pp-v2-reception-portrait-source',version:1,
  title:'Recursive Divisions',seed,engine:'rects',
  width:1000,height:1400,orientation:'portrait',
  material:'oil',imageFile:filename,sourceSha256:sha,
  href:href.href,sampledInk:result.sampledInk,
  rendererVersion:result.rendererVersion
};
await writeFile(join(stage,filename),png);
await writeFile(join(dest,filename),png);
for(const location of [stage,dest])
  await writeFile(join(location,'source.json'),JSON.stringify(source,null,2));
console.log('V2_RECEPTION_PORTRAIT_SOURCE '+JSON.stringify({
  sourceSha256:sha,width:source.width,height:source.height,
  ink:source.sampledInk,seed,href:source.href,bytes:png.length
}));
