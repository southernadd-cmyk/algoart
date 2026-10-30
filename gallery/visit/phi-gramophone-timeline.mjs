import {ASAP_DEBUSSY_SOURCE} from './phi-gramophone-asap-debussy.mjs';
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
