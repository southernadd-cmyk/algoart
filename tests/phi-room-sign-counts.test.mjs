// Diagnostic for shared live/test hanging signs, using the same archive
// metadata and geometry planner as the running tower.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
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
test('diagnose every archived floor’s curated hanging-room sign counts',()=>{
 const report=[];
 for(const {date} of archive.floors){
  const studies=studiesFor(date);
  const phi=buildPhiRendererPlan(date,studies);
  const rooms=phi.exhibition.curation.rooms;
  const themes=rooms.filter(r=>r.theme);
  const eligible=rooms.filter(r=>roomSignTitle(r));
  const signs=planHangingRoomSigns(phi);
  const placed=new Set(signs.map(s=>s.room));
  const misses=eligible.filter(r=>!placed.has(r.room)).map(r=>({room:r.room+1,
    theme:r.theme.dimension+':'+r.theme.value,matching:r.theme.count,
    total:r.studyIds.length}));
  report.push({date,artworks:studies.length,rooms:rooms.length,
    themed:themes.length,eligible:eligible.length,signs:signs.length,
    titles:signs.map(s=>s.label),misses});
  assert.ok(signs.length<=eligible.length,'Sign count must not exceed eligible rooms on '+date);
  assert.equal(new Set(signs.map(s=>s.room)).size,signs.length,'One sign per room on '+date);
 }
 console.log('PHI_ROOM_SIGN_COUNTS_BEGIN');
 for(const row of report)console.log(JSON.stringify(row));
 console.log('PHI_ROOM_SIGN_COUNTS_END');
 assert.equal(report.length,archive.floors.length);
});
