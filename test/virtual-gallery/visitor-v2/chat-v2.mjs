// Gallery visitors, v2. Still entirely rule-based — no model, no network.
// v1 (../phi-visitor-chat.mjs) supplies intents, facts and the φ/art notes.
// v2 adds, as separate classic-AI layers:
//   • forward chaining over the room's settings (rules.mjs) — visitors notice things
//   • a semantic network (graph.mjs) — "how is this connected to Fibonacci?"
//   • frames and a visit script (mind.mjs) — names, where they came from, stage
//   • a shared session — tell one visitor something, others hear about it
//   • a small grammar (nlg.mjs) — varied phrasing
//   • explanations for all of it, from proof trees and graph paths
import {coreAnswer,explain as explainV1,intent as intentV1,describeWork,resolveWork,TOPIC_LABELS} from './chat-v1-adapter.mjs';
import {matchKnowledge,normalise} from '../phi-visitor-knowledge.mjs';
import {visitorTopicCatalog} from '../phi-visitor-chat.mjs';
import {infer,observations,opinions,favouriteFact,proof,readSettings,RULES} from './rules.mjs';
import {buildGraph,findNodes,findPath,edgeSentence,neighbours} from './graph.mjs';
import {GRAMMAR,expand,rng} from './nlg.mjs';
import {visitorNotice} from './noticing.mjs';
import {session,visitorFrame,stageFor,readName,rememberView,noteInterest,topInterest} from './mind.mjs';

export {session,RULES};
const words=s=>normalise(s).split(' ').filter(Boolean);
const has=(line,list)=>list.some(x=>(' '+line+' ').includes(' '+x+' '));
const ends=text=>/\?\s*$/.test(text);
const t=w=>'“'+(w.displayTitle||w.title)+'”';
const TITLE_STOP=new Set(['the','and','with','one','for','from','this','that','study','untitled','drawing','painting','work','piece','in','of','a','an','to']);

export function buildVisitorKnowledge(input){
 const works=(input.works||[]).map(w=>({...w,material:w.material==='watercolor'?'tissue':w.material}));
 const counts=new Map();for(const w of works)counts.set(w.title,(counts.get(w.title)||0)+1);
 const labels=new Map();for(const w of works)if(counts.get(w.title)>1){const label=(w.material||w.engine||'work')+' '+w.title;labels.set(label,(labels.get(label)||0)+1);w.displayTitle=label;}
 const used=new Map();for(const w of works)if(w.displayTitle&&labels.get(w.displayTitle)>1){const n=(used.get(w.displayTitle)||0)+1;used.set(w.displayTitle,n);w.displayTitle+=' ('+n+')';}
 const frame=visitorFrame(input);
 const k={...input,works,...frame};
 k.memory=infer(works,frame.persona);
 k.graph=buildGraph(works);
 return k;
}

// ----------------------------------------------------------------- intents
function intentV2(line,question){
 // A recognised subject wins over conversational words such as 'help' or 'special'.
 const kb=matchKnowledge(line);
 if(kb&&kb.score>=2)return intentV1(question);
 if(has(line,['connected','connection','connect','link between','links','to do with','related to','relate','relationship between']))return 'connect';
 if(has(line,['notice','noticed','interesting','stand out','stands out','special','spot','spotted','what do you see','observe']))return 'notice';
 if(has(line,['compare','comparison','difference between','different from','versus','vs','which is more','which has more']))return 'compare';
 if(has(line,['where have you been','where did you come from','where have you come from','where are you from','which floor','other floors','your visit','been here long','come here often']))return 'whereFrom';
 if(has(line,['matters more','more important','what matters']))return 'phiDebate';
 if(has(line,['what can i ask','what can you do','help','what do you know']))return 'help';
 if(has(line,['favourite','favorite','like most','recommend','best one']))return 'favourite';
 return intentV1(question);
}
const isWhy=line=>/^(why|how do you know|how come|explain|what makes you say|why do you say|why did you|whats your reasoning|reason|reasoning|source|says who|prove it)\b/.test(line)&&line.split(' ').length<=8;

// ---------------------------------------------------------------- answers
function workFrom(question,k,state){
 const how={};const w=resolveWork(question,k,state,how);return {w,via:how.via};
}
function connect(question,line,k,state){
 const g=k.graph;
 let ends=findNodes(g,line).filter(n=>n.type!=='work');
 const {w}=workFrom(question.replace(/\bconnect(ed|ion|s)?\b/gi,' '),k,state);
 const workNode=w?g.nodes.get('work:'+(w.studyId||w.title)):null;
 if(workNode)ends=[workNode,...ends];
 if(ends.length===1&&!workNode&&k.facing&&/\b(this|it|that|here|room)\b/.test(line))ends=[g.nodes.get('work:'+(k.facing.studyId||k.facing.title)),...ends];
 if(ends.length>=2){
  const path=findPath(g,ends[0].id,ends[1].id);
  if(!path)return {text:'I can’t find a link between '+ends[0].label+' and '+ends[1].label+' — not one I know about, anyway.',route:{kind:'graph',path:[],from:ends[0].id,to:ends[1].id}};
  if(!path.length)return {text:'They’re the same thing!',route:{kind:'graph',path}};
  return {text:path.map(e=>edgeSentence(g,e)).join(' '),route:{kind:'graph',path,from:ends[0].id,to:ends[1].id},work:w||null};
 }
 if(ends.length===1){
  const ns=neighbours(g,ends[0].id).slice(0,3);
  return ns.length?{text:ns.join(' '),route:{kind:'graph',node:ends[0].id,path:(g.adjacent.get(ends[0].id)||[]).slice(0,3)}}:null;
 }
 return null;
}
function compare(question,k,state){
 const works=k.works||[];
 const ws=words(question);
 const named=works.filter(w=>words(w.title).filter(x=>x.length>2&&!TITLE_STOP.has(x)).some(x=>ws.includes(x)));
 // Material/system descriptions can name a second work without its title.
 for(const material of ['marker','tissue','watercolour','oil','action'])if(ws.includes(material)||material==='watercolour'&&ws.includes('watercolor')){
  const hit=works.filter(w=>w.material===material);if(hit.length===1&&!named.includes(hit[0]))named.push(hit[0]);
 }
 for(const engine of ['field','spiral','rects','burst','network','organic','growth','geometric','construct','scribble','automatic'])if(ws.includes(engine)){
  const hit=works.filter(w=>w.engine===engine);if(hit.length===1&&!named.includes(hit[0]))named.push(hit[0]);
 }
 const ORD={first:0,second:1,third:2,fourth:3,fifth:4,last:-1};
 for(const [word,i] of Object.entries(ORD))if(ws.includes(word)){const w=works.at(i);if(w&&!named.includes(w))named.push(w);}
 let pair=named.length>=2?named.slice(0,2):null;
 const contrast=k.memory.wm.find(f=>f.pred==='phiContrast');
 if(!pair&&named.length===1){const other=(contrast&&contrast.args.find(x=>x!==named[0]))||works.find(x=>x!==named[0]);if(other)pair=[named[0],other];}
 if(!pair&&contrast)pair=contrast.args;
 if(!pair&&works.length>=2)pair=works.slice(0,2);
 if(!pair)return null;
 const [a,b]=pair,sa=readSettings(a),sb=readSettings(b),bits=[];
 if(Number.isFinite(sa.phi)&&Number.isFinite(sb.phi))bits.push(sa.phi===sb.phi?'the same φ pull ('+sa.phi+')':'φ pull of '+sa.phi+' against '+sb.phi);
 if(Number.isFinite(sa.neg)&&Number.isFinite(sb.neg))bits.push('negative space '+sa.neg+' against '+sb.neg);
 if(Number.isFinite(sa.wob)&&Number.isFinite(sb.wob))bits.push('wobble '+sa.wob+' against '+sb.wob);
 const same=[];if(a.engine===b.engine)same.push('composition system');if(a.material===b.material)same.push('material');
 const text=t(a)+' and '+t(b)+': '+(bits.length?bits.join(', ')+'. ':'')+
  (same.length?'They share a '+same.join(' and a ')+'.':'Different system, different material.');
 return {text,route:{kind:'compare',works:[a,b]},work:a};
}
function notice(k,state){
 return visitorNotice(k,state);
}
function favourite(k){
 const f=favouriteFact(k.memory);
 if(!f)return null;
 const r=rng(k.seed+7);
 return {text:expand(GRAMMAR,'opinionLead',r,{opinion:f.text}),route:{kind:'rule',fact:f.id},work:f.args[0]};
}
function opinion(k,state){
 const said=new Set(state.said||[]);
 const o=opinions(k.memory).find(f=>f.pred!=='favourite'&&!said.has(f.id));
 if(!o)return null;
 return {text:expand(GRAMMAR,'opinionLead',rng(k.seed+(state.turns||0)),{opinion:o.text}),route:{kind:'rule',fact:o.id},said:o.id};
}
function whereFrom(k){
 const r=rng(k.seed+3);
 if(k.reception)return {text:'I’ve only just arrived — I’m deciding where to start. The lift goes to every floor.',route:{kind:'frame',slot:'from'}};
 const arrival=k.from?expand(GRAMMAR,'arrival',r,{from:k.from}):'This is my first floor today.';
 return {text:arrival+' Each floor is a different day, so it’s like walking back through the collection.',route:{kind:'frame',slot:'from'}};
}
function help(k){
 return {text:'You can ask me about this room, any work in it, the tower, or φ and art history. I can compare two works, tell you what I’ve noticed, or trace how two things are connected. And you can always ask me why.',route:{kind:'intent',intent:'help'}};
}

// ----------------------------------------------------------- explanations
function explainV2(route,k,state,depth){
 if(!route)return 'I haven’t said anything yet to explain!';
 if(depth>=3)return 'That’s the bottom of my reasons. Someone wrote those rules and links when they built the tower, so the next “why” is for them.';
 const g=k.graph,fact=route.fact&&k.memory.wm.find(f=>f.id===route.fact);
 switch(route.kind){
  case 'rule':
   if(!fact)break;
   if(depth===1)return (fact.kind==='opinion'?'That’s my opinion — I’m the '+k.persona+' type. It rests on this: ':'')+proof(fact,1);
   return proof(fact,2);
  case 'graph':
   if(depth===1)return route.path?.length?'Each of those is a link in my network of ideas — '+route.path.length+' step'+(route.path.length===1?'':'s')+'. Where a link is disputed, it says so in the link itself.':'I know those two things, but no chain of links joins them.';
   return 'Underneath, I’m a semantic network: things joined by labelled links. I searched outwards from '+(g.nodes.get(route.from||route.node)?.label||'the first thing')+' one link at a time until I reached '+(g.nodes.get(route.to)?.label||'the end')+' — the shortest chain wins.';
  case 'compare':
   if(depth===1)return 'Those numbers are straight from each work’s share link — the settings it was made with. I didn’t judge anything, just read them side by side.';
   return 'Underneath, I’m rules. One rule picks the two works — the ones you named, or else the highest and lowest φ pull in the room — and another lists where their settings differ.';
  case 'noticeContext':
   return route.context==='reception'?'Each archived day becomes a floor in this gallery; the entrance is where that sequence begins.':'I am describing only the actual room and the work settings available to me.';
  case 'frame':
   if(depth===1)return 'That’s just who I am today — every visitor has a floor they came from, worked out from their seed.';
   return 'Underneath, I’m a frame: slots like name, temperament and starting floor, each filled with a default from my seed.';
  case 'gossip':
   return depth===1?route.other+' told me — every visitor on this visit can hear what you’ve told the others.':'Underneath, we share one memory for your visit. It’s forgotten when you leave the page.';
  case 'name':return 'You told me your name, so I used it.';
  case 'intent':if(route.intent==='help')return 'That’s a list of the rules I have.';
 }
 return explainV1(route,k,state,depth);
}

// --------------------------------------------------------------- dialogue
const REACT={
 yes:{enthusiast:'Good — that’s what I think the φ is for.',sceptic:'Then maybe φ is doing more than I give it credit for. Or the material is.',regular:'Me too, today. Ask me again tomorrow.'},
 no:{enthusiast:'Fair enough. Open it in the editor and pull the φ slider down — see if it gets better or worse.',sceptic:'Same here. I think the marks carry it, not the maths.',regular:'Some days I’d say the same.'},
 phi:{enthusiast:'Exactly. I’m glad someone agrees.',sceptic:'I’m not sure. Look at the material for a minute and tell me it isn’t doing more.',regular:'Some days I think that too.'},
 material:{enthusiast:'Maybe. But the material alone would just be texture — something has to place it.',sceptic:'That’s what I think. The splashes and wobble do the work.',regular:'That’s a good argument. I keep changing my mind.'}
};
const ASK={
 work:{enthusiast:'Does it feel balanced to you?',sceptic:'Honestly — would you notice if the φ were taken out of it?',regular:'Do you like it more close up, or from back here?'},
 debate:'What do you think matters more here — the φ or the material?',
 browsing:'Which one would you take home, if you could?'
};
const YES=['yes','yeah','yep','yup','definitely','sure','of course','i do','it does','i have','i would','probably','kind of','sort of'];
const NO=['no','nope','nah','not really','i dont','it doesnt','i havent','i wouldnt','not sure','never'];
const VIEW_TEXT={phi:'the φ matters more than the material',material:'the material matters more than the φ',both:'it’s a bit of both'};
function readAnswer(line,question,k,state){
 const a=state.awaiting,p=k.persona;
 if(a==='obs'){
  const fact=k.memory.wm.find(f=>f.id===state.awaitFact);
  const linked=opinions(k.memory).find(o=>(o.why.from||[]).includes(fact));
  if(has(line,YES))return {text:linked?expand(GRAMMAR,'opinionLead',rng(k.seed),{opinion:linked.text}):'Good. It’s the kind of thing you only see in a room together.',route:linked?{kind:'rule',fact:linked.id}:{kind:'answered'}};
  if(has(line,NO))return {text:'Have a look — '+(fact?.args?.[0]?.title?'start with '+t(fact.args[0])+'.':'stand in the middle and turn round slowly.'),route:{kind:'answered'}};
 }
 if(a==='yesno'){
  if(has(line,['close','closer','near','up close','back','far','distance','both']))return {text:'Close up it’s all material — wobble and grain. From further back it’s all composition, and that’s the bit φ is meant to control.',route:{kind:'answered'}};
  if(has(line,NO))return {text:REACT.no[p],route:{kind:'answered'}};
  if(has(line,YES))return {text:REACT.yes[p],route:{kind:'answered'}};
 }
 if(a==='phiOrMaterial'){
  const phi=has(line,['phi','φ','golden','ratio','maths','math','proportion','composition']),mat=has(line,['material','materials','paint','marks','texture','wobble','splashes','ink']);
  let view=null;
  if(phi&&mat||has(line,['both','neither','dont know','not sure','depends']))view='both';else if(phi)view='phi';else if(mat)view='material';
  if(view){rememberView(view,k.name);return {text:view==='both'?'Probably the honest answer — that’s why the project calls it a question.':REACT[view][p],route:{kind:'answered'},view};}
 }
 if(a==='work'){
  const w=resolveWork(question,k,state);
  if(w)return {text:t(w)+'? '+(p==='sceptic'?'Not my pick, but I can see why.':'Good choice.')+' '+describeWork(w).replace(/^.*?\.\s/,''),route:{kind:'answered'},work:w};
  if(has(line,['none','nothing','neither','dont know']))return {text:p==='sceptic'?'Ha. Fair.':'Fair enough — maybe one upstairs.',route:{kind:'answered'}};
 }
 if(a==='leaving'){
  if(has(line,NO)||has(line,['bye','thats all','nothing']))return {text:'Enjoy the rest of the tower'+(session.userName?', '+session.userName:'')+'.',route:{kind:'intent',intent:'thanks'},farewell:true};
  if(has(line,YES))return {text:'Go on, then.',route:{kind:'answered'}};
 }
 if(a==='open'&&(has(line,YES)||has(line,NO)||line.split(' ').length<=6))return {text:'Interesting. I’ll think about that.',route:{kind:'answered'}};
 return null;
}

/** One visitor turn. Returns {text,state,work,route}. */
export function answerVisitor(question,k,state={}){
 const line=words(question).join(' ');
 const turns=(state.turns||0)+1;
 // WHY — explain the last answer, a level deeper each time.
 if(isWhy(line)&&!matchKnowledge(line)){
  const depth=(state.whyDepth||0)+1;
  const route=/\bask\b/.test(line)&&state.lastAsked?{kind:'asked'}:state.lastRoute;
  return {text:explainV2(route,k,state,depth),state:{...state,turns,whyDepth:depth},work:null,route:{kind:'why',of:route}};
 }
 let base={...state,whyDepth:0};
 // AWAITING — read the reply to the visitor's own question, unless it's a new question.
 if(state.awaiting){
  const newQuestion=ends(question)&&(intentV2(line,question)||matchKnowledge(line));
  const got=!newQuestion&&readAnswer(line,question,k,state);
  base={...base,awaiting:null,awaitFact:null};
  if(got){
   const next={...base,turns,lastRoute:got.route,lastAsked:false,mode:got.farewell?'farewell':state.mode};
   if(got.view)next.userView=got.view;
   if(got.work)next.lastWork=got.work;
   return {text:got.text,state:next,work:got.work||null,route:got.route};
  }
 }
 // NAME — "I'm Sam".
 const name=readName(question);
 let prefix='';
 if(name){session.userName=name;prefix=expand(GRAMMAR,'gotName',rng(k.seed+turns),{name})+' ';}
 if(state.mode==='farewell')prefix=expand(GRAMMAR,'back',rng(k.seed+turns))+' '+prefix;

 const top=intentV2(line,question);
 let out=null;
 if(top==='connect')out=connect(question,line,k,base);
 else if(top==='notice')out=notice(k,base);
 else if(top==='compare')out=compare(question,k,base);
 else if(top==='favourite'&&!(resolveWork(question,k,base)&&/\b(this|it)\b/.test(line)))out=favourite(k);
 else if((top==='opinion'||top==='phi')&&!resolveWork(question,k,base))out=top==='opinion'?opinion(k,base):null;
 else if(top==='whereFrom')out=whereFrom(k);
 else if(top==='phiDebate'){const c=coreAnswer('is the golden ratio enough',k,base);out={text:c.text,route:c.route};}
 else if(top==='help')out=help(k);
 let answer;
 if(out){
  const said=out.said?[...new Set([...(base.said||[]),...(Array.isArray(out.said)?out.said:[out.said])])]:base.said;
  answer={text:out.text,route:out.route,work:out.work||null,state:{...base,turns,said,intent:top,topic:null,lastWork:out.work||base.lastWork}};
 }else{
  answer=coreAnswer(question,k,base);
  answer.state.turns=turns;
  if(name&&answer.route.intent==='greeting')answer={...answer,text:'What would you like to know?',route:{kind:'name'}};
  // Nothing matched: try the network for a single thing they named.
  if(answer.route.kind==='fallback'){
   const g=connect(question,line,k,base);
   if(g)answer={...answer,text:g.text,route:g.route};
   else if(name)answer={...answer,text:'Ask me anything about this room, the art, or φ.',route:{kind:'name'}};
  }
 }
 if(answer.route.kind==='knowledge')noteInterest(answer.route.topic);
 let text=prefix+answer.text;
 const next=answer.state;
 if(answer.route.intent==='phi'&&base.userView)text='You said you think '+VIEW_TEXT[base.userView]+'. '+text;
 // Dialogue state from what just happened.
 const r=answer.route;
 next.mode=r.intent==='thanks'?'farewell':r.kind==='work'||r.kind==='compare'?'work':
  r.kind==='knowledge'||r.intent==='phi'||r.intent==='opinion'?'debate':r.intent==='list'?'browsing':'open';
 next.stage=stageFor(turns);
 next.lastRoute=r;next.lastAsked=false;
 // Initiative: every third turn or so, the visitor leads.
 const ready=top!=='notice'&&turns>=2&&turns-(base.lastAskTurn??-9)>=3&&!ends(text)&&next.mode!=='farewell';
 if(ready){
  let ask=null;
  const obs=observations(k.memory).find(f=>!(next.said||[]).includes(f.id));
  if(next.stage==='leaving'&&!base.askedLeaving){next.askedLeaving=true;ask='I should keep moving soon — anything else before I go?';next.awaiting='leaving';}
  else if(next.mode==='work'){ask=ASK.work[k.persona];next.awaiting='yesno';}
  else if(next.mode==='debate'){ask=ASK.debate;next.awaiting='phiOrMaterial';}
  else if(next.mode==='browsing'&&k.works.length){ask=ASK.browsing;next.awaiting='work';}
  else if(obs){ask=expand(GRAMMAR,'notice',rng(k.seed+turns),{fact:obs.text});if(!ends(ask))ask=null;else{next.awaiting='obs';next.awaitFact=obs.id;next.said=[...(next.said||[]),obs.id];}}
  if(ask){text+=' '+ask;next.lastAskTurn=turns;next.lastAsked=true;}
 }else if(ends(text)&&r.kind!=='fallback'){next.awaiting='open';next.lastAskTurn=turns;next.lastAsked=true;}
 return {...answer,text,state:next};
}

// ---------------------------------------------------- greeting & overhearing
/** The visitor's opening line: name, gossip from other visitors, a hook. */
export function greetVisitor(k){
 const r=rng(k.seed);
 const lines=['Hello'+(session.userName?', '+session.userName:'')+'. I’m '+k.name+'.'];
 const heard=session.views.at(-1);
 if(heard&&heard.told!==k.name)lines.push(expand(GRAMMAR,'gossip',r,{other:heard.told,view:VIEW_TEXT[heard.view]}));
 const interest=topInterest();
 if(!heard&&interest&&session.interests[interest]>=2)lines.push('Someone said you’ve been asking about '+(TOPIC_LABELS[interest]||interest.replace(/-/g,' '))+'.');
 if(!session.met.includes(k.name))session.met.push(k.name);
 lines.push(k.reception?'Ask me about the tower, φ, or art.':'Ask me about this room, the art, or φ — or ask what I’ve noticed.');
 const route=heard&&heard.told!==k.name?{kind:'gossip',other:heard.told}:{kind:'intent',intent:'greeting'};
 return {text:lines.join(' '),state:{lastRoute:route}};
}
/** Two visitors in the same room, overheard: one's observation or opinion, the other's reaction. */
export function overhear(a,b){
 const op=opinions(a.memory).find(f=>f.pred!=='favourite');
 const said=op||observations(a.memory)[0];
 if(!said)return null;
 const r=rng(a.seed^b.seed);
 let reply;
 if(op){
  const rel=a.persona===b.persona?'agree':a.persona==='regular'||b.persona==='regular'?'shrug':'disagree';
  reply=expand(GRAMMAR,rel,r);
 }else{
  // A fact gets an acknowledgement, plus the listener's own take if they have one.
  const own=opinions(b.memory).find(f=>f.pred!=='favourite')||favouriteFact(b.memory);
  reply=expand(GRAMMAR,'ack',r)+(own?' '+expand(GRAMMAR,'opinionLead',r,{opinion:own.text}):'');
 }
 const lines=[{who:a.name,text:said.text[0].toUpperCase()+said.text.slice(1)+'.'},{who:b.name,text:reply}];
 lines.fact=said.id;
 return lines;
}

// Discovery uses the same knowledge catalogue as v1; no duplicate facts.
export const MORE_TOPICS_LABEL='More topics…';
export const TOPICS_PER_PAGE=4;
export function topicGroupsFor(k,state={}){
 const here=k.outside
  ?['How was the tower built?', "How does a day's art become a floor?",'What determines the rooms?','How do drawings become sculptures?']
  :k.reception
   ?['What is this place?','What are the screens?','What is the gramophone?','Is this AI?']
   :['What is this room called?','Which works are here?','Tell me about this one','Is the golden ratio enough?'];
 const talk=['What have you noticed?',"What's your favourite?",'Where did you come from?','How is this connected to Fibonacci?'];
 if((k.works||[]).length>=2)talk.push('Compare the first and the last');
 if(state.lastRoute)talk.push('Why?');
 const topics=questions=>questions.map(question=>({id:question,question}));
 return [
  {category:'Here in the gallery',topics:topics(here)},
  {category:'Talking to visitors',topics:topics(talk)},
  ...visitorTopicCatalog()
 ];
}

export function suggestionsFor(k,state={}){
 if(state.awaiting==='yesno'||state.awaiting==='obs'||state.awaiting==='leaving')return ['Yes','No'];
 if(state.awaiting==='phiOrMaterial')return ['The φ','The material','Both'];
 if(state.awaiting==='work')return k.works.slice(0,3).map(w=>w.title);
 const chips=[];
 if(state.lastRoute&&!['fallback','name'].includes(state.lastRoute.kind)&&!(state.lastRoute.intent==='greeting'))chips.push('Why?');
 if(k.reception)chips.push('What is this place?','How is the tower connected to φ?','Who was Vera Molnár?');
 else if(state.lastRoute?.kind==='work')chips.push('How is this connected to φ?','Compare it with another');
 else chips.push('What have you noticed?','What’s your favourite?','How is this connected to Fibonacci?');
 return chips.slice(0,4);
}

/** Plain-text trace of a turn, for the reasoning panel. */
export function traceOf(answer,k){
 const r=answer.route||{};
 const out=[];
 if(r.kind==='why')out.push('explain: '+(r.of?.kind||'nothing'));
 else out.push('route: '+r.kind+(r.intent?' / '+r.intent:'')+(r.topic?' / '+r.topic:''));
 if(r.fact){const f=k.memory.wm.find(x=>x.id===r.fact);if(f)out.push('fact '+f.id+' '+f.pred+' ← rule '+f.why.rule.id);}
 if(r.path?.length)out.push('path: '+r.path.map(e=>e.from+' —'+e.rel.split(' ').slice(0,3).join(' ')+'→ '+e.to).join(' ; '));
 if(r.via)out.push('work resolved by: '+r.via);
 if(answer.state?.awaiting)out.push('awaiting: '+answer.state.awaiting);
 out.push('mode: '+(answer.state?.mode||'-')+' · stage: '+(answer.state?.stage||'-'));
 return out.join('\n');
}
export function memorySummary(k){
 return {fired:k.memory.fired.map(f=>f.rule),derived:k.memory.wm.filter(f=>!f.base).map(f=>f.pred+': '+f.text)};
}

// ---------------------------------------------------------------------- UI
// Same contract as v1's createVisitorChatUI, plus dynamic chips, an
// overheard exchange and an optional reasoning view (?chatdebug=1 or the
// "Reasoning" toggle).
export const V2_CSS=`.visitor-chat-v2 .visitor-chat-head{display:flex;align-items:center;gap:10px}
.visitor-chat-v2 .visitor-chat-head h2{flex:1}
.visitor-chat-reasoning{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.7;display:flex;gap:4px;align-items:center;cursor:pointer}
.visitor-chat-aside{font-style:italic;opacity:.72;font-size:12px}
.visitor-chat-trace{display:none;margin:-6px 0 10px;padding:6px 8px;font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;border-left:2px solid currentColor;opacity:.6}
.visitor-chat-v2.show-reasoning .visitor-chat-trace{display:block}
/* Give contextual chips their own visible space. Only the conversation scrolls. */
.visitor-chat.visitor-chat-v2{max-height:min(86dvh,780px);bottom:max(18px,env(safe-area-inset-bottom,0px))}
.visitor-chat-v2 .visitor-chat-head,.visitor-chat-v2 .visitor-chat-form{flex-shrink:0}
.visitor-chat-v2 .visitor-chat-log{flex:1 1 auto;min-height:96px}
.visitor-chat-v2 .visitor-chat-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start;max-height:none;min-height:144px;overflow:visible;flex:0 0 auto;padding:12px 15px}
.visitor-chat-v2 .visitor-chat-chips button{width:100%;min-width:0;min-height:44px;white-space:normal;overflow-wrap:anywhere;font:12px/1.35 Arial,Helvetica,sans-serif;padding:9px 10px}
.visitor-chat-v2 .visitor-chat-chips .visitor-chat-more{border-color:#8d8066;font-weight:600}
.visitor-chat-v2 .visitor-chat-topic-heading{grid-column:1/-1;font:12px/1.3 Arial,Helvetica,sans-serif;color:#4b594f;padding:2px 0}
.visitor-chat-v2 .visitor-chat-chips.visitor-chat-topics-open{gap:6px}
@media(max-width:620px){
 .visitor-chat.visitor-chat-v2{max-height:min(90dvh,740px);bottom:max(12px,env(safe-area-inset-bottom,0px))}
 .visitor-chat-v2 .visitor-chat-chips{gap:7px;padding:10px 12px;min-height:140px}
 .visitor-chat-v2 .visitor-chat-log{min-height:78px}
}
@media(max-height:570px){
 .visitor-chat.visitor-chat-v2{max-height:calc(100dvh - 14px);bottom:7px}
 .visitor-chat-v2 .visitor-chat-chips{gap:5px;min-height:0;padding:7px 10px}
 .visitor-chat-v2 .visitor-chat-chips button{min-height:36px;padding:6px 8px;font-size:11px}
 .visitor-chat-v2 .visitor-chat-log{min-height:56px}
}
`;
function injectStyles(){
 if(document.getElementById('visitor-chat-v2-css'))return;
 const style=document.createElement('style');style.id='visitor-chat-v2-css';style.textContent=V2_CSS;document.head.append(style);
}
export function createVisitorChatUI({onClose,showReasoning=/[?&]chatdebug=1\b/.test(globalThis.location?.search||'')}={}){
 injectStyles();
 const prompt=document.createElement('button');prompt.type='button';prompt.className='visitor-talk-prompt';prompt.hidden=true;
 const panel=document.createElement('aside');panel.className='visitor-chat visitor-chat-v2';panel.hidden=true;
 panel.setAttribute('aria-label','Conversation with a gallery visitor');
 panel.innerHTML='<div class="visitor-chat-head"><h2></h2><label class="visitor-chat-reasoning"><input type="checkbox"> Reasoning</label><button class="visitor-chat-close" type="button" aria-label="End conversation">×</button></div>'+
  '<div class="visitor-chat-log" role="log" aria-live="polite"></div><div class="visitor-chat-chips"></div>'+
  '<form class="visitor-chat-form"><input type="text" maxlength="160" autocomplete="off" aria-label="Ask a visitor" placeholder="Ask about this room, the art, φ… or ask why"><button type="submit">Ask</button></form>';
 document.body.append(prompt,panel);
 const title=panel.querySelector('h2'),log=panel.querySelector('.visitor-chat-log'),toggle=panel.querySelector('.visitor-chat-reasoning input');
 const chips=panel.querySelector('.visitor-chat-chips'),form=panel.querySelector('form'),input=form.querySelector('input');
 toggle.checked=showReasoning;panel.classList.toggle('show-reasoning',showReasoning);
 toggle.addEventListener('change',()=>panel.classList.toggle('show-reasoning',toggle.checked));
 let knowledge=null,speaker=null,state={};
 let topicView=null,topicPage=0;
 const add=(who,value,trace)=>{
  const p=document.createElement('p');p.className='visitor-chat-'+who;p.textContent=value;log.append(p);
  if(trace){const pre=document.createElement('pre');pre.className='visitor-chat-trace';pre.textContent=trace;log.append(pre);}
  log.scrollTop=log.scrollHeight;
 };
 const renderChips=()=>{
  chips.replaceChildren();
  chips.classList.toggle('visitor-chat-topics-open',topicView!==null);
  const button=(label,click,className='')=>{
   const b=document.createElement('button');b.type='button';b.textContent=label;
   if(className)b.className=className;
   b.addEventListener('click',click);chips.append(b);return b;
  };
  const show=(view,page=0)=>{
   topicView=view;topicPage=page;renderChips();
   chips.querySelector('button')?.focus({preventScroll:true});
  };
  if(topicView===null){
   for(const label of suggestionsFor(knowledge,state))
    button(label,()=>{ask(label);input.focus({preventScroll:true});});
   button(MORE_TOPICS_LABEL,()=>show('categories'), 'visitor-chat-more');
   return;
  }
  const groups=topicGroupsFor(knowledge,state);
  if(topicView==='categories'){
   for(const group of groups)
    button(group.category+' ('+group.topics.length+')',()=>show(group.category));
   button('← Back to chat',()=>show(null),'visitor-chat-more');
   return;
  }
  const group=groups.find(g=>g.category===topicView);
  if(!group){show('categories');return;}
  const heading=document.createElement('span');heading.className='visitor-chat-topic-heading';heading.textContent=group.category;
  chips.append(heading);
  for(const topic of group.topics.slice(topicPage*TOPICS_PER_PAGE,(topicPage+1)*TOPICS_PER_PAGE))
   button(topic.question,()=>{
    topicView=null;topicPage=0;
    ask(/\?\s*$/.test(topic.question)?topic.question:topic.question+'?');input.focus({preventScroll:true});
   });
  button('← Categories',()=>show('categories'),'visitor-chat-more');
  if(group.topics.length>TOPICS_PER_PAGE)
   button('More in this category →',()=>show(topicView,(topicPage+1)%Math.ceil(group.topics.length/TOPICS_PER_PAGE)),'visitor-chat-more');
 };
 const ask=value=>{
  if(!knowledge||!value.trim())return;
  add('you',value.trim());
  const response=answerVisitor(value,knowledge,state);state=response.state;
  add('them',response.text,traceOf(response,knowledge));renderChips();
 };
 form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);input.value='';input.focus({preventScroll:true});});
 const close=()=>{panel.hidden=true;knowledge=null;speaker=null;topicView=null;topicPage=0;prompt.hidden=true;onClose?.();};
 panel.querySelector('.visitor-chat-close').addEventListener('click',close);
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
 return {
  prompt,
  get open(){return !panel.hidden;},
  get speaker(){return speaker;},
  showPrompt(name){if(panel.hidden&&name){if(prompt.textContent!=='T · Talk to '+name)prompt.textContent='T · Talk to '+name;prompt.hidden=false;}else prompt.hidden=true;},
  start(who,k,{others=[]}={}){
   speaker=who;knowledge=k;title.textContent=k.name;
   topicView=null;topicPage=0;log.replaceChildren();
   const other=others.find(o=>o.name!==k.name);
   const heard=other&&overhear(k,other);
   if(heard){
    add('aside',expand(GRAMMAR,'overhearLead',rng(k.seed),{a:k.name,b:other.name}));
    for(const l of heard)add('aside',l.who+': '+l.text);
   }
   const hello=greetVisitor(k);state=hello.state;
   // What they were overheard saying counts as said.
   if(heard)state={...state,said:[heard.fact]};
   add('them',hello.text);renderChips();
   prompt.hidden=true;panel.hidden=false;input.focus({preventScroll:true});
  },
  close
 };
}
