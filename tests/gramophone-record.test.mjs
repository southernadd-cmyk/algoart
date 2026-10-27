import test from 'node:test';import assert from 'node:assert/strict';
import {createGramophoneRecord,RECEPTION_RECORD} from '../gallery/visit/gramophone-record.mjs';
class Media extends EventTarget{constructor(){super();this.paused=true;this.loads=0;this.starts=0;}load(){this.loads++;}async play(){this.paused=false;this.starts++;}pause(){this.paused=true;}removeAttribute(name){delete this[name];}}
test('the record waits for a visitor, plays both complete works in order and loops without overlap',async()=>{
 const audio=new Media(),player=createGramophoneRecord({audio});assert.equal(audio.src,undefined);assert.equal(audio.starts,0);assert.equal(audio.preload,'none');
 await player.play();assert.equal(audio.src,RECEPTION_RECORD[0].src);assert.equal(player.state().playing,true);
 audio.dispatchEvent(new Event('ended'));await Promise.resolve();assert.equal(audio.src,RECEPTION_RECORD[1].src);assert.equal(player.state().index,1);
 audio.dispatchEvent(new Event('ended'));await Promise.resolve();assert.equal(audio.src,RECEPTION_RECORD[0].src);assert.equal(player.state().index,0);assert.equal(audio.starts,3);
 player.pause();assert.equal(audio.paused,true);assert.equal(player.state().playing,false);
 player.dispose();const starts=audio.starts;audio.dispatchEvent(new Event('ended'));await player.play();assert.equal(audio.starts,starts);assert.equal(audio.src,undefined);
});
test('a blocked playback can be retried and never falsely reports playing',async()=>{
 const audio=new Media();audio.play=async()=>{throw new Error('blocked')};const player=createGramophoneRecord({audio});await player.play();assert.equal(player.state().playing,false);assert.ok(player.state().problem);
 audio.play=Media.prototype.play;await player.play();assert.equal(player.state().playing,true);assert.equal(player.state().problem,'');player.dispose();
});

test('visitors can select either listed track without overlapping playback',async()=>{
 assert.equal(RECEPTION_RECORD[0].composer,'Claude Debussy');
 assert.equal(RECEPTION_RECORD[1].composer,'Béla Bartók');
 const audio=new Media(),player=createGramophoneRecord({audio});
 player.choose(1);assert.equal(player.state().index,1);assert.equal(audio.src,RECEPTION_RECORD[1].src);assert.equal(audio.starts,0);
 await player.play();await player.choose(0);
 assert.equal(player.state().index,0);assert.equal(audio.src,RECEPTION_RECORD[0].src);
 assert.equal(player.state().playing,true);assert.equal(audio.starts,2);
 player.dispose();
});
