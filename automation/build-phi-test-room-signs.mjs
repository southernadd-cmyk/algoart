// Keep the independent test bundle and test lift routing while sharing the
// same curated hanging signs already integrated in the production source.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {stageCurationPlugin} from './phi-stage-curation-plugin.mjs';
const dir=resolve(process.cwd(),'gallery/visit');
let source=await readFile(resolve(dir,'gallery-phi.js'),'utf8');
const replace=(before,after)=>{
 if(source.split(before).length!==2)throw Error('Room-signs build anchor changed: '+before.slice(0,75));
 source=source.replace(before,after);
};
// Signs are shared in the production source; only navigation differs on test.
replace("import * as THREE from 'three';",
  "import {stagingFloorUrl} from '../../test/virtual-gallery/phi-stage-routing.mjs';\nimport {chooseGalleryPenroseRooms,prepareGalleryPenroseMaterial,pieceRoomIndex} from './phi-gallery-penrose-floor.mjs';\nimport * as THREE from 'three';");
// The approved reception Penrose inlay now comes from the shared live source.
// The test-only gallery finish selects just one or two exhibition rooms per day.
replace(" for(const p of phi.pieces){\n   const slab=staticBlock(p.w,.28,p.h,p.x+p.w/2,elevation-.17,p.z+p.h/2,roomFloor);\n   if(roomFloor===receptionTilePreview)alignReceptionTileUvs(slab);\n }",
 " const galleryPenroseRooms=exhibitDate===RECEPTION?[]:chooseGalleryPenroseRooms(phi.floor.mergedRooms,exhibitDate);\n const galleryPenroseMaterial=galleryPenroseRooms.length\n  ?prepareGalleryPenroseMaterial(THREE,galleryFinish.floor,phi.pieces,{lowPower:galleryFinish.lowPower})\n  :null;\n if(GALLERY_DEBUG)window.__phiGalleryPenrose={date:exhibitDate,rooms:galleryPenroseRooms,kind:'subtle five-grid rhombs',ready:galleryPenroseMaterial?.userData?.galleryPenrose?.status||'not-used'};\n for(const p of phi.pieces){\n   const selected=galleryPenroseMaterial&&galleryPenroseRooms.includes(pieceRoomIndex(p,phi.floor.mergedRooms));\n   const finish=selected?galleryPenroseMaterial:roomFloor;\n   const slab=staticBlock(p.w,.28,p.h,p.x+p.w/2,elevation-.17,p.z+p.h/2,finish);\n   if(finish===receptionTilePreview||selected)alignReceptionTileUvs(slab);\n }");
// Only the staging bundle is patched. The live gallery continues to use its
// current URL semantics, and test assets still load from gallery/visit/.
replace("history.replaceState(null,'',date===RECEPTION?location.pathname:'?date='+date);",
 "history.replaceState(null,'',stagingFloorUrl(location.href,date,RECEPTION));");
// The staging archive can be updated after publication; never force-cache its HTML.
replace('fetchGalleryText(url,{cache}),',"fetchGalleryText(url,{cache:'no-store'}),");

await build({
 stdin:{contents:source,sourcefile:'gallery-phi-test-room-signs.js',resolveDir:dir,loader:'js'},
 bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',
 outfile:'gallery/visit/gallery-phi-test-room-signs-bundle.js',
 plugins:[stageCurationPlugin(),{
 name:'gramophone-phi-time-markers-test-only',
 setup(builder){
  builder.onLoad({filter:/gallery-music[.]mjs$/},async({path})=>{
   let text=await readFile(path,'utf8');
   const swap=(before,after)=>{
    if(text.split(before).length!==2)throw Error('φ timeline staging anchor changed: '+before.slice(0,80));
    text=text.replace(before,after);
   };
   swap("import {createGramophoneRecord} from './gramophone-record.mjs?v=selectable-tracks-20261027';",
    "import {createGramophonePhiTimeline} from './phi-gramophone-timeline.mjs';\nimport {createGramophoneRecord} from './gramophone-record.mjs?v=selectable-tracks-20261027';");
   swap("let opened=false,trackButtons=[];",
    "let opened=false,trackButtons=[],goldenTimeline=null;");
   swap("trackButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===s.index)));",
    "trackButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===s.index)));goldenTimeline?.update();");
   swap(" const position=new THREE.Vector3();",
    " goldenTimeline=createGramophonePhiTimeline({panel,record});\n const position=new THREE.Vector3();");
   swap("  dispose(){record.dispose();",
    "  dispose(){goldenTimeline?.dispose();record.dispose();");
   return {contents:text,loader:'js',resolveDir:dir};
  });
 }
}],
 logLevel:'warning'
});
const bundle=await readFile(resolve(dir,'gallery-phi-test-room-signs-bundle.js'));
const sha256=createHash('sha256').update(bundle).digest('hex');
await writeFile(resolve(dir,'test-curator-revision.json'),JSON.stringify({sha256}));
console.log('Built test-only phi curation bundle, revision '+sha256.slice(0,12));
