// Adapted from Claude's rule-based gallery visitor conversation system.
// No model API, network requests, tracking or dialogue persistence.
// Test edition: outdoor construction questions, progressive chips and a complete topic catalogue.
import {matchKnowledge,knowledgeAnswer,knowledgeTopic,FOLLOW_ON,normalise} from './phi-visitor-knowledge.mjs';
const MATERIALS={
 marker:['marker drawing','uneven ink, pressure, wobble and dry strokes'],
 tissue:['tissue-and-graphite piece','translucent layers with fine graphite-like marks'],
 watercolour:['watercolour','pigment movement, drying edges and paper grain'],
 oil:['oil painting','heavy paint forms and bristle texture'],
 action:['action painting','poured gestures, pools and scattered splashes']
};
const ENGINES={
 field:['Orbital Studies','balances arrangements around focal points'],
 spiral:['Golden Trajectories','follows curved paths influenced by the golden angle'],
 trajectory:['Golden Trajectories','follows curved paths influenced by the golden angle'],
 rects:['Recursive Divisions','splits the canvas into unequal rectangles'],
 burst:['Radiant Systems','sends marks outwards from focal points'],
 network:['Connected Fields','connects marks into networks'],
 organic:['Growth Systems','branches and grows in scale'],
 growth:['Growth Systems','branches and grows in scale'],
 geometric:['Constructed Forms','arranges geometric shapes of different scales'],
 construct:['Constructed Forms','arranges geometric shapes of different scales'],
 scribble:['Automatic Marks','generates loose gestural strokes'],
 automatic:['Automatic Marks','generates loose gestural strokes']
};
const PALETTES={spectrum:'full-spectrum',golden:'golden-angle',marker:'classic marker',
 cmyk:'CMYK',primary:'primary-colour',neon:'neon',pastel:'pastel',earth:'earth-tone',
 warm:'warm',cold:'cool',mono:'monochrome'};
const NAMES=['Ines','Tomasz','Ruth','Kwame','Marguerite','Dev','Saoirse','Hugo','Amara','Felix','Noor','Bea'];
const TYPES=['enthusiast','sceptic','regular'];
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function words(s){return normalise(s).split(' ').filter(Boolean);}
function plural(n,s){return n+' '+s+(n===1?'':'s');}
function join(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a.at(-1);}
export function describeWork(w){
 const material=MATERIALS[w.material],engine=ENGINES[w.engine],kind=material?.[0]||'drawing';
 const output=['“'+w.title+'” is '+(/^[aeiou]/.test(kind)?'an ':'a ')+kind+
  (w.sculpture?' — interpreted here as a sculpture':'')+'.'];
 if(engine)output.push('It belongs to '+engine[0]+', which '+engine[1]+'.');
 if(material)output.push('Its '+w.material+' material brings '+material[1]+'.');
 if(PALETTES[w.palette])output.push('The palette is '+PALETTES[w.palette]+'.');
 if(Number.isFinite(w.phi))output.push('Its additional φ pull is '+w.phi+' out of 100.');
 return output.join(' ');
}
export function buildVisitorKnowledge(input){
 const seed=hash((input.date||'reception')+':'+input.roomIndex+':'+input.visitorIndex);
 return {...input,outside:!!input.reception&&(input.outside===true||input.visitorIndex>=100),seed,persona:TYPES[seed%3],name:NAMES[(seed>>>3)%NAMES.length]};
}
const ORDINALS={first:0,'1st':0,second:1,'2nd':1,third:2,'3rd':2,fourth:3,'4th':3,last:-1};
export function resolveWork(question,k,state={}){
 const ws=words(question),line=ws.join(' '),works=k.works||[];
 if(!works.length)return null;
 let matched=null,score=0;
 for(const work of works){
  const title=words(work.title).filter(w=>w.length>2&&w!=='study');
  let n=title.filter(w=>ws.includes(w)).length;
  const number=work.title.match(/(\d+)\s*$/)?.[1];
  if(number&&new RegExp('\\b(study|number|no)\\s*0*'+Number(number)+'\\b').test(line))n+=2;
  if(n>score){score=n;matched=work;}
 }
 if(matched)return matched;
 for(const [ordinal,index] of Object.entries(ORDINALS))
  if(ws.includes(ordinal)&&/\b(one|work|painting|piece|sculpture)\b/.test(line))return works.at(index)||null;
 for(const material of Object.keys(MATERIALS)){
  if(ws.some(w=>w.startsWith(material.slice(0,5)))){
   const hits=works.filter(w=>w.material===material);if(hits.length===1)return hits[0];
  }
 }
 if(/\b(biggest|largest|big one)\b/.test(line))return [...works].sort((a,b)=>(b.size||0)-(a.size||0))[0];
 if(/\b(this|in front|looking at)\b/.test(line))return k.facing||state.lastWork||null;
 if(/\b(it|that|its)\b/.test(line))return state.lastWork||k.facing||null;
 return null;
}
function intent(q){
 const w=new Set(words(q)),line=' '+words(q).join(' ')+' ';
 const has=(...items)=>items.some(x=>w.has(x)||line.includes(' '+x+' '));
 if(has('hello','hi','hey','hiya','morning','afternoon'))return 'greeting';
 if(has('thanks','thank','bye','goodbye','cheers'))return 'thanks';
 if(has('who are you','your name','are you ai','are you a bot'))return 'who';
 if(has('how many'))return 'count';
 if(has('what is this room','what’s this room','whats this room','room called','name of the room','theme','why these together'))return 'room';
 if(has('which works','what works','whats here','what is here','list','which paintings','what paintings'))return 'list';
 if(has('favourite','favorite','recommend','best','like most'))return 'favourite';
 if(has('what do you think','your opinion','do you like','any good'))return 'opinion';
 if(has('where is the music','gramophone','music','sound','listen','record'))return 'music';
 if(has('penrose','tiles','tile','floor pattern'))return 'tiles';
 if(has('light','lighting','lights','lit'))return 'light';
 if(has('screens','screen','touchdesigner','monitor','translation'))return 'screens';
 if(has('artificial','midjourney','dalle','is this ai','made by ai'))return 'ai';
 if(has('watercolour','watercolor','tissue','graphite','marker','oil','action','material','materials','medium','made of'))return 'material';
 if(has('how was','how were','how is it made','how are they made','algorithm','generated','generative','seed','code','computer','procedural','who made'))return 'how';
 if(has('golden','φ','phi','1.618','ratio','fibonacci','proportion'))return 'phi';
 if(has('tower','floor','floors','lift','elevator','building','upstairs','downstairs'))return 'tower';
 if(has('every day','each day','daily','today','yesterday','date','when'))return 'daily';
 if(has('remix','editor','slider','sliders','make my own','create','try','own version'))return 'remix';
 if(has('sculpture','sculptures','statue','plinth'))return 'sculpture';
 if(has('download','export','print','svg','png','save'))return 'export';
 if(has('canvas','rectangle','format','shape'))return 'canvas';
 if(has('website','online','link','url','2d'))return 'link';
 if(has('project','gallery','artist','adam','what is this place','what’s this place'))return 'project';
 return null;
}
const MORE=['more','go on','tell me more','continue','what else','anything else','keep going','another'];
function isMore(line){
 const ws=line.split(' ');
 return ws.length<=5&&MORE.some(m=>(' '+line+' ').includes(' '+m+' '));
}
function titleNamed(question,k){
 const ws=words(question);
 return (k.works||[]).some(w=>words(w.title).filter(x=>x.length>2&&x!=='study').some(x=>ws.includes(x))||
  (/\d+\s*$/.test(w.title)&&new RegExp('\\b(study|number|no)\\s*0*'+Number(w.title.match(/(\d+)\s*$/)[1])+'\\b').test(ws.join(' '))));
}
function tryLine(k){
 return k.outside?'Try how this tower was built or how a day’s images become a floor.':k.reception?'Ask me about Fibonacci, Penrose tiles or how this tower is organised.':'Ask me about Fibonacci, the Parthenon myth, or artists who worked with rules.';
}
function phiOpinion(k){
 if(k.persona==='enthusiast')return 'I think φ carries more than you would expect. It guides divisions, scale and spacing, but materials and chance play a part too. Make up your own mind.';
 if(k.persona==='sceptic')return 'I am not convinced φ is what makes these work. The material, the wobble and splashes, may matter more. The project does not claim φ automatically makes things beautiful.';
 return 'I visit often and still have not decided. How far can the golden ratio govern a composition while its marks remain visibly human? The answer seems different each day.';
}
function roomLine(k){
 if(k.reception)return 'This is reception, the ground floor of the tower.';
 const n=k.roomName;
 if(!n?.title)return 'This room does not have a displayed name.';
 if(n.dimension&&n.values?.length)return 'This room is “'+n.title+'”. The works share '+n.dimension+': '+join(n.values)+'.';
 return 'This room is “'+n.title+'”. The title describes how the works sit together rather than claiming they are all the same.';
}
function listLine(k){
 if(!k.works?.length)return k.reception?'The exhibition floors are upstairs. Press L to use the lift.':'There are no listed works in this room.';
 const names=k.works.slice(0,6).map(w=>'“'+w.title+'”');
 return 'There are '+plural(k.works.length,'work')+' here: '+join(names)+(k.works.length>6?', and more':'')+'. Ask me about any of them.';
}
export function answerVisitor(question,k,state={}){
 const next={...state,turns:(state.turns||0)+1};
 const top=intent(question),work=resolveWork(question,k,state);
 if(work)next.lastWork=work;
 const reply=text=>({text,state:next,work:work||null});
 // General φ and art knowledge. A specific topic wins unless the question
 // names a work here or points at one ("this", "it").
 const line=words(question).join(' ');
 const kb=matchKnowledge(line);
 const aboutWork=work&&(/\b(this|that)\b/.test(line)||titleNamed(question,k));
 const fromTopic=(topic,fallbackLast=true,hits=[])=>{
  // Knowledge chains can circle back: do not recurse forever.
  const traversed=new Set();
  while(topic&&!traversed.has(topic.id)){
   traversed.add(topic.id);
   const answer=knowledgeAnswer(topic,k.persona,next.seen||state.seen,hits);
   if(answer){next.seen=answer.seen;next.topic=topic.id;return reply(answer.text);}
   topic=topic.next&&knowledgeTopic(topic.next);hits=[];
  }
  next.topic=state.topic||null;
  return reply(fallbackLast?'That’s about all I know on that. '+tryLine(k):tryLine(k));
 };
 // Phrase keys ("is this art") are specific enough to win even with "this".
 if(kb&&(kb.score>=2.5||(kb.score>=2&&!aboutWork)))return fromTopic(kb.topic,true,kb.hits);
 if(isMore(line)){
  const last=state.topic&&knowledgeTopic(state.topic);
  if(last)return fromTopic(last);
  const on=FOLLOW_ON[state.intent];
  if(on)return fromTopic(knowledgeTopic(on));
  if(state.lastWork)return reply(describeWork(state.lastWork));
 }
 next.intent=top;next.topic=null;
 if(work&&(!top||['list','material','opinion','favourite','link','phi','canvas','export'].includes(top))){
  if(top==='opinion')return reply(k.persona==='sceptic'?'I am not certain the golden ratio explains “'+work.title+'”. What do you think?':'For me, “'+work.title+'” is worth spending time with. Look at the distances between its marks.');
  if(top==='link')return reply('The label for “'+work.title+'” opens its original settings in the 2D editor. Approach it and press E.');
  if(top==='phi'&&Number.isFinite(work.phi))return reply('Its additional φ pull is '+work.phi+' out of 100. '+phiOpinion(k));
  return reply(describeWork(work)+(work.seed?' Its seed is '+work.seed+'.':''));
 }
 switch(top){
  case 'greeting':return reply('Hello, I am '+k.name+'. '+(k.reception?'Ask me about the tower or this project.':'Ask me about this room, the artwork, or the project.'));
  case 'thanks':return reply('Enjoy the rest of the exhibition.');
  case 'who':return reply('I am '+k.name+', one of the tower’s generated visitors. I answer using rules and facts about this room, not a language model.');
  case 'room':return reply(roomLine(k));
  case 'list':return reply(listLine(k));
  case 'count':{
   const w=words(question);
   if(w.some(x=>x.startsWith('floor')||x==='levels'))return reply('The tower has '+plural(k.floorCount,'exhibition floor')+', one per daily collection.');
   if(w.some(x=>x.startsWith('room')))return reply('This floor has '+plural(k.roomCount,'room')+'.');
   if(w.some(x=>x.startsWith('sculpt')))return reply('There are '+plural(k.floorSculptures,'sculpture')+' on this floor.');
   return reply(k.reception?listLine(k):plural(k.works.length,'work')+' in this room, '+plural(k.floorWorks,'work')+' on the floor.');
  }
  case 'favourite':{
   if(!k.works.length)return reply('I would choose something from upstairs.');
   const fav=k.works[k.seed%k.works.length];next.lastWork=fav;
   return reply('Today, I keep coming back to “'+fav.title+'”. '+describeWork(fav));
  }
  case 'opinion':return reply(state.lastWork?'For me, “'+state.lastWork.title+'” changes when I look at it again.':phiOpinion(k));
  case 'material':{
   const counts=new Map();for(const item of k.works)counts.set(item.material,(counts.get(item.material)||0)+1);
   const parts=[...counts].map(([m,n])=>n+' '+(MATERIALS[m]?.[0]||m));
   return reply((parts.length?'In this room: '+join(parts)+'. ':'')+'Across the project there are five simulated materials: marker, tissue and graphite, watercolour, oil, and action painting.');
  }
  case 'how':return reply('Each work is generated by seeded JavaScript. Eight composition engines guide the arrangement, using φ in divisions, sizes and spacing. Five simulated materials add irregularity. The settings were also tuned by eye.');
  case 'phi':return reply(phiOpinion(k));
  case 'project':return reply('PROPORTION PIECE asks: how far can the golden ratio govern a composition while its marks remain visibly human? It does not set out to prove φ makes anything beautiful. Each drawing can be reopened and changed in the editor.');
  case 'tower':return reply('The tower grows by one exhibition floor per day. Each floor plan uses golden-section cuts and merges them into walkable rooms. '+(k.reception?'The lift takes you upstairs.':'This floor represents '+k.readableDate+'.')+' Press L for the lift.');
  case 'daily':return reply(k.reception?'A new daily collection adds another floor.':'This floor contains the collection dated '+k.readableDate+'.');
  case 'remix':return reply('Open any drawing in the editor from its label to alter the seed, composition or material. The editor can export PNG or SVG artwork and share reproducible links.');
  case 'sculpture':return reply('Some portrait works are reinterpreted as layered sculptures on plinths. '+(k.reception?'They are upstairs.':'There are '+plural(k.floorSculptures,'sculpture')+' on this floor.'));
  case 'tiles':return reply('Some rooms use Penrose rhombus patterns in the floor. Their non-repeating geometry has a mathematical relationship with φ.');
  case 'music':return reply(/\bgramophone\b/i.test(question)
   ? 'The gramophone exhibit has been removed. Optional background music is available from Music in the gallery toolbar, off by default.'
   : 'For optional background music, open Music in the gallery toolbar. It starts off, and the recordings are not presented as part of the golden-ratio experiment.');
  case 'light':return reply('The room lighting follows golden divisions, but not every aspect of the tower is claimed to follow φ.');
  case 'screens':return reply('The Translation Area in reception explores works translated into moving images using TouchDesigner.');
  case 'ai':return reply('The artworks come from seeded JavaScript, not an AI image generator. I am a rule-based visitor, too.');
  case 'link':return reply('Approach a work and press E to see its label and open its 2D editor link.');
  case 'export':return reply('The editor can export PNG images and SVG paths, including plotter paths. Share links reopen a study with its settings.');
  case 'canvas':return reply('The main canvas is a practical 7:5 format, not a golden rectangle. The golden ratio operates inside the image.');
 }
 return reply('I don’t know about that one. I know this tower, its art, and a fair bit about φ and art history. '+(k.reception?'Try asking what this place is, or about Fibonacci.':'Try asking which works are here, or whether the Parthenon really uses φ.'));
}
// Each topic has a question; the drawer makes the entire knowledge base
// discoverable, while the visible chips adapt to the conversation.
const DISCOVERY={
 'Building the tower':[
  ['tower-build','How was the tower built?'],
  ['daily-to-floor',"How does a day's art become a floor?"],
  ['curation-process','What determines the rooms?'],
  ['hanging-process','How are paintings hung?'],
  ['sculpture-translation','How do drawings become sculptures?']],
 'Golden ratio & nature':[
  ['phi-definition','What is the golden ratio?'],['phi-history','Who discovered phi?'],
  ['fibonacci','What is Fibonacci?'],['golden-angle','What is the golden angle?'],
  ['nature','Is phi everywhere in nature?'],['nautilus','Is the nautilus shell golden?'],
  ['golden-rectangle','What is a golden rectangle?'],['penrose-history','Who was Roger Penrose?']],
 'Art history & evidence':[
  ['parthenon','Does the Parthenon use phi?'],['leonardo','Did Leonardo use phi?'],
  ['modern-artists','Which artists used phi?'],['le-corbusier','What is the Modulor?'],
  ['preference','Is the golden ratio more beautiful?'],['faces','Do faces follow phi?'],
  ['phi-music','Is phi used in music?']
  ],
 'Art, code & chance':[
  ['thirds','What is the rule of thirds?'],['composition','How does composition work?'],
  ['kandinsky','Tell me about Kandinsky'],['generative','What is generative art?'],
  ['instructions','Tell me about Sol LeWitt'],['chance','How is chance used in art?'],
  ['is-it-art','Is this art?']],
 'Simulated materials & forms':[
  ['action-painting','What is action painting?'],['watercolour-history','What is watercolour?'],
  ['oil-history','What is oil paint?'],['relief','What is relief sculpture?']]
};
export function visitorTopicCatalog(){
 return Object.entries(DISCOVERY).map(([category,topics])=>({category,
  topics:topics.filter(([id])=>knowledgeTopic(id)).map(([id,question])=>({id,question}))}));
}
const QUICK={
 outside:['tower-build','daily-to-floor','curation-process','sculpture-translation'],
 reception:['tower-build','phi-definition','penrose-history','curation-process'],
 gallery:['phi-definition','composition','generative','preference']
};
export function visitorSuggestions(k,state={}){
 if(!state.turns&&!state.topic)return k.outside
  ?['How was the tower built?',"How does a day's art become a floor?",'What determines the rooms?','How do drawings become sculptures?']
  :k.reception?['What is this place?','What are the screens?','How are paintings hung?','Is this AI?']
  :['What is this room called?','Which works are here?','Tell me about this one','Is the golden ratio enough?'];
 const options=[],used=new Set();
 const add=q=>{if(q&&!used.has(q)){options.push(q);used.add(q);}};
 const selected=state.topic&&knowledgeTopic(state.topic);
 if(selected&&(state.seen?.[selected.id]||[]).length<selected.answers.length)add('Tell me more');
 const all=visitorTopicCatalog().flatMap(group=>group.topics);
 if(selected?.next){const related=all.find(t=>t.id===selected.next);if(related)add(related.question);}
 const group=k.outside?'outside':k.reception?'reception':'gallery';
 const priority=QUICK[group].map(id=>all.find(t=>t.id===id)).filter(Boolean);
 const remaining=[...priority,...all.filter(t=>!priority.includes(t))];
 const unread=remaining.filter(t=>!(state.seen?.[t.id]?.length));
 const read=remaining.filter(t=>state.seen?.[t.id]?.length);
 const rotated=unread.length?[...unread.slice(state.turns%unread.length),...unread.slice(0,state.turns%unread.length)]:[];
 for(const topic of [...rotated,...read]){add(topic.question);if(options.length>=4)break;}
 return options.slice(0,4);
}
export function createVisitorChatUI({onClose}={}){
 const prompt=document.createElement('button');prompt.type='button';prompt.className='visitor-talk-prompt';prompt.hidden=true;
 const panel=document.createElement('aside');panel.className='visitor-chat';panel.hidden=true;
 panel.setAttribute('aria-label','Conversation with a gallery visitor');
 panel.innerHTML='<div class="visitor-chat-head"><h2></h2><button class="visitor-chat-close" type="button" aria-label="End conversation">×</button></div>'+
  '<div class="visitor-chat-log" role="log" aria-live="polite"></div><div class="visitor-chat-chips"><div class="visitor-chip-quick"></div><details class="visitor-topic-browser"><summary>Browse all topics</summary><div class="visitor-topic-groups"></div></details></div>'+
  '<form class="visitor-chat-form"><input type="text" maxlength="160" autocomplete="off" aria-label="Ask a visitor" placeholder="Ask about this room, the art, φ…"><button type="submit">Ask</button></form>';
 document.body.append(prompt,panel);
 const title=panel.querySelector('h2'),log=panel.querySelector('.visitor-chat-log');
 const chips=panel.querySelector('.visitor-chip-quick'),browser=panel.querySelector('.visitor-topic-browser'),groups=panel.querySelector('.visitor-topic-groups'),form=panel.querySelector('form'),input=panel.querySelector('input');
 let knowledge=null,speaker=null,state={};
 const add=(who,value)=>{const p=document.createElement('p');p.className='visitor-chat-'+who;p.textContent=value;log.append(p);log.scrollTop=log.scrollHeight;};
 const ask=value=>{if(!knowledge||!value.trim())return;add('you',value.trim());const response=answerVisitor(value,knowledge,state);state=response.state;add('them',response.text);renderChips();};
 const renderChips=()=>{
  chips.replaceChildren();
  for(const label of visitorSuggestions(knowledge,state)){
   const b=document.createElement('button');b.type='button';b.textContent=label;
   b.addEventListener('click',()=>{ask(label);input.focus({preventScroll:true});});chips.append(b);
  }
  for(const b of groups.querySelectorAll('button[data-topic]'))
   b.classList.toggle('visitor-topic-seen',!!state.seen?.[b.dataset.topic]?.length);
 };
 const buildBrowser=()=>{
  groups.replaceChildren();
  for(const {category,topics} of visitorTopicCatalog()){
   const section=document.createElement('details');
   const heading=document.createElement('summary');heading.textContent=category+' ('+topics.length+')';
   const buttons=document.createElement('div');buttons.className='visitor-topic-options';
   for(const topic of topics){
    const b=document.createElement('button');b.type='button';b.dataset.topic=topic.id;b.textContent=topic.question;
    b.addEventListener('click',()=>{browser.open=false;ask(topic.question);input.focus({preventScroll:true});});
    buttons.append(b);
   }
   section.append(heading,buttons);groups.append(section);
  }
 };
 form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);input.value='';input.focus({preventScroll:true});});
 const close=()=>{panel.hidden=true;knowledge=null;speaker=null;prompt.hidden=true;onClose?.();};
 panel.querySelector('.visitor-chat-close').addEventListener('click',close);
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
 return {
  prompt,
  get open(){return !panel.hidden;},
  get speaker(){return speaker;},
  showPrompt(name){if(panel.hidden&&name){if(prompt.textContent!=='Chat')prompt.textContent='Chat';prompt.hidden=false;}else prompt.hidden=true;},
  start(who,k){
   speaker=who;knowledge=k;state={};title.textContent=k.name;
   log.replaceChildren();browser.open=false;buildBrowser();
   add('them','Hello. I am '+k.name+'. '+(k.outside?'Ask me how the gallery grows from each day’s images.':'Ask me about this room, the art or PROPORTION PIECE.'));
   renderChips();
   prompt.hidden=true;panel.hidden=false;input.focus({preventScroll:true});
  },
  close
 };
}
