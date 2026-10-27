export const RECEPTION_RECORD=Object.freeze([
 {title:'Reflets dans l’eau',composer:'Claude Debussy',analysis:'Roy Howat',
  src:'https://s9.imslp.org/files/imglnks/usimg/0/0e/IMSLP506786-PMLP07652-Debussy_%2C_Reflets_dans_l%27eau.ogg',
  credit:'Giorgi Latso · recorded by Asuas · 2017 · CC BY-SA 4.0',
  source:'https://commons.wikimedia.org/wiki/File:Debussy_,_Reflets_dans_l%27eau.ogg'}
 {title:'Music for Strings, Percussion and Celesta',composer:'Béla Bartók',analysis:'Ernő Lendvai',
  src:'https://imslp.eu/files/imglnks/euimg/7/74/IMSLP415495-PMLP40552-Bartok_Sz_106_SOSWF_Somogyi_1957.mp3',
  credit:'SWR Sinfonieorchester Baden-Baden und Freiburg · László Somogyi · 1957',
  source:'https://imslp.org/wiki/Music_for_Strings,_Percussion_and_Celesta_(Bart%C3%B3k,_B%C3%A9la)'}
]);
// One media element is the record: track changes never overlap two performances.
export function createGramophoneRecord({audio=new Audio(),tracks=RECEPTION_RECORD,onChange=()=>{}}={}){
 let index=0,loaded=false,disposed=false,playing=false,problem='',intent=0;
 audio.preload='none';audio.loop=false;
 const state=()=>({index,track:tracks[index],playing,problem});
 const notify=()=>onChange(state());
 function select(){audio.src=tracks[index].src;audio.load();loaded=true;}
 async function play(){
  if(disposed)return;const ticket=++intent;problem='';if(!loaded)select();
  try{await audio.play();if(disposed){audio.pause();return;}if(ticket!==intent)return;playing=true;}
  catch(error){playing=false;problem='The recording could not start. Please try again.';}
  notify();
 }
 function pause(){intent++;audio.pause();playing=false;notify();}
 function choose(next){
  if(disposed||!Number.isInteger(next)||next<0||next>=tracks.length)return;
  const resume=playing;intent++;audio.pause();playing=false;problem='';index=next;loaded=false;select();notify();
  if(resume)return play();
 }
 const ended=()=>{if(disposed)return;index=(index+1)%tracks.length;select();play();};
 const failed=()=>{if(disposed)return;loaded=false;playing=false;problem='The recording is unavailable. Please try again.';notify();};
 audio.addEventListener('ended',ended);audio.addEventListener('error',failed);
 return {audio,tracks,state,play,pause,choose,toggle:()=>playing?pause():play(),
  dispose(){disposed=true;audio.pause();playing=false;audio.removeEventListener('ended',ended);audio.removeEventListener('error',failed);audio.removeAttribute('src');audio.load();}
 };
}
