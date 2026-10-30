import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comparePhiPositions,phiListeningQuestion,getScorePoint} from '../gallery/visit/phi-gramophone-experience.mjs';
import {PHI_LISTENING_MARKERS,LISTEN_LEAD_IN_SECONDS} from '../gallery/visit/phi-gramophone-timeline.mjs';
import {ASAP_DEBUSSY_SOURCE} from '../gallery/visit/phi-gramophone-asap-debussy.mjs';

test('the visible study uses one recording clock for both positions',()=>{
 const duration=287.775625;
 const p=comparePhiPositions(ASAP_DEBUSSY_SOURCE,PHI_LISTENING_MARKERS[2].fraction,duration);
 assert.ok(p?.score?.verified);
 assert.equal(p.score.confidence,'published');
 assert.ok(Math.abs(p.score.time-157.63)<.2);
 assert.ok(Math.abs(p.time.time-174.15)<.1);
 assert.equal(p.time.start,.916667);
 assert.equal(p.time.end,281.210938);
 assert.ok(Math.abs(p.gapSeconds-(-16.52))<.5);
 assert.ok(Math.abs((p.score.time-LISTEN_LEAD_IN_SECONDS)-149.63)<.2);
 assert.equal(comparePhiPositions(ASAP_DEBUSSY_SOURCE,.618,NaN),null);
});
test('Mozart retains the known performance, never fakes independent bar annotation',()=>{
 const src='./audio/mozart-k545-allegro.ogg',duration=133.878;
 const p=comparePhiPositions(src,PHI_LISTENING_MARKERS[1].fraction,duration);
 assert.ok(p?.score);
 assert.ok(p.score.verified);
 assert.notEqual(p.score.confidence,'published');
 assert.ok(Math.abs(p.score.time-51.31)<.5);
 assert.ok(Math.abs(p.gapSeconds)<1);
 assert.match(phiListeningQuestion(src,1),/exposition/);
 assert.match(phiListeningQuestion(src,2),/Putz/);
 assert.match(phiListeningQuestion(ASAP_DEBUSSY_SOURCE,2),/Howat/);
 assert.equal(getScorePoint(src,.618,500),null);
});
test('new experience is test-only with shared timeline, progressive reveal, reflection and provenance',()=>{
 const source=readFileSync(new URL('../gallery/visit/phi-gramophone-experience.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../gallery/visit/phi-gramophone-experience.css',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const production=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 assert.match(builder,/phi-gramophone-experience\.mjs/);
 assert.match(source,/Reveal the golden divisions/);
 assert.match(source,/ONE FRACTION/);
 assert.match(source,/HEAR THE SCORE/);
 assert.match(source,/HEAR THE CLOCK/);
 assert.match(source,/What did you hear/);
 assert.match(source,/scorePoint|asapDebussyScorePoint/);
 assert.match(source,/timeupdate/);
 assert.match(source,/record\.play\(\)/);
 assert.match(source,/creativecommons\.org\/licenses\/by-nc-sa/);
 assert.match(css,/phi-listen-figure/);
 assert.match(css,/max-width:600px/);
 assert.doesNotMatch(production,/phi-gramophone-experience|ASAP_DEBUSSY_SOURCE/);
});

test('paired listening plays score then clock, stops, and cancels on track change',async()=>{
 const {createGramophonePhiTimeline}=await import('../gallery/visit/phi-gramophone-experience.mjs');
 class Element extends EventTarget{
  constructor(){super();this.children=[];this.dataset={};this.attributes={};}
  append(...items){this.children.push(...items);}
  setAttribute(k,v){this.attributes[k]=v;}
  querySelector(){return null;}
  remove(){}
 }
 const previous=globalThis.document;
 globalThis.document={createElement:()=>new Element(),createElementNS:()=>new Element(),head:new Element(),baseURI:'https://example.org/gallery/visit/'};
 try{
  const audio=new Element();audio.src='https://example.org/gallery/visit/audio/debussy-reflets-asap-kleisen.ogg';
  audio.duration=287.775625;audio.currentTime=0;audio.seeking=false;
  const track={src:ASAP_DEBUSSY_SOURCE};let playing=false,pauses=0;
  const record={audio,state:()=>({track,playing}),play:async()=>{playing=true;},pause:()=>{playing=false;pauses++;}};
  const panel=new Element(),ui=createGramophonePhiTimeline({panel,record});
  const all=e=>[e,...e.children.filter(x=>x instanceof Element).flatMap(all)];
  const both=all(panel).find(e=>e.className==='phi-listen-both');
  const p=comparePhiPositions(track.src,PHI_LISTENING_MARKERS[2].fraction,audio.duration);
  both.dispatchEvent(new Event('click'));
  assert.equal(audio.currentTime,p.score.time-8);assert.equal(playing,true);
  audio.currentTime=p.score.time+4;audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(audio.currentTime,p.time.time-8);
  audio.currentTime=p.time.time+4;audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(pauses,1);assert.equal(playing,false);
  both.dispatchEvent(new Event('click'));audio.src='https://example.org/other.ogg';ui.update();
  const before=audio.currentTime;audio.currentTime+=20;audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(audio.currentTime,before+20,'stale comparison must not seek the replacement recording');
  ui.dispose();
 }finally{globalThis.document=previous;}
});

test('Debussy clock proportions exclude a changed encoder tail',()=>{
 const f=PHI_LISTENING_MARKERS[2].fraction;
 assert.equal(comparePhiPositions(ASAP_DEBUSSY_SOURCE,f,286).time.time,
  comparePhiPositions(ASAP_DEBUSSY_SOURCE,f,288).time.time);
});
