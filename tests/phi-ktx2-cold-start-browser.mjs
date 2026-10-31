// Four *network-cold* starts against the published test tower.
// Each run has a new Chromium context, disabled HTTP cache, and a cleared
// browser cache. Software WebGL timings are not hardware-GPU benchmarks.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base='https://southernadd-cmyk.github.io/algoart/test/virtual-gallery/full-engine.html';
const order=['jpeg','multi','multi','jpeg'];
const fileNames=['Bricks055_NormalGL','Bricks055_Roughness','OfficeCeiling001_NormalGL'];
const results=[];
const out='phi-ktx2-cold-start-results';
await mkdir(out,{recursive:true});

const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try{
 for(const [index,mode] of order.entries()){
  // A new browser context avoids HTTP memory cache, but a browser-wide disk
  // cache can survive across contexts; explicitly clear and disable it.
  const context=await browser.newContext({viewport:{width:1100,height:700},
   deviceScaleFactor:1,locale:'en-GB',timezoneId:'Europe/London'});
  const page=await context.newPage();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.setBypassServiceWorker',{bypass:true});
  const fromCache=[],responses=[],pageErrors=[];
  cdp.on('Network.requestServedFromCache',data=>fromCache.push(data.requestId));
  cdp.on('Network.responseReceived',data=>{
   if(fileNames.some(x=>data.response.url.includes(x))){
    responses.push({
     name:data.response.url.split('/').at(-1),
     status:data.response.status,
     fromDiskCache:!!data.response.fromDiskCache,
     fromServiceWorker:!!data.response.fromServiceWorker,
     encodedDataLength:data.response.encodedDataLength||0
    });
   }
  });
  page.on('pageerror',e=>pageErrors.push(e.message));
  const target=new URL(base);target.searchParams.set('debug','1');target.searchParams.set('coldbench',String(index+1));
  if(mode==='multi')target.searchParams.set('ktx2','multi');
  let result={iteration:index+1,mode,status:'failed'};
  try{
   const started=Date.now();
   await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>document.querySelector('#enter')?.disabled===false||
     !!window.__galleryStartupError,null,{timeout:100000});
   const readyMs=Date.now()-started;
   const startupError=await page.evaluate(()=>window.__galleryStartupError||null);
   if(startupError)throw Error('Gallery failed to prepare: '+startupError);
   if(mode==='multi'){
    await page.waitForFunction(()=>['loaded','partial-fallback','fallback-jpg'].includes(window.__phiKTX2Pilot?.status),
      null,{timeout:90000});
   }else{
    // For JPEG, wait for the three image resource transfers to complete.
    await page.waitForFunction(names=>{
      const resource=performance.getEntriesByType('resource');
      return names.every(name=>resource.some(x=>x.name.includes(name+'.jpg')&&x.responseEnd>0));
    },fileNames,{timeout:90000});
   }
   const allTexturesReadyMs=Date.now()-started;
   const browserMetrics=await page.evaluate(names=>{
    const entries=performance.getEntriesByType('resource');
    const expected=names.map(n=>n+(new URLSearchParams(location.search).get('ktx2')==='multi'?'.ktx2':'.jpg'));
    const textureResources=expected.map(name=>{
      const r=entries.filter(e=>e.name.includes('/'+name)).at(-1);
      return r?{name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,
        decodedBodySize:r.decodedBodySize,durationMs:Math.round(r.duration),
        responseEndMs:Math.round(r.responseEnd),initiatorType:r.initiatorType}
        :{name,missing:true};
    });
    const nav=performance.getEntriesByType('navigation')[0];
    return {textures:textureResources,nav:{
      durationMs:Math.round(nav?.duration||0),transferSize:nav?.transferSize||0},
      performanceResourceCount:entries.length,
      pilot:window.__phiKTX2Pilot||null,
      gpu:(()=>{
        const gl=document.querySelector('#world')?.getContext('webgl2');
        const info=gl?.getExtension('WEBGL_debug_renderer_info');
        return info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER)||null;
      })()
    };
   },fileNames);
   const expected=mode==='multi'?'loaded':'off';
   if(browserMetrics.pilot?.status!==expected)throw Error('Unexpected KTX2 pilot status: '+browserMetrics.pilot?.status);
   const cold=browserMetrics.textures.every(t=>t.transferSize>0&&!t.missing)
      &&!responses.some(r=>r.fromDiskCache||r.fromServiceWorker)
      &&fromCache.length===0;
   result={iteration:index+1,mode,status:'complete',readyMs,allTexturesReadyMs,
     networkColdVerified:cold,metrics:browserMetrics,fromCacheRequests:fromCache.length,
     assetResponses:responses,pageErrors};
   if(!cold)result.note='A browser cache or missing timing was detected; exclude this sample';
  }catch(error){
   result={iteration:index+1,mode,status:'failed',error:String(error?.message||error),
     fromCacheRequests:fromCache.length,assetResponses:responses,pageErrors};
  }
  results.push(result);
  console.log('COLD_START_RESULT '+JSON.stringify(result));
  await context.close();
 }
 const groups={};
 for(const mode of ['jpeg','multi']){
  const valid=results.filter(r=>r.mode===mode&&r.status==='complete'&&r.networkColdVerified);
  groups[mode]={validRuns:valid.length,readyMs:valid.map(r=>r.readyMs),
   texturesDoneMs:valid.map(r=>r.allTexturesReadyMs),
   resourceBytes:valid.map(r=>r.metrics.textures.reduce((s,t)=>s+(t.transferSize||0),0))};
 }
 const report={description:'Chromium software WebGL true network-cold starts (cache cleared & disabled, separate context each run)',
  sequence:order,results,groups};
 await writeFile(out+'/results.json',JSON.stringify(report,null,2));
 console.log('COLD_START_SUMMARY '+JSON.stringify(groups));
 if(results.some(r=>r.status!=='complete'||!r.networkColdVerified))process.exitCode=1;
}finally{await browser.close();}
