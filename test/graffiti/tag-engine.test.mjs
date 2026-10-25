import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTag,planFloorTags,HANDS,LETTERING_FORMS,REFERENCE_STUDIES,normaliseText,drawTag,PHI,goldenMetrics,letterSkeleton,tagDuration,strokeFraction} from './tag-engine.mjs';
import {buildSprayPlan} from './spray-paint.mjs';
import {planWritingMotion,connectionClear} from './writing-motion.mjs';
import {shapeStudyLetter} from './handstyles.mjs?v=bold-dialects-v5';

test('width increases paint weight without changing the letters or writing rhythm',()=>{
 const narrow=createTag('PROPORTION',{hand:'twist',seed:'width',paintWidth:1}),broad=createTag('PROPORTION',{hand:'twist',seed:'width',paintWidth:2});
 assert.equal(broad.weight,narrow.weight*2);assert.equal(createTag('ECHO').paintWidth,2);
 assert.deepEqual(narrow.strokes,broad.strokes);assert.deepEqual(narrow.writer,broad.writer);assert.deepEqual(narrow.motion,broad.motion);
 assert.ok(broad.bounds.width>narrow.bounds.width);assert.ok(broad.bounds.height>narrow.bounds.height);
 assert.throws(()=>createTag('ECHO',{paintWidth:0}),RangeError);assert.throws(()=>createTag('ECHO',{paintWidth:4}),RangeError);
 for(const hand of ['kadism','karma','sliks','style']){
  const tag=createTag('PROPORTION',{hand,paintWidth:3}),plan=buildSprayPlan(tag);
  for(const dab of plan.dabs){const r=dab.radius*plan.halo;assert.ok(dab.x-r>tag.bounds.x&&dab.x+r<tag.bounds.x+tag.bounds.width);assert.ok(dab.y-r>tag.bounds.y&&dab.y+r<tag.bounds.y+tag.bounds.height);}
 }
});
test('similar studies use different letter constructions before slant and scaling',()=>{
 const skeleton=(hand,ch)=>{const h=REFERENCE_STUDIES[hand];return shapeStudyLetter(ch,letterSkeleton(ch,{hand:h.family}),h,goldenMetrics()).strokes;};
 for(const [a,b] of [['twist','daver'],['kadism','karma'],['soviet','grey']]){
  const shapeA=[...'PROPORTION'].map(ch=>skeleton(a,ch)),shapeB=[...'PROPORTION'].map(ch=>skeleton(b,ch));assert.notDeepEqual(shapeA,shapeB);
 }
 for(const word of ['ECHO','PROPORTION']){
  const unscaled=new Set(Object.keys(REFERENCE_STUDIES).map(id=>JSON.stringify([...word].map(ch=>skeleton(id,ch)))));assert.equal(unscaled.size,50,word+' has fifty distinct constructions before writer transforms');
 }
 // Rounded O has no extra wicket head; spines are attached only to relevant
 // stem letters, so repeated Os no longer turn into the same tall loop.
 assert.notDeepEqual(skeleton('kadism','P'),skeleton('karma','P'));
});

test('GUESS has a distinct handwritten MUSHROOM construction and remains seeded',()=>{
 const a=createTag('MUSHROOM',{hand:'guess',seed:'PP-TAG-X1AXW',paintWidth:1.8});
 const b=createTag('MUSHROOM',{hand:'guess',seed:'PP-TAG-X1AXW',paintWidth:1.8});
 const generic=createTag('MUSHROOM',{hand:'jade',seed:'PP-TAG-X1AXW',paintWidth:1.8});
 assert.deepEqual(a,b);
 assert.notDeepEqual(a.strokes,generic.strokes);
 const hand=REFERENCE_STUDIES.guess,other=REFERENCE_STUDIES.jade,m=goldenMetrics();
 for(const ch of 'MUSHRO'){
  const glyph=letterSkeleton(ch,{hand:hand.family});
  const guess=shapeStudyLetter(ch,glyph,hand,m);
  const jade=shapeStudyLetter(ch,glyph,other,m);
  assert.notDeepEqual(guess.strokes,jade.strokes,ch+' uses a different pen construction');
 }
 assert.ok(a.motion.duration>0);
});

test('contrasting artist alphabets have independently constructed letters',()=>{
 const m=goldenMetrics();const word='MUSHRO';
 const vectors=['guess','faust','revok','kadism','zephyr','gorey'].map(id=>{
  const style=REFERENCE_STUDIES[id];
  return JSON.stringify([...word].map(ch=>shapeStudyLetter(ch,letterSkeleton(ch,{hand:style.family}),style,m).strokes));
 });
 assert.equal(new Set(vectors).size,vectors.length);
 for(const id of ['guess','faust','revok','kadism','zephyr','gorey']){
  const tag=createTag('MUSHROOM',{hand:id,seed:'PP-TAG-X1AXW'});
  assert.ok(tag.strokes.every(stroke=>stroke.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
  assert.deepEqual(tag,createTag('MUSHROOM',{hand:id,seed:'PP-TAG-X1AXW'}));
 }
});

test('SKOFE and SKUF use contrasting pen paths on the same word',()=>{
 const m=goldenMetrics();
 for(const ch of 'SKOFEMU'){
  const a=REFERENCE_STUDIES.skofe,b=REFERENCE_STUDIES.skuf;
  const pa=shapeStudyLetter(ch,letterSkeleton(ch,{hand:a.family}),a,m);
  const pb=shapeStudyLetter(ch,letterSkeleton(ch,{hand:b.family}),b,m);
  assert.notDeepEqual(pa.strokes,pb.strokes,ch+' must differ in construction');
 }
 for(const word of ['SKOF','MUSHROOM']){
  const tags=['skofe','skuf'].map(hand=>createTag(word,{hand,seed:'contrast-seed'}));
  assert.notDeepEqual(tags[0].strokes,tags[1].strokes);
  for(const tag of tags){assert.ok(tag.strokes.every(s=>s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));assert.deepEqual(tag,createTag(word,{hand:tag.hand,seed:'contrast-seed'}));}
 }
});

test('joins meet their actual neighbours, with no connection across a word break',()=>{
 let joins=0;
 for(const hand of Object.keys(HANDS))for(const seed of ['first','second']){
  const tag=createTag('ECHO MARK',{hand,seed});
  for(let i=0;i<tag.strokes.length;i++)if(tag.strokes[i].kind==='join'){
   const join=tag.strokes[i];joins++;
   assert.deepEqual(join.points[0],tag.strokes[i-1].points.at(-1),hand+' join start');
   assert.deepEqual(join.points.at(-1),tag.strokes[i+1].points[0],hand+' join end');
  }
  for(const connection of tag.flow.connections)assert.ok(!tag.text.slice(connection.from+1,connection.to).includes(' '));
  if(REFERENCE_STUDIES[hand]?.shape==='oneline')assert.equal(tag.strokes.filter(s=>s.kind==='letter').length,2);
  if(tag.strokes[0].kind==='entry')assert.deepEqual(tag.strokes[0].points.at(-1),tag.strokes[1].points[0]);
 }
 assert.ok(joins>30);
 assert.equal(connectionClear([{x:0,y:0},{x:50,y:0}],[{points:[{x:25,y:-10},{x:25,y:10}]}]),false);
 assert.equal(connectionClear([{x:0,y:0},{x:50,y:0}],[{points:[{x:0,y:-10},{x:0,y:10}]}]),true);
});
test('writer habits persist across words and seeds while execution changes',()=>{
 for(const hand of Object.keys(HANDS)){
  const a=createTag('ALPHA',{hand,seed:'hit-a'}),b=createTag('ALPHA',{hand,seed:'hit-b'}),c=createTag('MARK',{hand,seed:'other-word'});
  assert.deepEqual(a.writer,b.writer);assert.deepEqual(a.writer,c.writer);assert.notDeepEqual(a.strokes,b.strokes);
  for(const frame of [...a.construction.letters,...b.construction.letters,...c.construction.letters])assert.equal(frame.variant,a.writer.variants[frame.character]);
  for(const stroke of a.strokes)assert.ok(Math.abs(stroke.nib-a.writer.nib)<=.0121);
 }
});
test('turns slow the hand, lift travel pauses it, and shared playback follows the timing',()=>{
 const points=[...Array.from({length:101},(_,x)=>({x,y:0})),...Array.from({length:100},(_,i)=>({x:100,y:i+1}))];
 const strokes=[{points,kind:'letter'},{points:[{x:120,y:100},{x:150,y:100}],kind:'letter'}];
 const motion=planWritingMotion(strokes),tag={strokes,motion};
 assert.ok(motion.strokes[0].speeds[100]<motion.strokes[0].speeds[50]-.2);
 assert.ok(motion.strokes[1].pause>.035);
 const inPause=(motion.strokes[0].start+motion.strokes[0].duration+motion.strokes[1].pause/2)/motion.duration;
 assert.equal(strokeFraction(tag,0,inPause),1);assert.equal(strokeFraction(tag,1,inPause),0);
 assert.equal(strokeFraction(tag,1,1),1);
 const sprayTag={...tag,seed:'speed',ink:'#222222',weight:7,opacity:.9,sprayFlare:1,strokes:strokes.map(s=>({...s,weight:1,pressure:1,phase:0}))};
 const plan=buildSprayPlan(sprayTag),fast=plan.dabs.filter(d=>d.x>20&&d.x<70&&d.y<1),slow=plan.dabs.filter(d=>d.x>96&&d.y<5);
 const mean=xs=>xs.reduce((n,d)=>n+d.opacity,0)/xs.length;
 assert.ok(fast.length&&slow.length);assert.ok(mean(slow)>mean(fast)*1.08);
 assert.equal(plan.total,motion.duration);
});

test('aerosol deposits are seeded, stay in bounds and leave the phi geometry unchanged',()=>{
 const tag=createTag('ECHO',{seed:'aerosol'}),copy=structuredClone(tag),a=buildSprayPlan(tag),b=buildSprayPlan(copy);
 assert.deepEqual(a,b);assert.deepEqual(tag,copy);assert.ok(a.dabs.length>300);
 let previous=-1;
 for(const dab of a.dabs){assert.ok(dab.at>=previous);previous=dab.at;assert.ok(dab.opacity>0&&dab.opacity<=1);assert.ok(dab.radius>0);const r=dab.radius*a.halo;assert.ok(dab.x-r>tag.bounds.x&&dab.x+r<tag.bounds.x+tag.bounds.width);assert.ok(dab.y-r>tag.bounds.y&&dab.y+r<tag.bounds.y+tag.bounds.height);}
 assert.equal(a.total,tagDuration(tag));
 assert.notDeepEqual(a.dabs,buildSprayPlan(createTag('ECHO',{seed:'different'})).dabs);
});

test('all fifty reference studies have distinct recipes and valid spray footprints',()=>{
 assert.equal(Object.keys(REFERENCE_STUDIES).length,50);assert.equal(Object.keys(HANDS).length,53);
 const recipes=new Set(),signatures=new Set();
 for(const [id,study] of Object.entries(REFERENCE_STUDIES)){
  recipes.add(JSON.stringify([study.shape,study.lean,study.width,study.height,study.weight,study.spacing,study.join,study.bounce,study.gesture,study.flare]));
  const tag=createTag('ECHO',{hand:id,seed:'all-studies'}),spray=buildSprayPlan(tag);signatures.add(JSON.stringify(tag.strokes));
  assert.equal(tag.construction.metrics.ratio,PHI);assert.ok(spray.dabs.length>100);
  for(const dab of spray.dabs){const r=dab.radius*spray.halo;assert.ok(dab.x-r>tag.bounds.x&&dab.x+r<tag.bounds.x+tag.bounds.width,id);assert.ok(dab.y-r>tag.bounds.y&&dab.y+r<tag.bounds.y+tag.bounds.height,id);}
  if(study.shape==='oneline')assert.equal(tag.strokes.filter(s=>s.kind==='letter').length,1);
 }
 assert.equal(recipes.size,50);assert.equal(signatures.size,50);
});

test('phi constructs actual alphabet geometry, including bowl splits and crossbar intersections',()=>{
 const m=goldenMetrics();assert.ok(Math.abs(m.height/m.width-PHI)<1e-12);
 assert.ok(Math.abs(m.short+m.long-m.height)<1e-12);assert.ok(Math.abs(m.long/m.short-PHI)<1e-12);
 const A=letterSkeleton('A'),bar=A.strokes[1].points;
 assert.equal(bar[0].y,m.long);assert.equal(bar[1].y,m.long);
 // The crossbar ends lie on the two constructed diagonals, not at decorative
 // guide positions unrelated to the actual A.
 assert.ok(Math.abs(bar[0].x-m.width/2*(1-bar[0].y/m.height))<1e-12);
 const H=letterSkeleton('H');assert.ok(H.strokes[2].points.every(p=>p.y===m.long));
 const B=letterSkeleton('B');assert.ok(Math.abs(B.strokes[1].points.at(-1).y-m.short)<1e-12);
 assert.ok(Math.abs(B.strokes[2].points.at(-1).y-m.height)<1e-12);
 const normal=createTag('ABHOP',{seed:'phi-construction'}),different=createTag('ABHOP',{seed:'phi-construction',ratio:1.45});
 assert.notDeepEqual(normal.strokes,different.strokes);assert.notEqual(normal.construction.wordAdvance,different.construction.wordAdvance);
 assert.equal(normal.construction.letters.length,5);assert.equal(normal.construction.metrics.ratio,PHI);
 assert.throws(()=>goldenMetrics(0),RangeError);assert.throws(()=>goldenMetrics(100,1),RangeError);
});

test('every floor receives one or two reproducible tags, including upper floors',()=>{
 const seen=new Set();
 for(let floor=0;floor<300;floor++){
  const options={floorId:'exhibition-'+floor,seed:'tower'};
  const tags=planFloorTags(options);assert.ok(tags.length===1||tags.length===2);seen.add(tags.length);
  assert.deepEqual(tags,planFloorTags(options));
  for(const tag of tags){assert.equal(tag.floorId,options.floorId);assert.ok(HANDS[tag.hand]);}
 }
 assert.deepEqual([...seen].sort(),[1,2]);
});
test('new floors do not change the plans of existing exhibitions',()=>{
 const dates=['2026-10-21','2026-10-22','2026-10-23'];
 const before=dates.map(floorId=>planFloorTags({floorId}));
 const after=[...dates,'2026-10-24'].map(floorId=>planFloorTags({floorId}));
 assert.deepEqual(after.slice(0,3),before);assert.notDeepEqual(before[0],before[1]);
});
test('count validation prevents zero or more than two tags',()=>{
 for(const count of [0,3,-1,20,'all'])assert.throws(()=>planFloorTags({floorId:'a',count}),RangeError);
 assert.throws(()=>planFloorTags({}),TypeError);
 assert.equal(planFloorTags({floorId:'a',count:1}).length,1);assert.equal(planFloorTags({floorId:'a',count:2}).length,2);
});
test('whole words have deterministic finite geometry and bounds, including long words',()=>{
 for(const hand of Object.keys(HANDS))for(const word of ['PHI','ECHO','PROPORTION PIECE','ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,24),'0123456789 φ.!?-']){
  const tag=createTag(word,{seed:'test',hand});assert.deepEqual(tag,createTag(word,{seed:'test',hand}));
  assert.ok(tag.strokes.some(s=>s.kind==='flourish'));assert.ok(tag.bounds.width>0&&tag.bounds.height>0);
  for(const s of tag.strokes)for(const p of s.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>tag.bounds.x&&p.y>tag.bounds.y);assert.ok(p.x<tag.bounds.x+tag.bounds.width&&p.y<tag.bounds.y+tag.bounds.height);}
 }
 assert.notDeepEqual(createTag('PHI',{seed:'a'}).strokes,createTag('PHI',{seed:'b'}).strokes);
 assert.notDeepEqual(createTag('PHI',{hand:'loop'}).strokes,createTag('PHI',{hand:'cut'}).strokes);
});
test('normalisation supports words and phi, and rejects markup safely',()=>{
 assert.equal(normaliseText('hello φ 42!'),'HELLO φ 42!');assert.equal(normaliseText('é😊'),'');
 assert.equal(normaliseText('A'.repeat(100)).length,24);assert.equal(createTag('').text,'PHI');
 assert.throws(()=>createTag('TEST',{hand:'missing'}),RangeError);
});
test('actual legacy marker renderer draws the planned strokes without a recorder or settings mutation',()=>{
 const env={window:{}};vm.createContext(env);
 for(const file of ['random.js','phi.js','marker.js'])vm.runInContext(fs.readFileSync(new URL('../../js/'+file,import.meta.url),'utf8'),env);
 const marker=env.window.AlgoArt,original=marker.stroke;let deposits=0;
 const ctx={save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},stroke(){deposits++;},fill(){deposits++;},setLineDash(){},globalCompositeOperation:'source-over'};
 const tag=createTag('ECHO',{seed:'marker-reuse'}),copy=structuredClone(tag);
 drawTag(ctx,tag,{marker,finish:'marker'});assert.ok(deposits>=tag.strokes.length*2);assert.deepEqual(tag,copy);assert.equal(marker.stroke,original);assert.equal(marker.svgRecorder,undefined);
 const full=deposits;deposits=0;drawTag(ctx,tag,{marker,progress:0,finish:'marker'});assert.equal(deposits,0);
 drawTag(ctx,tag,{marker,progress:.4,finish:'marker'});assert.ok(deposits>0&&deposits<full);
});


test('lettering forms change construction while remaining seeded, finite and phi based',()=>{
 const forms=Object.keys(LETTERING_FORMS);assert.equal(forms.length,8);
 const shapes=new Set();
 for(const form of forms){
  const a=createTag('PROPORTION',{form,hand:'loop',seed:'forms'}),b=createTag('PROPORTION',{form,hand:'loop',seed:'forms'});
  assert.deepEqual(a,b);assert.equal(a.form,form);assert.equal(a.construction.metrics.width,100/PHI);
  shapes.add(JSON.stringify(a.strokes));
  for(const word of ['ABCDEFGHIJKLMNOPQRSTUVWX','YZ 0123456789φ.!?-','A A','I'])for(const paintWidth of [.75,3]){
   const t=createTag(word,{form,paintWidth});assert.ok(t.bounds.width>0&&t.bounds.height>0&&Number.isFinite(t.motion.duration));
   for(const stroke of t.strokes)for(const q of stroke.points){assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y));assert.ok(q.x>t.bounds.x&&q.x<t.bounds.x+t.bounds.width);assert.ok(q.y>t.bounds.y&&q.y<t.bounds.y+t.bounds.height);}
   if(LETTERING_FORMS[form].solid){assert.equal(t.flow.connections.length,0);assert.ok(t.strokes.every(s=>Number.isInteger(s.letterIndex)));}
  }
 }
 assert.equal(shapes.size,8);
 assert.notDeepEqual(createTag('BOR',{form:'blockbuster'}).strokes,createTag('BOR',{form:'bubble'}).strokes);
 assert.throws(()=>createTag('ECHO',{form:'unknown'}),RangeError);
});
test('mixed forms keep floor counts, words, inks and writers stable',()=>{
 const forms=new Set();
 for(let floor=1;floor<=150;floor++){
  const input={floorId:'exhibition-'+floor,seed:'mixed-forms'},plain=planFloorTags(input),mixed=planFloorTags({...input,form:'mixed'});
  assert.deepEqual(mixed,planFloorTags({...input,form:'mixed'}));assert.equal(mixed.length,plain.length);assert.ok([1,2].includes(mixed.length));
  mixed.forEach((p,i)=>{forms.add(p.form);assert.ok(LETTERING_FORMS[p.form]);for(const key of ['text','hand','ink','seed','x','y','scale','rotation'])assert.deepEqual(p[key],plain[i][key]);});
 }
 assert.equal(forms.size,8);
 assert.throws(()=>planFloorTags({floorId:1,form:'unknown'}),RangeError);
});
test('optical adjustments are bounded and independent of paint width',()=>{
 let corrected=0;
 for(const hand of ['loop','rush','cut','faust','twist']){
  const tag=createTag('MARK WORD',{hand}),narrow=createTag('MARK WORD',{hand,paintWidth:.75});
  assert.deepEqual(tag.spacing,narrow.spacing);
  for(const pair of tag.spacing.pairs){assert.ok(Math.abs(pair.shift)<=pair.maximum+1e-9);assert.ok(Math.abs(pair.after-pair.target)<=Math.abs(pair.before-pair.target)+.1);assert.ok(!tag.text.slice(pair.from+1,pair.to).includes(' '));if(Math.abs(pair.shift)>.1)corrected++;}
 }
 assert.ok(corrected>10);
});
test('thick spray preserves counter clearance and keeps detached droplets fine',()=>{
 for(const hand of ['loop','kadism','sliks']){
  const tag=createTag('PROPORTION',{hand,paintWidth:3}),plan=buildSprayPlan(tag);
  assert.ok(tag.strokes.some(s=>s.nozzleLimit>0));
  for(const dab of plan.dabs)for(const drop of dab.droplets)assert.ok(drop.radius<=.85);
  for(let i=0;i<tag.strokes.length;i++){
   const limit=tag.strokes[i].nozzleLimit;if(!limit)continue;
   const motion=tag.motion.strokes[i];for(const dab of plan.dabs.filter(d=>d.at>=motion.start&&d.at<=motion.start+motion.duration))assert.ok(dab.radius<=limit+1e-9);
  }
 }
});
