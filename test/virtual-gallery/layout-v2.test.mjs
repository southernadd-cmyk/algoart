import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLayout, footprintAt, canStand, DOOR_WIDTH, ROOM_HEIGHT} from './layout-v2.mjs';
import {planGalleryHangs} from './hanging-v2.mjs';

const ENGINE=['rects','spiral','network','organic','field','burst','geometric','scribble'];
function exhibition(date,count,type='mixed'){
  const studies=Array.from({length:count},(_,id)=>{
    const portrait=type==='portrait'||(type==='mixed'&&id%4>=2);
    return {
      id,seed:date+'-'+id,engine:ENGINE[id%ENGINE.length],portrait,
      aspect:portrait?1/1.4:1.4
    };
  });
  return {studies,layout:buildLayout(date,count,studies)};
}
function reachable(layout){
  const visited=new Set([0]);
  let changed=true;
  while(changed){
    changed=false;
    for(const c of layout.corridors){
      if(visited.has(c.a)&&!visited.has(c.b)){visited.add(c.b);changed=true;}
      if(visited.has(c.b)&&!visited.has(c.a)){visited.add(c.a);changed=true;}
    }
  }
  return visited;
}

test('Six-room gallery has multiple directions and an actual navigable loop',()=>{
  const {layout}=exhibition('2026-10-21',18);
  assert.equal(layout.rooms.length,6);
  assert.ok(layout.corridors.length>=layout.rooms.length,'there must be a cycle');
  assert.equal(reachable(layout).size,6);
  assert.ok(layout.rooms.some(room=>room.doors.length>=3),'there must be a branching junction');
  assert.ok(new Set(layout.rooms.map(r=>r.gx)).size>=2);
  assert.ok(new Set(layout.rooms.map(r=>r.gz)).size>=2);
});

test('Generated galleries are reproducible, connected and respect walking clearance',()=>{
  for(const date of ['2026-10-05','2026-10-18','2026-10-21','2026-10-25']){
    for(const count of [1,2,3,6,9,12,15,18,19,24,35]){
      const {layout,studies}=exhibition(date,count);
      assert.deepEqual(buildLayout(date,count,studies),layout);
      assert.equal(reachable(layout).size,layout.rooms.length);
      const keys=new Set(layout.rooms.map(room=>room.gx+','+room.gz));
      assert.equal(keys.size,layout.rooms.length,'rooms cannot overlap');
      for(const corridor of layout.corridors){
        assert.ok(Math.abs(corridor.end.y-corridor.start.y)/corridor.length<.09,'ramp too steep');
        for(let step=1;step<20;step++){
          const t=step/20;
          const x=corridor.start.x+(corridor.end.x-corridor.start.x)*t;
          const z=corridor.start.z+(corridor.end.z-corridor.start.z)*t;
          assert.ok(canStand(layout,x,z),`blocked passage ${corridor.a} to ${corridor.b}`);
          assert.ok(footprintAt(layout,x,z), 'walkway missing floor');
        }
      }
    }
  }
});

test('Hanging arrangements use real pictures once, with safe margins on every wall',()=>{
  for(const date of ['2026-10-05','2026-10-18','2026-10-21']){
    for(const count of [1,2,3,9,15,18,19,27]){
      for(const type of ['mixed','landscape','portrait']){
        const {layout,studies}=exhibition(date,count,type);
        const plan=planGalleryHangs(layout,studies);
        assert.deepEqual(plan,planGalleryHangs(layout,studies));
        assert.equal(plan.length,studies.length);
        assert.equal(new Set(plan.map(item=>item.studyId)).size,studies.length);
        for(const room of layout.rooms){
          const hung=plan.filter(item=>item.roomIndex===room.index);
          assert.equal(hung.length,room.artEnd-room.artStart);
          for(const picture of hung){
            assert.ok(picture.y-picture.height/2 >=room.y+.70);
            assert.ok(picture.y+picture.height/2 <=room.y+ROOM_HEIGHT-.40);
            const span=['north','south'].includes(picture.surface)?room.width:room.depth;
            assert.ok(Math.abs(picture.u)+picture.width/2<span/2-.35);
            if(room.doors.includes(picture.surface)){
              assert.ok(Math.abs(picture.u)-picture.width/2>DOOR_WIDTH/2+.2,'painting blocks doorway');
            }
            for(const other of hung){
              if(other.studyId<=picture.studyId||other.surface!==picture.surface)continue;
              assert.ok(Math.abs(picture.u-other.u)>(picture.width+other.width)/2+.2,'paintings overlap');
            }
            const artwork=studies.find(x=>x.id===picture.studyId);
            assert.ok(Math.abs(picture.width/picture.height-artwork.aspect)<.001);
          }
        }
      }
    }
  }
});

test('Realistic editions vary the scale and alternate hanging formats',()=>{
  const {layout,studies}=exhibition('2026-10-21',18);
  const hangs=planGalleryHangs(layout,studies);
  assert.ok(new Set(hangs.map(h=>h.role)).size>=2);
  assert.ok(Math.max(...hangs.map(h=>h.width))-Math.min(...hangs.map(h=>h.width))>1.4);
  assert.ok(new Set(hangs.map(h=>h.surface)).size>=3);
  assert.ok(new Set(hangs.map(h=>h.profile)).size>=5);
});
