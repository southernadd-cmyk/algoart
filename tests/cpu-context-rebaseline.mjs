// CPU canvas backend versions: benchmark + controlled re-baseline harness.
//   Oil V3 -> Oil V4, Tissue V7 -> Tissue V8, Watercolour V2S -> Watercolour V2T
// Each new version runs the predecessor's drawing code on CPU-backed canvases.
// Records, per material x composition x orientation:
//   warm and cold-start timings for old and new versions (medians),
//   new reference hashes + dimensions, determinism, backend audit, and an
//   old-vs-new visual difference summary (changed pixel %, mean/max channel).
// Fails on: dimension change, nondeterministic NEW output, a non-CPU context
// inside a new-version render, willReadFrequently on the visible canvas,
// or NEW hashes that differ from tests/fixtures/cpu-context-reference.json.
// Old-version hashes are reported, never asserted: they depend on whether
// the browser GPU-accelerates canvases, which is the point of this change.
//
// Environment:
//   ALGOART_LOCAL_URL   site root (default http://127.0.0.1:4173/)
//   BROWSER_PROFILE     default | cpu | swiftshader | hardware
//   CHROMIUM_EXECUTABLE optional browser binary; CHROMIUM_ARGS extra args (space separated)
//   MATERIALS           comma list of oil,tissue,watercolour (default all)
//   MODES               comma list (default organic,network,burst,rects)
//   ORIENTATIONS        comma list (default landscape,portrait)
//   SCALE               render scale (default 1)
//   WARM_SAMPLES        timed warm renders per version (default 5)
//   COLD_SAMPLES        fresh-context first renders per version (default 3)
//   WRITE_FIXTURE=1     write/refresh the new-version reference fixture
//   SAVE_PNGS=1         also save old/new PNGs to the results directory
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const profileName=process.env.BROWSER_PROFILE||'default';
const PROFILES={
  default:{args:[],headless:true},
  cpu:{args:['--disable-gpu'],headless:true},
  swiftshader:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist'],headless:true},
  // For a local machine with a real GPU. Headed, so Chrome uses its normal GPU path.
  hardware:{args:['--ignore-gpu-blocklist'],headless:false}
};
const profile=PROFILES[profileName];
if(!profile)throw Error('Unknown BROWSER_PROFILE '+profileName);
const list=(name,fallback)=>(process.env[name]||fallback).split(',').map(x=>x.trim()).filter(Boolean);
const materials=list('MATERIALS','oil,tissue,watercolour');
const modes=list('MODES','organic,network,burst,rects');
const orientations=list('ORIENTATIONS','landscape,portrait');
const scale=Number(process.env.SCALE||1);
const warmSamples=Math.max(1,Number(process.env.WARM_SAMPLES||5));
const coldSamples=Math.max(1,Number(process.env.COLD_SAMPLES||3));
const writeFixture=process.env.WRITE_FIXTURE==='1';
const savePngs=process.env.SAVE_PNGS==='1';
const outDir='cpu-context-results';
const fixtureURL=new URL('./fixtures/cpu-context-reference.json',import.meta.url);
const VERSIONS={
  oil:{old:'oil-v3',new:'oil-v4'},
  tissue:{old:'tissue-7',new:'tissue-8'},
  watercolour:{old:'watercolour-v2s',new:'watercolour-v2t'}
};
let fixture=null;
try{fixture=JSON.parse(await readFile(fixtureURL,'utf8'))}catch{fixture=null}

const browser=await chromium.launch({headless:profile.headless,
  executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:[...profile.args,...(process.env.CHROMIUM_ARGS||'').split(' ').filter(Boolean)]});
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;
  return +(s.length%2?s[m]:(s[m-1]+s[m])/2).toFixed(1)};

// Everything below runs in the page.
function pageHelpers(){
  const A=window.AlgoArt;
  window.__cpuBench={
    renderers:{
      'oil-v3':(c,s,z)=>A.renderOilPaintV3(c,s,z,false),
      'oil-v4':(c,s,z)=>A.renderOilPaintV4(c,s,z,false),
      'tissue-7':(c,s,z)=>A.renderOil(c,s,z,false,7),
      'tissue-8':(c,s,z)=>A.renderTissueV8(c,s,z,false),
      'watercolour-v2s':(c,s,z)=>A.renderWatercolourV2S(c,s,z,false),
      'watercolour-v2t':(c,s,z)=>A.renderWatercolourV2T(c,s,z,false)
    },
    settings(mode,orientation){
      return {...A.readSettings(),seed:'MATERIAL-BENCH-'+mode+'-'+orientation,mode,orientation,
        palette:'golden',colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
    },
    canvases:{},
    render(version,mode,orientation,scale,keep){
      A.phiFramingEnabled=false;
      if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=false;
      const canvas=document.createElement('canvas');
      const settings=this.settings(mode,orientation);
      A.lastCPUCanvasRender=null;
      const start=performance.now();
      this.renderers[version](canvas,settings,scale);
      const ms=performance.now()-start;
      const ctx=canvas.getContext('2d');
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let hash=2166136261;
      for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
      if(keep)this.canvases[version]=pixels;
      const audit=A.lastCPUCanvasRender;
      return {ms:+ms.toFixed(1),hash:hash>>>0,width:canvas.width,height:canvas.height,
        visibleReadFrequently:A.canvasReadFrequently?A.canvasReadFrequently(ctx):null,
        cpuAudit:audit?{contexts:audit.contexts,nonCpu:audit.nonCpu,unknown:audit.unknown}:null};
    },
    difference(a,b){
      const x=this.canvases[a],y=this.canvases[b];
      if(!x||!y||x.length!==y.length)return null;
      let changed=0,sum=0,max=0;
      for(let i=0;i<x.length;i+=4){
        let differ=false;
        for(let c=0;c<4;c++){const d=Math.abs(x[i+c]-y[i+c]);sum+=d;if(d>max)max=d;if(d)differ=true}
        if(differ)changed++;
      }
      return {changedPct:+(100*changed/(x.length/4)).toFixed(4),
        meanAbsoluteChannelDifference:+(sum/x.length).toFixed(5),maxChannelDifference:max};
    },
    // Are plain 2D canvases GPU-accelerated here? Draw the same anti-aliased
    // shapes on a plain and a willReadFrequently canvas and compare pixels.
    backendProbe(){
      const draw=ctx=>{
        ctx.fillStyle='#fff';ctx.fillRect(0,0,512,512);
        for(let i=0;i<40;i++){
          ctx.beginPath();ctx.globalAlpha=.37;
          ctx.ellipse(256+Math.cos(i)*150,256+Math.sin(i*1.3)*150,63.3,21.7,i*.41,0,Math.PI*2);
          ctx.fillStyle='hsl('+(i*37%360)+',70%,45%)';ctx.fill();
        }
        return ctx.getImageData(0,0,512,512).data;
      };
      const plain=document.createElement('canvas'),cpu=document.createElement('canvas');
      plain.width=cpu.width=plain.height=cpu.height=512;
      const a=draw(plain.getContext('2d')),b=draw(cpu.getContext('2d',{willReadFrequently:true}));
      let differ=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])differ++;
      return {plainCanvasBackend:differ?'gpu (pixels differ from CPU canvas)':'same as CPU canvas',
        differingBytes:differ};
    }
  };
}
async function openPage(context){
  const page=await context.newPage({viewport:{width:1400,height:950}});
  page.setDefaultTimeout(600000);
  const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  // Marker on load: no material render happens before the timed render.
  await page.goto(root+'?v=9&seed=CPU-CONTEXT-BENCH&mode=organic&material=marker',
    {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlgoArt?.renderOilPaintV4&&
    window.AlgoArt?.renderTissueV8&&window.AlgoArt?.renderWatercolourV2T);
  await page.evaluate(pageHelpers);
  return {page,errors};
}
const rows=[];let probe=null;
try{
  {
    const context=await browser.newContext();const {page}=await openPage(context);
    probe={profile:profileName,browserVersion:browser.version(),
      userAgent:await page.evaluate(()=>navigator.userAgent),
      ...(await page.evaluate(()=>window.__cpuBench.backendProbe()))};
    await context.close();
    console.log('CPU_CONTEXT_PROBE '+JSON.stringify(probe));
  }
  for(const material of materials){
    const {old:oldVersion,new:newVersion}=VERSIONS[material];
    for(const orientation of orientations)for(const mode of modes){
      const key=[material,mode,orientation,scale].join('|');
      const cold={[oldVersion]:[],[newVersion]:[]},hashes={[oldVersion]:new Set(),[newVersion]:new Set()};
      const audits=[];let dims={};
      // Cold: first material render in a brand-new browser context (new renderer process).
      for(let i=0;i<coldSamples;i++){
        for(const version of i%2?[newVersion,oldVersion]:[oldVersion,newVersion]){
          const context=await browser.newContext();
          const {page,errors}=await openPage(context);
          const r=await page.evaluate(([v,m,o,z])=>window.__cpuBench.render(v,m,o,z,false),
            [version,mode,orientation,scale]);
          await context.close();
          assert.deepEqual(errors,[],'Browser errors: '+key);
          cold[version].push(r.ms);hashes[version].add(r.hash);
          dims[version]=[r.width,r.height];
          if(version===newVersion)audits.push(r);
        }
      }
      // Warm: one page, one warm-up each, then alternating timed samples.
      const warm={[oldVersion]:[],[newVersion]:[]};
      const context=await browser.newContext();
      const {page,errors}=await openPage(context);
      for(const version of [oldVersion,newVersion])
        await page.evaluate(([v,m,o,z])=>window.__cpuBench.render(v,m,o,z,true),
          [version,mode,orientation,scale]);
      for(let i=0;i<warmSamples;i++){
        for(const version of i%2?[newVersion,oldVersion]:[oldVersion,newVersion]){
          const r=await page.evaluate(([v,m,o,z])=>window.__cpuBench.render(v,m,o,z,false),
            [version,mode,orientation,scale]);
          warm[version].push(r.ms);hashes[version].add(r.hash);
          if(version===newVersion)audits.push(r);
        }
      }
      const difference=await page.evaluate(([a,b])=>window.__cpuBench.difference(a,b),
        [oldVersion,newVersion]);
      if(savePngs){
        await mkdir(outDir,{recursive:true});
        for(const version of [oldVersion,newVersion]){
          const data=await page.evaluate(([v,m,o,z])=>{
            const B=window.__cpuBench,c=document.createElement('canvas');
            B.renderers[v](c,B.settings(m,o),z);return c.toDataURL('image/png');
          },[version,mode,orientation,scale]);
          await writeFile(`${outDir}/${material}-${mode}-${orientation}-${version}.png`,
            Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
        }
      }
      await context.close();
      assert.deepEqual(errors,[],'Browser errors: '+key);
      const newHashes=[...hashes[newVersion]],oldHashes=[...hashes[oldVersion]];
      const row={material,mode,orientation,scale,oldVersion,newVersion,
        width:dims[newVersion][0],height:dims[newVersion][1],
        newHash:newHashes[0],newDeterministic:newHashes.length===1,
        oldHashes,oldDeterministic:oldHashes.length===1,
        identicalToPrevious:newHashes.length===1&&oldHashes.length===1&&newHashes[0]===oldHashes[0],
        warmMs:{old:median(warm[oldVersion]),new:median(warm[newVersion])},
        coldMs:{old:median(cold[oldVersion]),new:median(cold[newVersion])},
        warmMinMs:{old:Math.min(...warm[oldVersion]),new:Math.min(...warm[newVersion])},
        warmSpeedup:+(median(warm[oldVersion])/median(warm[newVersion])).toFixed(2),
        coldSpeedup:+(median(cold[oldVersion])/median(cold[newVersion])).toFixed(2),
        samples:{warm,cold},difference,
        cpuAudit:audits.map(a=>a.cpuAudit),
        visibleReadFrequently:[...new Set(audits.map(a=>a.visibleReadFrequently))]};
      rows.push(row);
      console.log('CPU_CONTEXT_ROW '+JSON.stringify({...row,samples:undefined,cpuAudit:undefined}));
      assert.deepEqual(dims[newVersion],dims[oldVersion],'Dimensions changed: '+key);
      assert(row.newDeterministic,'New version output is not deterministic: '+key+' '+newHashes);
      assert(audits.every(a=>a.cpuAudit&&a.cpuAudit.nonCpu===0),'Non-CPU context inside new render: '+key);
      assert(audits.every(a=>a.visibleReadFrequently!==true),'Visible canvas got willReadFrequently: '+key);
    }
  }
}finally{await browser.close()}

// Fixture: new-version references are expected to be backend-independent.
const references=Object.fromEntries(rows.map(r=>[[r.material,r.mode,r.orientation,r.scale].join('|'),
  {version:r.newVersion,hash:r.newHash,width:r.width,height:r.height}]));
const mismatches=[];
if(fixture&&!writeFixture){
  for(const [key,ref] of Object.entries(references)){
    const frozen=fixture.references[key];
    if(frozen&&(frozen.hash!==ref.hash||frozen.width!==ref.width||frozen.height!==ref.height))
      mismatches.push({key,frozen,observed:ref});
  }
}
await mkdir(outDir,{recursive:true});
if(writeFixture){
  const next={note:'New-version (CPU canvas backend) reference hashes. FNV-1a over RGBA. '+
    'Generated by tests/cpu-context-rebaseline.mjs with WRITE_FIXTURE=1.',
    generated:new Date().toISOString(),probe,
    references:{...(fixture?.references||{}),...references}};
  await writeFile(fixtureURL,JSON.stringify(next,null,2)+'\n');
  await writeFile(`${outDir}/cpu-context-reference.json`,JSON.stringify(next,null,2)+'\n');
}
const fmt=x=>x==null?'–':String(x);
const lines=[`# CPU canvas backend benchmark (${profileName})`,'',
  `Browser ${probe.browserVersion}; plain canvases: ${probe.plainCanvasBackend}. Scale ${scale}; `+
  `${warmSamples} warm and ${coldSamples} cold samples per version (medians).`,'',
  '| Material | Composition | Orientation | Warm old→new (ms) | Warm × | Cold old→new (ms) | Cold × | Same pixels as previous | Changed px % | Mean abs | Max | New hash |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for(const r of rows)lines.push(`| ${r.material} | ${r.mode} | ${r.orientation} | ${r.warmMs.old} → ${r.warmMs.new} | ${r.warmSpeedup} | `+
  `${r.coldMs.old} → ${r.coldMs.new} | ${r.coldSpeedup} | ${r.identicalToPrevious?'yes':'no'} | `+
  `${fmt(r.difference?.changedPct)} | ${fmt(r.difference?.meanAbsoluteChannelDifference)} | `+
  `${fmt(r.difference?.maxChannelDifference)} | ${r.newHash} |`);
if(mismatches.length)lines.push('','**Fixture mismatches:** '+mismatches.map(m=>m.key).join(', '));
await writeFile(`${outDir}/summary.md`,lines.join('\n')+'\n');
await writeFile(`${outDir}/results.json`,JSON.stringify({probe,rows,mismatches},null,2));
console.log(lines.join('\n'));
assert.deepEqual(mismatches,[],'New-version hashes differ from the frozen CPU reference fixture');
