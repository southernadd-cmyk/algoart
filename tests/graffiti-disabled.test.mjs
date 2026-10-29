import test from 'node:test';
import assert from 'node:assert/strict';
import {createTowerGraffiti} from '../gallery/visit/exterior-graffiti.mjs?v=atlas-first-20261027';
test('graffiti=off bypasses planning, scene objects, textures and paint work',()=>{
 const previous=globalThis.location;globalThis.location={search:'?graffiti=off'};
 try{
  const forbidden=new Proxy({}, {get(){throw Error('Graphics or scene work attempted');}});
  const manager=createTowerGraffiti(forbidden,{brick:forbidden,planner(){throw Error('Planner called');}});
  assert.equal(manager.addTo(forbidden,[],0),null);manager.paintNext();manager.dispose();
  assert.deepEqual(manager.snapshot(0),[]);assert.equal(manager.diagnostics.disabled,true);
  for(const key of ['marks','pending','pages','paintSteps','totalPaintMs'])assert.equal(manager.diagnostics[key],0);
 }finally{globalThis.location=previous;}
});
