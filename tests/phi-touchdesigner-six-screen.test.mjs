import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createTouchDesignerMonitorMedia,validateTouchDesignerSixScreen,TOUCHDESIGNER_SIX_SCREEN_MANIFEST} from '../gallery/visit/phi-touchdesigner-media.mjs';
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
 const videos=[],requests=[];
 class Video extends EventTarget{
  constructor(){super();this.readyState=2;this.videoWidth=1152;this.videoHeight=480;this.playCalls=0;this.pauseCalls=0;}
  setAttribute(){} removeAttribute(){} load(){queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
  async play(){this.playCalls++;} pause(){this.pauseCalls++;}
 }
 globalThis.document={createElement(tag){assert.equal(tag,'video');const v=new Video();videos.push(v);return v;}};
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
  media.update(false);assert.equal(videos[0].pauseCalls,1);assert.equal(media.diagnostics().playing,false);
  media.update(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(videos[0].playCalls,2);
  media.dispose();
  screens.forEach((s,i)=>{assert.equal(s.material,originals[i].material);assert.deepEqual(Array.from(s.geometry.attributes.uv.array),originals[i].uv);});
  assert.equal(media.diagnostics().state,'disposed');
 }finally{
  media.dispose();globalThis.document=oldDocument;globalThis.fetch=oldFetch;
  screens.forEach((s,i)=>{s.geometry.dispose();originals[i].material.dispose();});
 }
});
