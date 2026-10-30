import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 ASAP_DEBUSSY_SOURCE,ASAP_DEBUSSY_SCORE_BARS,ASAP_DEBUSSY_DOWNBEATS,
 ASAP_DEBUSSY_LAST_BEAT,asapDebussyScorePoint
} from '../gallery/visit/phi-gramophone-asap-debussy.mjs';
import {RECEPTION_RECORD_ASAP_TEST} from '../gallery/visit/gramophone-record-asap-test.mjs';
import {RECEPTION_RECORD} from '../gallery/visit/gramophone-record.mjs';
import {PHI_LISTENING_MARKERS} from '../gallery/visit/phi-gramophone-timeline.mjs';

const provenance=JSON.parse(readFileSync(new URL('../gallery/visit/audio/debussy-reflets-asap-kleisen-provenance.json',import.meta.url),'utf8'));

test('published ASAP performance: all 94 actual downbeats and exact-source audio checksum',()=>{
 assert.equal(ASAP_DEBUSSY_SCORE_BARS,94);
 assert.equal(ASAP_DEBUSSY_DOWNBEATS.length,94);
 assert.ok(ASAP_DEBUSSY_DOWNBEATS[0]>.8&&ASAP_DEBUSSY_DOWNBEATS[0]<1.1);
 assert.ok(ASAP_DEBUSSY_DOWNBEATS.every((s,i)=>i===0||s>ASAP_DEBUSSY_DOWNBEATS[i-1]));
 assert.ok(ASAP_DEBUSSY_LAST_BEAT>ASAP_DEBUSSY_DOWNBEATS.at(-1));
 assert.ok(provenance.oggDurationSeconds>ASAP_DEBUSSY_LAST_BEAT);
 assert.ok(provenance.oggDurationSeconds<ASAP_DEBUSSY_LAST_BEAT+8);
 assert.equal(provenance.license,'CC BY-NC-SA 4.0');
 assert.equal(provenance.derivedFromOriginalWav,true);
 const bytes=readFileSync(new URL('../gallery/visit/audio/debussy-reflets-asap-kleisen.ogg',import.meta.url));
 assert.ok(bytes.byteLength>1e6&&bytes.byteLength<16e6,'must contain real playable Ogg, not placeholder');
 assert.equal(bytes.toString('latin1',0,4),'OggS','must be an Ogg file');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.oggSha256,
   'Exact recorded audio bytes must match the imported provenance');
});

test('test-only recording choice leaves live Debussy and Mozart untouched',()=>{
 assert.equal(RECEPTION_RECORD_ASAP_TEST.length,2);
 assert.equal(RECEPTION_RECORD_ASAP_TEST[0].src,ASAP_DEBUSSY_SOURCE);
 assert.match(RECEPTION_RECORD_ASAP_TEST[0].credit,/ASAP.*CC BY-NC-SA/);
 assert.deepEqual(RECEPTION_RECORD_ASAP_TEST[1],RECEPTION_RECORD[1]);
 assert.notEqual(RECEPTION_RECORD_ASAP_TEST[0].src,RECEPTION_RECORD[0].src);
 const live=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 const staging=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 assert.match(live,/gramophone-record\.mjs\?v=selectable-tracks/);
 assert.doesNotMatch(live,/gramophone-record-asap-test|phi-gramophone-asap-debussy/);
 assert.match(readFileSync(new URL('../gallery/visit/phi-gramophone-music.mjs',import.meta.url),'utf8'),/gramophone-record-asap-test\.mjs/);
});

test('each golden-score division seeks the annotated Debussy performance',()=>{
 const percent=[23.6,38.2,61.8,76.4];
 const expectedTimes=[68.27,104.80,157.63,215.15];
 for(let i=0;i<PHI_LISTENING_MARKERS.length;i++){
   const marker=PHI_LISTENING_MARKERS[i];
   const point=asapDebussyScorePoint(ASAP_DEBUSSY_SOURCE,marker.fraction,provenance.oggDurationSeconds);
   assert.ok(Math.abs(marker.fraction*100-percent[i])<.1);
   assert.ok(point?.verified);
   assert.equal(point.confidence,'published');
   assert.ok(Math.abs(point.time-expectedTimes[i])<.6);
   assert.ok(point.time>0&&point.time<provenance.oggDurationSeconds);
 }
 assert.equal(asapDebussyScorePoint(ASAP_DEBUSSY_SOURCE,.618,320),null);
 assert.equal(asapDebussyScorePoint('./audio/other.ogg',.618,provenance.oggDurationSeconds),null);
});

test('test interface includes recording, score and license attribution',()=>{
 const timeline=readFileSync(new URL('../gallery/visit/phi-gramophone-experience.mjs',import.meta.url),'utf8');
 assert.match(timeline,/asapDebussyScorePoint/);
 assert.match(timeline,/provenance/);
 assert.match(timeline,/creativecommons\.org\/licenses\/by-nc-sa\/4\.0/);
 assert.match(timeline,/ASAP-annotated score downbeats/);
});
