import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {create8barsGoldenTrack,GOLDEN_STUDY,PHI,planGoldenStudy,goldenPitchRates,encodeWav} from '../gallery/visit/phi-8bars-record.mjs';
import {createPhiTestGramophoneRecord} from '../gallery/visit/phi-gramophone-test-controller.mjs';
import {RECEPTION_RECORD} from '../gallery/visit/gramophone-record.mjs';

class Media extends EventTarget {
 constructor(){super();this.paused=true;this.loads=0;this.starts=0;this.loop=false;}
 load(){this.loads++;}
 async play(){this.paused=false;this.starts++;}
 pause(){this.paused=true;}
 removeAttribute(key){delete this[key];}
}
test('8bars plans exactly eight bars and phi remains exact in pitch and time',()=>{
 const calls=[];
 const compose=params=>{calls.push(params);return {bars:8,events:[
  {step:0,note:69,duration:4,velocity:.4,track:'lead'},
  {step:80,note:57,duration:2,velocity:.5,track:'pad'},
  {step:12,track:'kick',duration:1,velocity:.8}
 ]};};
 const {events}=planGoldenStudy(compose);
 assert.equal(calls[0].engine,'melodic');
 assert.equal(calls[0].seed,GOLDEN_STUDY.seed);
 assert.equal(calls[0].bpm,96);
 assert.equal(events.length,2);
 assert.deepEqual(goldenPitchRates(1.2),[1.2,1.2*PHI]);
 assert.ok(Math.abs(GOLDEN_STUDY.climax-12.360679775)<.00001);
 assert.equal(GOLDEN_STUDY.duration,20);
 const blob=encodeWav({sampleRate:22050,getChannelData:()=>new Float32Array(32).fill(.25)});
 assert.equal(blob.type,'audio/wav');assert.equal(blob.size,108);
});

test('test tower has the optional third record without changing the original two',async()=>{
 assert.equal(RECEPTION_RECORD.length,2);
 let rendered=0;
 const track=create8barsGoldenTrack({render:async()=>{rendered++;return new Blob(['music'],{type:'audio/wav'});}});
 const audio=new Media(),record=createPhiTestGramophoneRecord({audio,tracks:[...RECEPTION_RECORD,track]});
 assert.equal(record.tracks.length,3);assert.equal(rendered,0);assert.equal(record.state().track.composer,'Claude Debussy');
 record.choose(2);assert.equal(rendered,0);assert.equal(record.state().index,2);
 await record.play();assert.equal(rendered,1);assert.equal(audio.loop,true);assert.equal(record.state().playing,true);
 const url=audio.src;assert.match(url,/^blob:/);
 record.pause();await record.play();assert.equal(rendered,1);assert.equal(audio.src,url);
 record.choose(0);assert.equal(audio.loop,false);assert.equal(audio.src,RECEPTION_RECORD[0].src);
 record.dispose();
});

test('changing a track while the 8bars sample is preparing cannot start an old request',async()=>{
 let finish;
 const future=new Promise(resolve=>{finish=resolve;});
 const track=create8barsGoldenTrack({render:()=>future});
 const audio=new Media(),record=createPhiTestGramophoneRecord({audio,tracks:[...RECEPTION_RECORD,track]});
 record.choose(2);
 const playing=record.play();
 assert.equal(record.state().loading,true);
 record.choose(1);
 finish(new Blob(['test'],{type:'audio/wav'}));
 await playing;await Promise.resolve();
 assert.equal(record.state().index,1);
 assert.equal(record.state().playing,false);
 assert.equal(audio.starts,0);
 assert.equal(audio.src,RECEPTION_RECORD[1].src);
 record.dispose();
});

test('the golden record loops independently; originals still rotate without entering it',async()=>{
 const audio=new Media(),record=createPhiTestGramophoneRecord({audio,tracks:[
 ...RECEPTION_RECORD,create8barsGoldenTrack({render:async()=>new Blob(['study'],{type:'audio/wav'})})
 ]});
 await record.play();audio.dispatchEvent(new Event('ended'));await Promise.resolve();
 assert.equal(record.state().index,1);
 audio.dispatchEvent(new Event('ended'));await Promise.resolve();
 assert.equal(record.state().index,0);
 record.choose(2);await record.play();
 assert.equal(audio.loop,true);
 audio.dispatchEvent(new Event('ended'));await Promise.resolve();
 assert.equal(record.state().index,2);
 record.dispose();
});

test('the production source stays on the original two records',()=>{
 const music=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(music,/phi-8bars-record|phi-gramophone-test-controller/);
 assert.match(builder,/8bars-gramophone-staging-only/);
 assert.match(builder,/phi-gramophone-test-controller/);
});


test('Compose another replaces only the third tune with a new deterministic 8bars seed',async()=>{
 const seen=[],old=create8barsGoldenTrack({
  render:async()=>new Blob(['original'],{type:'audio/wav'})
 });
 const audio=new Media();
 const record=createPhiTestGramophoneRecord({
  audio,tracks:[...RECEPTION_RECORD,old],
  makeGoldenTrack:(seed,edition)=>{
   seen.push({seed,edition});
   return create8barsGoldenTrack({seed,edition,render:async({seed:renderedSeed})=>{
    assert.equal(renderedSeed,seed);
    return new Blob([seed],{type:'audio/wav'});
   }});
  }
 });
 const historic0=record.tracks[0],historic1=record.tracks[1];
 const result=record.composeAnother();await result;
 assert.equal(record.state().index,2);
 assert.equal(record.state().edition,2);
 assert.equal(record.state().playing,true);
 assert.equal(record.tracks[0],historic0);
 assert.equal(record.tracks[1],historic1);
 assert.notEqual(record.tracks[2],old);
 assert.equal(record.tracks[2].title,'Golden Frequency · study 2');
 assert.equal(seen[0].seed,GOLDEN_STUDY.seed+'-variation-2');
 const firstUrl=audio.src;
 await record.composeAnother();
 assert.equal(record.state().edition,3);
 assert.equal(record.tracks[2].title,'Golden Frequency · study 3');
 assert.equal(seen[1].seed,GOLDEN_STUDY.seed+'-variation-3');
 assert.notEqual(firstUrl,audio.src);
 assert.equal(record.tracks.length,3);
 assert.equal(audio.loop,true);
 record.dispose();
});

test('the staging build exposes a real button and keeps the live music panel isolated',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 assert.match(builder,/Compose another/);
 assert.match(builder,/record\\.composeAnother\\(\\)/);
 assert.match(builder,/record-compose/);
 assert.match(builder,/trackButtons\\.forEach/);
});
