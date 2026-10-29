// Diagnostic for shared live/test hanging signs, using the same archive
// metadata and geometry planner as the running tower.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {nameExhibitionRooms} from '../gallery/visit/phi-room-names.mjs';
import {planHangingRoomSigns,roomSignTitle} from '../gallery/visit/phi-room-hanging-signs.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const archive=JSON.parse(read('../gallery/tower-layouts.json'));
function studiesFor(date){
 const html=read('../gallery/'+date+'/index.html');
 return [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card],id)=>{
  const width=Number(card.match(/<img[^>]*width="(\d+)"/)?.[1]);
  const height=Number(card.match(/<img[^>]*height="(\d+)"/)?.[1]);
  const href=card.match(/class="remix" href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&')||'';
  return {
    id,portrait:/data-orientation="portrait"/.test(card)||height>width,
    aspect:width/height||1.4,href,
    material:card.match(/data-material="([^"]+)"/)?.[1]
  };
 });
}
test('every archived doorway gets a correctly directed sign',()=>{
 const report=[];
 for(const {date} of archive.floors){
  const phi=buildPhiRendererPlan(date,studiesFor(date));
  const names=nameExhibitionRooms(phi.exhibition.curation.rooms);
  assert.equal(new Set([...names.values()].map(n=>n.title)).size,names.size);
  const signs=planHangingRoomSigns(phi);
  const seen=new Set();
  for(const sign of signs){
   const id=[sign.axis,sign.at,sign.centre].join('|');
   assert.ok(!seen.has(id),'duplicate doorway sign '+date+' '+id);
   seen.add(id);
   assert.ok(sign.faces.positive.label&&sign.faces.negative.label);
   assert.ok(sign.faces.positive.subtitle&&sign.faces.negative.subtitle);
   for(const side of ['positive','negative']){
    const target=side==='positive'?sign.minusRoom:sign.plusRoom;
    const face=sign.faces[side];
    assert.equal(face.room,target<0?null:target,'wrong doorway destination '+date+' '+id+' '+side);
    if(target>=0){
     assert.equal(face.label,'Room '+(target+1)+' · '+(names.get(target)?.title||'Gallery'));
    }
   }
  }
  const interRoom=signs.filter(s=>s.kind==='room');
  assert.equal(interRoom.length,phi.circulation.doors.length,'missing inter-room sign '+date);
  const named=new Set(signs.flatMap(s=>[s.faces.positive.room,s.faces.negative.room]).filter(Number.isInteger));
  const reachable=new Set(phi.circulation.doors.flatMap(d=>[d.a,d.b]));
  for(const room of reachable)assert.ok(named.has(room),'room has no directional sign '+date+'/'+room);
  report.push({date,artworks:studiesFor(date).length,rooms:names.size,
   doorways:signs.length,interRoom:interRoom.length,bridgeSigns:signs.filter(s=>s.kind==='bridge').length});
 }
 console.log('PHI_DIRECTIONAL_ROOM_SIGNS '+JSON.stringify(report));
 assert.equal(report.length,archive.floors.length);
});
