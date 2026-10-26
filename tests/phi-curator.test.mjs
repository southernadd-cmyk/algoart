import test from 'node:test';
import assert from 'node:assert/strict';
import {planPhiFloor} from '../gallery/visit/phi-architecture.mjs';
import {planPhiBridges} from '../gallery/visit/phi-bridges.mjs';
import {planPhiCirculation} from '../gallery/visit/phi-circulation.mjs';
import {buildPhysicalPhiFloor} from '../gallery/visit/phi-physical.mjs';
import {exhibitionSurfaces,planCuratedPhiArtwork,planCuratedPhiExhibition} from '../gallery/visit/phi-curator.mjs';

test('curatorial adapter is repeatable and never duplicates studies',()=>{
  const floor=planPhiBridges(planPhiFloor('2026-10-26',{artworks:18})).plan;
  const circulation=planPhiCirculation(floor);
  const physical=buildPhysicalPhiFloor(floor,circulation);
  const studies=Array.from({length:12},(_,i)=>({id:'landscape-'+i,portrait:false,aspect:1.4}));
  const a=planCuratedPhiArtwork(floor,circulation,physical,studies);
  const b=planCuratedPhiArtwork(floor,circulation,physical,studies);
  assert.deepEqual(a,b);
  assert.equal(a.checks.unique,true);
  assert.equal(a.checks.inwardFacing,true);
  assert.deepEqual(a.surfaces,exhibitionSurfaces(floor,physical));
  assert.equal(a.paintings.length+a.unplaced.length,studies.length);
  for(const p of a.paintings){
    const wall=a.surfaces.find(s=>s.id===p.surfaceId);
    assert.ok(wall);
    assert.ok(p.u-p.width/2>=wall.lo-1e-4);
    assert.ok(p.u+p.width/2<=wall.hi+1e-4);
    assert.ok(p.height>0);
  }
});
test('portraits are reserved for sculpture curator',()=>{
  const floor=planPhiFloor('2026-10-26',{artworks:18});
  const circulation=planPhiCirculation(floor),physical=buildPhysicalPhiFloor(floor,circulation);
  const result=planCuratedPhiArtwork(floor,circulation,physical,[{id:'portrait',portrait:true}]);
  assert.equal(result.paintings.length,0);
  assert.equal(result.unplaced.length,0);
});

test('sculpture placements respect room and exhibition clearance',()=>{
 const floor=planPhiBridges(planPhiFloor('2026-10-26',{artworks:18})).plan;
 const circulation=planPhiCirculation(floor);
 const physical=buildPhysicalPhiFloor(floor,circulation);
 const studies=Array.from({length:18},(_,i)=>({id:'art-'+i,portrait:i%3===0,aspect:i%3===0?.72:1.4}));
 const a=planCuratedPhiExhibition(floor,circulation,physical,studies);
 const b=planCuratedPhiExhibition(floor,circulation,physical,studies);
 assert.deepEqual(a,b);
 assert.equal(a.checks.unique,true);
 assert.equal(a.checks.sculptureClearances,true);
 assert.equal(a.sculptures.length+a.paintings.length+a.unplaced.length,studies.length);
 for(const sculpture of a.sculptures) {
   assert.ok(sculpture.width>0);
   assert.ok(sculpture.depth>0);
 }
});
