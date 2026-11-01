import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisitorKnowledge,answerVisitor,greetVisitor,overhear,session,suggestionsFor,topicGroupsFor,MORE_TOPICS_LABEL,TOPICS_PER_PAGE,V2_CSS} from './chat-v2.mjs';
import {resetSession} from './mind.mjs';
import {infer,proof} from './rules.mjs';
import {buildGraph,findPath} from './graph.mjs';

const href=(phi,neg,wob,ga=50)=>`https://x/algoart/?seed=s&phi=${phi}&neg=${neg}&wob=${wob}&ga=${ga}`;
const works=[
 {studyId:'a',title:'Radiant Systems — Study 01',engine:'burst',material:'oil',href:href(96,34,31)},
 {studyId:'b',title:'Radiant Systems — Study 02',engine:'burst',material:'action',href:href(82,22,55)},
 {studyId:'c',title:'Golden Trajectories — Study 03',engine:'spiral',material:'oil',href:href(90,18,40),portrait:true}
];
const make=(visitorIndex=0)=>buildVisitorKnowledge({date:'2026-11-01',readableDate:'1 November 2026',floor:27,floorCount:27,
 roomIndex:2,roomName:{title:'Ways of Making'},works,facing:works[0],visitorIndex,floorWorks:12,floorSculptures:0,roomCount:5,
 floorDates:['2026-10-01','2026-11-01']});

test('forward chaining derives facts with justifications back to settings',()=>{
 const m=infer(works,'sceptic');
 const preds=m.wm.filter(f=>!f.base).map(f=>f.pred);
 for(const p of ['naturalExperiment','phiContrast','materialTest','goldenAngle','handmade','crowded'])assert.ok(preds.includes(p),p);
 const test2=m.wm.find(f=>f.pred==='materialTest');
 assert.match(proof(test2,2),/natural experiment/);
 assert.match(proof(test2,2),/mode setting/);
 // Temperament rules only fire for their temperament.
 assert.ok(m.wm.some(f=>f.kind==='opinion'&&/material, not φ/.test(f.text)));
 assert.ok(!infer(works,'enthusiast').wm.some(f=>/material, not φ/.test(f.text)));
});
test('semantic network finds and explains paths, and keeps myths marked',()=>{
 const g=buildGraph(works);
 const p=findPath(g,'work:c','fibonacci');
 assert.ok(p&&p.length<=4);
 assert.ok(findPath(g,'parthenon','phi')[0].rel.includes('without good evidence'));
});
test('notice, why (proof), why again (rule chain), bottom',()=>{
 resetSession();
 const k=make(0);
 let a=answerVisitor('what have you noticed?',k,{});
 assert.equal(a.route.kind,'rule');
 const w1=answerVisitor('why?',k,a.state);
 assert.match(w1.text,/^(That’s my opinion|Because)/);
 const w2=answerVisitor('why',k,w1.state);
 assert.match(w2.text,/My rule/);
 assert.match(answerVisitor('why',k,w2.state).text,/bottom of my reasons/);
});
test('graph question with a work and a concept',()=>{
 const k=make(0);
 const a=answerVisitor('how is this connected to fibonacci?',k,{});
 assert.equal(a.route.kind,'graph');
 assert.match(a.text,/Fibonacci/);
 assert.match(answerVisitor('why',k,a.state).text,/link/);
 // "connected" in a question shouldn't select the Connected Fields title.
 const b=answerVisitor('how is debussy connected to the tower?',k,{});
 assert.doesNotMatch(b.text,/Study/);
});
test('compare by ordinals reads settings side by side',()=>{
 const a=answerVisitor('compare the first and the last',make(0),{});
 assert.match(a.text,/Study 01.*Study 03/);
 assert.match(a.text,/φ pull of 96 against 90/);
});
test('names, shared memory and gossip between visitors',()=>{
 resetSession();
 const k=make(0),other=make(1);
 const n=answerVisitor("Hi, I'm Sam",k,{});
 assert.match(n.text,/Sam/);
 assert.equal(session.userName,'Sam');
 const asked={...n.state,awaiting:'phiOrMaterial'};
 answerVisitor('the material, definitely',k,asked);
 const g=greetVisitor(other);
 assert.match(g.text,/Sam/);
 assert.match(g.text,new RegExp(k.name));
 assert.match(g.text,/material matters more/);
 assert.match(answerVisitor('why?',other,g.state).text,/told me/);
});
test('overhearing two visitors in a room',()=>{
 const lines=overhear(make(0),make(1));
 assert.equal(lines.length,2);
 assert.ok(lines.fact);
});
test('visitor initiative and context chips',()=>{
 let s={};const k=make(2);
 const asked=[];
 for(const q of ['which works are here','tell me about the first one','what is phi?','is the golden ratio enough?','where have you come from?','what is this room called?']){
  const a=answerVisitor(q,k,s);s=a.state;if(a.state.awaiting)asked.push(a.state.awaiting);
 }
 assert.ok(asked.length>=1);
 assert.ok(suggestionsFor(k,{awaiting:'phiOrMaterial'}).includes('The material'));
 assert.ok(suggestionsFor(k,{lastRoute:{kind:'graph'}}).includes('Why?'));
});


test('notice is a grounded, conversational account of a particular pair of works',()=>{
 resetSession();
 const k=make(0);
 const a=answerVisitor('What have you noticed?',k,{});
 assert.match(a.text,/Radiant Systems.*Study 01/);
 assert.match(a.text,/Radiant Systems.*Study 02/);
 assert.match(a.text,/oil paint/);
 assert.match(a.text,/action painting/);
 assert.match(a.text,/composition|material|geometry/);
 assert.doesNotMatch(a.text,/fair test|Have you noticed that|Nothing jumps out/);
 assert.equal(a.route.kind,'rule');
 assert.ok(a.state.said.length>=2,'covers related comparison facts rather than repeating them');
 const b=answerVisitor('What have you noticed?',k,a.state);
 assert.notEqual(b.route.fact,a.route.fact);
 assert.doesNotMatch(b.text,/fair test|Have you noticed that/);
 const why=answerVisitor('Why?',k,b.state);
 assert.match(why.text,/Because/);
 assert.match(answerVisitor('why?',k,why.state).text,/My rule/);
});
test('different temperaments make specific, grounded observations',()=>{
 for(const persona of ['regular','sceptic','enthusiast']){
  const k=make(0);
  k.persona=persona;k.memory=infer(k.works,persona);
  const a=answerVisitor('what have you noticed?',k,{});
  assert.ok(a.text.split(' ').length>=28,persona);
  assert.doesNotMatch(a.text,/fair test|Nothing jumps out/);
  assert.equal(a.route.kind,'rule');
  if(persona==='enthusiast')assert.match(a.text,/φ/);
  if(persona==='sceptic')assert.match(a.text,/material|geometry/);
 }
});
test('a single-work room and reception avoid invented comparisons',()=>{
 const single=buildVisitorKnowledge({date:'2026-11-01',floor:1,floorCount:1,roomIndex:0,
  works:[{studyId:'one',title:'Just One',material:'marker',engine:'field',href:'https://x/?seed=one'}],visitorIndex:1});
 const a=answerVisitor('what have you noticed?',single,{});
 assert.match(a.text,/Just One/);assert.match(a.text,/Orbital/);
 assert.match(answerVisitor('why',single,a.state).text,/mode setting|composition system/);
 const reception=buildVisitorKnowledge({date:'reception',reception:true,floor:0,floorCount:27,roomIndex:0,works:[],visitorIndex:100});
 const r=answerVisitor('what have you noticed?',reception,{});
 assert.match(r.text,/building|floor|tower/);
 assert.doesNotMatch(r.text,/“.*”|hanging|same material/);
 assert.match(answerVisitor('why?',reception,r.state).text,/archived day|floor/);
});
test('repeated what-have-you-noticed turns do not recycle the same experiment',()=>{
 const k=make(0);
 let state={},facts=[];
 for(let i=0;i<9;i++){
  const a=answerVisitor('what have you noticed?',k,state);
  facts.push(a.route.fact||a.route.kind);
  state=a.state;
  assert.ok(a.text.length>20);
  assert.doesNotMatch(a.text,/fair test|Nothing jumps out/);
 }
 assert.equal(facts.filter(id=>['materialTest','naturalExperiment'].includes(k.memory.wm.find(f=>f.id===id)?.pred)).length,1);
});

test('v2 suggestion chips are fully visible without a nested scrolling area',()=>{
 assert.match(V2_CSS,/\.visitor-chat-v2 \.visitor-chat-chips\{[^}]*display:grid/);
 assert.match(V2_CSS,/\.visitor-chat-v2 \.visitor-chat-chips\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(V2_CSS,/\.visitor-chat-v2 \.visitor-chat-chips\{[^}]*max-height:none/);
 assert.match(V2_CSS,/\.visitor-chat-v2 \.visitor-chat-chips\{[^}]*overflow:visible/);
 assert.match(V2_CSS,/\.visitor-chat-v2 \.visitor-chat-chips\{[^}]*flex:0 0 auto/);
 assert.match(V2_CSS,/\.visitor-chat-v2 \.visitor-chat-chips button\{[^}]*min-height:44px/);
 assert.match(V2_CSS,/@media\(max-width:620px\)/);
 assert.match(V2_CSS,/@media\(max-height:570px\)/);
 const k=make(0);
 assert.ok(suggestionsFor(k,{}).length<=4);
});

test('the More topics chip exposes the whole supported knowledge catalogue without scrolling',()=>{
 const groups=topicGroupsFor(make(),{lastRoute:{kind:'graph'}});
 assert.equal(MORE_TOPICS_LABEL,'More topics…');
 assert.equal(TOPICS_PER_PAGE,4);
 assert.equal(groups.length,7);
 const names=groups.map(g=>g.category);
 assert.ok(names.includes('Golden ratio & nature'));
 assert.ok(names.includes('Art history & evidence'));
 assert.ok(names.includes('Simulated materials & forms'));
 const questions=groups.flatMap(g=>g.topics.map(t=>t.question));
 assert.ok(questions.includes('Is the nautilus shell golden?'));
 assert.ok(questions.includes('What is generative art?'));
 assert.ok(questions.includes('Why?'));
 assert.equal(new Set(questions).size,questions.length);
 const reception=buildVisitorKnowledge({reception:true,works:[],visitorIndex:100,roomIndex:0,floor:0});
 assert.ok(!topicGroupsFor(reception,{}).flatMap(g=>g.topics).some(t=>t.question==='Compare the first and the last'));
 assert.match(V2_CSS,/visitor-chat-topic-heading/);
});
