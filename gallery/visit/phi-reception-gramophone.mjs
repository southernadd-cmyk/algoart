import {loadPhiDecorAsset,fitPhiDecorAsset} from './phi-model-assets.mjs';
import {createGramophoneRecord} from './gramophone-record.mjs?v=one-reception-record-20261027';

export function addPhiReceptionGramophone(THREE,scene,{furnishing,elevation,camera,canvas,timber,trims,debug=false}){
 const root=new THREE.Group();root.name='phi-reception-gramophone';
 root.position.set(furnishing.desk.x+4.4,elevation,furnishing.desk.z+2.35);scene.add(root);
 const box=(w,h,d,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 box(1.12,.78,.66,0,.44,0,timber);box(1.18,.065,.72,0,.86,0,timber);
 for(const x of [-.44,.44])box(.075,.13,.48,x,.065,0,trims);
 for(const y of [.30,.59])box(.74,.025,.025,0,y,-.344,trims);
 loadPhiDecorAsset(new URL('./models/reception-gramophone.glb',import.meta.url).href).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=fitPhiDecorAsset(THREE,source.clone(true),.73);model.position.y=.895;root.add(model);root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Reception gramophone unavailable',error));
 const style=document.createElement('style');style.textContent=`
 .gramophone-panel{position:fixed;z-index:7;right:24px;bottom:78px;width:min(360px,calc(100vw - 32px));padding:22px;background:var(--glass);box-shadow:0 8px 40px #0003;font:14px/1.5 Georgia,serif}
 .gramophone-panel h2{font:normal 29px "AlgoArt Marker",Georgia;margin:0 24px 12px 0}.gramophone-panel p{margin:10px 0}.gramophone-panel button{background:#34433c;color:white;border:0;padding:10px 16px;font:14px Arial,sans-serif}.gramophone-panel .record-close{position:absolute;right:12px;top:8px;background:none;color:#34433c;font-size:24px;padding:3px 8px}.gramophone-panel label{display:flex;align-items:center;gap:12px;margin-top:14px}.gramophone-panel input{width:100%;min-height:30px}.gramophone-panel small{display:block;color:#576158;font-size:11px}.gramophone-panel a{color:inherit;text-underline-offset:3px}.gramophone-panel button:focus-visible,.gramophone-panel input:focus-visible{outline:3px solid #c79750;outline-offset:3px}
 @media(max-width:600px){.gramophone-panel{right:12px;bottom:100px;padding:18px;font-size:13px}}`;
 document.head.append(style);
 const panel=document.createElement('section');panel.className='gramophone-panel';panel.hidden=true;panel.setAttribute('aria-label','Reception gramophone');
 panel.innerHTML='<button type="button" class="record-close" aria-label="Close gramophone controls">×</button><h2>On the record</h2><p class="record-track" aria-live="polite"></p><small>Bartók, then Debussy. The two works repeat as one record. Sound comes from the gramophone in reception.</small><p class="record-notes">Musical proportion: Ernő Lendvai’s analysis of Bartók; Roy Howat’s analysis of Debussy.</p><button type="button" class="record-toggle">Play record</button><label>Volume <input aria-label="Gramophone volume" type="range" min="0" max="1" step="0.01" value="0.45"></label><p class="record-error" role="status"></p><small class="record-credit"></small><small><a href="./credits.html" target="_blank" rel="noopener">Recordings and model credits</a></small>';
 document.body.append(panel);
 const trigger=document.createElement('button');trigger.type='button';trigger.textContent='Gramophone';trigger.setAttribute('aria-expanded','false');document.querySelector('.top-actions').append(trigger);
 const toggle=panel.querySelector('.record-toggle'),title=panel.querySelector('.record-track'),credit=panel.querySelector('.record-credit'),problem=panel.querySelector('.record-error'),volume=panel.querySelector('input');
 let opened=false,level=1;
 const record=createGramophoneRecord({onChange:s=>{
  title.textContent=s.track.composer+' — '+s.track.title;credit.textContent=s.track.credit;problem.textContent=s.problem;toggle.textContent=s.playing?'Pause record':'Play record';
 }});
 title.textContent=record.state().track.composer+' — '+record.state().track.title;credit.textContent=record.state().track.credit;
 function open(){opened=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');document.exitPointerLock?.();toggle.focus({preventScroll:true});}
 function close(){opened=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');canvas.focus({preventScroll:true});}
 trigger.addEventListener('click',()=>opened?close():open());panel.querySelector('.record-close').addEventListener('click',close);
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
 toggle.addEventListener('click',()=>{record.audio.volume=Number(volume.value)*level;record.toggle();});
 volume.addEventListener('input',()=>{record.audio.volume=Number(volume.value)*level;});
 const hidden=()=>{if(document.hidden)record.pause();};document.addEventListener('visibilitychange',hidden);
 const ray=new THREE.Raycaster();
 const click=event=>{
  if(!document.querySelector('#welcome')?.hidden)return;
  const rect=canvas.getBoundingClientRect(),point=document.pointerLockElement===canvas?new THREE.Vector2():new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  ray.setFromCamera(point,camera);const hit=ray.intersectObject(root,true)[0];
  if(hit&&hit.distance<4.5){event.preventDefault();event.stopImmediatePropagation();open();}
 };canvas.addEventListener('click',click,true);
 if(debug)globalThis.__phiGramophone={state:record.state,root,open,record};
 const position=new THREE.Vector3();
 return {root,record,update(visitor){root.getWorldPosition(position);const distance=Math.hypot(visitor.x-position.x,visitor.y+1.65-position.y-1.2,visitor.z-position.z);level=distance>=24?0:1/(1+Math.max(0,distance-2.2)/5)**2;record.audio.volume=Number(volume.value)*level;},obstacle:{x:root.position.x,z:root.position.z,width:1.25,depth:.85,yaw:0,kind:'gramophone'},
  dispose(){record.dispose();canvas.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',hidden);trigger.remove();panel.remove();style.remove();if(debug)delete globalThis.__phiGramophone;}
 };
}
