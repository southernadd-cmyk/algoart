import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createTowerGraffiti} from '../gallery/visit/exterior-graffiti.mjs';
import {towerGraffitiSignature} from '../gallery/visit/tower-family-lettering.mjs';
async function fixture(baked,run){
 const originals={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,Image:globalThis.Image};
 let resolveFetch,paints=0;
 const mark={id:'one',normal:{x:0,z:1},position:{x:0,y:1,z:0},rotation:0,width:2,height:1,level:0,surface:'square',face:{centre:{x:0,z:0},length:4,roomY:0},tag:{renderer:'az-nine-v1'},bounds:{x:0,y:0,width:16,height:16}};
 globalThis.location={href:'https://example.org/test/virtual-gallery/full-engine.html'};
 globalThis.document={baseURI:'https://example.org/gallery/visit/',createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},drawImage(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},scale(){}})})};
 globalThis.Image=class{naturalWidth=32;naturalHeight=32;decode(){return Promise.resolve();}};
 globalThis.fetch=url=>{assert.ok(String(url).startsWith('https://example.org/gallery/visit/graffiti-assets/'),'Atlas URL must use the document base, including on test');return new Promise(resolve=>resolveFetch=resolve);};
 const manager=createTowerGraffiti(THREE,{enabled:true,brick:new THREE.MeshStandardMaterial(),planner:()=>[mark],keyFor:()=> 'fixture',atlasPrefix:'',paintTag:()=>paints++,atlasPlanner:()=>[{size:32,height:32,page:0,entries:[{mark,x:0,y:0,width:16,height:16}]}]});
 try{
  manager.addTo(new THREE.Group(),[],0);
  for(let i=0;i<5;i++)manager.paintNext();
  assert.equal(paints,0,'Fallback must wait while the pre-baked image is being checked');
  resolveFetch(baked?{ok:true,json:async()=>({version:1,signature:towerGraffitiSignature([mark]),pages:[{size:32,height:32,entries:1,file:'atlas.png'}]})}:{ok:false});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(manager.diagnostics.bakeLoading,false);
  manager.paintNext();
  assert.equal(paints,baked?0:1);
  assert.equal(manager.diagnostics.baked,baked);
  if(baked)assert.equal(manager.diagnostics.pending,0);
  await run?.(manager);
 }finally{manager.dispose();for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}
test('matching atlas removes all redundant procedural paint work',()=>fixture(true));
test('missing atlas still uses the complete procedural fallback',()=>fixture(false));
