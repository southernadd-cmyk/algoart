import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument,cubicKnots,pathD,validateDocument,simulateDocument,minimumJerk,ribbonForStroke} from '../test/graffiti/skuf-lab/gesture-model.mjs';
import {SKUF_SOURCES,describeCoverage,REFERENCE_TARGET} from '../test/graffiti/skuf-lab/references.mjs';
test('source register distinguishes research pages from reviewed photographs',()=>{
 assert.ok(SKUF_SOURCES.length>=5);
 assert.ok(SKUF_SOURCES.every(s=>s.url.startsWith('https://')&&s.limitation&&s.evidence&&s.category));
 assert.equal(describeCoverage().handstyleExamples,0);
 assert.ok(REFERENCE_TARGET.minimum>=15);
});
test('legacy geometry imports cubic and quadratic paths with editable handles',()=>{
 const a=cubicKnots('M 0 0 C 20 -10 40 20 60 50');
 assert.deepEqual(a[0].out,{x:20,y:-10});assert.deepEqual(a[1].in,{x:40,y:20});
 const b=cubicKnots('M 0 0 Q 30 60 70 0');assert.ok(b[0].out&&b[1].in);
});
test('nine SKUF gestures are editable but explicitly unapproved',()=>{
 const doc=initialDocument();
 assert.equal(doc.strokes.length,9);assert.equal(doc.revision,0);
 assert.ok(doc.strokes.every(s=>s.confidence==='inferred'));
 assert.ok(doc.strokes.some(s=>pathD(s).includes(' C ')));
 assert.strictEqual(validateDocument(doc),doc);
});
test('constant seed reproduces complete timed samples',()=>{
 const doc=initialDocument();
 assert.deepEqual(simulateDocument(doc),simulateDocument(doc));
 assert.notDeepEqual(simulateDocument(doc,{seed:'other'}),simulateDocument(doc));
});
test('time always increases and lifts remain explicit',()=>{
 const events=simulateDocument(initialDocument()).events;
 assert.ok(events.length>100);
 for(let i=1;i<events.length;i++)assert.ok(events[i].t>=events[i-1].t,'time reversed at '+i);
 assert.ok(events.some(e=>e.contact===false)&&events.some(e=>e.contact===true));
 assert.ok(events.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.pressure)));
});
test('minimum-jerk easing has correctly bounded endpoints',()=>{
 assert.equal(minimumJerk(0),0);
 assert.ok(Math.abs(minimumJerk(1)-1)<1e-12);
 assert.ok(minimumJerk(.1)<.1);
 assert.ok(minimumJerk(.9)>.9);
});
test('independent pressure yields a finite solid ribbon',()=>{
 const sim=simulateDocument(initialDocument());
 const geometry=ribbonForStroke(sim.events.filter(e=>e.strokeId==='S1'));
 assert.match(geometry,/^M.*Z$/);
 assert.ok(!geometry.includes('NaN')&&!geometry.includes('Infinity'));
});
test('disconnected strokes cannot falsely report continuous pen contact',()=>{
 const doc=initialDocument();doc.strokes[0].liftAfter=false;
 assert.throws(()=>simulateDocument(doc),/Unjoined strokes/);
});
test('genuinely adjacent strokes may remain joined',()=>{
 const doc=initialDocument(),first=doc.strokes[0],second=doc.strokes[1];
 second.knots[0].x=first.knots.at(-1).x;second.knots[0].y=first.knots.at(-1).y;
 first.liftAfter=false;
 const events=simulateDocument(doc).events;
 assert.ok(events.length>0);
});
test('invalid duration and duplicate identities are rejected',()=>{
 const doc=initialDocument();doc.strokes[0].durationMs=0;assert.throws(()=>validateDocument(doc));
 doc.strokes[0].durationMs=600;doc.strokes[1].id=doc.strokes[0].id;assert.throws(()=>validateDocument(doc));
});
