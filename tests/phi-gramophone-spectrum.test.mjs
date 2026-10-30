import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GOLDEN_RATIO,phiSpectrumBands,createGramophonePhiSpectrum} from '../gallery/visit/phi-gramophone-spectrum.mjs';
import {RECEPTION_RECORD} from '../gallery/visit/gramophone-record.mjs';

class Param {
 constructor(){this.value=0;}
 setTargetAtTime(value){this.value=value;}
 cancelScheduledValues(){}
}
class Node {
 constructor(){this.connected=[];this.gain=new Param();this.frequency=new Param();this.Q=new Param();}
 connect(other){this.connected.push(other);return other;}
 disconnect(){this.connected=[];}
}
let lastContext=null;
class Context {
 constructor(){this.currentTime=10;this.destination=new Node();this.gains=[];this.filters=[];this.sources=[];this.resumes=0;lastContext=this;}
 createMediaElementSource(audio){const o=new Node();o.audio=audio;this.sources.push(o);return o;}
 createGain(){const o=new Node();this.gains.push(o);return o;}
 createBiquadFilter(){const o=new Node();this.filters.push(o);return o;}
 async resume(){this.resumes++;}
 async close(){this.closed=true;}
}
test('bands are placed at powers of phi and audio is not pitch-shifted',()=>{
 const bands=phiSpectrumBands();
 assert.equal(bands.length,6);
 assert.ok(Math.abs(GOLDEN_RATIO-1.618033988749895)<1e-10);
 for(let i=1;i<bands.length;i++)assert.ok(Math.abs(bands[i].frequency/bands[i-1].frequency-GOLDEN_RATIO)<1e-12);
 assert.equal(bands[0].frequency,220);
 assert.deepEqual(bands.map(b=>b.gain),[9,-7,9,-7,9,-7]);
 assert.deepEqual(bands.map(b=>b.Q),Array(6).fill(2.8));
});
test('effect starts dry, only connects on opt-in, supports instant A/B and preserves playhead',async()=>{
 const audio={currentTime:80.25,volume:.45,src:'./audio/debussy-reflets-dans-leau.ogg'};
 const phi=createGramophonePhiSpectrum(audio,{Context});
 assert.deepEqual(phi.state(),{enabled:false,initialised:false,filters:0});
 assert.equal(lastContext,null);
 await phi.setEnabled(true);
 const ctx=lastContext;
 assert.equal(ctx.sources.length,1);
 assert.equal(ctx.sources[0].audio,audio);
 assert.equal(ctx.filters.length,6);
 assert.equal(ctx.gains[0].gain.value,0);
 assert.equal(ctx.gains[1].gain.value,.72);
 assert.equal(phi.state().enabled,true);
 assert.equal(audio.currentTime,80.25);
 await phi.setEnabled(false);
 assert.equal(ctx.gains[0].gain.value,1);
 assert.equal(ctx.gains[1].gain.value,0);
 assert.equal(audio.volume,.45);
 assert.equal(ctx.sources.length,1,'one media element source must survive repeated toggles');
 await phi.toggle();
 assert.equal(phi.state().enabled,true);
 assert.equal(ctx.sources.length,1);
 phi.dispose();
 assert.equal(ctx.closed,true);
 await assert.rejects(()=>phi.setEnabled(true),/disposed/);
});
test('original recordings and production music controller are untouched',()=>{
 assert.deepEqual(RECEPTION_RECORD.map(t=>t.composer),['Claude Debussy','Wolfgang Amadeus Mozart']);
 const music=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(music,/phi-gramophone-spectrum|record-phi-spectrum/);
 assert.match(builder,/gramophone-phi-spectrum-staging-only/);
 assert.match(builder,/Hear φ spectrum/);
 assert.match(builder,/phiSpectrum\.dispose\(\)/);
 assert.doesNotMatch(builder,/8bars-gramophone|Compose another/);
});
