import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisitorKnowledge,answerVisitor,resolveWork,describeWork,visitorSuggestions} from './phi-visitor-chat.mjs';
import {KNOWLEDGE,matchKnowledge} from './phi-visitor-knowledge.mjs';

const works=[
 {title:'Connected Fields — Study 01',material:'marker',engine:'network',palette:'mono',phi:86,seed:'AA-1',size:3},
 {title:'Growth Systems — Study 02',material:'watercolour',engine:'organic',palette:'earth',phi:40,seed:'AWL-2',size:5}
];
const room=buildVisitorKnowledge({date:'2026-11-01',readableDate:'1 November 2026',floor:27,
 floorCount:27,roomIndex:2,roomName:{title:'Ways of Making',dimension:null,values:[]},
 works,floorWorks:12,floorSculptures:2,roomCount:5,visitorIndex:0,facing:works[1]});
test('a named work and local facing reference resolve from current room',()=>{
 assert.equal(resolveWork('tell me about this one',room)?.seed,'AWL-2');
 assert.equal(resolveWork('connected fields',room)?.seed,'AA-1');
 assert.equal(resolveWork('study 2',room)?.seed,'AWL-2');
 assert.equal(resolveWork('the second one',room)?.seed,'AWL-2');
});
test('material, engineering and palette descriptions come from study metadata',()=>{
 assert.match(describeWork(works[1]),/Growth Systems/);
 assert.match(describeWork(works[1]),/watercolour/);
 assert.match(describeWork(works[1]),/40 out of 100/);
});
test('multi-turn chat preserves last discussed artwork without hallucinating an LLM',()=>{
 const a=answerVisitor('connected fields',room,{});
 const b=answerVisitor('what do you think of it?',room,a.state);
 assert.match(b.text,/Connected Fields/);
 assert.equal(b.state.turns,2);
 assert.match(answerVisitor('who are you',room,{}).text,/not a language model/);
});
test('room names, tower counts, φ question and editor are recognised',()=>{
 assert.match(answerVisitor('what is this room called?',room,{}).text,/Ways of Making/);
 assert.match(answerVisitor('how many floors',room,{}).text,/27 exhibition floors/);
 assert.match(answerVisitor('is the golden ratio enough?',room,{}).text,/φ|golden ratio/);
 assert.match(answerVisitor('can i use the editor',room,{}).text,/editor/);
 assert.equal(visitorSuggestions(room).length,4);
});
test('empty reception does not invent exhibited artwork',()=>{
 const reception=buildVisitorKnowledge({date:'__phi_reception__',reception:true,floor:0,
 floorCount:27,roomIndex:0,works:[],floorWorks:0,floorSculptures:0,roomCount:4,visitorIndex:0});
 assert.match(answerVisitor('which works are here?',reception,{}).text,/upstairs/);
 assert.match(answerVisitor('tell me about the gramophone',reception,{}).text,/gramophone/i);
});
test('φ and art knowledge answers, follows on and stays honest about myths',()=>{
 let a=answerVisitor('what is phi?',room,{});
 assert.match(a.text,/1\.618/);
 a=answerVisitor('tell me more',room,a.state);
 assert.match(a.text,/0\.618/);
 assert.match(answerVisitor('does the parthenon use it?',room,{}).text,/no ancient evidence/);
 assert.match(answerVisitor('who was vera molnar',room,{}).text,/Molnár/);
 assert.match(answerVisitor('what about Dürer',room,{}).text,/Dürer/);
 assert.match(answerVisitor('is this art?',room,{}).text,/1965/);
 const m=answerVisitor('tell me about the gramophone',room,{});
 assert.match(answerVisitor('tell me more',room,m.state).text,/Debussy|Howat/);
 // A named work in the room still beats general knowledge.
 assert.match(answerVisitor('tell me about connected fields',room,{}).text,/AA-1|Connected Fields/);
});
test('every knowledge topic is reachable from its own keys',()=>{
 for(const topic of KNOWLEDGE)assert.equal(matchKnowledge(topic.keys[0])?.topic.id,topic.id,topic.id);
});
