// Test tower only: rebuild its own JavaScript bundle without modifying
// gallery/visit/gallery-phi.js or the deployed live gallery-phi-bundle.js.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const dir=resolve(process.cwd(),'gallery/visit');
let source=await readFile(resolve(dir,'gallery-phi.js'),'utf8');
const replace=(before,after)=>{
 if(source.split(before).length!==2)throw Error('Room-signs build anchor changed: '+before.slice(0,75));
 source=source.replace(before,after);
};
replace("import * as THREE from 'three';",
  "import {addHangingRoomSigns} from '../../test/virtual-gallery/phi-room-hanging-signs.mjs';\nimport {stagingFloorUrl} from '../../test/virtual-gallery/phi-stage-routing.mjs';\nimport * as THREE from 'three';");
replace(" const byId=new Map(studies.map(study=>[study.id,study]));",
  " if(exhibitDate!==RECEPTION){\n"+
  "  window.__testRoomSigns=addHangingRoomSigns(THREE,scene,phi,elevation,ROOM_HEIGHT);\n"+
  " }else window.__testRoomSigns=[];\n"+
  " const byId=new Map(studies.map(study=>[study.id,study]));");
// Only the staging bundle is patched. The live gallery continues to use its
// current URL semantics, and test assets still load from gallery/visit/.
replace("history.replaceState(null,'',date===RECEPTION?location.pathname:'?date='+date);",
 "history.replaceState(null,'',stagingFloorUrl(location.href,date,RECEPTION));");

await build({
 stdin:{contents:source,sourcefile:'gallery-phi-test-room-signs.js',resolveDir:dir,loader:'js'},
 bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',
 outfile:'gallery/visit/gallery-phi-test-room-signs-bundle.js',
 logLevel:'warning'
});
console.log('Built test-only room-signs bundle. Live source and bundle untouched.');
