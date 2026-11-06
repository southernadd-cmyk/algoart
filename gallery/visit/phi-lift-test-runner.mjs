const params=new URLSearchParams(location.search);
if(params.has('liftbench'))run();
async function run(){
 const panel=document.createElement('pre');panel.id='lift-test-results';
 panel.style='position:fixed;z-index:10000;bottom:0;left:0;max-height:40vh;overflow:auto;background:white;color:black;font:12px monospace;padding:8px;max-width:95vw;white-space:pre-wrap';
 document.body.append(panel);
 const results={variant:params.get('liftcompiletest')||'baseline',rides:[],errors:[]};
 const show=message=>panel.textContent=message+'\n'+JSON.stringify(results,null,2);
 window.addEventListener('error',e=>{if(e.message)results.errors.push(e.message)});
 const wait=async(predicate,timeout=180000)=>{
  const start=performance.now();while(!predicate()){
   if(performance.now()-start>timeout)throw Error('Test timeout');
   await new Promise(r=>setTimeout(r,100));
  }
 };
 const frames=[];let tracking=false,last=0;
 function frame(t){if(tracking&&last)frames.push(t-last);last=t;requestAnimationFrame(frame)}
 requestAnimationFrame(frame);
 try{
  show('Preparing isolated test');
  await wait(()=>!document.getElementById('enter').disabled);
  document.getElementById('enter').click();
  await wait(()=>document.getElementById('welcome').hidden);
  for(const date of ['2026-10-20','2026-10-30','__phi_reception__']){
   show('Testing journey to '+date);
   document.getElementById('openLift').click();
   await wait(()=>!document.getElementById('lift').hidden,20000);
   let button;
   if(date==='__phi_reception__')button=document.getElementById('liftReception');
   else{
    const month=document.getElementById('liftMonth');month.value=date.slice(0,7);
    month.dispatchEvent(new Event('change',{bubbles:true}));
    button=document.querySelector('#liftDays button[title^="'+date+'"]');
   }
   if(!button)throw Error('Missing destination '+date);
   frames.length=0;tracking=true;last=0;
   const started=performance.now();button.click();
   await wait(()=>window.__phiLiftError||window.__phiLiftProfile?.visits?.at(-1)?.summary);
   tracking=false;
   if(window.__phiLiftError)throw Error(JSON.stringify(window.__phiLiftError));
   const profile=window.__phiLiftProfile.visits.at(-1);
   const stage=name=>profile.stages.find(s=>s.name===name)?.elapsedMs;
   const sorted=[...frames].sort((a,b)=>a-b);
   results.rides.push({date,ms:profile.summary.ms,maxFrameMs:Math.max(...frames),
    p95FrameMs:sorted[Math.floor(sorted.length*.95)],stalls100:frames.filter(x=>x>=100).length,
    revealMs:stage('scene-reveal-finished')-stage('scene-reveal-start'),
    reveal:profile.stages.find(s=>s.name==='scene-reveal-finished')?.details,
    warmup:profile.stages.find(s=>s.name==='warmup-details')?.details,
    loaded:window.__phiFullEngine?.paintingsLoaded,total:window.__phiFullEngine?.paintings,
    preparationTimedOut:window.__phiLiftPreparation?.timedOut,
    largestStalls:profile.summary.frameSpikeStages.sort((a,b)=>b.ms-a.ms).slice(0,5)});
   show('Completed journey to '+date);
   await wait(()=>window.__phiLiftRide?.status==='ready',30000);
  }
  show('TEST COMPLETE');
 }catch(error){results.errors.push(String(error));show('TEST FAILED')}
 // Make the report concise enough for copying from the isolated test page.
 for(const ride of results.rides)if(ride.reveal)ride.reveal={total:ride.reveal.total,shown:ride.reveal.shown,batches:ride.reveal.batches.length};
 show(results.errors.length?'TEST FINISHED WITH ERRORS':'TEST COMPLETE');
}
