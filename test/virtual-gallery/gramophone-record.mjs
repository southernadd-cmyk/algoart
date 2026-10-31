export const RECEPTION_RECORD=Object.freeze([
 {title:'Reflets dans l’eau',composer:'Claude Debussy',analysis:'Roy Howat',
  src:'./audio/debussy-reflets-dans-leau.ogg',
  credit:'Giorgi Latso · recorded by Asuas · 2017 · CC BY-SA 4.0',
  source:'https://commons.wikimedia.org/wiki/File:Debussy_,_Reflets_dans_l%27eau.ogg'},
 {title:'Piano Sonata No. 16 in C major, K. 545 — I. Allegro',composer:'Wolfgang Amadeus Mozart',analysis:'John F. Putz',
  src:'./audio/mozart-k545-allegro.ogg',
  credit:'Musopen · public-domain recording · worldwide use',
  source:'https://commons.wikimedia.org/wiki/File:Wolfgang_Amadeus_Mozart_-_sonata_no._16_in_c_major,_k.545_%27sonata_facile%27_-_i._allegro.ogg'}
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
