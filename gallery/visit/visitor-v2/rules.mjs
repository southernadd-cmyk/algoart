// Forward chaining over a room. Base facts come from each work's settings
// (its share link); production rules fire until nothing new can be derived.
// Every derived fact keeps its justification — the rule and the facts it
// came from — so a visitor can answer "why?" with a proof, not a guess.

const MATERIAL_NAMES={marker:'marker',tissue:'tissue and graphite',watercolour:'watercolour',watercolor:'tissue and graphite',
 oil:'oil',action:'action painting'};
const matName=m=>MATERIAL_NAMES[m]||m;
const t=w=>'“'+w.title+'”';

/** Settings live in each work's share link; the room plan supplies the rest. */
export function readSettings(w){
 let q=new URLSearchParams();
 try{q=new URL(w.href||'','https://x.invalid/').searchParams;}catch{}
 const n=key=>q.has(key)&&q.get(key)!==''?Number(q.get(key)):NaN;
 return {
  phi:Number.isFinite(w.phi)?w.phi:n('phi'),
  neg:Number.isFinite(w.neg)?w.neg:n('neg'),
  wob:Number.isFinite(w.wob)?w.wob:n('wob'),
  ga:Number.isFinite(w.ga)?w.ga:n('ga'),
  den:Number.isFinite(w.den)?w.den:n('den')
 };
}

function baseFacts(works){
 const facts=[];
 const add=(pred,args,text,source)=>facts.push({pred,args,text,why:{source}});
 for(const w of works){
  const s=readSettings(w),m=w.material==='watercolor'?'tissue':w.material;
  add('work',[w],t(w)+' hangs in this room','the curator’s plan for this room');
  if(m)add('material',[w,m],t(w)+' is '+matName(m),'its material setting');
  if(w.engine)add('engine',[w,w.engine],t(w)+' uses the “'+w.engine+'” composition system','its mode setting');
  if(Number.isFinite(s.phi))add('phi',[w,s.phi],t(w)+' has a φ pull of '+s.phi,'the phi value in its share link');
  if(Number.isFinite(s.neg))add('neg',[w,s.neg],t(w)+' has negative space at '+s.neg,'the neg value in its share link');
  if(Number.isFinite(s.wob))add('wob',[w,s.wob],t(w)+' has wobble at '+s.wob,'the wob value in its share link');
  if(Number.isFinite(s.ga))add('ga',[w,s.ga],t(w)+' has its golden-angle setting at '+s.ga,'the ga value in its share link');
  if(w.portrait)add('portrait',[w],t(w)+' is portrait format','its image shape');
  if(w.sculpture)add('sculpture',[w],t(w)+' is shown as a sculpture','the curator’s plan for this room');
 }
 return facts;
}
const all=(wm,pred)=>wm.filter(f=>f.pred===pred);
const one=(wm,pred,w)=>wm.find(f=>f.pred===pred&&f.args[0]===w);

// Each rule: id, plain-English name, optional persona, and when(), which
// returns new facts as {pred,args,text,from:[facts],kind?}.
export const RULES=[
 {id:'one-material',name:'If every work in a room shares a material, the room is about that material',
  when:wm=>{const ms=all(wm,'material');const set=new Set(ms.map(f=>f.args[1]));
   return ms.length>=2&&set.size===1?[{pred:'roomMaterial',args:[ms[0].args[1]],text:'everything in this room is '+matName(ms[0].args[1]),from:ms}]:[];}},
 {id:'mixed-materials',name:'If a room has three or more materials, it is a room of contrasts',
  when:wm=>{const ms=all(wm,'material');const set=new Set(ms.map(f=>f.args[1]));
   return set.size>=3?[{pred:'mixedMaterials',args:[set.size],text:'this room mixes '+set.size+' materials',from:ms}]:[];}},
 {id:'natural-experiment',name:'If two works share a composition system but not a material, they are a natural experiment',
  when:wm=>{const out=[],es=all(wm,'engine');
   for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++){
    const a=es[i].args[0],b=es[j].args[0];
    if(es[i].args[1]!==es[j].args[1])continue;
    const ma=one(wm,'material',a),mb=one(wm,'material',b);
    if(ma&&mb&&ma.args[1]!==mb.args[1])out.push({pred:'naturalExperiment',args:[a,b],
     text:t(a)+' and '+t(b)+' share a composition system but not a material — a natural experiment',from:[es[i],es[j],ma,mb]});
   }
   return out.slice(0,2);}},
 {id:'phi-contrast',name:'If φ pull varies by 8 or more across a room, compare the highest and lowest',
  when:wm=>{const ps=all(wm,'phi');if(ps.length<2)return [];
   const sorted=[...ps].sort((a,b)=>b.args[1]-a.args[1]),hi=sorted[0],lo=sorted.at(-1);
   return hi.args[1]-lo.args[1]>=8?[{pred:'phiContrast',args:[hi.args[0],lo.args[0]],
    text:t(hi.args[0])+' has the most φ pull in here ('+hi.args[1]+') and '+t(lo.args[0])+' the least ('+lo.args[1]+')',from:[hi,lo]}]:[];}},
 {id:'tight-phi',name:'If every work in a room has φ pull of 90 or more, the room is held tightly by φ',
  when:wm=>{const ps=all(wm,'phi');
   return ps.length>=2&&ps.every(f=>f.args[1]>=90)?[{pred:'tightPhi',args:[],text:'every work in here has its φ pull at 90 or more',from:ps}]:[];}},
 {id:'airy',name:'If negative space is 32 or more, the work is airy',
  when:wm=>all(wm,'neg').filter(f=>f.args[1]>=32).map(f=>({pred:'airy',args:[f.args[0]],text:t(f.args[0])+' leaves a lot of empty space',from:[f]}))},
 {id:'crowded',name:'If negative space is 20 or less, the work is crowded',
  when:wm=>all(wm,'neg').filter(f=>f.args[1]<=20).map(f=>({pred:'crowded',args:[f.args[0]],text:t(f.args[0])+' fills most of its page',from:[f]}))},
 {id:'airy-room',name:'If at least half the works are airy, the room is airy',
  when:wm=>{const ws=all(wm,'work'),airy=all(wm,'airy');
   return ws.length>=2&&airy.length*2>=ws.length?[{pred:'airyRoom',args:[],text:'most of the work in here is sparse — lots of empty page',from:airy}]:[];}},
 {id:'handmade',name:'If wobble is 50 or more, the marks look handmade',
  when:wm=>all(wm,'wob').filter(f=>f.args[1]>=50).map(f=>({pred:'handmade',args:[f.args[0]],text:t(f.args[0])+' has very wobbly, handmade-looking marks',from:[f]}))},
 {id:'golden-angle',name:'If a work follows Golden Trajectories or its golden-angle setting is 90+, it leans on the golden angle',
  when:wm=>{const out=[];
   for(const f of all(wm,'engine'))if(f.args[1]==='spiral')out.push({pred:'goldenAngle',args:[f.args[0]],text:t(f.args[0])+' is built on curves from the golden angle',from:[f]});
   for(const f of all(wm,'ga'))if(f.args[1]>=90&&!out.some(o=>o.args[0]===f.args[0]))out.push({pred:'goldenAngle',args:[f.args[0]],text:t(f.args[0])+' has its golden-angle setting turned right up',from:[f]});
   return out;}},
 {id:'vertical-room',name:'If most works are portrait format, the room reads vertically',
  when:wm=>{const ws=all(wm,'work'),ps=all(wm,'portrait');
   return ws.length>=2&&ps.length*2>ws.length?[{pred:'verticalRoom',args:[],text:'most of the work in here is portrait format',from:ps}]:[];}},
 // Second-order rule: an experiment worth doing.
 {id:'material-test',name:'A natural experiment tests whether material matters more than φ',
  when:wm=>all(wm,'naturalExperiment').slice(0,1).map(f=>({pred:'materialTest',args:f.args,
   text:'comparing '+t(f.args[0])+' with '+t(f.args[1])+' is a fair test of whether the material matters more than φ',from:[f]}))},
 // Temperament rules: only that kind of visitor holds these opinions.
 {id:'enthusiast-tight',persona:'enthusiast',name:'An enthusiast admires a room held tightly by φ',
  when:wm=>all(wm,'tightPhi').map(f=>({pred:'opinion',args:['room'],kind:'opinion',text:'I love this room — it’s φ all the way through and it holds together',from:[f]}))},
 {id:'enthusiast-prefers',persona:'enthusiast',name:'An enthusiast prefers the work with the most φ pull',
  when:wm=>all(wm,'phiContrast').map(f=>({pred:'favourite',args:[f.args[0]],kind:'opinion',text:'my favourite is '+t(f.args[0])+' — it has the most φ in the room',from:[f]}))},
 {id:'sceptic-material',persona:'sceptic',name:'A sceptic takes a natural experiment as evidence for the material',
  when:wm=>all(wm,'naturalExperiment').slice(0,1).map(f=>({pred:'opinion',args:['material'],kind:'opinion',
   text:'look at '+t(f.args[0])+' and '+t(f.args[1])+': same system, different material, and they feel completely different. That’s the material, not φ',from:[f]}))},
 {id:'sceptic-prefers',persona:'sceptic',name:'A sceptic prefers the most handmade-looking work',
  when:wm=>{const h=all(wm,'handmade').sort((a,b)=>(one(wm,'wob',b.args[0])?.args[1]||0)-(one(wm,'wob',a.args[0])?.args[1]||0));
   return h.length?[{pred:'favourite',args:[h[0].args[0]],kind:'opinion',text:'my favourite is '+t(h[0].args[0])+' — the wobble makes it look human',from:[h[0]]}]:[];}},
 {id:'regular-compare',persona:'regular',name:'A regular suggests comparing the highest and lowest φ',
  when:wm=>all(wm,'phiContrast').map(f=>({pred:'opinion',args:['compare'],kind:'opinion',
   text:'stand between '+t(f.args[0])+' and '+t(f.args[1])+' — one has more φ than the other. I can never decide whether I can see it',from:[f]}))},
 {id:'regular-airy',persona:'regular',name:'A regular likes a sparse room',
  when:wm=>all(wm,'airyRoom').map(f=>({pred:'opinion',args:['airy'],kind:'opinion',text:'I like how quiet this room is. The empty space is part of it',from:[f]}))}
];

const key=f=>f.pred+':'+f.args.map(a=>a?.title??a).join('|');

/** Run rules to a fixpoint. Returns working memory and the order rules fired. */
export function infer(works,persona){
 const wm=baseFacts(works);
 wm.forEach((f,i)=>{f.id='f'+i;f.base=true;});
 const seen=new Set(wm.map(key)),fired=[];
 let changed=true,cycle=0;
 while(changed&&cycle++<10){
  changed=false;
  for(const rule of RULES){
   if(rule.persona&&rule.persona!==persona)continue;
   for(const f of rule.when(wm)){
    if(seen.has(key(f)))continue;
    if(f.pred==='favourite'&&wm.some(x=>x.pred==='favourite'))continue;
    seen.add(key(f));
    const fact={...f,id:'f'+wm.length,why:{rule,from:f.from}};delete fact.from;
    wm.push(fact);fired.push({rule:rule.id,fact:fact.id,cycle});changed=true;
   }
  }
 }
 return {wm,fired};
}

// Which derived facts make good things to point out, best first.
const NOTABLE=['materialTest','naturalExperiment','phiContrast','roomMaterial','tightPhi','mixedMaterials','airyRoom','verticalRoom','goldenAngle','handmade','airy','crowded'];
export function observations(memory){
 return memory.wm.filter(f=>!f.base&&f.kind!=='opinion').sort((a,b)=>NOTABLE.indexOf(a.pred)-NOTABLE.indexOf(b.pred));
}
export const opinions=memory=>memory.wm.filter(f=>f.kind==='opinion');
export const favouriteFact=memory=>memory.wm.find(f=>f.pred==='favourite')||null;

const cap=s=>s[0].toUpperCase()+s.slice(1);
/** Proof of a fact. depth 1: its premises. depth 2: the rule and the whole chain. */
export function proof(fact,depth=1){
 if(!fact)return '';
 if(fact.base)return cap(fact.text)+' — that’s '+fact.why.source+'.';
 const premises=fact.why.from||[];
 if(depth<=1)return 'Because '+premises.slice(0,4).map(p=>p.text).join(', and ')+(premises.length>4?', and more':'')+'.';
 const lines=['My rule: “'+fact.why.rule.name+'.”'];
 const walk=(f,indent)=>{
  for(const p of f.why.from||[]){
   if(p.base)lines.push(indent+cap(p.text)+' ('+p.why.source+').');
   else{lines.push(indent+cap(p.text)+', from the rule “'+p.why.rule.name+'”:');walk(p,indent+'  ');}
  }
 };
 walk(fact,'');
 return lines.slice(0,9).join(' ');
}
