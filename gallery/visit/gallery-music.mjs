import {createGramophoneRecord} from './gramophone-record.mjs?v=selectable-tracks-20261027';
import {createGallerySpeakerFeed} from './gallery-speakers.mjs?v=distributed-record-20261027';

export function createPhiGalleryMusic(THREE,{canvas,debug=false}){
 const style=document.createElement('style');style.textContent=`
 .gramophone-panel{position:fixed;z-index:7;right:24px;bottom:78px;width:min(400px,calc(100vw - 24px));box-sizing:border-box;max-height:calc(100dvh - 240px);overflow-y:auto;overscroll-behavior:contain;padding:18px;background:var(--glass);box-shadow:0 8px 40px #0003;font:14px/1.5 Georgia,serif}
 .gramophone-panel h2{font:normal 29px "AlgoArt Marker",Georgia;margin:0 24px 12px 0}.gramophone-panel p{margin:10px 0}.gramophone-panel button{background:#34433c;color:white;border:0;padding:10px 16px;font:14px Arial,sans-serif}.gramophone-panel .record-close{position:absolute;right:12px;top:8px;background:none;color:#34433c;font-size:24px;padding:3px 8px}.gramophone-panel label{display:flex;align-items:center;gap:12px;margin-top:14px}.gramophone-panel input{width:100%;min-height:30px}.gramophone-panel small{display:block;color:#576158;font-size:11px}.gramophone-panel a{color:inherit;text-underline-offset:3px}.gramophone-panel .record-tracks{display:grid;gap:6px;margin:12px 0}.gramophone-panel .record-tracks button{background:#d7d7cb;color:#263831;text-align:left;padding:9px 11px}.gramophone-panel .record-tracks button[aria-pressed="true"]{background:#34433c;color:#fff}.gramophone-panel .record-analysis-video{display:inline;background:none;border:0;color:inherit;padding:0;text-align:left;text-decoration:underline;text-underline-offset:3px;font:inherit;cursor:pointer}
 .gramophone-video-dialog{position:fixed;inset:0;margin:auto;border:0;padding:15px;background:#e9e4d5;color:#263831;box-shadow:0 12px 70px #0008;width:min(850px,calc(100vw - 24px));max-height:calc(100dvh - 24px)}.gramophone-video-dialog::backdrop{background:#141c19bd}.gramophone-video-dialog h2{font:normal 25px "AlgoArt Marker",Georgia;margin:0 45px 12px 0}.gramophone-video-dialog .video-frame{width:100%;aspect-ratio:16/9;background:#171d19}.gramophone-video-dialog iframe{display:block;width:100%;height:100%;border:0}.gramophone-video-dialog .video-close{position:absolute;top:9px;right:9px;background:#34433c;color:white;border:0;font:23px Arial;padding:5px 12px;cursor:pointer}.gramophone-video-dialog .video-context{font:14px/1.5 Georgia,serif;margin:10px 0 0}.gramophone-video-dialog a{display:inline-block;margin-top:10px;color:inherit;text-underline-offset:3px}.gramophone-video-dialog button:focus-visible,.gramophone-video-dialog a:focus-visible{outline:3px solid #c79750;outline-offset:3px}
 .gramophone-panel button:focus-visible,.gramophone-panel input:focus-visible{outline:3px solid #c79750;outline-offset:3px}
 @media(max-width:600px){.gramophone-panel{right:12px;bottom:100px;max-height:calc(100dvh - 190px);padding:15px;font-size:13px}}`;
 document.head.append(style);
 const panel=document.createElement('section');panel.className='gramophone-panel';panel.hidden=true;panel.setAttribute('aria-label','Gallery music');
 panel.innerHTML='<button type="button" class="record-close" aria-label="Close gramophone controls">×</button><h2>On the record</h2><p class="record-track" aria-live="polite"></p><div class="record-tracks" role="group" aria-label="Choose a recording"></div><small>Choose a recording. When it finishes, the next begins; both repeat through the gallery and lift speakers.</small><button type="button" class="record-toggle">Play record</button><label>Volume <input aria-label="Gramophone volume" type="range" min="0" max="1" step="0.01" value="0.45"></label><p class="record-error" role="status"></p><small class="record-credit"></small><p class="record-interpretation" aria-live="polite"></p><small><a href="./credits.html" target="_blank" rel="noopener">Recordings and model credits</a></small>';
 document.body.append(panel);
 const trigger=document.createElement('button');trigger.type='button';trigger.textContent='Gramophone';trigger.setAttribute('aria-expanded','false');document.querySelector('.top-actions').append(trigger);
 const toggle=panel.querySelector('.record-toggle'),title=panel.querySelector('.record-track'),credit=panel.querySelector('.record-credit'),interpretation=panel.querySelector('.record-interpretation'),problem=panel.querySelector('.record-error'),volume=panel.querySelector('input');
 let opened=false,trackButtons=[];
 const record=createGramophoneRecord({onChange:s=>{
  title.textContent=s.track.composer+' — '+s.track.title;credit.textContent=s.track.credit;interpretation.textContent=s.track.composer==='Claude Debussy'?'Roy Howat argues this piece uses golden-section proportions. Others dispute the interpretation. Listen and decide.':'John F. Putz examined golden-section claims in Mozart’s sonatas and found substantial deviations. Listen and decide.';problem.textContent=s.problem;toggle.textContent=s.playing?'Pause record':'Play record';
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
 title.textContent=record.state().track.composer+' — '+record.state().track.title;credit.textContent=record.state().track.credit;interpretation.textContent='Roy Howat argues this piece uses golden-section proportions. Others dispute the interpretation. Listen and decide.';
 function open(){opened=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');document.exitPointerLock?.();toggle.focus({preventScroll:true});}
 function close(){opened=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');canvas.focus({preventScroll:true});}
 trigger.addEventListener('click',()=>opened?close():open());panel.querySelector('.record-close').addEventListener('click',close);
 const outsidePanel=event=>{if(opened&&!panel.contains(event.target)&&!trigger.contains(event.target))close();};
 document.addEventListener('pointerdown',outsidePanel);
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
 toggle.addEventListener('click',()=>record.toggle());
 volume.addEventListener('input',()=>feed.setVolume(volume.value));
 const hidden=()=>{if(document.hidden)record.pause();};document.addEventListener('visibilitychange',hidden);
 if(debug)globalThis.__phiGalleryMusic={state:record.state,record,open,speakers:feed.snapshot};
 return {record,open,update:feed.update,setEmitters:feed.setEmitters,
  dispose(){record.dispose();document.removeEventListener('visibilitychange',hidden);document.removeEventListener('pointerdown',outsidePanel);trigger.remove();panel.remove();style.remove();if(debug)delete globalThis.__phiGalleryMusic;}
 };
}
