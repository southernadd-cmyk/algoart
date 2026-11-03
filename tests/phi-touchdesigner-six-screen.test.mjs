import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createTouchDesignerMonitorMedia,validateTouchDesignerSixScreen,TOUCHDESIGNER_SIX_SCREEN_MANIFEST} from '../gallery/visit/phi-touchdesigner-media.mjs';
import {initTouchDesignerMotionControl,isTouchDesignerMotionPaused,setTouchDesignerMotionPaused} from '../gallery/visit/phi-touchdesigner-motion.mjs';
const manifest=JSON.parse(await readFile(TOUCHDESIGNER_SIX_SCREEN_MANIFEST));

test('six-screen atlas has verified bytes and a fixed safe 3 by 2 layout',async()=>{
 assert.ok(validateTouchDesignerSixScreen(manifest));
 const bytes=await readFile(new URL(manifest.atlas.file,TOUCHDESIGNER_SIX_SCREEN_MANIFEST));
 assert.equal(bytes.length,manifest.atlas.sizeBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.atlas.sha256);
 for(const change of [{file:'../other.webm'},{columns:6},{rows:1},{panelCount:3},{width:2304},{height:240},{fps:60}]){
  assert.equal(validateTouchDesignerSixScreen({...manifest,atlas:{...manifest.atlas,...change}}),null);
 }
 assert.equal(validateTouchDesignerSixScreen({...manifest,status:'unpublished'}),null);
});

test('one player and texture feed six distinct crops, pause together and restore both UV axes',async()=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 setTouchDesignerMotionPaused(false);
 const videos=[],requests=[];
 class Video extends EventTarget{
  constructor(){super();this.readyState=2;this.videoWidth=1152;this.videoHeight=480;this.playCalls=0;this.pauseCalls=0;this.paused=true;this.currentTime=0;}
  setAttribute(){} removeAttribute(){} load(){queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
  async play(){this.playCalls++;this.paused=false;} pause(){this.pauseCalls++;this.paused=true;}
 }
 globalThis.document={hidden:false,createElement(tag){assert.equal(tag,'video');const v=new Video();videos.push(v);return v;}};
 globalThis.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>manifest};};
 const screens=Array.from({length:6},()=>new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()));
 const originals=screens.map(s=>({material:s.material,uv:Array.from(s.geometry.attributes.uv.array)}));
 const media=createTouchDesignerMonitorMedia(THREE,{screens,manifestURL:TOUCHDESIGNER_SIX_SCREEN_MANIFEST,followActiveIndex:false});
 try{
  media.update(false);assert.equal(requests.length,0,'Distant visitors must not load video');
  media.update(true);await new Promise(resolve=>setImmediate(resolve));
  media.update(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos.length,1);assert.equal(requests.length,1);
  assert.ok(videos[0].src.endsWith('?v='+manifest.atlas.sha256.slice(0,16)),
   'Published film URL should follow the manifest digest rather than cache a previous version');
  assert.equal(media.diagnostics().state,'playing-export');assert.equal(videos[0].playCalls,1);
  assert.ok(screens.every(s=>s.material===screens[0].material&&s.material.map.image===videos[0]));
  const regions=screens.map(s=>{
   const uv=s.geometry.attributes.uv;
   const xs=Array.from({length:uv.count},(_,i)=>uv.getX(i)),ys=Array.from({length:uv.count},(_,i)=>uv.getY(i));
   return [Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)].map(x=>Math.round(x*6)/6);
  });
  assert.deepEqual(regions,[[0,1/3,.5,1],[1/3,2/3,.5,1],[2/3,1,.5,1],[0,1/3,0,.5],[1/3,2/3,0,.5],[2/3,1,0,.5]]);
  // Distances fluctuate as visitors move between reception's adjacent rooms.
  // Once lazily started, neither video is allowed to freeze outside 11m.
  media.update(false);
  assert.equal(videos[0].pauseCalls,0,'Walking away should not pause a shared atlas');
  assert.equal(media.diagnostics().playing,true);
  assert.equal(videos[0].playCalls,1);
  // Recover if the browser itself pauses an otherwise active video.
  videos[0].pause();media.update(false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos[0].playCalls,2,'Unexpected pause must resume without proximity');
  assert.equal(media.diagnostics().playing,true);
  // A hidden tab may pause for efficiency; return to the visible tab resumes.
  globalThis.document.hidden=true;media.update(false);
  assert.equal(media.diagnostics().playing,false);
  globalThis.document.hidden=false;media.update(false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos[0].playCalls,3);
  // Explicit pause must not be auto-restarted by the old stall recovery loop.
  setTouchDesignerMotionPaused(true);
  assert.equal(videos[0].paused,true,'Pause control must stop video immediately');
  media.update(false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos[0].playCalls,3,'Paused screens must stay paused');
  assert.equal(media.diagnostics().motionPaused,true);
  setTouchDesignerMotionPaused(false);
  media.update(false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos[0].playCalls,4,'Play control resumes the shared video');
  media.dispose();
  screens.forEach((s,i)=>{assert.equal(s.material,originals[i].material);assert.deepEqual(Array.from(s.geometry.attributes.uv.array),originals[i].uv);});
  assert.equal(media.diagnostics().state,'disposed');
 }finally{
  media.dispose();globalThis.document=oldDocument;globalThis.fetch=oldFetch;
  setTouchDesignerMotionPaused(null);
  screens.forEach((s,i)=>{s.geometry.dispose();originals[i].material.dispose();});
 }
});

test('reduced motion shows a still video frame until Play screens is requested',async()=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch,oldMatchMedia=globalThis.matchMedia;
 const queries=[],videos=[];
 const preference={matches:true,addEventListener(type,handler){if(type==='change')queries.push(handler);}};
 globalThis.matchMedia=()=>preference;
 class Video extends EventTarget{
  constructor(){super();this.readyState=2;this.videoWidth=1152;this.videoHeight=480;this.paused=true;this.currentTime=0;this.playCalls=0;this.pauseCalls=0;}
  setAttribute(){}removeAttribute(){}load(){queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
  async play(){this.playCalls++;this.paused=false;}
  pause(){this.pauseCalls++;this.paused=true;}
 }
 globalThis.document={hidden:false,createElement(tag){assert.equal(tag,'video');const v=new Video();videos.push(v);return v;}};
 globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
 setTouchDesignerMotionPaused(null);
 const screens=Array.from({length:6},()=>new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()));
 const originals=screens.map(screen=>screen.material);
 const media=createTouchDesignerMonitorMedia(THREE,{screens,manifestURL:TOUCHDESIGNER_SIX_SCREEN_MANIFEST,followActiveIndex:false});
 try{
  assert.equal(isTouchDesignerMotionPaused(),true);
  media.update(true);await new Promise(resolve=>setImmediate(resolve));
  media.update(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos.length,1);
  assert.equal(videos[0].playCalls,0,'Do not autoplay for reduced motion');
  assert.equal(videos[0].paused,true);
  assert.equal(media.diagnostics().state,'export-ready');
  assert.ok(screens.every(screen=>screen.material.map?.image===videos[0]),
   'Keep the decoded first frame on each screen instead of a blank black display');
  setTouchDesignerMotionPaused(false);
  media.update(false);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos[0].playCalls,1,'Explicit Play screens overrides reduced motion');
  setTouchDesignerMotionPaused(null);
  assert.equal(videos[0].paused,true,'Returning to system preference pauses immediately');
  preference.matches=false;
  for(const handler of queries)handler();
  assert.equal(isTouchDesignerMotionPaused(),false,'React to live OS preference changes');
  media.update(false);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(videos[0].playCalls,2);
 }finally{
  media.dispose();globalThis.document=oldDocument;globalThis.fetch=oldFetch;
  globalThis.matchMedia=oldMatchMedia;setTouchDesignerMotionPaused(false);
  screens.forEach((screen,i)=>{screen.geometry.dispose();originals[i].dispose();});
 }
});

test('accessible screen control reflects reduced motion and toggles without page navigation',()=>{
 const oldDocument=globalThis.document;
 const button={dataset:{},attributes:{},handlers:{},textContent:'',
  setAttribute(key,value){this.attributes[key]=value;},
  addEventListener(key,handler){this.handlers[key]=handler;}};
 globalThis.document={readyState:'complete',getElementById(id){return id==='touchDesignerMotionToggle'?button:null;}};
 try{
  setTouchDesignerMotionPaused(true);
  initTouchDesignerMotionControl();
  assert.equal(button.textContent,'Play screens');
  assert.equal(button.attributes['aria-label'],'Play TouchDesigner screens');
  button.handlers.click();
  assert.equal(button.textContent,'Pause screens');
  assert.equal(isTouchDesignerMotionPaused(),false);
  button.handlers.click();
  assert.equal(isTouchDesignerMotionPaused(),true);
  initTouchDesignerMotionControl();
  assert.equal(button.dataset.motionControlReady,'true','Do not install duplicate click handlers');
 }finally{
  globalThis.document=oldDocument;setTouchDesignerMotionPaused(false);
 }
});
