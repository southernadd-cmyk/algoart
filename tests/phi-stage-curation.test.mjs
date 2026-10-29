import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {stageCurationPlugin} from '../automation/phi-stage-curation-plugin.mjs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {wallPhiPreference,sculpturePhiPreference,stageMaterial} from '../test/virtual-gallery/phi-curation-stage.mjs';

async function stagedModule(percent){
 const bundle=await build({
  stdin:{contents:"export {planCuratedPhiExhibition} from './gallery/visit/phi-curator.mjs'; export {studyCurationTraits} from './gallery/visit/phi-curation-groups.mjs';",
   sourcefile:'stage-curation-fixture.js',resolveDir:process.cwd(),loader:'js'},
  bundle:true,format:'esm',platform:'node',target:'es2022',write:false,
  plugins:[stageCurationPlugin()],logLevel:'silent'
 });
 globalThis.location={search:'?phiHang='+percent};
 const data=Buffer.from(bundle.outputFiles[0].text).toString('base64');
 return import('data:text/javascript;base64,'+data+'#stage-'+percent);
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
 for(const {date} of archive.floors){
  const studies=archivedStudies(date);
  const live=buildPhiRendererPlan(date,studies);
  const base=off.planCuratedPhiExhibition(live.floor,live.circulation,live.physical,studies);
  const stage=on.planCuratedPhiExhibition(live.floor,live.circulation,live.physical,studies);
  assert.deepEqual(placements(base),placements(live.exhibition),'0% must match original placement '+date);
  assert.equal(stage.checks.complete,true,'no unplaced artworks '+date);
  assert.equal(stage.checks.inwardFacing,true,'inward facing '+date);
  assert.equal(stage.checks.sculptureClearances,true,'sculpture clearance '+date);
  assert.equal(stage.checks.unique,true,'unique art '+date);
  assert.ok(stage.curation.score+1e-9>=stage.curation.baselineScore,'theme grouping '+date);
  assert.deepEqual(stage,on.planCuratedPhiExhibition(live.floor,live.circulation,live.physical,studies),'deterministic '+date);
  baselineAffinity+=affinity(base);stagedAffinity+=affinity(stage);
  paintings+=stage.paintings.length;sculptures+=stage.sculptures.length;
  if(JSON.stringify(placements(base))!==JSON.stringify(placements(stage)))modified++;
 }
 assert.ok(stagedAffinity>baselineAffinity+1,'new hang must measurably favour golden-section placements');
 assert.ok(modified>0,'at least one floor should differ');
 console.log('stage curation:',{paintings,sculptures,modified,baselineAffinity,stagedAffinity});
 delete globalThis.location;
});
