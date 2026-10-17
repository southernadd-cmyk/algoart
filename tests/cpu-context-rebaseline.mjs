// CPU canvas backend versions: benchmark + re-baseline release gate.
//   Oil V3 -> Oil V4, Tissue V7 -> Tissue V8, Watercolour V2S -> Watercolour V2T
// Each new version runs its predecessor's drawing code on CPU-backed canvases.
//
// Per material x composition x orientation it records old/new timings
// (warm, and cold at three levels: fresh page, fresh browser context, fresh
// browser process), new reference hashes and dimensions, an old-vs-new
// visual difference, Reveal renders and PNG exports.
//
// FAILS (release gate) on:
//   - missing reference fixture or a missing/mismatched NEW hash in it
//     (unless WRITE_FIXTURE=1); with REQUIRE_FULL_MATRIX=1 also on any
//     filtered run or incomplete fixture coverage for the materials run
//   - changed dimensions; nondeterministic NEW output (cold, warm, Reveal
//     page, export page); non-opaque NEW output
//   - contamination: the OLD version's sequence of hashes in a page that
//     alternates old/new (V3 -> V4 -> V3 ...) differing from the same
//     sequence in a page that renders only the old version
//   - a non-CPU context inside a new render; willReadFrequently on the
//     visible canvas
//   - NEW PNG export differing from the NEW on-screen render (user order:
//     screen render, then Save, in one page)
//   - when this browser's plain canvases are CPU-backed: NEW render, Reveal
//     or export differing from the OLD version's first render in a fresh
//     page (an independent check of the fixture)
// Reported, not failed: whether the OLD version is itself history-dependent
// within a page, and whether the OLD version's export matches its screen.
//
// Environment:
//   ALGOART_LOCAL_URL   site root (default http://127.0.0.1:4173/)
//   BROWSER_PROFILE     default | cpu | swiftshader | hardware
//   CHROMIUM_EXECUTABLE optional browser binary; CHROMIUM_ARGS extra args
//   MATERIALS           oil,tissue,watercolour (default all)
//   MODES               default all eight composition engines
//   ORIENTATIONS        default landscape,portrait
//   SCALE               benchmark render scale (default 1). Exports always 1.
//   WARM_SAMPLES        alternating warm renders per version (default 5)
//   COLD_SAMPLES        samples per cold level and version (default 3)
//   COLD_LEVELS         page,context,browser (default all three)
//   WRITE_FIXTURE=1     write the new-version references for this run
//   REQUIRE_FULL_MATRIX=1  release-gate mode (see above)
//   SAVE_PNGS=1         save old/new PNGs to the results directory
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
  hardware:{args:['--ignore-gpu-blocklist'],headless:false} // a local machine with a real GPU
};
const profile=PROFILES[profileName];
if(!profile)throw Error('Unknown BROWSER_PROFILE '+profileName);
const ALL_MODES=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const ALL_ORIENTATIONS=['landscape','portrait'];
const list=(name,fallback)=>(process.env[name]||fallback.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
const materials=list('MATERIALS',['oil','tissue','watercolour']);
const modes=list('MODES',ALL_MODES);
const orientations=list('ORIENTATIONS',ALL_ORIENTATIONS);
const coldLevels=list('COLD_LEVELS',['page','context','browser']);
const scale=Number(process.env.SCALE||1);
const warmSamples=Math.max(1,Number(process.env.WARM_SAMPLES||5));
const coldSamples=Math.max(1,Number(process.env.COLD_SAMPLES||3));
const writeFixture=process.env.WRITE_FIXTURE==='1';
const requireFull=process.env.REQUIRE_FULL_MATRIX==='1';
const savePngs=process.env.SAVE_PNGS==='1';
const outDir='cpu-context-results';
const fixtureURL=new URL('./fixtures/cpu-context-reference.json',import.meta.url);
const VERSIONS={
  oil:{old:'oil-v3',new:'oil-v4'},
  tissue:{old:'tissue-7',new:'tissue-8'},
  watercolour:{old:'watercolour-v2s',new:'watercolour-v2t'}
};
const refKey=(material,mode,orientation,s)=>[material,mode,orientation,s].join('|');
const fullMatrix=modes.length===ALL_MODES.length&&ALL_MODES.every(m=>modes.includes(m))&&
  orientations.length===2&&scale===1;
if(requireFull&&!fullMatrix)
  throw Error('REQUIRE_FULL_MATRIX=1 needs all eight modes, both orientations and SCALE=1');
let fixture=null;
try{fixture=JSON.parse(await readFile(fixtureURL,'utf8'))}catch{fixture=null}
if(!writeFixture&&!fixture)
  throw Error('Missing tests/fixtures/cpu-context-reference.json. Generate it with WRITE_FIXTURE=1 '+
    '(CI: run the workflow with write_fixture), review it, and commit it.');

const launch=()=>chromium.launch({headless:profile.headless,
  executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:[...profile.args,...(process.env.CHROMIUM_ARGS||'').split(' ').filter(Boolean)]});
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;
  return +(s.length%2?s[m]:(s[m-1]+s[m])/2).toFixed(1)};

// Installed in each page.
function pageHelpers(){
  const A=window.AlgoArt;
  const fnv=pixels=>{let h=2166136261;for(let i=0;i<pixels.length;i++)h=Math.imul(h^pixels[i],16777619);return h>>>0};
  window.__cpuBench={
    renderers:{
      'oil-v3':(c,s,z,r)=>A.renderOilPaintV3(c,s,z,r),
      'oil-v4':(c,s,z,r)=>A.renderOilPaintV4(c,s,z,r),
      'tissue-7':(c,s,z,r)=>A.renderOil(c,s,z,r,7),
      'tissue-8':(c,s,z,r)=>A.renderTissueV8(c,s,z,r),
      'watercolour-v2s':(c,s,z,r)=>A.renderWatercolourV2S(c,s,z,r),
      'watercolour-v2t':(c,s,z,r)=>A.renderWatercolourV2T(c,s,z,r)
    },
    // Same settings the app's export path receives for each version.
    exportFlags:{
      'oil-v3':{oilPaintRender:true,oilPaintRevision:'v3'},
      'oil-v4':{oilPaintRender:true,oilPaintRevision:'v4'},
      'tissue-7':{oilRender:true,tissuePaletteVersion:7},
      'tissue-8':{oilRender:true,tissuePaletteVersion:8},
      'watercolour-v2s':{watercolourRender:true,watercolourRevision:'v2s',watercolourFitToSheet:false},
      'watercolour-v2t':{watercolourRender:true,watercolourRevision:'v2t',watercolourFitToSheet:false}
    },
    settings(mode,orientation){
      return {...A.readSettings(),seed:'MATERIAL-BENCH-'+mode+'-'+orientation,mode,orientation,
        palette:'golden',colourCount:7,elements:45,density:63,complexity:59,negativeSpace:47};
    },
    reset(){
      A.phiFramingEnabled=false;
      if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=false;
      A.lastCPUCanvasRender=null;
    },
    canvases:{},
    render(version,mode,orientation,scale,options={}){
      this.reset();
      const canvas=document.createElement('canvas');
      const start=performance.now();
      this.renderers[version](canvas,this.settings(mode,orientation),scale,options.reveal===true);
      const ms=performance.now()-start;
      const ctx=canvas.getContext('2d');
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let translucent=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)translucent++;
      if(options.keep)this.canvases[options.keep]=pixels;
      const audit=A.lastCPUCanvasRender;
      return {ms:+ms.toFixed(1),hash:fnv(pixels),width:canvas.width,height:canvas.height,translucent,
        visibleReadFrequently:A.canvasReadFrequently(ctx),
        cpuAudit:audit?{contexts:audit.contexts,nonCpu:audit.nonCpu,unknown:audit.unknown}:null};
    },
    async exportPNG(version,mode,orientation,keep){
      this.reset();
      const file=await A.preparePNG({...this.settings(mode,orientation),...this.exportFlags[version]},1);
      const bitmap=await createImageBitmap(file.blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});
      const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
      const pixels=ctx.getImageData(0,0,c.width,c.height).data;
      if(keep)this.canvases[keep]=pixels;
      return {hash:fnv(pixels),width:c.width,height:c.height,filename:file.filename};
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
    png(version,mode,orientation,scale){
      const c=document.createElement('canvas');this.reset();
      this.renderers[version](c,this.settings(mode,orientation),scale,false);
      return c.toDataURL('image/png');
    },
    // Are plain 2D canvases GPU-backed here? Same anti-aliased drawing on a
    // plain and a willReadFrequently canvas; differing pixels mean GPU.
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
      return {plainCanvasesCpu:differ===0,differingBytes:differ};
    }
  };
}
async function openPage(context){
  const page=await context.newPage({viewport:{width:1400,height:950}});
  page.setDefaultTimeout(900000);
  const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  // Marker on load: no material render happens before the timed render.
  await page.goto(root+'?v=9&seed=CPU-CONTEXT-BENCH&mode=organic&material=marker',
    {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlgoArt?.renderOilPaintV4&&
    window.AlgoArt?.renderTissueV8&&window.AlgoArt?.renderWatercolourV2T&&window.AlgoArt?.preparePNG);
  await page.evaluate(pageHelpers);
  return {page,errors};
}
const call=(page,fn,...args)=>page.evaluate(([fn,args])=>window.__cpuBench[fn](...args),[fn,args]);

let browser=await launch();
const rows=[];let probe=null;
try{
  {
    const context=await browser.newContext();const {page}=await openPage(context);
    probe={profile:profileName,browserVersion:browser.version(),
      userAgent:await page.evaluate(()=>navigator.userAgent),...(await call(page,'backendProbe'))};
    await context.close();
    console.log('CPU_CONTEXT_PROBE '+JSON.stringify(probe));
  }
  // One long-lived page for fresh-page samples (same browser context/process).
  const pageContext=await browser.newContext();
  for(const material of materials){
    const {old:oldV,new:newV}=VERSIONS[material];
    for(const orientation of orientations)for(const mode of modes){
      const key=refKey(material,mode,orientation,scale);
      const errorsSeen=[];
      const freshOldHashes=new Set(),newHashes=new Set();
      const audits=[];const dims={};
      const cold={};for(const level of coldLevels)cold[level]={[oldV]:[],[newV]:[]};
      const noteNew=r=>{newHashes.add(r.hash);audits.push(r)};
      const freshPage=async()=>openPage(await browser.newContext());
      const closePage=async({page,errors})=>{errorsSeen.push(...errors);await page.context().close()};
      // Cold renders: the first material render in a fresh page / context / process.
      for(const level of coldLevels){
        for(let i=0;i<coldSamples;i++){
          for(const version of i%2?[newV,oldV]:[oldV,newV]){
            let context,ownBrowser=null;
            if(level==='browser'){ownBrowser=await launch();context=await ownBrowser.newContext()}
            else if(level==='context')context=await browser.newContext();
            else context=pageContext;
            const {page,errors}=await openPage(context);
            const r=await call(page,'render',version,mode,orientation,scale,{});
            if(level==='page')await page.close();else await context.close();
            if(ownBrowser)await ownBrowser.close();
            errorsSeen.push(...errors);
            cold[level][version].push(r.ms);dims[version]=[r.width,r.height];
            if(version===oldV)freshOldHashes.add(r.hash);else noteNew(r);
          }
        }
      }
      // Control: the old version alone, repeatedly, in one page.
      const sequenceLength=Math.min(3,1+warmSamples);
      const control=await freshPage(),controlSequence=[];
      for(let i=0;i<sequenceLength;i++)
        controlSequence.push((await call(control.page,'render',oldV,mode,orientation,scale,{})).hash);
      await closePage(control);
      // Warm + switching: one page alternates old/new (V3 -> V4 -> V3 ...).
      const warm={[oldV]:[],[newV]:[]},alternatingSequence=[];
      const alt=await freshPage();
      for(const version of [oldV,newV]){
        const r=await call(alt.page,'render',version,mode,orientation,scale,{keep:version});
        if(version===oldV)alternatingSequence.push(r.hash);else noteNew(r);
      }
      for(let i=0;i<warmSamples;i++){
        for(const version of i%2?[newV,oldV]:[oldV,newV]){
          const r=await call(alt.page,'render',version,mode,orientation,scale,{});
          warm[version].push(r.ms);
          if(version===oldV)alternatingSequence.push(r.hash);else noteNew(r);
        }
      }
      await closePage(alt);
      // Old-vs-new difference: old's first render in a fresh page, then new
      // in the same page (new renders are unaffected by old-version state,
      // which the contamination check above and the determinism check prove).
      const firstOld=await freshPage();
      await call(firstOld.page,'render',oldV,mode,orientation,scale,{keep:'first-old'});
      noteNew(await call(firstOld.page,'render',newV,mode,orientation,scale,{keep:'new'}));
      const diff=await call(firstOld.page,'difference','first-old','new');
      await closePage(firstOld);
      // Reveal: each version's first render in its own fresh page.
      const reveal={};
      for(const version of [oldV,newV]){
        const p=await freshPage();
        const r=await call(p.page,'render',version,mode,orientation,scale,{reveal:true});
        reveal[version]=r.hash;if(version===newV)audits.push(r);
        await closePage(p);
      }
      // PNG export in user order: fresh page, on-screen 1x render, then Save.
      const exports={};
      for(const version of [oldV,newV]){
        const p=await freshPage();
        const screen=await call(p.page,'render',version,mode,orientation,1,{});
        const exported=await call(p.page,'exportPNG',version,mode,orientation);
        await closePage(p);
        exports[version]={screenHash:screen.hash,exportHash:exported.hash,
          matches:screen.hash===exported.hash&&screen.width===exported.width&&screen.height===exported.height,
          filename:exported.filename};
        if(version===newV&&scale===1){newHashes.add(screen.hash);newHashes.add(exported.hash)}
        if(version===newV)audits.push(screen);
      }
      if(savePngs){
        await mkdir(outDir,{recursive:true});
        const p=await freshPage();
        for(const version of [oldV,newV]){
          const data=await call(p.page,'png',version,mode,orientation,scale);
          await writeFile(`${outDir}/${material}-${mode}-${orientation}-${version}.png`,
            Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
        }
        await closePage(p);
      }
      const newList=[...newHashes],freshOld=[...freshOldHashes];
      const coldMs={},coldSpeedup={};
      for(const level of coldLevels){
        coldMs[level]={old:median(cold[level][oldV]),new:median(cold[level][newV])};
        coldSpeedup[level]=+(coldMs[level].old/coldMs[level].new).toFixed(2);
      }
      const oldHistoryDependent=new Set(controlSequence).size>1;
      const row={material,mode,orientation,scale,oldVersion:oldV,newVersion:newV,
        width:dims[newV][0],height:dims[newV][1],newHash:newList[0],newHashes:newList,
        oldFirstRenderHashes:freshOld,
        matchesPreviousFirstRender:newList.length===1&&freshOld.length===1&&newList[0]===freshOld[0],
        oldControlSequence:controlSequence,
        oldAlternatingSequence:alternatingSequence.slice(0,sequenceLength),
        noContamination:controlSequence.every((h,i)=>alternatingSequence[i]===h),
        oldHistoryDependent,
        warmMs:{old:median(warm[oldV]),new:median(warm[newV])},
        warmMinMs:{old:Math.min(...warm[oldV]),new:Math.min(...warm[newV])},
        warmSpeedup:+(median(warm[oldV])/median(warm[newV])).toFixed(2),
        coldMs,coldSpeedup,samples:{warm,cold},difference:diff,
        reveal,exports,
        newTranslucentPixels:Math.max(...audits.map(a=>a.translucent)),
        cpuAudit:audits.map(a=>a.cpuAudit),
        visibleReadFrequently:[...new Set(audits.map(a=>a.visibleReadFrequently))]};
      rows.push(row);
      console.log('CPU_CONTEXT_ROW '+JSON.stringify({...row,samples:undefined,cpuAudit:undefined}));
      assert.deepEqual(errorsSeen,[],'Browser errors: '+key);
      assert.deepEqual(dims[newV],dims[oldV],'Dimensions changed: '+key);
      assert.equal(newList.length,1,'New version output is not deterministic: '+key+' '+newList);
      assert.equal(row.newTranslucentPixels,0,'New version output has non-opaque pixels: '+key);
      assert(row.noContamination,'Old version pixels changed when alternating with the new version: '+
        key+' control='+controlSequence+' alternating='+row.oldAlternatingSequence);
      assert(audits.every(a=>a.cpuAudit&&a.cpuAudit.nonCpu===0&&a.cpuAudit.contexts>0),
        'Non-CPU context inside new render: '+key);
      assert(audits.every(a=>a.visibleReadFrequently===false),'Visible canvas got willReadFrequently: '+key);
      assert(exports[newV].matches,'New version PNG export differs from its on-screen render: '+key);
      if(probe.plainCanvasesCpu){
        assert(row.matchesPreviousFirstRender,'CPU browser: new version differs from previous: '+key);
        assert.equal(reveal[oldV],reveal[newV],'CPU browser: Reveal differs: '+key);
        assert.equal(exports[newV].exportHash,exports[oldV].screenHash,
          'CPU browser: new export differs from previous on-screen render: '+key);
      }
    }
  }
  await pageContext.close();
}finally{await browser.close()}

// Reference fixture: one hash per new version and case.
const references=Object.fromEntries(rows.map(r=>[refKey(r.material,r.mode,r.orientation,r.scale),
  {version:r.newVersion,hash:r.newHash,width:r.width,height:r.height}]));
const problems=[];
if(!writeFixture){
  for(const [key,ref] of Object.entries(references)){
    const frozen=fixture.references?.[key];
    if(!frozen)problems.push({key,problem:'missing from fixture'});
    else if(frozen.hash!==ref.hash||frozen.width!==ref.width||frozen.height!==ref.height)
      problems.push({key,problem:'mismatch',frozen,observed:ref});
  }
  if(requireFull){
    for(const material of materials)for(const orientation of ALL_ORIENTATIONS)for(const mode of ALL_MODES){
      const key=refKey(material,mode,orientation,1);
      if(!fixture.references?.[key])problems.push({key,problem:'fixture coverage incomplete'});
    }
  }
}
await mkdir(outDir,{recursive:true});
if(writeFixture){
  const fragment={note:'New-version (CPU canvas backend) reference hashes, FNV-1a over RGBA. '+
    'Written by tests/cpu-context-rebaseline.mjs with WRITE_FIXTURE=1.',
    generated:new Date().toISOString(),probe,references};
  await writeFile(`${outDir}/cpu-context-reference.fragment.json`,JSON.stringify(fragment,null,2)+'\n');
  const merged={...fragment,references:{...(fixture?.references||{}),...references}};
  await writeFile(fixtureURL,JSON.stringify(merged,null,2)+'\n');
}
const fmt=x=>x==null?'–':String(x);
const lines=[`# CPU canvas backend benchmark (${profileName})`,'',
  `Browser ${probe.browserVersion}; plain canvases ${probe.plainCanvasesCpu?'are CPU-backed':'are GPU-backed'}. `+
  `Scale ${scale}; ${warmSamples} warm and ${coldSamples} cold samples per level and version (medians). `+
  `Matrix: ${materials.join(', ')} × ${modes.length} modes × ${orientations.length} orientations`+
  `${fullMatrix?' (full)':' (partial)'}.`,'',
  '| Material | Mode | Orientation | Warm old→new ms | Warm × | '+coldLevels.map(l=>`Cold ${l} ×`).join(' | ')+
  ' | New = old first render | Changed px % | Mean abs | Max | Old history-dependent | Export = screen (old/new) | New hash |',
  '|---|---|---|---|---|'+coldLevels.map(()=>'---|').join('')+'---|---|---|---|---|---|---|'];
for(const r of rows)lines.push(`| ${r.material} | ${r.mode} | ${r.orientation} | ${r.warmMs.old} → ${r.warmMs.new} | `+
  `${r.warmSpeedup} | ${coldLevels.map(l=>r.coldSpeedup[l]).join(' | ')} | ${r.matchesPreviousFirstRender?'yes':'no'} | `+
  `${fmt(r.difference?.changedPct)} | ${fmt(r.difference?.meanAbsoluteChannelDifference)} | `+
  `${fmt(r.difference?.maxChannelDifference)} | ${r.oldHistoryDependent?'**yes**':'no'} | `+
  `${r.exports[r.oldVersion].matches?'yes':'**no**'} / ${r.exports[r.newVersion].matches?'yes':'no'} | ${r.newHash} |`);
if(problems.length)lines.push('','**Fixture problems:** '+problems.map(p=>p.key+' ('+p.problem+')').join(', '));
await writeFile(`${outDir}/summary.md`,lines.join('\n')+'\n');
await writeFile(`${outDir}/results.json`,JSON.stringify({probe,fullMatrix,rows,problems},null,2));
console.log(lines.join('\n'));
assert.deepEqual(problems,[],'New-version reference fixture check failed');
