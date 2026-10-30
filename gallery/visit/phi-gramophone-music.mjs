// Test-tower listening room. Native dialog keeps the exhibit above gallery chrome.
import {createGramophoneRecord} from './gramophone-record-asap-test.mjs';
import {createGallerySpeakerFeed} from './gallery-speakers.mjs?v=distributed-record-20261027';
import {createGramophonePhiTimeline} from './phi-gramophone-experience.mjs';

export function createPhiGalleryMusic(THREE,{canvas,debug=false}){
 const panel=document.createElement('dialog');panel.className='phi-gramophone-dialog';
 panel.setAttribute('aria-labelledby','phi-listening-title');
 panel.innerHTML=`<header class="phi-record-header"><div><span class="phi-record-overline">PROPORTION PIECE / LISTENING STUDY 01</span><h2 id="phi-listening-title">Where does <i>φ</i> fall?</h2></div><button type="button" class="record-close" aria-label="Close gramophone controls">Close <span aria-hidden="true">×</span></button></header>
 <div class="phi-record-body"><aside class="phi-record-sidebar" aria-label="Recording controls"><div><span class="phi-record-overline">01 / CHOOSE A RECORDING</span><div class="record-tracks" role="group" aria-label="Choose a recording"></div><select class="record-choice" aria-label="Choose a recording"></select></div><div class="phi-record-intro"><span class="record-track" hidden></span><p class="record-interpretation"></p></div><div class="phi-record-transport"><button type="button" class="record-toggle">Play recording</button><label>Volume <input aria-label="Gramophone volume" type="range" min="0" max="1" step="0.01" value="0.45"></label><p class="record-error" role="status"></p></div><p class="phi-record-context">The score counts written bars. The clock counts performed time. A steady tempo brings them together; expressive timing can pull them apart.</p><small class="record-credit"></small></aside><main class="phi-record-study" aria-label="Score and clock comparison"></main></div>`;
 document.body.append(panel);
 const css=document.createElement('link');css.rel='stylesheet';css.href='./phi-gramophone-experience.css?v=dialog-redesign-20261030';document.head.append(css);
 const trigger=document.createElement('button');trigger.type='button';trigger.textContent='Gramophone';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 document.querySelector('.top-actions').append(trigger);
 const toggle=panel.querySelector('.record-toggle'),title=panel.querySelector('.record-track'),credit=panel.querySelector('.record-credit'),interpretation=panel.querySelector('.record-interpretation'),problem=panel.querySelector('.record-error'),volume=panel.querySelector('input');
 const choice=panel.querySelector('.record-choice');
 let trackButtons=[],goldenTimeline=null,previousFocus=null;
 function sync(s){
  title.textContent=s.track.title;credit.textContent=s.track.credit;
  interpretation.textContent=s.index===0?'Debussy lets the score and the clock drift apart. Compare where each places the same fraction.':'In this Mozart performance, the golden-section points nearly meet. Listen for the formal boundary.';
  problem.textContent=s.problem;toggle.textContent=s.playing?'Pause recording':'Play recording';
  choice.value=String(s.index);
  trackButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===s.index)));
  goldenTimeline?.update();
 }
 const record=createGramophoneRecord({onChange:sync});
 trackButtons=record.tracks.map((track,i)=>{
  const button=document.createElement('button');button.type='button';
  const composer=document.createElement('strong'),work=document.createElement('span');
  composer.textContent=track.composer==='Claude Debussy'?'Debussy':'Mozart';work.textContent=i===0?'Reflets dans l’eau':'Sonata K. 545 · Allegro';
  button.append(composer,work);button.addEventListener('click',()=>record.choose(i));panel.querySelector('.record-tracks').append(button);return button;
 });
 record.tracks.forEach((track,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=i===0?'Debussy · Reflets':'Mozart · K. 545';choice.append(option);});
 choice.addEventListener('change',()=>record.choose(Number(choice.value)));
 const position=new THREE.Vector3();
 const feed=createGallerySpeakerFeed(record,{positionOf:source=>source.getWorldPosition(position)});
 goldenTimeline=createGramophonePhiTimeline({panel:panel.querySelector('.phi-record-study'),record});sync(record.state());
 function open(){
  if(panel.open)return;previousFocus=document.activeElement;document.exitPointerLock?.();
  panel.showModal();trigger.setAttribute('aria-expanded','true');panel.querySelector('.record-close').focus({preventScroll:true});
 }
 function closed(){trigger.setAttribute('aria-expanded','false');(previousFocus?.isConnected?previousFocus:canvas).focus({preventScroll:true});}
 function close(){if(panel.open)panel.close();}
 trigger.addEventListener('click',open);panel.querySelector('.record-close').addEventListener('click',close);
 panel.addEventListener('close',closed);
 // Preserve native Tab trapping and Escape; prevent gallery movement shortcuts.
 panel.addEventListener('keydown',event=>event.stopPropagation());
 panel.addEventListener('click',event=>{
  if(event.target!==panel)return;const r=panel.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
 });
 toggle.addEventListener('click',()=>record.toggle());volume.addEventListener('input',()=>feed.setVolume(volume.value));
 const hidden=()=>{if(document.hidden)record.pause();};document.addEventListener('visibilitychange',hidden);
 if(debug)globalThis.__phiGalleryMusic={state:record.state,record,open,speakers:feed.snapshot};
 // In the listening modal, use the chosen listening volume; outside it,
 // resume the gallery's distance-based loudspeaker feed.
 const update=listener=>{const gain=feed.update(listener);if(panel.open)record.audio.volume=feed.snapshot().volume;return gain;};
 return {record,open,isOpen:()=>panel.open,update,setEmitters:feed.setEmitters,
  dispose(){goldenTimeline.dispose();record.dispose();document.removeEventListener('visibilitychange',hidden);panel.removeEventListener('close',closed);panel.remove();trigger.remove();css.remove();if(debug)delete globalThis.__phiGalleryMusic;}
 };
}
