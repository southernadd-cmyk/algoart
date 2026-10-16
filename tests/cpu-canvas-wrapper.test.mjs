// Unit tests for js/cpu-canvas.js: the scoped getContext interception used by
// Oil V4, Tissue V8 and Watercolour V2T. Fast; run before the benchmark.
// Same environment variables as cpu-context-rebaseline.mjs for the browser.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const PROFILE_ARGS={default:[],cpu:['--disable-gpu'],
  swiftshader:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
  hardware:['--ignore-gpu-blocklist']};
const profile=process.env.BROWSER_PROFILE||'default';
const browser=await chromium.launch({headless:profile!=='hardware',
  executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:[...PROFILE_ARGS[profile],...(process.env.CHROMIUM_ARGS||'').split(' ').filter(Boolean)]});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(root+'?v=9&seed=CPU-WRAPPER-TEST&mode=organic&material=marker',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlgoArt?.renderOilPaintV4&&window.AlgoArt?.renderTissueV8&&
    window.AlgoArt?.renderWatercolourV2T);
  const results=await page.evaluate(()=>{
    const A=window.AlgoArt,P=HTMLCanvasElement.prototype,native=P.getContext,out={};
    const cpu=c=>A.canvasReadFrequently(c.getContext('2d'));
    const fresh=()=>document.createElement('canvas');
    // 1. Scope sets and restores the interception.
    let inside=null;
    A.withCPUCanvases(()=>{inside=cpu(fresh())});
    out.insideScopeCpu=inside;
    out.restoredAfterScope=P.getContext===native&&A.cpuCanvasBackendActive===false;
    out.outsideScopeCpu=cpu(fresh());
    // 2. Exceptions restore everything and propagate.
    let threw=false;
    try{A.withCPUCanvases(()=>{throw Error('boom')})}catch(e){threw=e.message==='boom'}
    out.exceptionPropagates=threw;
    out.restoredAfterException=P.getContext===native&&A.cpuCanvasBackendActive===false;
    // 3. Nesting: leaving the inner scope must not end the outer one.
    let afterInner=null;
    A.withCPUCanvases(()=>{A.withCPUCanvases(()=>{});afterInner=cpu(fresh())});
    out.nestedOuterStillCpu=afterInner;
    out.restoredAfterNesting=P.getContext===native&&A.cpuCanvasBackendActive===false;
    // 4. Nested exception inside an outer scope.
    let outerAfterInnerThrow=null;
    A.withCPUCanvases(()=>{try{A.withCPUCanvases(()=>{throw Error('inner')})}catch{};
      outerAfterInnerThrow=cpu(fresh())});
    out.outerSurvivesInnerThrow=outerAfterInnerThrow;
    out.restoredAfterNestedThrow=P.getContext===native&&A.cpuCanvasBackendActive===false;
    // 5. renderViaCPUCanvas: a throwing renderer restores state; target untouched.
    const target=fresh();target.width=7;target.height=5;
    const previousRecord=A.lastCPUCanvasRender;
    threw=false;
    try{A.renderViaCPUCanvas(()=>{throw Error('render')},target,'t')}catch(e){threw=e.message==='render'}
    out.renderThrowPropagates=threw;
    out.renderThrowRestored=P.getContext===native&&A.cpuCanvasBackendActive===false&&
      A.lastCPUCanvasRender===previousRecord;
    out.renderThrowTargetUntouched=target.width===7&&target.height===5;
    // 6. Audit detects a canvas whose context predates the scope (cached canvas).
    const cached=fresh();cached.getContext('2d');
    A.renderViaCPUCanvas(c=>{c.width=4;c.height=4;cached.getContext('2d');fresh().getContext('2d')},fresh(),'audit');
    out.auditDetectsCachedCanvas=A.lastCPUCanvasRender.nonCpu===1&&A.lastCPUCanvasRender.contexts>=3;
    // 7. The visible/export canvas never receives willReadFrequently.
    const visibleExisting=fresh();visibleExisting.getContext('2d');
    A.renderViaCPUCanvas(c=>{c.width=9;c.height=9},visibleExisting,'v1');
    const visibleNew=fresh();
    A.renderViaCPUCanvas(c=>{c.width=9;c.height=9},visibleNew,'v2');
    out.visibleNotCpu=cpu(visibleExisting)===false&&cpu(visibleNew)===false;
    out.visibleSized=visibleNew.width===9&&visibleNew.height===9;
    // 8. Copy step is exact for opaque output. (Semi-transparent pixels can
    // round differently when the visible canvas is GPU-backed, because GPU
    // storage is premultiplied; so every new-version output must be opaque,
    // which check 9 asserts. The semi-transparent result is only reported.)
    function copyDifference(alphaFor){
      const src=fresh();src.width=src.height=64;
      const sctx=src.getContext('2d',{willReadFrequently:true});
      for(let i=0;i<64;i++)for(let j=0;j<64;j+=8){
        sctx.fillStyle=`rgba(${(i*4+j)%256},${(255-i*3+j*2)%256},${(i*2+j*5)%256},${alphaFor(i)})`;
        sctx.fillRect(i,j,1,8);
      }
      const expected=sctx.getImageData(0,0,64,64).data;
      const copied=fresh();
      A.renderViaCPUCanvas(c=>{c.width=c.height=64;c.getContext('2d').drawImage(src,0,0)},copied,'copy');
      const got=copied.getContext('2d').getImageData(0,0,64,64).data;
      let diff=0;for(let i=0;i<got.length;i++)if(got[i]!==expected[i])diff++;
      return diff;
    }
    out.copyExactBytesDifferingOpaque=copyDifference(()=>1);
    out.copyBytesDifferingSemiTransparent=copyDifference(i=>(i+1)/64);
    // 9. Real renders: no canvas references retained in returned/global metadata.
    const settings={...A.readSettings(),seed:'CPU-WRAPPER-TEST',mode:'network',orientation:'landscape'};
    const retained=[];
    function scan(value,path,seen,depth){
      if(!value||typeof value!=='object'||seen.has(value)||depth>6)return;
      seen.add(value);
      if(value instanceof HTMLCanvasElement||value instanceof CanvasRenderingContext2D){retained.push(path);return}
      if(ArrayBuffer.isView(value))return;
      for(const key of Object.keys(value))scan(value[key],path+'.'+key,seen,depth+1);
    }
    for(const [name,fn] of [['oil-v4',A.renderOilPaintV4],['tissue-8',A.renderTissueV8],
      ['watercolour-v2t',A.renderWatercolourV2T]]){
      for(const reveal of [false,true]){
        const c=fresh();const meta=fn(c,settings,.2,reveal);
        const seen=new Set();
        scan(meta,name+':meta',seen,0);
        for(const k of ['lastRenderMeta','lastV5PInterpretation','lastOilPaintV4EStats','lastCPUCanvasRender'])
          scan(A[k],name+':A.'+k,seen,0);
        if(!(c.width>1&&c.height>1))retained.push(name+': empty output');
        const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let translucent=0;for(let i=3;i<px.length;i+=4)if(px[i]!==255)translucent++;
        if(translucent)retained.push(name+': '+translucent+' non-opaque pixels (copy may not be exact)');
        if(A.lastCPUCanvasRender.nonCpu!==0)retained.push(name+': non-CPU context');
      }
    }
    out.retainedCanvasReferences=retained;
    out.finalRestored=P.getContext===native&&A.cpuCanvasBackendActive===false;
    return out;
  });
  console.log('CPU_CANVAS_WRAPPER '+JSON.stringify(results));
  assert.equal(results.insideScopeCpu,true,'Canvas created in scope is not CPU-backed');
  assert.equal(results.outsideScopeCpu,false,'Canvas created outside scope became CPU-backed');
  for(const k of ['restoredAfterScope','exceptionPropagates','restoredAfterException','nestedOuterStillCpu',
    'restoredAfterNesting','outerSurvivesInnerThrow','restoredAfterNestedThrow','renderThrowPropagates',
    'renderThrowRestored','renderThrowTargetUntouched','auditDetectsCachedCanvas','visibleNotCpu',
    'visibleSized','finalRestored'])assert.equal(results[k],true,k);
  assert.equal(results.copyExactBytesDifferingOpaque,0,'Copy to the visible canvas altered opaque pixels');
  assert.deepEqual(results.retainedCanvasReferences,[],'Retained canvas references or non-opaque output');
  assert.deepEqual(errors,[]);
  console.log('PASS cpu-canvas wrapper ('+profile+')');
}finally{await browser.close()}
