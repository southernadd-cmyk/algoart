// Golden listening study — test tower only. The original audio is never altered.
import {PHI_LISTENING_MARKERS,LISTEN_LEAD_IN_SECONDS,timelineForDuration,formatRecordTime} from './phi-gramophone-timeline.mjs';
import {alignedScorePoint} from './phi-gramophone-score-map.mjs';
import {ASAP_DEBUSSY_SOURCE,ASAP_DEBUSSY_DOWNBEATS,ASAP_DEBUSSY_LAST_BEAT,asapDebussyScorePoint} from './phi-gramophone-asap-debussy.mjs';

export const getScorePoint=(src,fraction,duration)=>src===ASAP_DEBUSSY_SOURCE?
 asapDebussyScorePoint(src,fraction,duration):alignedScorePoint(src,fraction,duration);

export function comparePhiPositions(src,fraction,duration){
 if(!Number.isFinite(duration)||duration<=0)return null;
 const annotated=src===ASAP_DEBUSSY_SOURCE&&!!asapDebussyScorePoint(src,0,duration);
 const start=annotated?ASAP_DEBUSSY_DOWNBEATS[0]:0;
 const end=annotated?ASAP_DEBUSSY_LAST_BEAT:duration;
 const offset=timelineForDuration(end-start,[{fraction}])[0];
 const time={...offset,time:start+offset.time,listenFrom:Math.max(start,start+offset.time-LISTEN_LEAD_IN_SECONDS),start,end};
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
 section.append(el('span','phi-record-overline','02 / CHOOSE A PROPORTION'));
 const ratios=el('div','phi-listen-ratios');ratios.setAttribute('role','group');ratios.setAttribute('aria-label','Select a golden-ratio division');
 const selectedButtons=PHI_LISTENING_MARKERS.map((m,i)=>{
  const b=el('button',null,m.label+(i===2?' · φ':''));b.type='button';b.setAttribute('aria-pressed',String(i===2));ratios.append(b);return b;
 });section.append(ratios);
 const moment=el('div','phi-listen-moment'),momentName=el('h3'),question=el('p','phi-listen-question');moment.append(momentName,question);section.append(moment);
 const figure=el('figure','phi-listen-figure');
 const fighead=el('div','phi-listen-fighead'),elapsed=el('span',null,'LOAD A RECORDING');fighead.append(el('span',null,'ONE FRACTION · TWO POSITIONS'),elapsed);figure.append(fighead);
 const chart=svg('svg',{viewBox:'0 0 420 128',role:'img','aria-label':'Score and clock positions on the recording timeline'}),left=12,width=396;
 for(const y of [34,86])chart.append(svg('line',{x1:left,y1:y,x2:408,y2:y,class:'phi-listen-axis'}));
 const join=svg('line',{x1:left,y1:34,x2:left,y2:86,class:'phi-listen-connection'}),scoreDot=svg('circle',{cx:left,cy:34,r:7,class:'phi-listen-score-dot'}),timeDot=svg('circle',{cx:left,cy:86,r:7,class:'phi-listen-time-dot'}),playhead=svg('line',{x1:left,y1:22,x2:left,y2:102,class:'phi-listen-playhead'});
 for(const [name,y] of [['WRITTEN SCORE',14],['PERFORMANCE CLOCK',119]]){const text=svg('text',{x:left,y,class:'phi-listen-label'});text.textContent=name;chart.append(text);}
 chart.append(join,scoreDot,timeDot,playhead);figure.append(chart);
 const foot=el('figcaption','phi-listen-figfoot'),difference=el('strong',null,'Load the recording to compare');foot.append(difference);figure.append(foot);section.append(figure);
 const actions=el('div','phi-listen-actions');
 function action(name,cls){
  const button=el('button','phi-listen-action '+cls),label=el('span',null,name),timestamp=el('strong',null,'—:——'),detail=el('small');button.type='button';button.append(label,timestamp,detail);actions.append(button);return {button,label,timestamp,detail};
 }
 const scoreAction=action('HEAR THE SCORE','score'),timeAction=action('HEAR THE CLOCK','time');section.append(actions);
 const comparisonNote=el('p','phi-listen-note');comparisonNote.setAttribute('aria-live','polite');section.append(comparisonNote);
 section.append(el('p','phi-listen-instruction','Each button starts 8 seconds before its position. Listen for a change of texture, an arrival, or simply the music continuing.'));
 const sources=el('details','phi-listen-sources');sources.append(el('summary',null,'How this is measured'));
 const provenance=el('div');sources.append(provenance);section.append(sources);
 panel.append(section);
 let selectedIndex=2,track=null,duration=0,disposed=false;
 function activeDuration(){
  const src=record.state().track?.src;if(!src)return 0;
  if(audio.src!==new URL(src,document.baseURI).href&&audio.getAttribute?.('src')!==src)return 0;
  return Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
 }
 function seekTo(time){
  if(!Number.isFinite(time)||activeDuration()<=0)return;
  audio.currentTime=Math.max(0,Math.min(activeDuration()-.15,time-LISTEN_LEAD_IN_SECONDS));
  if(!record.state().playing)void record.play();render();
 }
 const headings=['A smaller division','The complementary point','The golden section','A returning division'];
 selectedButtons.forEach((b,i)=>b.addEventListener('click',()=>{selectedIndex=i;update();}));
 scoreAction.button.addEventListener('click',()=>{
  const x=comparePhiPositions(record.state().track?.src,PHI_LISTENING_MARKERS[selectedIndex].fraction,activeDuration());if(x?.score?.verified)seekTo(x.score.time);
 });
 timeAction.button.addEventListener('click',()=>{
  const x=comparePhiPositions(record.state().track?.src,PHI_LISTENING_MARKERS[selectedIndex].fraction,activeDuration());if(x?.time)seekTo(x.time.time);
 });
 function render(){
  if(disposed)return;
  const fraction=duration>0?Math.max(0,Math.min(1,audio.currentTime/duration)):0,x=left+width*fraction;
  playhead.setAttribute('x1',x);playhead.setAttribute('x2',x);
  elapsed.textContent=duration>0?formatRecordTime(audio.currentTime)+' / '+formatRecordTime(duration):'LOAD A RECORDING';
 }
 function update(){
  if(disposed)return;
  const current=record.state().track,src=current?.src||'';if(track!==current)track=current;
  duration=activeDuration();
  const marker=PHI_LISTENING_MARKERS[selectedIndex],comparison=comparePhiPositions(src,marker.fraction,duration),sc=comparison?.score,tm=comparison?.time;
  const same=!!sc?.verified&&!!tm&&Math.abs(comparison.gapSeconds)<2;
  selectedButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedIndex)));
  momentName.textContent=headings[selectedIndex];question.textContent=phiListeningQuestion(src,selectedIndex);
  scoreAction.button.disabled=!sc?.verified;timeAction.button.disabled=!tm;
  scoreAction.label.textContent=same?'HEAR THIS MOMENT':'HEAR THE SCORE';timeAction.button.hidden=same;actions.classList.toggle('single',same);
  scoreAction.timestamp.textContent=sc?formatRecordTime(sc.time):'—:——';timeAction.timestamp.textContent=tm?formatRecordTime(tm.time):'—:——';
  scoreAction.detail.textContent=sc?'After '+sc.completedBars.toFixed(1)+' of '+sc.scoreBars+' bars'+(sc.verified?'':' · needs review'):'Play the recording to load its position';
  timeAction.detail.textContent=tm?marker.label+(src===ASAP_DEBUSSY_SOURCE?' of annotated performance':' of recording time'):'Play the recording to load its position';
  const scoreX=sc?left+width*sc.time/duration:left,timeX=tm?left+width*tm.time/duration:left;
  join.setAttribute('x1',scoreX);join.setAttribute('x2',timeX);join.setAttribute('visibility',sc&&tm?'visible':'hidden');
  scoreDot.setAttribute('cx',scoreX);scoreDot.setAttribute('visibility',sc?'visible':'hidden');timeDot.setAttribute('cx',timeX);timeDot.setAttribute('visibility',tm?'visible':'hidden');
  chart.setAttribute('aria-label',marker.label+' score at '+(sc?formatRecordTime(sc.time):'unknown')+', clock at '+(tm?formatRecordTime(tm.time):'unknown')+'. Both use file time.');
  if(sc&&tm){
   const gap=Math.abs(comparison.gapSeconds).toFixed(1);
   difference.textContent=same?'Only '+gap+'s apart':gap+'s apart · score '+(comparison.gapSeconds<0?'earlier':'later');
   comparisonNote.textContent=same?'These positions lead to essentially the same passage, so there is one listening button.':
    'The same fraction lands in two different places. Listen to either position, then compare.';
  }else{difference.textContent='Play the recording to load the comparison';comparisonNote.textContent='Choose a recording on the left, then press Play recording.';}
  if(provenance.dataset.src!==src){
   provenance.dataset.src=src;
   provenance.innerHTML=src===ASAP_DEBUSSY_SOURCE?
    '<p>The score has 94 bars. Positions use <a href="https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau" target="_blank" rel="noopener noreferrer">ASAP-annotated score downbeats</a> for this exact performance. Sub-bar positions are interpolated estimates.</p><p>The clock spans the first downbeat (0.9s) to the last annotated beat (281.2s), excluding the file lead-in and tail. This is an annotation boundary, not the end of the piano’s resonance.</p><p>Audio: <a href="https://magenta.tensorflow.org/datasets/maestro" target="_blank" rel="noopener noreferrer">MAESTRO</a>. Score annotations: ASAP, Foscarin et al. <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>.</p>':
    '<p>Mozart’s 73 written bars are counted once; this Robin Alciatore performance omits both repeats. Our score-to-audio analysis is <a href="https://audiolabs.github.io/trackswitch.js/use-cases/repeated-section/" target="_blank" rel="noopener noreferrer">independently checked at major sections</a>; individual bar positions are not externally certified. The clock uses the full recording.</p><p>Recording: <a href="https://commons.wikimedia.org/wiki/File:Wolfgang_Amadeus_Mozart_-_sonata_no._16_in_c_major,_k.545_%27sonata_facile%27_-_i._allegro.ogg" target="_blank" rel="noopener noreferrer">Musopen / Wikimedia Commons</a>, public domain.</p>';
   provenance.append(el('p',null,'No audio cues are added. A proportion is a listening prompt, not proof of a composer’s intention. Howat’s Debussy interpretation is debated; Putz disputes golden-section readings of Mozart.'));
  }
  render();
 }
 const events=['loadedmetadata','durationchange','emptied','seeked'];for(const event of events)audio.addEventListener(event,update);audio.addEventListener('timeupdate',render);update();
 return {markers:PHI_LISTENING_MARKERS,update,dispose(){disposed=true;for(const event of events)audio.removeEventListener(event,update);audio.removeEventListener('timeupdate',render);section.remove();}};
}
