// Staging-only controller: the two historical records remain unchanged.
// The third record is an asynchronously prepared 8bars composition.
import {RECEPTION_RECORD} from './gramophone-record.mjs';
import {create8barsGoldenTrack} from './phi-8bars-record.mjs';

export function createPhiTestGramophoneRecord({
  audio=new Audio(),tracks=[...RECEPTION_RECORD,create8barsGoldenTrack()],onChange=()=>{}
}={}){
 let index=0,loaded=false,disposed=false,playing=false,loading=false,problem='',intent=0;
 audio.preload='none';audio.loop=false;
 const state=()=>({index,track:tracks[index],playing,loading,problem});
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
     if(disposed||ticket!==intent){audio.pause();return;}
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
   // The recorded tracks retain their original immediate selection behaviour.
   if(!tracks[index].prepare)select();
   notify();
   if(resume)return play();
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
 return {audio,tracks,state,play,pause,choose,
  toggle:()=>playing||loading?pause():play(),
  dispose(){
    disposed=true;intent++;audio.pause();playing=false;loading=false;
    audio.removeEventListener('ended',ended);audio.removeEventListener('error',failed);
    audio.removeAttribute('src');audio.load();
    for(const track of tracks)track.release?.();
  }
 };
}
