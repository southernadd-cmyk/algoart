import {createGramophoneRecord} from './gramophone-record.mjs?v=one-reception-record-20261027';
import {createGallerySpeakerFeed} from './gallery-speakers.mjs?v=distributed-record-20261027';

export function createPhiGalleryMusic(THREE,{canvas,debug=false}){
 const style=document.createElement('style');style.textContent=`
 .gramophone-panel{position:fixed;z-index:7;right:24px;bottom:78px;width:min(360px,calc(100vw - 32px));padding:22px;background:var(--glass);box-shadow:0 8px 40px #0003;font:14px/1.5 Georgia,serif}
 .gramophone-panel h2{font:normal 29px "AlgoArt Marker",Georgia;margin:0 24px 12px 0}.gramophone-panel p{margin:10px 0}.gramophone-panel button{background:#34433c;color:white;border:0;padding:10px 16px;font:14px Arial,sans-serif}.gramophone-panel .record-close{position:absolute;right:12px;top:8px;background:none;color:#34433c;font-size:24px;padding:3px 8px}.gramophone-panel label{display:flex;align-items:center;gap:12px;margin-top:14px}.gramophone-panel input{width:100%;min-height:30px}.gramophone-panel small{display:block;color:#576158;font-size:11px}.gramophone-panel a{color:inherit;text-underline-offset:3px}.gramophone-panel .record-tracks{display:grid;gap:6px;margin:12px 0}.gramophone-panel .record-tracks button{background:#d7d7cb;color:#263831;text-align:left;padding:9px 11px}.gramophone-panel .record-tracks button[aria-pressed="true"]{background:#34433c;color:#fff}.gramophone-panel button:focus-visible,.gramophone-panel input:focus-visible{outline:3px solid #c79750;outline-offset:3px}
 @media(max-width:600px){.gramophone-panel{right:12px;bottom:100px;padding:18px;font-size:13px}}`;
 document.head.append(style);
 const panel=document.createElement('section');panel.className='gramophone-panel';panel.hidden=true;panel.setAttribute('aria-label','Gallery music');
 panel.innerHTML='<button type="button" class="record-close" aria-label="Close gramophone controls">×</button><h2>On the record</h2><p class="record-track" aria-live="polite"></p><div class="record-tracks" role="group" aria-label="Choose a recording"></div><small>Select either recording. When it finishes, the next begins; both repeat as one record through the gallery and lift speakers.</small><p class="record-notes">Musical proportion: Ernő Lendvai’s analysis of Bartók; Roy Howat’s analysis of Debussy.</p><button type="button" class="record-toggle">Play record</button><label>Volume <input aria-label="Gramophone volume" type="range" min="0" max="1" step="0.01" value="0.45"></label><p class="record-error" role="status"></p><small class="record-credit"></small><small><a href="./credits.html" target="_blank" rel="noopener">Recordings and model credits</a></small>';
 document.body.append(panel);
 const trigger=document.createElement('button');trigger.type='button';trigger.textContent='Gramophone';trigger.setAttribute('aria-expanded','false');document.querySelector('.top-actions').append(trigger);
 const toggle=panel.querySelector('.record-toggle'),title=panel.querySelector('.record-track'),credit=panel.querySelector('.record-credit'),problem=panel.querySelector('.record-error'),volume=panel.querySelector('input');
 let opened=false,trackButtons=[];
 const record=createGramophoneRecord({onChange:s=>{
  title.textContent=s.track.composer+' — '+s.track.title;credit.textContent=s.track.credit;problem.textContent=s.problem;toggle.textContent=s.playing?'Pause record':'Play record';
  trackButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===s.index)));
 }});
 const trackList=panel.querySelector('.record-tracks');
 trackButtons=record.tracks.map((track,i)=>{
  const button=document.createElement('button');button.type='button';button.textContent=track.composer+' — '+track.title;
  button.setAttribute('aria-pressed',String(i===record.state().index));
  button.addEventListener('click',()=>record.choose(i));trackList.append(button);return button;
 });
 const position=new THREE.Vector3();
 const feed=createGallerySpeakerFeed(record,{positionOf:source=>source.getWorldPosition(position)});
 title.textContent=record.state().track.composer+' — '+record.state().track.title;credit.textContent=record.state().track.credit;
 function open(){opened=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');document.exitPointerLock?.();toggle.focus({preventScroll:true});}
 function close(){opened=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');canvas.focus({preventScroll:true});}
 trigger.addEventListener('click',()=>opened?close():open());panel.querySelector('.record-close').addEventListener('click',close);
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
 toggle.addEventListener('click',()=>record.toggle());
 volume.addEventListener('input',()=>feed.setVolume(volume.value));
 const hidden=()=>{if(document.hidden)record.pause();};document.addEventListener('visibilitychange',hidden);
 if(debug)globalThis.__phiGalleryMusic={state:record.state,record,open,speakers:feed.snapshot};
 return {record,open,update:feed.update,setEmitters:feed.setEmitters,
  dispose(){record.dispose();document.removeEventListener('visibilitychange',hidden);trigger.remove();panel.remove();style.remove();if(debug)delete globalThis.__phiGalleryMusic;}
 };
}
