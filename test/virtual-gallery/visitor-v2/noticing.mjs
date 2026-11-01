// Grounded, conversational v2 observations. Each claim is tied to an
// inferred rule or a real work, so the existing Why? proof can explain it.
import {observations,readSettings} from './rules.mjs';
const QUOTE=w=>'“'+String(w?.title||'this work')+'”';
const MATERIAL={marker:'marker',tissue:'tissue and graphite',watercolour:'watercolour',watercolor:'tissue and graphite',oil:'oil paint',action:'action painting'};
const SYSTEM={field:'Orbital / Field',trajectory:'Golden Trajectories',spiral:'Golden Trajectories',rects:'Recursive Divisions',recursive:'Recursive Divisions',burst:'Radiant Systems',network:'Connected Fields',growth:'Growth Systems',organic:'Growth Systems',construct:'Constructed Forms',automatic:'Automatic Marks'};
const mat=w=>MATERIAL[w?.material]||String(w?.material||'another material');
const engine=w=>SYSTEM[w?.engine]||String(w?.engine||'composition');
const voice=(k,lines)=>lines[k?.persona]||lines.regular;
const ORDER={
 regular:['naturalExperiment','phiContrast','airyRoom','roomMaterial','materialTest','mixedMaterials','goldenAngle','verticalRoom','handmade','airy','crowded','tightPhi'],
 sceptic:['naturalExperiment','handmade','materialTest','phiContrast','airyRoom','mixedMaterials','crowded','roomMaterial','goldenAngle','tightPhi','verticalRoom','airy'],
 enthusiast:['phiContrast','tightPhi','goldenAngle','naturalExperiment','materialTest','airyRoom','roomMaterial','handmade','mixedMaterials','verticalRoom','airy','crowded']
};
function describe(f,k){
 const a=f.args[0],b=f.args[1],works=k.works||[];
 switch(f.pred){
  case 'naturalExperiment':
  case 'materialTest':
   if(a?.title&&b?.title&&a.engine===b.engine&&a.material!==b.material)
    return 'Look at '+QUOTE(a)+' alongside '+QUOTE(b)+'. They both use '+engine(a)+', but one is made with '+mat(a)+' and the other with '+mat(b)+'. '+voice(k,{
      enthusiast:'I like how one underlying structure can leave room for two different ways of making marks.',
      sceptic:'It makes me wonder whether the material has more to say than the geometry.',
      regular:'It is hard to decide where the composition ends and the material begins.'});
   break;
  case 'phiContrast':
   if(a?.title&&b?.title){
    const p=readSettings(a).phi,q=readSettings(b).phi;
    if(Number.isFinite(p)&&Number.isFinite(q))
     return 'I keep comparing '+QUOTE(a)+' with '+QUOTE(b)+'. The first has a stronger pull towards φ in its saved settings ('+p+' against '+q+'). '+voice(k,{
      enthusiast:'I am interested in whether that stronger constraint gives the composition more coherence.',
      sceptic:'I am not convinced I could tell which was which without knowing those settings.',
      regular:'I wonder if you can feel that difference before anyone tells you the numbers.'});
   }
   break;
  case 'roomMaterial':
   if(a)return 'Everything in this room uses '+(MATERIAL[a]||a)+'. '+
    (works.length>1?'Put '+QUOTE(works[0])+' beside '+QUOTE(works[1])+': even within one material, there is room for different choices about composition. ':'')+
    voice(k,{enthusiast:'That consistency lets the underlying systems stand out for me.',sceptic:'I look at the decisions in the marks before giving φ the credit.',regular:'It makes it easier to concentrate on how each drawing is organised.'});
   break;
  case 'mixedMaterials':{
   const materials=[...new Set(works.map(mat))];
   if(materials.length>=3)return 'There are several kinds of mark-making together here — '+materials.slice(0,3).join(', ')+'. '+
    voice(k,{enthusiast:'The interesting part is what the proportional system can hold together across those differences.',sceptic:'I find myself noticing the materials before the ratio.',regular:'I keep shifting between the structure of the images and their surfaces.'});
   break;}
  case 'airyRoom':
   return 'At least half of these works have a high negative-space setting, leaving more room around the marks. '+
    voice(k,{enthusiast:'That restraint can make each placed mark more deliberate.',sceptic:'Leaving space is as much a decision as filling it.',regular:'The empty areas seem part of the composition, not just what is left over.'});
  case 'verticalRoom':
   return 'Most of the works here are portrait-shaped. That changes the rhythm of looking around the room — your eye moves up and down, not just along the wall. '+
    voice(k,{enthusiast:'I like how the same proportional ideas can work in a taller frame.',sceptic:'The shape of the surface matters before the mathematics.',regular:'It makes the hang quite different from a row of landscapes.'});
  case 'tightPhi':
   return 'Every work in here has a high φ-pull setting; the mathematical constraint is strong throughout the room. '+
    voice(k,{enthusiast:'I like that shared discipline, even when the marks vary.',sceptic:'I still want to know whether that strength is actually visible.',regular:'I wonder which differences come from the material instead of the shared rule.'});
  case 'goldenAngle':
   if(a?.title)return QUOTE(a)+' catches my attention because '+(a.engine==='spiral'?'its trajectories are organised around the golden angle':'its saved settings emphasise the golden angle')+'. '+
    voice(k,{enthusiast:'That is where mathematics can become a sense of movement.',sceptic:'The rule for turning is interesting, but the marks still have to earn their place.',regular:'I wonder if the movement is apparent without knowing the rule.'});
   break;
  case 'handmade':
   if(a?.title)return 'In '+QUOTE(a)+', the wobble setting introduces a lot of irregularity into the marks. '+
    voice(k,{enthusiast:'For me, that is the tension: precise placement without a rigid line.',sceptic:'That imperfection interests me more than a perfectly obeyed proportion.',regular:'It brings the question of what makes a mark feel human to the surface.'});
   break;
  case 'airy':
   if(a?.title)return QUOTE(a)+' gives its marks more room in the composition settings. '+
    voice(k,{enthusiast:'A few carefully placed gestures can do a lot.',sceptic:'Not every part of the page needs filling.',regular:'There is something interesting about what it leaves alone.'});
   break;
  case 'crowded':
   if(a?.title)return QUOTE(a)+' uses a low negative-space setting, so its composition is more densely occupied. '+
    voice(k,{enthusiast:'That puts more pressure on the underlying order to hold the marks together.',sceptic:'I wonder how much that density owes to the material.',regular:'It is a contrast with the quieter works in the room.'});
   break;
 }
 return null;
}
const equivalent=(a,b)=>['naturalExperiment','materialTest'].includes(a.pred)&&
 ['naturalExperiment','materialTest'].includes(b.pred)&&
 a.args.length>=2&&a.args[0]===b.args[0]&&a.args[1]===b.args[1];
export function visitorNotice(k,state={}){
 const observationsInRoom=observations(k?.memory||{wm:[]}),said=new Set(state.said||[]);
 const ranking=ORDER[k?.persona]||ORDER.regular;
 const candidates=observationsInRoom.filter(f=>!said.has(f.id)).sort((a,b)=>ranking.indexOf(a.pred)-ranking.indexOf(b.pred));
 for(const fact of candidates){
  const text=describe(fact,k);
  if(!text)continue;
  const covered=observationsInRoom.filter(f=>f===fact||equivalent(fact,f)).map(f=>f.id);
  return {text,route:{kind:'rule',fact:fact.id},said:covered};
 }
 const work=k?.works?.[0];
 if(work){
  const base=k.memory?.wm?.find(f=>f.base&&f.pred==='engine'&&f.args[0]===work)||
   k.memory?.wm?.find(f=>f.base&&f.pred==='material'&&f.args[0]===work);
  return {text:'I keep coming back to '+QUOTE(work)+'. Its '+engine(work)+' structure and '+mat(work)+' marks are two different decisions — how much does each contribute to what you see?',
   route:base?{kind:'rule',fact:base.id}:{kind:'noticeContext',context:'work'}};
 }
 return {text:k?.reception?
  'What interests me here is that we meet the building before the pictures. Each floor holds work from a different day, with φ organising the space around it. I wonder how that changes what we expect from the art.':
  'I would rather look carefully than invent a claim about an empty room. There is nothing here I can compare yet.',
  route:{kind:'noticeContext',context:k?.reception?'reception':'empty'}};
}
