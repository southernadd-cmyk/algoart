// Approved for tower release: nine independently authored complete alphabets.
// Source reference sheets remain research-only; new tags use their original
// procedural glyph geometry, not the archived 50 generic writer masks.
import {makeRandom} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {TOWER_LETTERING_REVISION} from './tower-family-lettering.mjs';
export const TOWER_HANDS=Object.freeze(['A','B','C','D','E','F','G','H','I']);
export function pickTowerHand(random){return TOWER_HANDS[Math.floor(random.n()*TOWER_HANDS.length)];}
export function towerHandCycle(key){
 const options=[...TOWER_HANDS],random=makeRandom(key+'|'+TOWER_LETTERING_REVISION);
 for(let i=options.length-1;i>0;i--){const j=Math.floor(random.n()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
 return options;
}
export function towerTagSlot({floorId,seed,slot=0,hand,ink}){
 const id=String(seed)+'|floor|'+String(floorId)+'|'+slot;
 const generatedSeed=String(seed)+'|floor|'+String(floorId)+'|tag|'+slot;
 const random=makeRandom(generatedSeed);
 const palette=['#232725','#342731','#2c3643','#4d4e40','#6b3f3c','#315c66'];
 return {id,floorId:String(floorId),slot,seed:generatedSeed,hand:hand||pickTowerHand(random),ink:ink||random.pick(palette),form:'handstyle'};
}
