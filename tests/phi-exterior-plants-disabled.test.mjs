import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHI_EXTERIOR_PLANTING_ENABLED,addPhiOutdoorPlants} from '../gallery/visit/phi-outdoor-plants.mjs';

test('exterior plants are disabled without loading the GLB or creating obstacles',async()=>{
 assert.equal(PHI_EXTERIOR_PLANTING_ENABLED,false);
 let requests=0;
 const result=addPhiOutdoorPlants(null,null,null,null,{loadModel(){requests++;}});
 await result.ready;
 assert.deepEqual(result.holders,[]);
 assert.deepEqual(result.obstacles,[]);
 assert.equal(requests,0);
});

test('exterior planters and foliage are opt-in, while benches and lanterns remain',()=>{
 const sources=['../gallery/visit/gallery-phi.js','../gallery/visit/environment-render.mjs','../gallery/visit/phi-square-graffiti.mjs'];
 for(const path of sources){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(source,/PHI_EXTERIOR_PLANTING_ENABLED/);
  assert.match(source,/if\(PHI_EXTERIOR_PLANTING_ENABLED\)/);
 }
 const square=readFileSync(new URL('../gallery/visit/phi-square-graffiti.mjs',import.meta.url),'utf8');
 assert.match(square,/phi-square-perimeter-seat/);
 const app=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(app,/placeCastIronStreetLamp/);
});

test('unused outdoor plant credit is absent; indoor Pothos remains attributed',()=>{
 const wall=readFileSync(new URL('../gallery/visit/phi-reception-decor.mjs',import.meta.url),'utf8');
 assert.match(wall,/Pothos plant — AllQuad/);
 assert.doesNotMatch(wall,/Plaza plants|Nicholas-3D/);
 for(const path of ['../gallery/visit/credits.html','../test/virtual-gallery/credits.html']){
  const html=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(html,/Plants Scene Free!|Nicholas-3D|sketchfab.com\/Nicholas01/);
  assert.match(html,/Pothos Potted Plant/);
 }
});
