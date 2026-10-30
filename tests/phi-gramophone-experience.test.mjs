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
test('new experience is test-only with shared timeline, clear controls and provenance',()=>{
 const source=readFileSync(new URL('../gallery/visit/phi-gramophone-experience.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../gallery/visit/phi-gramophone-experience.css',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const production=readFileSync(new URL('../gallery/visit/gallery-music.mjs',import.meta.url),'utf8');
 assert.match(builder,/phi-gramophone-music\.mjs/);
 assert.match(source,/CHOOSE A PROPORTION/);
 assert.match(source,/ONE FRACTION/);
 assert.match(source,/HEAR THE SCORE/);
 assert.match(source,/HEAR THE CLOCK/);
 assert.doesNotMatch(source,/HEAR BOTH|STOP COMPARISON/);
 assert.match(source,/scorePoint|asapDebussyScorePoint/);
 assert.match(source,/timeupdate/);
 assert.match(source,/record\.play\(\)/);
 assert.match(source,/creativecommons\.org\/licenses\/by-nc-sa/);
 assert.match(css,/phi-listen-figure/);
 assert.match(css,/max-width:600px/);
 assert.doesNotMatch(production,/phi-gramophone-experience|ASAP_DEBUSSY_SOURCE/);
});

test('coincident score and clock points give one button; separated points give two',async()=>{
 const {createGramophonePhiTimeline}=await import('../gallery/visit/phi-gramophone-experience.mjs');
 class Element extends EventTarget{
  constructor(){super();this.children=[];this.dataset={};this.attributes={};this.classList={toggle(){}};}
  append(...items){this.children.push(...items);}
  setAttribute(k,v){this.attributes[k]=v;}
  querySelector(){return null;}
  remove(){}
 }
 const previous=globalThis.document;
 globalThis.document={createElement:()=>new Element(),createElementNS:()=>new Element(),head:new Element(),baseURI:'https://example.org/gallery/visit/'};
 try{
  const audio=new Element();audio.duration=133.878;audio.currentTime=0;
  const mozart={src:'./audio/mozart-k545-allegro.ogg'},debussy={src:ASAP_DEBUSSY_SOURCE};let track=mozart,playing=false;
  audio.src='https://example.org/gallery/visit/audio/mozart-k545-allegro.ogg';
  const record={audio,state:()=>({track,playing}),play:async()=>{playing=true;}};
  const panel=new Element(),ui=createGramophonePhiTimeline({panel,record});
  const all=e=>[e,...e.children.filter(x=>x instanceof Element).flatMap(all)];
  const time=all(panel).find(e=>e.className==='phi-listen-action time');
  const score=all(panel).find(e=>e.className==='phi-listen-action score');
  assert.equal(time.hidden,true);assert.equal(score.children[0].textContent,'HEAR THIS MOMENT');
  score.dispatchEvent(new Event('click'));assert.equal(playing,true);assert.ok(audio.currentTime>74&&audio.currentTime<75);
  track=debussy;audio.src='https://example.org/gallery/visit/audio/debussy-reflets-asap-kleisen.ogg';audio.duration=287.775625;ui.update();
  assert.equal(time.hidden,false);assert.equal(score.children[0].textContent,'HEAR THE SCORE');
  time.dispatchEvent(new Event('click'));assert.ok(Math.abs(audio.currentTime-166.148)<.01);
  ui.dispose();
 }finally{globalThis.document=previous;}
});

test('Debussy clock proportions exclude a changed encoder tail',()=>{
 const f=PHI_LISTENING_MARKERS[2].fraction;
 assert.equal(comparePhiPositions(ASAP_DEBUSSY_SOURCE,f,286).time.time,
  comparePhiPositions(ASAP_DEBUSSY_SOURCE,f,288).time.time);
});
