// Test tower only. A lightweight UI to copy/download lift profiles.
// The gallery's built-in test profiler is the source of frame/stage measurements.
const round=x=>Number.isFinite(x)?+x.toFixed(1):null;
const rows=v=>Array.isArray(v?.stages)?v.stages:[];
const at=(v,n)=>rows(v).find(s=>s.name===n)?.elapsedMs??null;
const between=(v,a,b)=>at(v,a)==null||at(v,b)==null?null:round(at(v,b)-at(v,a));
export function summariseLiftVisit(v){
 const frames=v.frameMs||[],ordered=[...frames].sort((a,b)=>a-b);
 const pct=q=>ordered.length?round(ordered[Math.floor((ordered.length-1)*q)]):null;
 const count=n=>frames.filter(x=>x>=n).length;
 const stages=rows(v);
 const operations=v.operations||[];
 const buckets=[
  ['gl-','timed WebGL API / driver call'],
  ['pass-','named post-processing or scene-render pass'],
  ['render-frame-postfx','complete postprocessing / WebGL render submission'],
  ['gpu-upload','texture upload / GPU driver submission'],
  ['shader-compile','shader compilation submission'],
  ['stage-sculpture','sculpture geometry generation'],
  ['stage-room','room geometry generation'],
  ['build-floor','synchronous destination floor mesh construction'],
  ['transform-floor','scene coordinate transform'],
  ['update-tower','tower shell construction'],
  ['queue-scene','scene reveal preparation'],
  ['dispose-','geometry / material / texture disposal'],
  ['deferred-','deferred gallery construction'],
  ['gather-scene','scene texture traversal'],
  ['update-room','lighting setup']
 ];
 const category=name=>buckets.find(([prefix])=>name.startsWith(prefix))?.[1]||'other recorded synchronous work';
 const spikeAttribution=frame=>{
  const gapStart=(frame.elapsedMs||0)-(frame.deltaMs||0),gapEnd=frame.elapsedMs||0;
  const observed=operations.map(op=>{
   const opStart=op.elapsedMs,opEnd=opStart+op.durationMs;
   const overlap=Math.max(0,Math.min(gapEnd,opEnd)-Math.max(gapStart,opStart));
   return {...op,overlapMs:round(overlap),category:category(op.name)};
  }).filter(op=>op.overlapMs>0).sort((a,b)=>b.overlapMs-a.overlapMs).slice(0,8);
  const covered=observed.reduce((sum,op)=>sum+op.overlapMs,0);
  const largest=observed[0]||null;
  // Prefer a named pass only when it accounts for a substantial fraction
  // of the stalled frame; otherwise the root remains the whole render call.
  const namedPass=observed.filter(op=>op.name.startsWith('pass-'))
   .sort((a,b)=>b.overlapMs-a.overlapMs)[0]||null;
  // Narrow opt-in WebGL tracing can isolate one driver call from the full
  // scene-render pass. Never claim a cause if individual GL calls are cheap.
  const glCall=observed.filter(op=>op.name.startsWith('gl-'))
   .sort((a,b)=>b.overlapMs-a.overlapMs)[0]||null;
  const likely=glCall&&glCall.overlapMs>=Math.max(10,frame.deltaMs*.25)?
   glCall:namedPass&&namedPass.overlapMs>=Math.max(10,frame.deltaMs*.35)?
   namedPass:largest;
  const longFrames=(v.longAnimationFrames||[]).filter(item=>{
   const start=item.elapsedMs,end=start+item.durationMs;
   return Math.max(gapStart,start)<Math.min(gapEnd,end);
  }).sort((a,b)=>b.blockingDurationMs-a.blockingDurationMs).slice(0,4);
  const script=longFrames.flatMap(item=>item.scripts||[])
   .filter(item=>item.durationMs>=8&&item.functionName)
   .sort((a,b)=>b.durationMs-a.durationMs)[0]||null;
  const measuredBlock=likely&&likely.overlapMs>=Math.min(8,frame.deltaMs*.25);
  const attribution=measuredBlock?
   {status:likely.name.startsWith('gl-')?'observed WebGL driver-call blocking':
    likely.name.startsWith('pass-')?'observed render-pass blocking':'observed synchronous blocking',
    operation:likely.name,category:likely.category,overlapMs:likely.overlapMs}:
   script?{status:'browser script-function attribution',functionName:script.functionName,
    sourcePath:script.sourcePath,durationMs:script.durationMs}:
   {status:'unattributed',explanation:'No measured operation or browser script function explains this frame gap. Could be GPU-driver wait, GC, compositor, scheduling, or other browser work. Investigate in DevTools Performance.'};
  return {
   elapsedMs:round(frame.elapsedMs),gapMs:round(frame.deltaMs),stageAtEnd:frame.stage,
   matchingOperations:observed,matchingLongAnimationFrames:longFrames,
   // Stage names are context, not proof of the cause.
   attribution,measuredOverlapMs:round(covered)
  };
 };
 const failed=stages.some(x=>x.name==='failure'),interrupted=stages.some(x=>x.name==='interrupted');
 return {
  direction:(v.fromFloor===0?'G':v.fromFloor)+' → '+(v.toFloor===0?'G':v.toFloor),
  fromFloor:v.fromFloor,toFloor:v.toFloor,date:v.date,
  status:failed?'failed':v.summary?'completed':interrupted?'interrupted':'in-progress',
  elapsedMs:round(v.summary?.ms??(stages.at(-1)?.elapsedMs??0)),
  frames:{
   count:frames.length,p50Ms:v.summary?.frameP50Ms??pct(.5),
   p95Ms:v.summary?.frameP95Ms??pct(.95),
   p99Ms:v.summary?.frameP99Ms??pct(.99),
   maxMs:v.summary?.largestFrameGapMs??pct(1),
   over33Ms:v.summary?.framesOver33ms??count(33.3),
   over50Ms:v.summary?.framesOver50ms??count(50),
   over80Ms:v.summary?.framesOver80ms??count(80),
   over100Ms:v.summary?.framesOver100ms??count(100),
   over250Ms:v.summary?.framesOver250ms??count(250)
  },
  durationsMs:{
   metadata:at(v,'edition-metadata-ready'),
   closingDoors:between(v,'edition-metadata-ready','doors-closed'),
   construction:between(v,'ride-construction-start','floor-construction-finished'),
   paintingGate:between(v,'paintings-waiting','paintings-gpu-ready'),
   sceneReveal:between(v,'scene-reveal-start','scene-reveal-finished'),
   deferredPump:between(v,'scene-reveal-finished','deferred-pump-finished'),
   warmup:between(v,'deferred-pump-finished','texture-upload-and-compile-finished'),
   remainingRide:between(v,'destination-ready-in-ride','ride-finished'),
   arrival:between(v,'ride-finished','doors-opening')
  },
  earlyShaderCompile:{
   enabled:stages.some(s=>s.name.startsWith('destination-shader-precompile-')),
   result:stages.find(s=>s.name==='destination-shader-precompile-finished')?.details||
    stages.find(s=>s.name==='destination-shader-precompile-failed')?.details||null,
   elapsedMs:between(v,'destination-shader-precompile-start','destination-shader-precompile-finished')
  },
  stages:stages.map(s=>({name:s.name,elapsedMs:round(s.elapsedMs),
   ...(s.details==null?{}:{details:s.details})})),
  // Measured calls are evidence. Stage names merely indicate when they happened.
  operationTotals:Object.fromEntries(Object.entries(v.summary?.operationTotals||v.operationTotals||{})
   .map(([name,value])=>[name,{count:value.count,totalMs:round(value.totalMs),
     maxMs:round(value.maxMs),category:category(name)}])),
  operationSpikes:[...operations].sort((a,b)=>b.durationMs-a.durationMs).slice(0,80)
   .map(op=>({...op,category:category(op.name)})),
  webglCallSpikes:operations.filter(op=>op.name.startsWith('gl-'))
   .sort((a,b)=>b.durationMs-a.durationMs).slice(0,80),
  worstFrames:[...(v.frames||[])].sort((a,b)=>b.deltaMs-a.deltaMs).slice(0,60)
   .map(spikeAttribution),
  longTasks:[...(v.longTasks||[])].sort((a,b)=>b.durationMs-a.durationMs).slice(0,40),
  longAnimationFrames:[...(v.longAnimationFrames||[])]
   .sort((a,b)=>b.blockingDurationMs-a.blockingDurationMs).slice(0,40)
 };
}
export function buildLiftBenchmarkReport(state,environment={}){
 const visits=state?.visits||[];
 return {
  format:'PROPORTION PIECE — test tower lift benchmark',
  version:8,exportedAt:new Date().toISOString(),environment,
  summary:{journeys:visits.length,completed:visits.filter(v=>v.summary&&!rows(v).some(s=>s.name==='failure')).length,
   recording:!!state?.active,attributionNote:'Named render-pass timings identify which active scene, AO, bloom, artwork protection or grading pass blocks rendering. Optional ?gltrace=1 measures slow WebGL API calls. Optional ?shadertrace=1 identifies slow shader-program queries, their parameters and program/shader fingerprints without modifying the rendered scene. Operation overlaps identify measured blockers; Chromium Long Animation Frames can reveal functions. WebGL render and texture upload calls can include driver wait and do not prove pure GPU time. Unattributed gaps need a browser trace.',route:'Reception G → top exhibition → reception G'},
  journeys:visits.map(summariseLiftVisit)
 };
}
export function installLiftBenchmarkUI(){
 if(typeof document==='undefined'||document.getElementById('phiBenchToggle'))return;
 const toolbar=document.querySelector('.topbar .toolbar-utility');
 if(!toolbar)return;
 const css=document.createElement('style');
 css.textContent=[
  '#phiBenchPanel{position:fixed;z-index:66;right:15px;top:calc(var(--gallery-ui-bottom,112px) + 9px);width:min(390px,calc(100vw - 30px));max-height:calc(100dvh - var(--gallery-ui-bottom,112px) - 20px);overflow:auto;background:#f4f0e8;color:#26372e;border:1px solid #8b9b8b;border-radius:5px;padding:17px 18px;box-shadow:0 15px 40px #15261b55;font:13px/1.45 Arial,Helvetica,sans-serif}',
  '#phiBenchPanel h2{font:normal 22px Georgia,serif;margin:0}',
  '#phiBenchPanel p{margin:9px 0}',
  '#phiBenchPanel .bench-head,#phiBenchPanel .bench-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
  '#phiBenchPanel .bench-head{justify-content:space-between}',
  '#phiBenchPanel button{font:500 12px Arial,sans-serif;padding:8px 10px;min-height:36px;background:#fffdf8;color:#273a2c;border:1px solid #819781;border-radius:3px}',
  '#phiBenchPanel button:disabled{opacity:.45;cursor:not-allowed}',
  '#phiBenchPanel .primary{background:#344a3d;color:white}',
  '#phiBenchPanel .bench-status{font-weight:700}',
  '#phiBenchPanel .bench-journeys{white-space:pre-wrap;overflow-wrap:anywhere;border-top:1px solid #9dab9840;padding-top:9px;font:12px/1.5 Consolas,monospace}',
  '#phiBenchPanel .bench-feedback{min-height:18px;color:#47644d;font-weight:600}',
  '#phiBenchPanel textarea{box-sizing:border-box;width:100%;height:100px;font:11px monospace}'
 ].join('\n');
 document.head.append(css);
 const toggle=document.createElement('button');
 toggle.type='button';toggle.id='phiBenchToggle';toggle.textContent='Lift benchmark';
 toggle.setAttribute('aria-controls','phiBenchPanel');
 toggle.setAttribute('aria-expanded','false');
 toolbar.insertBefore(toggle,toolbar.firstChild);
 const panel=document.createElement('section');
 panel.id='phiBenchPanel';panel.hidden=true;
 panel.setAttribute('role','region');panel.setAttribute('aria-label','Test lift benchmark JSON export');
 panel.innerHTML=[
  '<div class="bench-head"><h2>Lift benchmark · test</h2><button data-action="close" type="button" aria-label="Close">×</button></div>',
  '<p>Recording starts automatically when you use the lift. Travel from reception to the highest floor, then back to reception.</p>',
  '<p class="bench-status" id="phiBenchStatus" aria-live="polite">Waiting for gallery…</p>',
  '<div class="bench-journeys" id="phiBenchTrips">No journeys yet.</div>',
  '<p class="bench-feedback" id="phiBenchFeedback" role="status"></p>',
  '<div class="bench-actions">',
  '<button class="primary" type="button" data-action="copy">Copy JSON</button>',
  '<button type="button" data-action="download">Download JSON</button>',
  '<button type="button" data-action="clear">Clear</button></div>',
  '<textarea id="phiBenchManual" hidden readonly aria-label="Select JSON manually if clipboard is unavailable"></textarea>',
  '<p style="font-size:11px">Paste copied JSON here in chat, or upload the downloaded .json file. This benchmark runs on TEST only.</p>'
 ].join('');
 document.body.append(panel);
 const find=x=>panel.querySelector('[data-action="'+x+'"]');
 const feedback=panel.querySelector('#phiBenchFeedback'),status=panel.querySelector('#phiBenchStatus');
 const trips=panel.querySelector('#phiBenchTrips'),manual=panel.querySelector('#phiBenchManual');
 const profile=()=>window.__phiLiftProfile||null;
 function report(){
  return buildLiftBenchmarkReport(profile(),{
   userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},
   devicePixelRatio:devicePixelRatio||1,
   threeRevision:window.__phiLiftState?.threeRevision||null,
   renderPixelRatio:window.__phiPerformance?.pixelRatio??null,
   webglTrace:window.__phiGLTrace||{enabled:false},
   shaderErrorChecks:window.__phiShaderChecks??null,
   shaderProgramTrace:window.__phiShaderSpikeTrace?.snapshot?.()||{enabled:false},
   shadowShaderReuse:window.__phiShadowShaderReuse||{enabled:new URLSearchParams(location.search).get('shaderreuse')==='1',available:false},
   realTimeShadows:window.__phiLightingStudy?{enabled:window.__phiLightingStudy.realTimeShadows,shadowMaps:window.__phiLightingStudy.shadowMaps,casters:window.__phiLightingStudy.casters,refreshes:window.__phiLightingStudy.refreshes}:{enabled:new URLSearchParams(location.search).get('shadows')!=='0',available:false},
   boundedLightPool:window.__phiBoundedLightPool?{...window.__phiBoundedLightPool}: {enabled:new URLSearchParams(location.search).get('lightpool')==='1',available:false},
   earlyDestinationCompile:{enabled:new URLSearchParams(location.search).get('earlycompile')==='1'||!!window.__phiEarlyCompile,details:window.__phiEarlyCompile||null}
  });
 }
 function update(){
  const s=profile(),v=s?.visits||[];
  status.textContent=!s?'Waiting for gallery profiler…':s.active&&s.current?
   'Recording '+(s.current.fromFloor||'G')+' → '+(s.current.toFloor||'G')+'…':
   v.length+' journey'+(v.length===1?'':'s')+' captured ('+v.filter(x=>x.summary).length+' completed)';
  trips.textContent=v.length?v.map((item,i)=>{
   const x=summariseLiftVisit(item);
   return (i+1)+'. '+x.direction+' · '+x.status+' · '+x.elapsedMs+'ms · worst '+(x.frames.maxMs??'—')+'ms · p95 '+(x.frames.p95Ms??'—')+'ms';
  }).join('\n'):'No journeys yet. Take the lift, then export.';
  find('copy').disabled=find('download').disabled=!v.length;
  find('clear').disabled=!v.length||!!s?.active;
 }
 function open(value){
  panel.hidden=!value;toggle.setAttribute('aria-expanded',String(!!value));
  if(value){
   document.getElementById('mobileOverflow')?.classList.remove('is-open');
   document.getElementById('mobileMenuToggle')?.setAttribute('aria-expanded','false');
   update();
  }
 }
 toggle.addEventListener('click',()=>open(panel.hidden));
 find('close').addEventListener('click',()=>{open(false);toggle.focus();});
 find('copy').addEventListener('click',async()=>{
  const json=JSON.stringify(report(),null,2);
  manual.hidden=true;feedback.textContent='';
  try{
   if(!navigator.clipboard?.writeText)throw Error('No clipboard');
   await navigator.clipboard.writeText(json);
   feedback.textContent='Copied! Paste the JSON in chat.';
  }catch{
   manual.value=json;manual.hidden=false;manual.focus();manual.select();
   feedback.textContent='Clipboard blocked. Copy selected text, or use Download JSON.';
  }
 });
 find('download').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(report(),null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='proportion-piece-lift-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  feedback.textContent='JSON downloaded.';
 });
 find('clear').addEventListener('click',()=>{
  const s=profile();if(!s||s.active)return;
  s.visits.length=0;s.current=null;manual.hidden=true;
  feedback.textContent='Previous journeys cleared.';update();
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!panel.hidden){open(false);toggle.focus();}
 });
 window.__phiLiftBenchmark={report,reset:()=>find('clear').click()};
 update();
 setInterval(()=>{if(!panel.hidden)update();},700);
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',installLiftBenchmarkUI,{once:true});
 else installLiftBenchmarkUI();
}
