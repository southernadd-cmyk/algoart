import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisitorKnowledge,answerVisitor} from './chat-v2.mjs';
import {readName,resetSession} from './mind.mjs';

function room(works=[]){
 resetSession();
 return buildVisitorKnowledge({date:'2026-10-28',roomIndex:0,visitorIndex:1,floor:2,floorDates:['2026-10-27'],works});
}
const work=(studyId,title,material,extra={})=>({studyId,title,material,engine:'field',phi:60,neg:35,wob:60,...extra});

test('history question does not become a visitor origin story',()=>{
 const k=room();
 const r=answerVisitor('Where does the golden ratio come from?',k);
 assert.doesNotMatch(r.text,/came up from floor|first floor today/i);
 assert.match(r.text,/Euclid|ratio|geometry/i);
});
test('Fibonacci question is not treated as a help request',()=>{
 const r=answerVisitor('Can you help me understand Fibonacci?',room());
 assert.match(r.text,/Fibonacci|sequence|1, 1, 2/i);
 assert.doesNotMatch(r.text,/You can ask me about this room/i);
});
test('golden ratio special question is not room noticing',()=>{
 const r=answerVisitor("What's special about the golden ratio?",room());
 assert.doesNotMatch(r.text,/what I.ve noticed in this room|room has/i);
});
test('compare uses meaningful title words and material descriptors',()=>{
 const k=room([work('a','Study in Blue','marker'),work('b','The Quiet Field','tissue'),work('c','Oil Currents','oil')]);
 const r=answerVisitor('Compare Study in Blue with the oil one',k);
 assert.equal(r.route.kind,'compare');
 assert.deepEqual(r.route.works.map(w=>w.studyId),['a','c']);
});
test('same title works remain separate facts and have distinct labels',()=>{
 const k=room([work('first','Untitled drawing','oil'),work('second','Untitled drawing','marker')]);
 assert.equal(k.memory.wm.filter(f=>f.pred==='airy').length,2);
 assert.equal(k.memory.wm.filter(f=>f.pred==='handmade').length,2);
 const labels=k.memory.wm.filter(f=>f.pred==='airy').map(f=>f.text);
 assert.notEqual(labels[0],labels[1]);
 assert.match(labels.join(' '),/oil Untitled drawing/);
});
test('curly apostrophe and cautious name capture',()=>{
 assert.equal(readName('I’m Sam'),'Sam');
 assert.equal(readName("I'm Tired"),null);
 assert.equal(readName('call me later'),null);
 assert.equal(readName("I'm Sam and I like art"),null);
 assert.equal(readName('My name is Alex.'),'Alex');
});
