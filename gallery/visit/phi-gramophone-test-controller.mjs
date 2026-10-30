// Staging-only gramophone controller. Historical records stay intact.
// The third record is an on-demand 8bars study; visitors can replace it.
import {RECEPTION_RECORD} from './gramophone-record.mjs?v=selectable-tracks-20261027';
import {GOLDEN_STUDY,create8barsGoldenTrack} from './phi-8bars-record.mjs';

export function createPhiTestGramophoneRecord({
  audio=new Audio(),
  tracks=[...RECEPTION_RECORD,create8barsGoldenTrack()],
  makeGoldenTrack=(seed,edition)=>create8barsGoldenTrack({seed,edition}),
  onChange=()=>{}
}={}){
 let index=0,loaded=false,disposed=false,playing=false,loading=false,problem='',intent=0;
 let edition=tracks[2]?.edition||1;
 audio.preload='none';audio.loop=false;
 const state=()=>({index,track:tracks[index],playing,loading,problem,edition});
 const notify=()=>onChange(state());
 function select(){
   audio.loop=!!tracks[index].repeat;
   audio.src=tracks[index].src;audio.load();loaded=true;
 }
 async function play(){
   if(disposed)return;
   const ticket=++intent;
   problem='';
   try{
     if(tracks[index].prepare&&!loaded){
       loading=true;notify();
       await tracks[index].prepare();
       if(disposed||ticket!==intent)return;
     }
     if(!loaded)select();
     loading=false;notify();
     await audio.play();
     if(disposed){audio.pause();return;}
     if(ticket!==intent)return;
     playing=true;
   }catch(error){
     if(disposed||ticket!==intent)return;
     playing=false;problem=error?.message||'Could not start the recording';
   }
   loading=false;notify();
 }
 function pause(){intent++;audio.pause();playing=false;loading=false;notify();}
 function choose(next){
   if(disposed||!Number.isInteger(next)||next<0||next>=tracks.length)return;
   const resume=playing;
   intent++;audio.pause();playing=false;loading=false;problem='';index=next;loaded=false;
   if(!tracks[index].prepare)select();
   notify();
   if(resume)return play();
 }
 // User interaction replaces only slot 3, never the Debussy/Mozart recordings.
 // A pending composition may finish after replacement but cannot start playback.
 function composeAnother(){
   if(disposed||tracks.length!==RECEPTION_RECORD.length+1||loading)return;
   const nextEdition=edition+1;
   const seed=GOLDEN_STUDY.seed+'-variation-'+nextEdition;
   const fresh=makeGoldenTrack(seed,nextEdition);
   if(!fresh?.prepare||!fresh.goldenStudy)throw Error('Expected an 8bars study');
   const old=tracks[2];
   intent++;audio.pause();playing=false;loading=false;loaded=false;problem='';
   audio.removeAttribute('src');audio.loop=false;audio.load();
   tracks[2]=fresh;edition=nextEdition;index=2;
   old.release?.();
   notify();
   return play();
 }
 function ended(){
   if(disposed)return;
   index=tracks[index].repeat?index:(index+1)%RECEPTION_RECORD.length;
   loaded=false;
   if(!tracks[index].prepare)select();
   void play();
 }
 const failed=()=>{
   if(disposed)return;
   loaded=false;playing=false;loading=false;problem='The recording is unavailable. Please try again.';
   notify();
 };
 audio.addEventListener('ended',ended);audio.addEventListener('error',failed);
 return {audio,tracks,state,play,pause,choose,composeAnother,
  toggle:()=>playing||loading?pause():play(),
  dispose(){
    disposed=true;intent++;audio.pause();playing=false;loading=false;
    audio.removeEventListener('ended',ended);audio.removeEventListener('error',failed);
    audio.removeAttribute('src');audio.load();
    for(const track of tracks)track.release?.();
  }
 };
}
