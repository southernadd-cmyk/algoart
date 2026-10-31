import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLayout} from '../../gallery/visit/layout-v2.mjs';
import {buildEnvironmentPlan,distanceToArchitecture} from '../../gallery/visit/environment-v1.mjs';

const states=Array.from({length:20},(_,i)=>({seed:'study-'+i,engine:i%2?'orbital':'field',material:i%3?'ink':'oil'}));
const gallery=date=>buildLayout(date,states.length,states);
test('landscape generation is deterministic for a daily edition',()=>{
  const layout=gallery('2026-10-21');
  const a=buildEnvironmentPlan(layout,states), b=buildEnvironmentPlan(layout,states);
  for(const key of ['theme','seed','size','centerX','centerZ'])assert.equal(a[key],b[key]);
  for(const key of ['trees','shrubs','rocks'])assert.deepEqual(a[key],b[key]);
  assert.equal(a.heightAt(50,70),b.heightAt(50,70));
});
test('other archive dates and states give a different environment',()=>{
  const first=buildEnvironmentPlan(gallery('2026-10-21'),states);
  const second=buildEnvironmentPlan(gallery('2026-10-20'),states);
  assert.notEqual(first.seed,second.seed);
  assert.notDeepEqual(first.trees,second.trees);
  const changed=states.map(s=>({...s}));changed[0].seed='other';
  assert.notEqual(first.seed,buildEnvironmentPlan(gallery('2026-10-21'),changed).seed);
});
test('landscaping never overlaps a room, walkway or sculpture entrance',()=>{
  const layout=gallery('2026-10-21');
  for(const mode of [false,true]){
    const site=buildEnvironmentPlan(layout,states,{lowPower:mode});
    for(const point of site.trees)assert.ok(distanceToArchitecture(layout,point.x,point.z)>=7);
    for(const point of site.shrubs)assert.ok(distanceToArchitecture(layout,point.x,point.z)>=3.3);
    for(const point of site.rocks)assert.ok(distanceToArchitecture(layout,point.x,point.z)>=4);
    for(const room of layout.rooms){
      assert.ok(site.heightAt(room.x,room.z)<room.y-.8);
    }
    for(const hall of layout.corridors){
      assert.ok(site.heightAt(hall.start.x,hall.start.z)<hall.start.y-.8);
    }
    assert.ok(site.trees.length>10);
  }
});
test('low-power mode uses fewer objects',()=>{
  const layout=gallery('2026-10-21');
  const full=buildEnvironmentPlan(layout,states);
  const lite=buildEnvironmentPlan(layout,states,{lowPower:true});
  for(const key of ['trees','shrubs'])assert.ok(lite[key].length<full[key].length);
  assert.equal(lite.rocks.length,0);
  assert.equal(full.rocks.length,0);
});
