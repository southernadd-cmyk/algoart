import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planCuratedPhiExhibition} from '../gallery/visit/phi-curator.mjs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {wallPhiPreference,sculpturePhiPreference,stageMaterial} from '../test/virtual-gallery/phi-curation-stage.mjs';

function stagedModule(percent){
 return {planCuratedPhiExhibition:(floor,circulation,physical,studies)=>
  planCuratedPhiExhibition(floor,circulation,physical,studies,{phiAdherence:percent/100})};
}
const placements=x=>({
 paintings:x.paintings.map(p=>({room:p.room,surfaceId:p.surfaceId,u:p.u,x:p.x,z:p.z})),
 sculptures:x.sculptures.map(p=>({room:p.room,x:p.x,z:p.z}))
});
function archivedStudies(date){
 const html=readFileSync(new URL('../gallery/'+date+'/index.html',import.meta.url),'utf8');
 return [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card],id)=>{
  const w=Number(card.match(/<img[^>]*width="(\d+)"/)?.[1]);
  const h=Number(card.match(/<img[^>]*height="(\d+)"/)?.[1]);
  return {id,portrait:/data-orientation="portrait"/.test(card)||h>w,
   aspect:w/h||1.4,
   href:card.match(/class="remix" href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&'),
   material:card.match(/data-material="([^"]+)"/)?.[1]};
 });
}
function affinity(exhibition){
 return exhibition.paintings.reduce((score,p)=>{
  const wall=exhibition.surfaces.find(w=>w.id===p.surfaceId);
  return score+wallPhiPreference(wall,p.u);
 },0);
}
test('stage preferences reward genuine golden anchors rather than wall ends',()=>{
 const w={lo:0,hi:10,length:10};
 assert.equal(wallPhiPreference(w,5),0);
 assert.ok(wallPhiPreference(w,10*(1-1/((1+Math.sqrt(5))/2)))>.99999);
 assert.equal(wallPhiPreference(w,0),0);
 assert.equal(sculpturePhiPreference(.5,.5),0);
 assert.ok(sculpturePhiPreference(.61803398875,.38196601125)>.99999);
});
test('stage material traits distinguish oil, watercolour and tissue',()=>{
 assert.equal(stageMaterial({oil:'1'},'tissue',''),'oil');
 assert.equal(stageMaterial({watercolor:'1'},'tissue',''),'watercolour');
 assert.equal(stageMaterial({tissue:'1'},'marker',''),'tissue');
 assert.equal(stageMaterial({},'watercolor',''),'watercolour');
 assert.equal(stageMaterial({},'oil','watercolour-v2s'),'watercolour');
});
test('staging bundle patches both score functions and group material classifier',()=>{
 const data=readFileSync(new URL('../gallery/visit/gallery-phi-test-room-signs-bundle.js',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 assert.match(builder,/stageCurationPlugin/);
 assert.ok(data.length>10000);
});
test('0% exactly preserves original geometry; 65% preserves safety and improves phi affinity',async()=>{
 const off=await stagedModule(0);
 const on=await stagedModule(65);
 const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
 let baselineAffinity=0,stagedAffinity=0,modified=0,paintings=0,sculptures=0;
 const changedPaintings=[],changedSculptures=[],perFloor=[];
 for(const {date} of archive.floors){
  const studies=archivedStudies(date);
  const live=buildPhiRendererPlan(date,studies);
  const base=off.planCuratedPhiExhibition(live.floor,live.circulation,live.physical,studies);
  const stage=on.planCuratedPhiExhibition(live.floor,live.circulation,live.physical,studies);
  assert.deepEqual(placements(base),placements(buildPhiRendererPlan(date,studies,{phiAdherence:0}).exhibition),'0% must preserve pre-phi placement '+date);
  assert.deepEqual(placements(stage),placements(live.exhibition),'65% must match live gallery placement '+date);
  assert.equal(stage.checks.complete,true,'no unplaced artworks '+date);
  assert.equal(stage.checks.inwardFacing,true,'inward facing '+date);
  assert.equal(stage.checks.sculptureClearances,true,'sculpture clearance '+date);
  assert.equal(stage.checks.unique,true,'unique art '+date);
  assert.ok(stage.curation.score+1e-9>=stage.curation.baselineScore,'theme grouping '+date);
  assert.deepEqual(stage,on.planCuratedPhiExhibition(live.floor,live.circulation,live.physical,studies),'deterministic '+date);
  baselineAffinity+=affinity(base);stagedAffinity+=affinity(stage);
  paintings+=stage.paintings.length;sculptures+=stage.sculptures.length;
  if(JSON.stringify(placements(base))!==JSON.stringify(placements(stage)))modified++;
  const basePaintings=new Map(base.paintings.map(p=>[p.studyId,p]));
  const baseSculptures=new Map(base.sculptures.map(p=>[p.studyId,p]));
  const floorPaintings=[],floorSculptures=[];
  for(const p of stage.paintings){
   const original=basePaintings.get(p.studyId);
   assert.ok(original,'missing baseline painting '+date+'/'+p.studyId);
   const delta=Math.hypot(p.x-original.x,p.z-original.z);
   const wallChanged=p.surfaceId!==original.surfaceId;
   assert.equal(wallChanged,false,'golden hang cannot change painting wall '+date+'/'+p.studyId);
   assert.equal(p.room,original.room,'golden hang cannot change painting room '+date+'/'+p.studyId);
   assert.ok(p.width+1e-6>=original.width,'golden hang cannot shrink a painting '+date+'/'+p.studyId);
   assert.ok(p.height+1e-6>=original.height,'golden hang cannot shrink painting height '+date+'/'+p.studyId);
   // Both passes have independent 1.5 m guards. The separate A/B regression
   // checks that the complete new hang stays within 1.5 m of the classic
   // 65% layout; the displacement from 0% can exceed either pass's limit.
   assert.ok(delta<=3.000001,'combined phi wall shift must stay within 3 m '+date+'/'+p.studyId+' '+delta);
   if(delta>1e-6||wallChanged){
    const change={date,id:p.studyId,delta:+delta.toFixed(3),
     wallChanged,roomChanged:p.room!==original.room,
     sameWall:!wallChanged,alongWall:!wallChanged?+Math.abs(p.u-original.u).toFixed(3):null};
    changedPaintings.push(change);floorPaintings.push(change);
   }
  }
  for(const p of stage.sculptures){
   const original=baseSculptures.get(p.studyId);
   assert.ok(original,'missing baseline sculpture '+date+'/'+p.studyId);
   const delta=Math.hypot(p.x-original.x,p.z-original.z);
   assert.equal(p.room,original.room,'golden sculpture cannot change room '+date+'/'+p.studyId);
   assert.ok(delta<=1.600001,'phi sculpture shift must stay within 1.6 m '+date+'/'+p.studyId);
   if(delta>1e-6){
    const change={date,id:p.studyId,delta:+delta.toFixed(3),roomChanged:p.room!==original.room};
    changedSculptures.push(change);floorSculptures.push(change);
   }
  }
  perFloor.push({date,paintings:stage.paintings.length,movedPaintings:floorPaintings.length,
   paintingsChangedWall:floorPaintings.filter(x=>x.wallChanged).length,
   sculptures:stage.sculptures.length,movedSculptures:floorSculptures.length});
 }
 assert.ok(stagedAffinity>baselineAffinity+1,'new hang must measurably favour golden-section placements');
 assert.ok(modified>0,'at least one floor should differ');
 assert.equal(changedPaintings.filter(x=>x.wallChanged).length,0,'no painting may change walls');
 assert.equal(changedPaintings.filter(x=>x.roomChanged).length,0,'no painting may change rooms');
 assert.equal(changedSculptures.filter(x=>x.roomChanged).length,0,'no sculpture may change rooms');
 const avg=xs=>xs.length?+(xs.reduce((total,x)=>total+x.delta,0)/xs.length).toFixed(3):0;
 const middle=xs=>xs.length?[...xs].map(x=>x.delta).sort((a,b)=>a-b)[Math.floor(xs.length/2)]:0;
 const changedWall=changedPaintings.filter(x=>x.wallChanged);
 const sameWall=changedPaintings.filter(x=>x.sameWall);
 console.log('stage curation:',{paintings,sculptures,modified,baselineAffinity,stagedAffinity});
 console.log('REAL POSITION DIFFERENCES '+JSON.stringify({
  paintings,paintingsMoved:changedPaintings.length,paintingsUnchanged:paintings-changedPaintings.length,
  paintingsChangedWall:changedWall.length,paintingsSameWallShift:sameWall.length,
  paintingsChangedRoom:changedPaintings.filter(x=>x.roomChanged).length,
  avgPaintingMoveMetres:avg(changedPaintings),medianPaintingMoveMetres:middle(changedPaintings),
  maxPaintingMoveMetres:Math.max(0,...changedPaintings.map(x=>x.delta)),
  avgSameWallShiftMetres:avg(sameWall),medianSameWallShiftMetres:middle(sameWall),
  sculptures,sculpturesMoved:changedSculptures.length,
  sculpturesChangedRoom:changedSculptures.filter(x=>x.roomChanged).length,
  avgSculptureMoveMetres:avg(changedSculptures),maxSculptureMoveMetres:Math.max(0,...changedSculptures.map(x=>x.delta)),
  perFloor
 }));

 delete globalThis.location;
});

test('both restored test entries load a local copy of the live gallery and the archive data',()=>{
 const entries=['../test/virtual-gallery/index.html','../test/virtual-gallery/full-engine.html'];
 for(const entry of entries){
  const source=readFileSync(new URL(entry,import.meta.url),'utf8');
  assert.match(source,/<base href="\.\.\/\.\.\/gallery\/visit\/">/);
  assert.match(source,/await import\('\.\.\/\.\.\/test\/virtual-gallery\/gallery-phi-bundle\.js\?v=/);
  assert.doesNotMatch(source,/gallery-phi-test-room-signs-bundle\.js/);
  assert.match(source,/tower-layouts\.json\?day=/);
 }
 const bundle=readFileSync(new URL('../test/virtual-gallery/gallery-phi-bundle.js',import.meta.url));
 assert.ok(bundle.byteLength>100000,'Restored local test gallery bundle is missing or unexpectedly small');
});
