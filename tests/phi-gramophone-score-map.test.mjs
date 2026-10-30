import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PHI_LISTENING_MARKERS} from '../gallery/visit/phi-gramophone-timeline.mjs';
import {GRAMOPHONE_SCORE_MAP,alignedScorePoint} from '../gallery/visit/phi-gramophone-score-map.mjs';

const debussy='./audio/debussy-reflets-dans-leau.ogg';
const mozart='./audio/mozart-k545-allegro.ogg';
const sha=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
test('the score maps are pinned to these EXACT 2 gramophone audio files',()=>{
 for(const [key,barCount] of [[debussy,94],[mozart,73]]){
  const x=GRAMOPHONE_SCORE_MAP[key];
  assert.equal(x.scoreBars,barCount);
  assert.equal(x.starts.length,barCount);
  assert.equal(x.differences.length,barCount);
  assert.equal(sha('../gallery/visit/audio/'+key.split('/').at(-1)),x.sha256,
    'audio bytes changed: bar alignments must be reverified');
  assert.ok(x.starts.every((v,i)=>i===0||v>x.starts[i-1]));
  assert.ok(x.duration>x.starts.at(-1));
  assert.ok(x.differences.every(x=>Number.isFinite(x)&&x>=0));
 }
 assert.equal(GRAMOPHONE_SCORE_MAP[mozart].repeat,'no_repeats');
 assert.match(GRAMOPHONE_SCORE_MAP[debussy].editorialNote,/94-bar original/);
});
test('four golden divisions are crosschecked and mapped to the real recording timeline',()=>{
 for(const key of [debussy,mozart]){
  const x=GRAMOPHONE_SCORE_MAP[key];
  const points=PHI_LISTENING_MARKERS.map(marker=>alignedScorePoint(key,marker.fraction,x.duration));
  assert.equal(points.length,4);
  for(let i=0;i<4;i++){
   const expectedCrossChecked=key===debussy&&i===0?false:true;
   assert.equal(points[i].verified,expectedCrossChecked,
     'golden division cross-check status: '+key+' '+i);
   assert.ok(points[i].time>0&&points[i].time<x.duration);
   if(expectedCrossChecked)assert.ok(points[i].disagreement<=2);
   if(i)assert.ok(points[i].time>points[i-1].time);
  }
  assert.equal(alignedScorePoint(key,.618,x.duration+8),null,
    'wrong-length recording must never reuse timestamps');
 }
 const dp=PHI_LISTENING_MARKERS.map(x=>alignedScorePoint(debussy,x.fraction,332.875).time);
 const mp=PHI_LISTENING_MARKERS.map(x=>alignedScorePoint(mozart,x.fraction,133.878).time);
 assert.ok(Math.abs(dp[2]-191.86)<.3);
 assert.ok(Math.abs(mp[2]-82.52)<.3);
 assert.ok(Math.abs(dp[2]-332.875*PHI_LISTENING_MARKERS[2].fraction)>10,
   'Debussy score and time positions should be meaningfully different');
 assert.ok(Math.abs(mp[2]-133.878*PHI_LISTENING_MARKERS[2].fraction)<1.5);
});
test('a low interpolated disagreement cannot conceal one bad adjacent bar',()=>{
 const x=GRAMOPHONE_SCORE_MAP[debussy];
 const point=alignedScorePoint(debussy,PHI_LISTENING_MARKERS[0].fraction,x.duration);
 assert.ok(point.disagreement<2,'weighted disagreement alone appears acceptable');
 assert.equal(point.verified,false,'a divergent neighbouring bar disables the seek');
 assert.equal(point.confidence,'needs-review');
});

test('unverified Debussy bars cannot masquerade as verified alignment points',()=>{
 // Bar 91-93 time estimates differ substantially between independent DTW runs.
 const x=GRAMOPHONE_SCORE_MAP[debussy];
 const near91=alignedScorePoint(debussy,90.5/x.scoreBars,x.duration);
 assert.equal(near91.verified,false);
 assert.equal(near91.confidence,'needs-review');
 const wrong=alignedScorePoint('./audio/other.ogg',.618,x.duration);
 assert.equal(wrong,null);
});
test('only the test tower imports the score map, preserving two original recordings',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const music=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 const timeline=readFileSync(new URL('../gallery/visit/phi-gramophone-experience.mjs',import.meta.url),'utf8');
 assert.match(builder,/phi-gramophone-music/);
 assert.match(timeline,/alignedScorePoint/);
 assert.match(timeline,/scoreDot/);
 assert.match(timeline,/time-LISTEN_LEAD_IN_SECONDS/);
 assert.doesNotMatch(music,/phi-gramophone-score-map|phi-gramophone-timeline/);
});
