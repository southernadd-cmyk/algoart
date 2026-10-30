// Golden listening study — test tower only. The original audio is never altered.
import {PHI_LISTENING_MARKERS,LISTEN_LEAD_IN_SECONDS,timelineForDuration,formatRecordTime} from './phi-gramophone-timeline.mjs';
import {alignedScorePoint} from './phi-gramophone-score-map.mjs';
import {ASAP_DEBUSSY_SOURCE,asapDebussyScorePoint} from './phi-gramophone-asap-debussy.mjs';

export const getScorePoint=(src,fraction,duration)=>src===ASAP_DEBUSSY_SOURCE?
 asapDebussyScorePoint(src,fraction,duration):alignedScorePoint(src,fraction,duration);

export function comparePhiPositions(src,fraction,duration){
 if(!Number.isFinite(duration)||duration<=0)return null;
 const time=timelineForDuration(duration,[{fraction}])[0];
 const score=getScorePoint(src,fraction,duration);
 return {time,score,gapSeconds:score?score.time-time.time:null};
}
export function phiListeningQuestion(src,index){
 const debussy=src===ASAP_DEBUSSY_SOURCE||src==='./audio/debussy-reflets-dans-leau.ogg';
 if(debussy&&index===2)return 'Howat identifies a principal climax near bar 58. Does the music make this proportion feel significant?';
 if(!debussy&&index===1)return 'The exposition closes around bar 28. Can you hear this formal boundary?';
 if(!debussy&&index===2)return 'Putz questioned golden-section readings of Mozart. Does the music support one here?';
 return [
  'Listen for an arrival, a change of texture, or nothing conspicuous.',
  'Does this feel like a musical boundary, or just a coordinate?',
  'Is there an audible turning point here?',
  'Is this nested proportion meaningful, or does the music simply continue?'
 ][index];
}
const el=(tag,cls,txt)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(txt!==undefined)e.textContent=txt;return e;
};
const svg=(tag,attrs)=>{
 const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 return e;
};

export function createGramophonePhiTimeline({panel,record}){
 if(!panel||!record?.audio||!record?.state)throw new TypeError('Gramophone panel and record required');
 const audio=record.audio,section=el('section','phi-listen');
 section.setAttribute('aria-label','Golden listening study');
 const top=el('div');
 top.append(el('span','phi-listen-overline','PROPORTION PIECE / LISTENING STUDY 01'));
 const heading=el('h3');heading.append('Where does ');
 const golden=el('i',null,'φ');heading.append(golden,' fall?');top.append(heading);
 top.append(el('p','phi-listen-intro',
  'One composition, two measures of time. Listen first. Then uncover where the written music and the performed recording place the same golden proportion.'));
 section.append(top);
 const reveal=el('button','phi-listen-reveal','Reveal the golden divisions');
 reveal.type='button';reveal.setAttribute('aria-expanded','false');section.append(reveal);
 const stage=el('div','phi-listen-stage');stage.hidden=true;section.append(stage);
 const ratios=el('div','phi-listen-ratios');ratios.setAttribute('role','group');
 ratios.setAttribute('aria-label','Select one of four nested golden-ratio divisions');
 const selectedButtons=PHI_LISTENING_MARKERS.map((m,i)=>{
  const b=el('button',null,m.label);b.type='button';b.setAttribute('aria-pressed',String(i===2));
  ratios.append(b);return b;
 });stage.append(ratios);
 const moment=el('div','phi-listen-moment');
 const count=el('span','phi-listen-step','03 / 04');
 const momentName=el('h4',null,'The golden section'),question=el('p','phi-listen-question');
 moment.append(count,momentName,question);stage.append(moment);
 const figure=el('figure','phi-listen-figure');
 const fighead=el('div','phi-listen-fighead');
 const elapsed=el('span',null,'PLAY TO LISTEN');fighead.append(el('span',null,'ONE FRACTION · TWO POSITIONS'),elapsed);figure.append(fighead);
 const chart=svg('svg',{viewBox:'0 0 420 128',role:'img','aria-label':'Position of score and recording divisions on a common audio timeline'});
 const left=12,right=408,width=right-left;
 for(const y of [34,86])chart.append(svg('line',{x1:left,y1:y,x2:right,y2:y,class:'phi-listen-axis'}));
 for(const m of PHI_LISTENING_MARKERS){
  const x=left+width*m.fraction;chart.append(svg('line',{x1:x,y1:78,x2:x,y2:94,class:'phi-listen-hairline'}));
 }
 const join=svg('line',{x1:left,y1:34,x2:left,y2:86,class:'phi-listen-connection'});
 const scoreDot=svg('circle',{cx:left,cy:34,r:7,class:'phi-listen-score-dot'});
 const timeDot=svg('circle',{cx:left,cy:86,r:7,class:'phi-listen-time-dot'});
 const playhead=svg('line',{x1:left,y1:22,x2:left,y2:102,class:'phi-listen-playhead'});
 const scoreName=svg('text',{x:left,y:14,class:'phi-listen-label'});scoreName.textContent='SCORE';
 const timeName=svg('text',{x:left,y:119,class:'phi-listen-label'});timeName.textContent='RECORDING TIME';
 chart.append(join,scoreDot,timeDot,playhead,scoreName,timeName);figure.append(chart);
 const foot=el('div','phi-listen-figfoot'),difference=el('strong',null,'—'),total=el('span',null,'—:——');
 foot.append(el('span',null,'0:00'),difference,total);figure.append(foot);stage.append(figure);
 const actions=el('div','phi-listen-actions');
 function action(name,cl){
  const b=el('button','phi-listen-action'+(cl?' '+cl:''));b.type='button';
  const label=el('span',null,name),timestamp=el('strong',null,'—:——');
  const detail=el('small',null,'8 seconds of lead-in');
  b.append(label,timestamp,detail);actions.append(b);
  return {button:b,timestamp,detail};
 }
 const scoreAction=action('HEAR THE SCORE'),timeAction=action('HEAR THE CLOCK','time');
 stage.append(actions);
 const reflection=el('div','phi-listen-reflect');reflection.append(el('p',null,'What did you hear?'));
 const answerChoices=el('div','phi-listen-reflect-controls');
 const answerNote=el('small',null,'A listening question, not a test.');
 const answerButtons=['A change','No clear change','Not sure'].map(text=>{
  const b=el('button',null,text);b.type='button';b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>{
   for(const other of answerButtons)other.setAttribute('aria-pressed',String(other===b));
   answerNote.textContent='Your impression stays in this panel and is not collected. Compare the other position.';
  });answerChoices.append(b);return b;
 });
 reflection.append(answerChoices,answerNote);stage.append(reflection);
 stage.append(el('p','phi-listen-explainer',
  'No audio cues are added. A numerical coincidence does not prove that a composer intended the golden ratio.'));
 const sources=el('details','phi-listen-sources');
 sources.append(el('summary',null,'About the recordings and alignment'));
 const provenance=el('div');sources.append(provenance);stage.append(sources);
 const toggle=panel.querySelector('.record-toggle');
 if(toggle)toggle.insertAdjacentElement('afterend',section);else panel.append(section);
 const css=el('link');css.rel='stylesheet';css.href='./phi-gramophone-experience.css';document.head.append(css);
 let selectedIndex=2,track=null,duration=0,disposed=false,revealed=false;

 function activeDuration(){
  const src=record.state().track?.src;
  if(!src)return 0;
  if(audio.src!==new URL(src,document.baseURI).href&&audio.getAttribute?.('src')!==src)return 0;
  return Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
 }
 function seekTo(time){
  if(!Number.isFinite(time)||activeDuration()<=0)return;
  audio.currentTime=Math.max(0,Math.min(activeDuration()-.15,time-LISTEN_LEAD_IN_SECONDS));
  if(!record.state().playing)void record.play();
  render();
 }
 const headings=['A smaller division','The complementary point','The golden section','A returning division'];
 selectedButtons.forEach((b,i)=>b.addEventListener('click',()=>{
  selectedIndex=i;
  selectedButtons.forEach((other,j)=>other.setAttribute('aria-pressed',String(i===j)));
  answerButtons.forEach(other=>other.setAttribute('aria-pressed','false'));
  answerNote.textContent='A listening question, not a test.';
  update();
 }));
 scoreAction.button.addEventListener('click',()=>{
  const x=comparePhiPositions(record.state().track?.src,
   PHI_LISTENING_MARKERS[selectedIndex].fraction,activeDuration());
  if(x?.score?.verified)seekTo(x.score.time);
 });
 timeAction.button.addEventListener('click',()=>{
  const x=comparePhiPositions(record.state().track?.src,
   PHI_LISTENING_MARKERS[selectedIndex].fraction,activeDuration());
  if(x?.time)seekTo(x.time.time);
 });
 function render(){
  if(disposed)return;
  const fraction=duration>0?Math.max(0,Math.min(1,audio.currentTime/duration)):0;
  const x=left+width*fraction;
  playhead.setAttribute('x1',x);playhead.setAttribute('x2',x);
  elapsed.textContent=duration>0?formatRecordTime(audio.currentTime):'PLAY TO LISTEN';
 }
 function update(){
  if(disposed)return;
  const current=record.state().track,src=current?.src||'';
  if(track!==current){track=current;duration=0;answerButtons.forEach(x=>x.setAttribute('aria-pressed','false'));}
  duration=activeDuration();
  const marker=PHI_LISTENING_MARKERS[selectedIndex],comparison=comparePhiPositions(src,marker.fraction,duration);
  count.textContent=String(selectedIndex+1).padStart(2,'0')+' / 04';
  momentName.textContent=headings[selectedIndex];
  question.textContent=phiListeningQuestion(src,selectedIndex);
  const sc=comparison?.score,tm=comparison?.time;
  scoreAction.button.disabled=!sc?.verified;
  timeAction.button.disabled=!tm;
  scoreAction.timestamp.textContent=sc?formatRecordTime(sc.time):'—:——';
  timeAction.timestamp.textContent=tm?formatRecordTime(tm.time):'—:——';
  scoreAction.detail.textContent=sc?
   'Bar '+sc.withinBar+'/'+sc.scoreBars+(sc.verified?' · 8s lead-in':' · needs review'):'Awaiting score';
  timeAction.detail.textContent=tm?'Elapsed '+marker.label+' · 8s lead-in':'Load the recording first';
  total.textContent=duration>0?formatRecordTime(duration):'—:——';
  const scoreX=sc?left+width*Math.max(0,Math.min(1,sc.time/duration)):left;
  const timeX=left+width*marker.fraction;
  join.setAttribute('x1',scoreX);join.setAttribute('x2',timeX);
  join.setAttribute('visibility',sc&&tm?'visible':'hidden');
  scoreDot.setAttribute('cx',scoreX);scoreDot.setAttribute('visibility',sc?'visible':'hidden');
  timeDot.setAttribute('cx',timeX);timeDot.setAttribute('visibility',tm?'visible':'hidden');
  chart.setAttribute('aria-label',marker.label+' score at '+(sc?formatRecordTime(sc.time):'unknown')+
   ', '+marker.label+' elapsed time at '+(tm?formatRecordTime(tm.time):'unknown')+
   '. Both positions use this recording as the time axis.');
  if(sc&&tm){
   const diff=comparison.gapSeconds;
   difference.textContent=Math.abs(diff)<1?'They nearly coincide':
    'Score '+Math.abs(diff).toFixed(1)+'s '+(diff<0?'earlier':'later');
  }else difference.textContent='Awaiting playback';
  if(provenance.dataset.src!==src){
   provenance.dataset.src=src;
   provenance.innerHTML=src===ASAP_DEBUSSY_SOURCE?
    '<p><strong>Debussy, Reflets dans l’eau.</strong> The selected 2008 performance has 94 <a href="https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau" target="_blank" rel="noopener noreferrer">ASAP-annotated score downbeats</a>. Sub-bar positions are interpolated estimates.</p>'+
    '<p>Performance from <a href="https://magenta.tensorflow.org/datasets/maestro" target="_blank" rel="noopener noreferrer">MAESTRO</a>; score annotations: ASAP (Foscarin et al.). Audio transcoded to Ogg. <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>. Howat’s golden-section interpretation remains debated.</p>':
    '<p><strong>Mozart, K. 545 Allegro.</strong> The original Robin Alciatore performance omits both written repeats. This 73-bar alignment was calculated from the score and checked at major sections against an <a href="https://audiolabs.github.io/trackswitch.js/use-cases/repeated-section/" target="_blank" rel="noopener noreferrer">independent recording alignment</a>; individual bar positions are not externally certified.</p>'+
    '<p>Recording: <a href="https://commons.wikimedia.org/wiki/File:Wolfgang_Amadeus_Mozart_-_sonata_no._16_in_c_major,_k.545_%27sonata_facile%27_-_i._allegro.ogg" target="_blank" rel="noopener noreferrer">Musopen / Wikimedia Commons</a>, public domain. Putz disputes golden-section readings of Mozart.</p>';
  }
  render();
 }
 reveal.addEventListener('click',()=>{
  revealed=!revealed;stage.hidden=!revealed;
  reveal.setAttribute('aria-expanded',String(revealed));
  reveal.textContent=revealed?'Conceal the golden divisions':'Reveal the golden divisions';
  if(revealed)update();
 });
 const events=['loadedmetadata','durationchange','emptied','seeked'];
 for(const event of events)audio.addEventListener(event,update);
 audio.addEventListener('timeupdate',render);
 update();
 return {markers:PHI_LISTENING_MARKERS,update,dispose(){
  disposed=true;for(const event of events)audio.removeEventListener(event,update);
  audio.removeEventListener('timeupdate',render);
  section.remove();css.remove();
 }};
}
