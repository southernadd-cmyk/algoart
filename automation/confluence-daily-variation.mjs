// Only the NEW daily-gallery Confluence studies use this complete seeded plan.
// Confluence's editor defaults, imported leads, and already archived shares stay
// exactly as they were. Every parameter comes from the study's immutable seed.
import {makeGoldenRoster} from '../confluence/golden-roster.js';

export const DAILY_VARIATION_START='2026-11-11';
function fraction(seed,label){
  const value=String(seed)+'|daily-confluence-v2|'+label;
  let h=2166136261;
  for(let i=0;i<value.length;i++){
    h^=value.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0)/4294967296;
}
function integer(seed,key,min,max){
  return min+Math.floor(fraction(seed,key)*(max-min+1));
}

export function makeDailyConfluencePlan(date,seed,catalog){
  const original=makeGoldenRoster(seed,catalog);
  if(date<DAILY_VARIATION_START){
    // 9–10 November's published state must remain byte-for-byte reproducible.
    return {artists:original,grain:11,strength:76,collaborationPull:100,leadIndex:0};
  }
  const artists=original.map((artist,index)=>{
    const range=(key,min,max)=>integer(seed,'artist-'+index+'-'+key,min,max);
    return {...artist,settings:{
      ...artist.settings,
      // Existing golden roster already varies elements, scale, bend, negative
      // space, phi, golden angle, wobble and colour parameters independently.
      recursion:range('recursion',2,7),
      spiralInfluence:range('spiralInfluence',42,95),
      nesting:range('nesting',16,68),
      thickness:range('thickness',4,16),
      overdraw:range('overdraw',1,3),
      opacity:range('opacity',65,94),
      pressure:range('pressure',26,69),
      dryness:range('dryness',5,31),
      curveBias:range('curveBias',26,78),
      shapeAmount:range('shapeAmount',40,86),
      overlap:range('overlap',31,76),
      rotation:range('rotation',34,94)
      // Keep each system's own pen and shape primitives: those describe its
      // drawing vocabulary and should not be disabled by a random preset.
    }};
  });
  return {
    artists,
    grain:integer(seed,'paper-grain',7,21),
    strength:integer(seed,'shared-strength',65,88),
    collaborationPull:integer(seed,'collaboration-pull',78,100),
    leadIndex:integer(seed,'starting-artist',0,2)
  };
}
