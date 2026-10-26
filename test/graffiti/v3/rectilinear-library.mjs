// Block grammar: a new continuous shelf belongs to BOTH neighbouring letters.
// Original geometric structures remain as support until pair-specific cutouts are approved.
export const RECTILINEAR_REVISION='shared-shelves-01';
const pairs=new Set(['PR','RT','TI','ON','IE','PI','OR','PO']);
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296};
export function composeRectilinear(plan,{seed='V3',mode='restrained'}={}){
 const letters=plan.letters.map(l=>({...l,variant:'plain',shapes:[...l.glyph.shapes]})),shared=[];
 if(mode!=='none')for(let i=1;i<letters.length;i++){
  const a=letters[i-1],b=letters[i],pair=a.ch+b.ch;
  if(b.index!==a.index+1||!pairs.has(pair))continue;
  const n=hash(seed+'|block|'+i);
  if(n>(mode==='expressive'?.92:.59))continue;
  const x0=a.x+53,x1=b.x+32;
  if(x1-x0<4||x1-x0>88)continue;
  const shelf=n>.5?43:67;
  // Hard right angles, asymmetric shelf length and a single connecting rail.
  const d=`M ${x0.toFixed(2)} ${shelf} L ${(x0+11).toFixed(2)} ${shelf} L ${(x0+11).toFixed(2)} ${(shelf-12).toFixed(2)} L ${(x1-9).toFixed(2)} ${(shelf-12).toFixed(2)} L ${(x1-9).toFixed(2)} ${shelf} L ${x1.toFixed(2)} ${shelf}`;
  shared.push({kind:'stroke',role:'primary',width:4.4,d,from:a.index,to:b.index,pair,tool:'square-marker',structural:true});
  a.variant='rail-sender';b.variant='rail-receiver';
 }
 return {word:plan.word,letters,shared,connectors:[],mode,revision:RECTILINEAR_REVISION};
}
