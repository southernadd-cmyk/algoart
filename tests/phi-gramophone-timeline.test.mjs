import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PHI,PHI_LISTENING_MARKERS,WRITTEN_SCORE_BARS,scorePositionsForTrack,
  timelineForDuration,formatRecordTime,LISTEN_LEAD_IN_SECONDS
} from '../gallery/visit/phi-gramophone-timeline.mjs';
import {RECEPTION_RECORD} from '../gallery/visit/gramophone-record.mjs';

test('four nested golden-section markers are shared by score and recording',()=>{
 const expected=[.23606797749979,.3819660112501,.618033988749895,.76393202250021];
 assert.equal(PHI_LISTENING_MARKERS.length,4);
 assert.ok(Math.abs(PHI-1.618033988749895)<1e-12);
 PHI_LISTENING_MARKERS.forEach((marker,i)=>{
  assert.ok(Math.abs(marker.fraction-expected[i])<1e-11);
  assert.equal(marker.label,(expected[i]*100).toFixed(1)+'%');
 });
 assert.deepEqual(PHI_LISTENING_MARKERS.map(m=>m.level),
  ['secondary','primary','primary','secondary']);
});

test('score markers use verified written-bar counts, not performance duration',()=>{
 assert.equal(WRITTEN_SCORE_BARS[RECEPTION_RECORD[0].src],94);
 assert.equal(WRITTEN_SCORE_BARS[RECEPTION_RECORD[1].src],73);
 assert.deepEqual(scorePositionsForTrack(RECEPTION_RECORD[0].src).map(p=>p.nearestBar),
  [23,36,59,72]);
 assert.deepEqual(scorePositionsForTrack(RECEPTION_RECORD[1].src).map(p=>p.nearestBar),
  [18,28,46,56]);
 assert.deepEqual(scorePositionsForTrack('missing.ogg'),[]);
});

test('recording marker durations are independent of score and seek with a lead-in',()=>{
 assert.deepEqual(timelineForDuration(Infinity),[]);
 assert.deepEqual(timelineForDuration(0),[]);
 const points=timelineForDuration(200);
 assert.equal(points.length,4);
 points.forEach((p,i)=>{
  assert.equal(p.time,200*PHI_LISTENING_MARKERS[i].fraction);
  assert.equal(p.listenFrom,p.time-LISTEN_LEAD_IN_SECONDS);
 });
 const short=timelineForDuration(10);
 assert.equal(short[0].listenFrom,0,'short recording cannot seek before start');
 assert.equal(formatRecordTime(65.5),'1:05');
 assert.equal(formatRecordTime(3661),'1:01:01');
 assert.equal(formatRecordTime(NaN),'–:––');
});

test('staging gallery has both musical and performance time references without modifying sound',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const timeline=readFileSync(new URL('../gallery/visit/phi-gramophone-timeline.mjs',import.meta.url),'utf8');
 const music=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 assert.match(builder,/gramophone-phi-time-markers-test-only/);
 assert.match(builder,/createGramophonePhiTimeline/);
 assert.match(builder,/goldenTimeline\?\.dispose\(\)/);
 assert.match(timeline,/Reveal φ listening positions/);
 assert.match(timeline,/Written score/);
 assert.match(timeline,/record-phi-score-bar/);
 assert.match(timeline,/loadedmetadata/);
 assert.match(timeline,/currentTime=point\.listenFrom/);
 assert.doesNotMatch(timeline,/AudioContext|BiquadFilter|spectrum/);
 assert.doesNotMatch(builder,/gramophone-phi-spectrum-staging-only|record-phi-spectrum/);
 assert.doesNotMatch(music,/phi-gramophone-timeline|phi-gramophone-spectrum/);
});
