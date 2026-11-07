import test from 'node:test';
import assert from 'node:assert/strict';
import {PHI,GOLDEN_TURN,PHI_COMPOSITIONS,phiCompositionEvents,createPhiCompositionPlayer} from '../gallery/visit/phi-music-compositions.mjs';

test('three original tracks identify a real structural relationship to phi',()=>{
 assert.equal(PHI_COMPOSITIONS.length,3);
 assert.ok(Math.abs(PHI*PHI-PHI-1)<1e-12);
 assert.ok(Math.abs(GOLDEN_TURN*360-137.50776405)<1e-6);
 assert.ok(PHI_COMPOSITIONS.every(t=>t.composer.includes('original')&&t.credit.includes('Original')&&t.explanation));
});

test('phi event lists are finite, in order, audible and deterministic',()=>{
 for(let i=0;i<3;i++){
  const events=phiCompositionEvents(i);
  assert.ok(events.length>35&&events.length<400, 'sparse enough for the 3D gallery');
  assert.deepEqual(events,phiCompositionEvents(i), 'no random generation');
  let last=-1;
  for(const e of events){
   assert.ok(Number.isFinite(e.at)&&e.at>=last);
   assert.ok(Number.isFinite(e.hz)&&e.hz>=55&&e.hz<=1200);
   assert.ok(e.dur>0&&e.dur<=8);
   assert.ok(e.vel>0&&e.vel<0.2);
   assert.ok(e.at<PHI_COMPOSITIONS[i].seconds);
   last=e.at;
  }
 }
 assert.throws(()=>phiCompositionEvents(-1),RangeError);
});

test('the spectral study actually uses exact phi frequency ratios',()=>{
 const events=phiCompositionEvents(0);
 assert.ok(events.some(e=>Math.abs(e.hz/(110*Math.pow(PHI,0.5))-1)<1e-10));
 assert.ok(events.some(e=>Math.abs(e.hz/(110*Math.pow(PHI,1.5))-1)<1e-10));
});

test('golden-angle pitch positions progress by the irrational turn',()=>{
 const events=phiCompositionEvents(1);
 const degrees=[0,2,4,7,9,12,14,16,19,21];
 const melodic=events.filter(e=>e.vel===0.065||e.vel===0.10);
 for(let i=0;i<Math.min(melodic.length,18);i++){
  const expected=174.614*Math.pow(2,degrees[Math.floor(((i*GOLDEN_TURN)%1)*degrees.length)]/12);
  assert.ok(Math.abs(melodic[i].hz-expected)<1e-7);
 }
});

test('recursive divisions place an event at the 61.8 percent boundary',()=>{
 const events=phiCompositionEvents(2);
 assert.ok(events.some(e=>Math.abs(e.at-20.8/PHI)<1e-8));
});

test('Web Audio is strictly lazy; stop clears a scheduler and closes the context',async()=>{
 let creations=0,closed=0,oscillators=0;
 class Param{
  setTargetAtTime(){}
  setValueAtTime(){}
  linearRampToValueAtTime(){}
 }
 class Node{
  constructor(){this.gain=new Param();this.frequency=new Param();this.delayTime={value:0};}
  connect(){return this;}
  disconnect(){}
 }
 class Osc extends Node{
  start(){oscillators++;}
  stop(){}
 }
 class FakeContext{
  constructor(){creations++;this.currentTime=0;this.destination=new Node();}
  createGain(){return new Node();}
  createDelay(){return new Node();}
  createOscillator(){return new Osc();}
  async resume(){}
  async close(){closed++;}
 }
 const player=createPhiCompositionPlayer({AudioContextType:FakeContext});
 assert.equal(creations,0);
 assert.equal(oscillators,0);
 await player.play(0,0.18);
 assert.equal(creations,1);
 assert.ok(oscillators>0);
 assert.equal(player.playing,true);
 player.setVolume(0);
 player.stop();
 assert.equal(player.playing,false);
 assert.equal(closed,1);
});
