import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {stageCurationPlugin} from '../automation/phi-stage-curation-plugin.mjs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {wallPhiPreference} from '../gallery/visit/phi-curation-refinement.mjs';
const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
async function stagedPlanner(){
 const result=await build({
  stdin:{contents:"export {planCuratedPhiExhibition} from './gallery/visit/phi-curator.mjs';",
   sourcefile:'pre-expansion-fixture.js',resolveDir:process.cwd(),loader:'js'},
  bundle:true,platform:'node',format:'esm',target:'es2022',write:false,
  plugins:[stageCurationPlugin()],logLevel:'silent'
 });
 return (await import('data:text/javascript;base64,'+
  Buffer.from(result.outputFiles[0].text).toString('base64')+'#preexp')).planCuratedPhiExhibition;
}
function studies(date){
 const html=readFileSync(new URL('../gallery/'+date+'/index.html',import.meta.url),'utf8');
 return [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([card],id)=>{
  const w=Number(card.match(/<img[^>]*width="(\d+)"/)?.[1]);
  const h=Number(card.match(/<img[^>]*height="(\d+)"/)?.[1]);
  return {id,portrait:/data-orientation="portrait"/.test(card)||h>w,aspect:w/h||1.4,
   href:card.match(/class="remix" href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&'),
   material:card.match(/data-material="([^"]+)"/)?.[1]};
 });
}
const affinity=p=>p.paintings.reduce((s,x)=>s+wallPhiPreference(
 p.surfaces.find(w=>w.id===x.surfaceId),x.u),0);
test('early golden-section positioning keeps painting scale, safety, and room allocations',async()=>{
 const stagePlan=await stagedPlanner();
 const totals=[];
 for(const adherence of [0,.65,1]){
  let liveAffinity=0,earlyAffinity=0,moved=0,movedFromZero=0,shrunk=0,grown=0,changedRoom=0,changedWall=0,paintings=0;
  for(const {date} of archive.floors){
   const st=studies(date),live=buildPhiRendererPlan(date,st,{phiAdherence:adherence});
   const zero=buildPhiRendererPlan(date,st,{phiAdherence:0}).exhibition;
   const zeroById=new Map(zero.paintings.map(p=>[p.studyId,p]));
   globalThis.location={search:'?phiPass=early'};
   const candidate=stagePlan(live.floor,live.circulation,live.physical,st,{phiAdherence:adherence});
   assert.deepEqual(candidate,live.exhibition,date+' test early must match new production');
   globalThis.location={search:'?phiPass=classic'};
   const classic=stagePlan(live.floor,live.circulation,live.physical,st,{phiAdherence:adherence});
   globalThis.location={search:'?phiPass=early'};
   const origById=new Map(classic.paintings.map(p=>[p.studyId,p]));
   assert.equal(candidate.checks.complete,true,date+' complete');
   assert.equal(candidate.checks.inwardFacing,true,date+' direction');
   assert.equal(candidate.checks.sculptureClearances,true,date+' sculpture clearances');
   assert.deepEqual(candidate.curation,classic.curation,date+' grouping');
   assert.deepEqual(candidate.unplaced,classic.unplaced,date+' unplaced');
   assert.deepEqual(candidate.sculptures.map(s=>s.room),classic.sculptures.map(s=>s.room),date+' sculpture room');
   for(const p of candidate.paintings){
    const old=origById.get(p.studyId);
    assert.ok(old,date+' matching painting');
    changedRoom+=Number(p.room!==old.room);changedWall+=Number(p.surfaceId!==old.surfaceId);
    if(p.width+1e-6<old.width){shrunk++;assert.fail(date+' painting '+p.studyId+' shrank '+old.width+' -> '+p.width);}
    assert.ok(p.height+1e-6>=old.height,date+' painting height shrank');
    grown+=Number(p.width>old.width+1e-6);
    movedFromZero+=Number(Math.abs(p.u-zeroById.get(p.studyId).u)>1e-6);
    assert.ok(Math.abs(p.u-old.u)<=1.500001,date+' exceeds overall movement limit');
    moved+=Number(Math.abs(p.u-old.u)>1e-6);
    paintings++;
   }
   liveAffinity+=affinity(classic);earlyAffinity+=affinity(candidate);
  }
  totals.push({adherence,paintings,moved,movedFromZero,shrunk,grown,changedRoom,changedWall,
   baseAffinity:+(liveAffinity/paintings).toFixed(4),
   earlyAffinity:+(earlyAffinity/paintings).toFixed(4)});
 }
 console.log('EARLY_PHI_COMPARISON '+JSON.stringify(totals));
 assert.ok(totals.every(r=>r.changedRoom===0&&r.changedWall===0&&r.shrunk===0));
 delete globalThis.location;
});
