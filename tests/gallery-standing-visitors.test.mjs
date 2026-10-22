// A daily gallery must not silently publish an exhibition where all planned
// visitors are seated. Run against every archived floor and both device budgets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {buildLayout} from '../test/virtual-gallery/layout-v2.mjs';
import {planGalleryHangs} from '../test/virtual-gallery/hanging-v3.mjs';
import {planGallerySculptures} from '../test/virtual-gallery/sculptures.mjs';
import {planVisitors} from '../test/virtual-gallery/visitors.mjs';

test('every published exhibition has visible standing visitors',async()=>{
 const days=(await readdir(new URL('../gallery/',import.meta.url)))
   .filter(name=>/^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
 assert.ok(days.length>0,'archive must include exhibitions');
 for(let index=0;index<days.length;index++){
   const date=days[index];
   const meta=JSON.parse(await readFile(new URL('../gallery/'+date+'/meta.json',import.meta.url),'utf8'));
   const studies=meta.entries.map((entry,id)=>({
     id,seed:entry.seed,engine:entry.mode,
     portrait:entry.orientation==='portrait',
     aspect:entry.orientation==='portrait'?1/1.4:1.4
   }));
   const layout=buildLayout(date,studies.length,studies);
   const entry=layout.rooms[0];
   entry.liftWall=['north','east','south','west'].find(side=>!entry.doors.includes(side));
   assert.ok(entry.liftWall,'entry room needs a full lift wall on '+date);
   // Ground floor has its own street entrance; upper floors do not.
   if(index===0)entry.entranceWall=['south','east','west','north']
     .find(side=>side!==entry.liftWall&&!entry.doors.includes(side));
   const hangs=planGalleryHangs(layout,studies);
   const sculptures=planGallerySculptures(layout,studies);
   for(const lowPower of [false,true]){
     const budget=lowPower?2:3;
     const plan=planVisitors(layout,hangs,sculptures,{lowPower});
     const second=planVisitors(layout,hangs,sculptures,{lowPower});
     const name=date+(lowPower?' mobile':' desktop');
     assert.deepEqual(plan,second,name+' must be seeded and deterministic');
     assert.ok(plan.people.filter(p=>!p.seat).length>=1,name+' must have a standing visitor');
     assert.ok(plan.people.length<=budget,name+' exceeds visitor budget');
     assert.ok(plan.people.filter(p=>p.seat).length<=1,name+' has too many seated visitors');
     const standing=plan.people.filter(p=>!p.seat);
     if(standing.length>=2)
       assert.equal(new Set(standing.slice(0,2).map(p=>p.bodyType)).size,2,
         name+' needs both male and female standing visitors');
     else if(plan.people.length>=2)
       assert.equal(new Set(plan.people.slice(0,2).map(p=>p.bodyType)).size,2,
         name+' needs a mixed seated/standing pair');
     for(const p of plan.people){
       const room=layout.rooms[p.roomIndex];
       assert.ok(room,name+' includes visitor in nonexistent room');
       assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z),name+' coordinates must be finite');
     }
   }
 }
});
