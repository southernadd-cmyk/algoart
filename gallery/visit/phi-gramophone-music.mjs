// Optional, unobtrusive gallery soundtrack. The former gramophone exhibit
// has been removed; the same recordings now belong to the visitor controls.
import {createGramophoneRecord} from './gramophone-record-asap-test.mjs';

export function createPhiGalleryMusic(THREE,{canvas,debug=false}){
 const panel=document.createElement('dialog');
 panel.className='phi-gallery-music-dialog';
 panel.setAttribute('aria-labelledby','phi-gallery-music-title');
 panel.innerHTML=`<div class="phi-gallery-music-heading">
   <h2 id="phi-gallery-music-title">Gallery music</h2>
   <button type="button" class="music-close" aria-label="Close music controls">Close ×</button>
  </div>
  <p class="music-intro">An optional soundtrack while you explore. Music is off until you play it.</p>
  <label class="music-field">Recording <select class="music-choice" aria-label="Choose a recording"></select></label>
  <div class="music-transport">
   <button type="button" class="music-toggle">Play</button>
   <label class="music-field">Volume <input class="music-volume" aria-label="Music volume" type="range" min="0" max="0.4" step="0.01" value="0.18"></label>
  </div>
  <p class="music-error" role="status" aria-live="polite"></p>
  <small class="music-credit"></small><p><a class="music-source" target="_blank" rel="noopener noreferrer">Source and method</a></p>`;
 document.body.append(panel);
 const css=document.createElement('style');
 css.textContent=`
 .phi-gallery-music-dialog{box-sizing:border-box;width:min(390px,calc(100vw - 24px));max-width:none;
  margin:auto;padding:22px;border:1px solid #87968a;border-radius:5px;background:#f1eee7;color:#304237;
  box-shadow:0 18px 65px #17271c55;font:14px/1.5 Arial,Helvetica,sans-serif}
 .phi-gallery-music-dialog::backdrop{background:#15201888}
 .phi-gallery-music-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}
 .phi-gallery-music-heading h2{font:600 21px/1.3 Georgia,serif;margin:0}
 .phi-gallery-music-dialog .music-intro{margin:12px 0 18px;color:#526458}
 .phi-gallery-music-dialog .music-field{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:600}
 .phi-gallery-music-dialog .music-choice{max-width:100%;width:100%;min-height:40px;padding:8px;border:1px solid #87968a;
  border-radius:3px;background:#fffdfa;color:#304237;font:14px Arial,Helvetica,sans-serif}
 .phi-gallery-music-dialog .music-transport{display:flex;align-items:center;gap:18px;margin:18px 0}
 .phi-gallery-music-dialog .music-transport .music-field{flex:1}
 .phi-gallery-music-dialog button{min-height:38px;padding:8px 14px;border:1px solid #445d4b;border-radius:3px;
  color:#304237;background:#fffdfa;cursor:pointer;font:500 13px Arial,Helvetica,sans-serif}
 .phi-gallery-music-dialog .music-toggle{min-width:84px;background:#344a3d;color:#fff}
 .phi-gallery-music-dialog .music-volume{width:100%;margin:4px 0;accent-color:#344a3d}
 .phi-gallery-music-dialog .music-error{min-height:1.1em;margin:4px 0 8px;color:#8a352d}
 .phi-gallery-music-dialog .music-credit{color:#647065}
 .phi-gallery-music-dialog button:focus-visible,.phi-gallery-music-dialog select:focus-visible,
 .phi-gallery-music-dialog input:focus-visible{outline:2px solid #304b3c;outline-offset:3px}
 `;
 document.head.append(css);
 const trigger=document.createElement('button');
 trigger.type='button';trigger.textContent='Music';
 trigger.setAttribute('aria-haspopup','dialog');
 trigger.setAttribute('aria-expanded','false');
 document.querySelector('.top-actions').append(trigger);
 const toggle=panel.querySelector('.music-toggle');
 const choice=panel.querySelector('.music-choice');
 const volume=panel.querySelector('.music-volume');
 const problem=panel.querySelector('.music-error');
 const credit=panel.querySelector('.music-credit');
 const source=panel.querySelector('.music-source');
 let previousFocus=null;
 function sync(state){
  choice.value=String(state.index);
  toggle.textContent=state.playing?'Pause':'Play';
  trigger.textContent=state.playing?'Music · On':'Music';
  trigger.setAttribute('aria-label',state.playing?'Music playing, open controls':'Music off, open controls');
  problem.textContent=state.problem||'';
  credit.textContent=state.track.credit||'';
  source.href=state.track.source||'#';
  source.hidden=!state.track.source;
 }
 // Audio is not constructed, decoded, or fetched until the visitor opens Music.
 let record=null;
 function ensureRecord(){
  if(record)return;
  record=createGramophoneRecord({onChange:sync});
  record.audio.volume=Number(volume.value);
  record.tracks.forEach((track,i)=>{
   const option=document.createElement('option');option.value=String(i);
   option.textContent=track.composer+' — '+track.title;
   choice.append(option);
  });
  sync(record.state());
 }
 function open(){
  if(panel.open)return;
  previousFocus=document.activeElement;
  ensureRecord();
  document.exitPointerLock?.();
  panel.showModal();
  trigger.setAttribute('aria-expanded','true');
  panel.querySelector('.music-close').focus({preventScroll:true});
 }
 function closed(){
  trigger.setAttribute('aria-expanded','false');
  (previousFocus?.isConnected?previousFocus:canvas).focus({preventScroll:true});
 }
 const close=()=>{if(panel.open)panel.close();};
 trigger.addEventListener('click',open);
 panel.querySelector('.music-close').addEventListener('click',close);
 panel.addEventListener('close',closed);
 panel.addEventListener('keydown',event=>event.stopPropagation());
 panel.addEventListener('click',event=>{
  if(event.target!==panel)return;
  const bounds=panel.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();
 });
 toggle.addEventListener('click',()=>record?.toggle());
 choice.addEventListener('change',()=>record?.choose(Number(choice.value)));
 volume.addEventListener('input',()=>{if(record)record.audio.volume=Number(volume.value);});
 const hidden=()=>{if(document.hidden)record?.pause();};
 document.addEventListener('visibilitychange',hidden);
 if(debug)globalThis.__phiGalleryMusic={state:()=>record?.state()||{playing:false},get record(){return record;},open};
 return {open,isOpen:()=>panel.open,
  dispose(){
   record?.dispose();document.removeEventListener('visibilitychange',hidden);
   panel.removeEventListener('close',closed);panel.remove();trigger.remove();css.remove();
   if(debug)delete globalThis.__phiGalleryMusic;
  }
 };
}
