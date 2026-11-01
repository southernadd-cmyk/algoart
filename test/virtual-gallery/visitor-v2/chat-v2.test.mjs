import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisitorKnowledge,answerVisitor,greetVisitor,overhear,session,suggestionsFor} from './chat-v2.mjs';
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
