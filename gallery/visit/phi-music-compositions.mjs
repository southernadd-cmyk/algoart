// Original, dependency-free phi-governed sound studies for PROPORTION PIECE.
// No external samples, recordings or remote fetches. Nothing runs before Play.
export const PHI=(1+Math.sqrt(5))/2;
export const GOLDEN_TURN=1/(PHI*PHI); // 137.50776 degrees as a fraction of a turn

export const PHI_COMPOSITIONS=Object.freeze([
 Object.freeze({
  title:'Phi Resonance',composer:'PROPORTION PIECE · original',
  credit:'Original browser-synthesised study · frequencies related by φ (1.618…) · no sampled recordings',
  explanation:'The pitches are separated by powers of φ rather than conventional octaves. This is an original study, not John Chowning’s Stria.',
  seconds:96
 }),
 Object.freeze({
  title:'Golden Trajectory',composer:'PROPORTION PIECE · original',
  credit:'Original browser-synthesised study · each new pitch is selected by the golden angle (137.5°)',
  explanation:'Each musical event advances by one golden-angle turn through a pentatonic pitch field; the spacing of events alternates between durations related by φ.',
  seconds:104
 }),
 Object.freeze({
  title:'Recursive Divisions',composer:'PROPORTION PIECE · original',
  credit:'Original browser-synthesised study · musical spans recursively divided at 61.8% / 38.2%',
  explanation:'Every phrase is divided recursively using the golden ratio. The resulting events determine the rhythm; harmony is chosen independently by ear.',
  seconds:104
 })
]);

function note(at,hz,dur,vel=0.1,wave='sine'){
 return {at,hz,dur,vel,wave};
}
function phiResonance(){
 const events=[],seq=[0,1,3,2,4,3,1,2,0,2,3,1,4];
 let t=0,i=0;
 while(t<95){
  const step=seq[i%seq.length];
  // Frequency ratios are exact powers of phi, never rounded to equal-tempered semitones.
  const hz=110*Math.pow(PHI,step-0.5);
  const dur=0.56*Math.pow(PHI,1+(i%3)*0.382);
  events.push(note(t,hz,Math.min(3.1,dur),0.083,i%4===0?'triangle':'sine'));
  if(i%5===0)events.push(note(t,110/PHI,Math.min(6.2,dur*PHI*2),0.055));
  if(i%8===3)events.push(note(t+0.25,hz*PHI,Math.min(2.5,dur),0.036));
  t+=0.52*Math.pow(PHI,(i%4)/3);
  i++;
 }
 return events;
}
function goldenTrajectory(){
 const events=[],degrees=[0,2,4,7,9,12,14,16,19,21];
 const base=174.614; // F3
 let t=0;
 for(let i=0;t<103;i++){
  const fraction=(i*GOLDEN_TURN)%1;
  const degree=degrees[Math.floor(fraction*degrees.length)];
  const hz=base*Math.pow(2,degree/12);
  const length=i%8===0?2.1:0.54*PHI;
  events.push(note(t,hz,length,i%8===0?0.10:0.065,'sine'));
  if(i%13===0){
   events.push(note(t,base/2,4.1,0.045,'triangle'));
   events.push(note(t+0.25,base*1.5,2.9,0.032));
  }
  t+=i%2===0?0.47:0.47*PHI;
 }
 return events;
}
function recursiveDivisions(){
 const events=[],pitches=[0,3,5,7,10,12,15,17],base=130.813; // C3
 const phrase=20.8;
 function divide(start,len,depth,branch){
  if(len<=1.22||depth>=7){
   const degree=pitches[(branch*3+depth)%pitches.length];
   events.push(note(start,base*Math.pow(2,degree/12),Math.min(2.8,len*1.5),0.055+(depth%3)*0.009,depth%3===0?'triangle':'sine'));
   return;
  }
  const long=len/PHI,short=len-long;
  divide(start,long,depth+1,branch*2);
  divide(start+long,short,depth+1,branch*2+1);
 }
 for(let cycle=0;cycle<5;cycle++){
  const start=cycle*phrase;
  divide(start,phrase,0,cycle+1);
  // A quiet drone marks the parent span, independent from the recursive accents.
  events.push(note(start,base/2,6.8,0.046,'sine'));
  events.push(note(start+phrase/PHI,base,4.3,0.043,'sine'));
 }
 return events;
}
const BUILDERS=[phiResonance,goldenTrajectory,recursiveDivisions];
export function phiCompositionEvents(index){
 if(!Number.isInteger(index)||index<0||index>=BUILDERS.length)throw new RangeError('Unknown phi composition');
 return BUILDERS[index]().sort((a,b)=>a.at-b.at);
}

// On-demand synthesis. ~two oscillators at a time; no music data is downloaded.
// A small scheduler avoids long-running audio work on the gallery render thread.
export function createPhiCompositionPlayer({AudioContextType=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
 let context=null,timer=null,master=null,playing=false,active=new Set();
 let outputVolume=0.18;
 function setVolume(value){
  outputVolume=Math.min(0.4,Math.max(0,Number(value)||0));
  if(master&&context)master.gain.setTargetAtTime(outputVolume*0.5,context.currentTime,0.025);
 }
 function stop(){
  playing=false;
  if(timer!==null){clearInterval(timer);timer=null;}
  for(const osc of active){try{osc.stop();}catch{}}
  active.clear();
  const old=context;context=null;master=null;
  if(old){try{old.close().catch(()=>{});}catch{}}
 }
 function schedule(ctx,bus,e,at){
  const osc=ctx.createOscillator(),envelope=ctx.createGain();
  osc.type=e.wave;
  osc.frequency.setValueAtTime(e.hz,at);
  const attack=Math.min(0.1,e.dur/5),release=Math.min(0.5,e.dur/3);
  envelope.gain.setValueAtTime(0,at);
  envelope.gain.linearRampToValueAtTime(e.vel,at+attack);
  envelope.gain.setValueAtTime(e.vel,at+Math.max(attack,e.dur-release));
  envelope.gain.linearRampToValueAtTime(0.0001,at+e.dur);
  osc.connect(envelope);envelope.connect(bus);
  osc.onended=()=>{active.delete(osc);osc.disconnect();envelope.disconnect();};
  active.add(osc);osc.start(at);osc.stop(at+e.dur+0.02);
 }
 async function play(index,value=outputVolume){
  if(!AudioContextType)throw new Error('Web Audio is unavailable in this browser');
  if(index<0||index>=PHI_COMPOSITIONS.length)throw new RangeError('Unknown phi composition');
  stop();setVolume(value);
  const ctx=new AudioContextType();context=ctx;
  const bus=ctx.createGain(),delay=ctx.createDelay(1),feedback=ctx.createGain(),wet=ctx.createGain();
  master=ctx.createGain();master.gain.value=outputVolume*0.5;
  bus.connect(master);bus.connect(delay);
  delay.delayTime.value=1/(PHI*PHI);
  delay.connect(wet);wet.gain.value=0.14;wet.connect(master);
  delay.connect(feedback);feedback.gain.value=0.16;feedback.connect(delay);
  master.connect(ctx.destination);
  const events=phiCompositionEvents(index),seconds=PHI_COMPOSITIONS[index].seconds;
  const startAt=ctx.currentTime+0.07;
  let eventIndex=0,cycle=0;
  function pump(){
   if(context!==ctx)return;
   const horizon=ctx.currentTime+0.42;
   // Always schedule fewer than a second ahead, even across loop boundaries.
   let count=0;
   while(count++<30){
    const e=events[eventIndex],at=startAt+cycle*seconds+e.at;
    if(at>horizon)break;
    if(at>ctx.currentTime-0.03)schedule(ctx,bus,e,Math.max(at,ctx.currentTime+0.005));
    eventIndex++;
    if(eventIndex===events.length){eventIndex=0;cycle++;}
   }
  }
  try{
   await ctx.resume();
   if(context!==ctx)return;
   playing=true;pump();timer=setInterval(pump,125);
  }catch(error){stop();throw error;}
 }
 return {play,stop,setVolume,get playing(){return playing;},dispose:stop};
}
