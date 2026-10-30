import {alignedScorePoint} from './phi-gramophone-score-map.mjs';
import {ASAP_DEBUSSY_SOURCE,asapDebussyScorePoint} from './phi-gramophone-asap-debussy.mjs';
const scorePoint=(src,fraction,duration)=>src===ASAP_DEBUSSY_SOURCE?
 asapDebussyScorePoint(src,fraction,duration):alignedScorePoint(src,fraction,duration);
// Test-tower listening experiment. The recording is never processed or edited:
// these are mathematical reference points, not claims about score landmarks.
export const PHI=(1+Math.sqrt(5))/2;
const INV_PHI=1/PHI;
export const PHI_LISTENING_MARKERS=Object.freeze([
 {fraction:INV_PHI**3,level:'secondary'},
 {fraction:INV_PHI**2,level:'primary'},
 {fraction:INV_PHI,level:'primary'},
 {fraction:1-INV_PHI**3,level:'secondary'}
].map(item=>Object.freeze({...item,label:(item.fraction*100).toFixed(1)+'%'})));

// Written scores: Debussy 94 bars (standard numbering); Mozart K.545/1 73 bars.
// Repeated measures are not counted again; audio anchors come from the separate score map.
export const WRITTEN_SCORE_BARS=Object.freeze({
 './audio/debussy-reflets-dans-leau.ogg':94,
 [ASAP_DEBUSSY_SOURCE]:94,
 './audio/mozart-k545-allegro.ogg':73
});
export function scorePositionsForTrack(src,markers=PHI_LISTENING_MARKERS){
 const bars=WRITTEN_SCORE_BARS[src];
 if(!bars)return [];
 return markers.map(m=>({...m,bars,position:m.fraction*bars,
   nearestBar:Math.min(bars,Math.floor(m.fraction*bars)+1)}));
}

export const LISTEN_LEAD_IN_SECONDS=8;

export function timelineForDuration(duration,markers=PHI_LISTENING_MARKERS){
 if(!Number.isFinite(duration)||duration<=0)return [];
 return markers.map(marker=>({...marker,time:marker.fraction*duration,
   listenFrom:Math.max(0,marker.fraction*duration-LISTEN_LEAD_IN_SECONDS)}));
}

export function formatRecordTime(seconds){
 if(!Number.isFinite(seconds)||seconds<0)return '–:––';
 const s=Math.floor(seconds),h=Math.floor(s/3600),m=Math.floor(s%3600/60);
 return h?String(h)+':'+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0'):
   String(m)+':'+String(s%60).padStart(2,'0');
}

export function createGramophonePhiTimeline({panel,record}){
 if(!panel||!record?.audio||!record?.state)throw new TypeError('Gramophone panel and record required');
 const audio=record.audio,section=document.createElement('section');
 section.className='record-phi-timeline';
 section.setAttribute('aria-label','Golden-section listening positions');
 const reveal=document.createElement('button');
 reveal.type='button';reveal.className='record-phi-reveal';
 reveal.textContent='Reveal φ listening positions';
 reveal.setAttribute('aria-expanded','false');
 section.append(reveal);
 const details=document.createElement('div');
 details.className='record-phi-details';details.hidden=true;
 const explanation=document.createElement('small');
 explanation.textContent='Compare the same four golden-ratio positions in written bars and in elapsed recording time. They need not coincide.';
 details.append(explanation);
 const timeHeading=document.createElement('small');timeHeading.textContent='Recording time · percentage of duration';details.append(timeHeading);
 const bar=document.createElement('div');
 bar.className='record-phi-bar';bar.setAttribute('role','img');
 bar.setAttribute('aria-label','Progress and four golden-section markers');
 const progress=document.createElement('div');progress.className='record-phi-progress';
 const playhead=document.createElement('div');playhead.className='record-phi-playhead';
 bar.append(progress);
 for(const marker of PHI_LISTENING_MARKERS){
   const line=document.createElement('div');line.className='record-phi-marker '+marker.level;
   line.style.left=(marker.fraction*100)+'%';
   line.title=marker.label+' of recording duration';bar.append(line);
 }
 bar.append(playhead);details.append(bar);
 const current=document.createElement('small');current.className='record-phi-current';
 details.append(current);
 const jumps=document.createElement('div');jumps.className='record-phi-jumps';
 const buttons=PHI_LISTENING_MARKERS.map((marker,i)=>{
   const button=document.createElement('button');button.type='button';
   button.className='record-phi-jump '+marker.level;button.disabled=true;
   button.setAttribute('aria-label','Listen from eight seconds before '+marker.label+' of the recording');
   button.addEventListener('click',()=>{
     const point=timelineForDuration(activeDuration())[i];
     if(!point)return;
     // A lead-in is essential: the listener needs to hear what leads to the division.
     audio.currentTime=point.listenFrom;
     if(!record.state().playing)void record.play();
     render();
   });
   jumps.append(button);return button;
 });
 details.append(jumps);
 const scoreTitle=document.createElement('small');
 scoreTitle.className='record-phi-score-title';
 details.append(scoreTitle);
 const scoreRow=document.createElement('div');
 scoreRow.className='record-phi-score-markers';
 const scoreCells=PHI_LISTENING_MARKERS.map(marker=>{
   const cell=document.createElement('button');cell.type='button';
   cell.className='record-phi-score-cell '+marker.level;cell.disabled=true;
   cell.setAttribute('aria-label','Listen from the aligned score '+marker.label+' position');
   cell.addEventListener('click',()=>{
     const point=scorePoint(record.state().track?.src,marker.fraction,activeDuration());
     if(!point?.verified)return;
     audio.currentTime=Math.max(0,point.time-LISTEN_LEAD_IN_SECONDS);
     if(!record.state().playing)void record.play();
     render();
   });
   scoreRow.append(cell);return cell;
 });
 details.append(scoreRow);
 const scoreBar=document.createElement('div');scoreBar.className='record-phi-bar record-phi-score-bar';
 const scoreLines=PHI_LISTENING_MARKERS.map(marker=>{
   const line=document.createElement('div');line.className='record-phi-marker '+marker.level;
   line.hidden=true;scoreBar.append(line);return line;
 });
 details.append(scoreBar);
 const evidence=document.createElement('small');evidence.className='record-phi-evidence';
 details.append(evidence);
 const externalReference=document.createElement('small');
 const independentLink=document.createElement('a');independentLink.target='_blank';
 independentLink.rel='noopener noreferrer';independentLink.textContent='Independent annotation source';
 externalReference.append(independentLink);details.append(externalReference);

 const hint=document.createElement('small');
 hint.textContent='Choose a marker to hear the preceding 8 seconds. Debussy uses published performance downbeats; Mozart uses score-to-audio analysis independently checked at musical sections. No cues are added.';
 details.append(hint);section.append(details);
 // The new UI lives under the normal transport, within the existing panel.
 const toggle=panel.querySelector('.record-toggle');
 if(toggle)toggle.insertAdjacentElement('afterend',section);else panel.append(section);
 const style=document.createElement('style');
 style.textContent=`
 .record-phi-timeline{margin:12px 0 16px;display:grid;gap:8px}
 .record-phi-timeline button{cursor:pointer}
 .record-phi-timeline button:focus-visible{outline:3px solid #c79750;outline-offset:3px}
 .record-phi-timeline button:disabled{opacity:.48;cursor:not-allowed}
 .record-phi-details{display:grid;gap:10px;padding:12px 0}
 .record-phi-details[hidden]{display:none}
 .record-phi-bar{height:29px;position:relative;overflow:hidden;border-radius:3px;background:#d7d7cb;margin:2px 3px}
 .record-phi-progress{position:absolute;left:0;top:0;bottom:0;width:0;background:#a9bbb0}
 .record-phi-marker{position:absolute;top:0;bottom:0;width:2px;transform:translateX(-50%);background:#9e7847}
 .record-phi-marker.primary{width:3px;background:#7a5029}
 .record-phi-playhead{position:absolute;top:0;bottom:0;left:0;width:2px;background:#263831;transform:translateX(-50%)}
 .record-phi-jumps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 .record-phi-jumps button{background:#e5e0d3;color:#263831;border:1px solid #b9ab90;text-align:left;font:13px/1.4 Arial,sans-serif;padding:7px 9px}
 .record-phi-jumps button.primary{border-color:#896f44}
 .record-phi-score-markers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font:12px/1.5 Arial,sans-serif}
 .record-phi-score-cell{padding:6px 8px;border-left:2px solid #a88851;background:#eee9dd}
 .record-phi-score-cell.primary{border-left-width:4px;border-left-color:#76562d}
 .record-phi-score-cell{font:12px/1.45 Arial,sans-serif;text-align:left;color:#263831;cursor:pointer}
 .record-phi-score-cell:focus-visible{outline:3px solid #c79750;outline-offset:3px}
 .record-phi-score-cell:disabled{opacity:.6;cursor:not-allowed}
 .record-phi-score-bar .record-phi-marker.uncertain{background:#998f80;opacity:.5;width:2px;border-left:1px dashed #594f44;}
 .record-phi-score-cell.moderate{border-style:dashed}
 .record-phi-score-bar .record-phi-marker[hidden]{display:none}
 .record-phi-score-title{font-weight:bold;margin-top:4px}
 .record-phi-current{font-variant-numeric:tabular-nums}
 `;
 document.head.append(style);
 let revealed=false,track=null,duration=0,disposed=false;
 function activeDuration(){
   const src=record.state().track?.src;
   if(audio.src!==new URL(src,document.baseURI).href && audio.getAttribute?.('src')!==src)return 0;
   return Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
 }
 function update(){
   if(disposed)return;
   const selected=record.state().track;
   if(selected!==track){track=selected;duration=0;}
   const actual=activeDuration();
   if(actual)duration=actual;
   const points=timelineForDuration(duration);
   const score=scorePositionsForTrack(selected?.src);
   const aligned=PHI_LISTENING_MARKERS.map(marker=>
     scorePoint(selected?.src,marker.fraction,actual));
   evidence.textContent=selected?.src===ASAP_DEBUSSY_SOURCE?
     'Debussy: the 94 score downbeats were published for this precise MAESTRO 2008 performance in the ASAP dataset. Choose a position to hear the preceding musical context.':
     selected?.src==='./audio/debussy-reflets-dans-leau.ogg'?
     'Debussy: the 94-bar score has been matched computationally to this Giorgi Latso recording, but an independently annotated version of this exact performance has not been found.':
     selected?.src==='./audio/mozart-k545-allegro.ogg'?
     'Mozart: this Robin Alciatore performance omits repeats. Independent research places the development at 0:51.27 and recapitulation at 1:13.10, agreeing with our mapping near these landmarks.':'';
   independentLink.href=selected?.src==='./audio/mozart-k545-allegro.ogg'?
     'https://audiolabs.github.io/trackswitch.js/use-cases/repeated-section/':
     'https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau';
   independentLink.textContent=selected?.src==='./audio/mozart-k545-allegro.ogg'?
     'External alignment of this recording':selected?.src===ASAP_DEBUSSY_SOURCE?
     'Published score annotations for this recording':'Annotated alternative performances (not this recording)';
   const bars=score[0]?.bars;
   scoreTitle.textContent=bars?'Written score · '+bars+' bars · aligned to this recording':
     'Written score · bar count unavailable';
   scoreCells.forEach((cell,i)=>{
     const point=aligned[i],marker=PHI_LISTENING_MARKERS[i];
     cell.disabled=!point?.verified;
     cell.classList.toggle('moderate',point?.confidence==='moderate');
     cell.setAttribute('aria-label',point?.verified?'Listen from 8 seconds before score position '+marker.label:'Score position '+marker.label+' needs manual review; seeking is disabled');
     cell.textContent=point?
       marker.label+' · bar '+point.withinBar+' · '+formatRecordTime(point.time)+
         (point.verified?'':' · needs review'):
       marker.label+' · awaiting verified audio';
     cell.title=point?
       (point.evidence?point.evidence+'; click for an eight-second lead-in.':
       'Two alignment methods differ around this point by '+point.disagreement.toFixed(2)+
       ' seconds. '+(point.verified?'Click for an eight-second lead-in.':'Not seekable until reviewed.')):
       'Play the correct recording to load its score alignment';
     const line=scoreLines[i];
     line.hidden=!point;
     line.classList.toggle('uncertain',!!point&&!point.verified);
     if(point&&duration>0){
       line.style.left=(point.time/duration*100)+'%';
       line.title=marker.label+' of written bars · '+formatRecordTime(point.time)+' in recording';
     }
   });
   buttons.forEach((button,i)=>{
     const point=points[i];button.disabled=!point;
     button.textContent=point?point.label+' · '+formatRecordTime(point.time):
       PHI_LISTENING_MARKERS[i].label+' · awaiting duration';
   });
   render();
 }
 function render(){
   if(disposed)return;
   const time=Number.isFinite(audio.currentTime)?audio.currentTime:0;
   const fraction=duration>0?Math.max(0,Math.min(1,time/duration)):0;
   progress.style.width=(fraction*100)+'%';playhead.style.left=(fraction*100)+'%';
   current.textContent=duration>0?'Playing position '+formatRecordTime(time)+' / '+formatRecordTime(duration):
     'Play or select a recording to load its duration';
 }
 reveal.addEventListener('click',()=>{
   revealed=!revealed;details.hidden=!revealed;
   reveal.textContent=revealed?'Hide φ listening positions':'Reveal φ listening positions';
   reveal.setAttribute('aria-expanded',String(revealed));if(revealed)update();
 });
 const events=['loadedmetadata','durationchange','emptied','timeupdate','seeked'];
 for(const name of events)audio.addEventListener(name,name==='timeupdate'?render:update);
 update();
 return {
   markers:PHI_LISTENING_MARKERS,scorePositionsForTrack,update,
   dispose(){
     disposed=true;
     for(const name of events)audio.removeEventListener(name,name==='timeupdate'?render:update);
     section.remove();style.remove();
   }
 };
}
