// Keep the independent test bundle and test lift routing while sharing the
// same curated hanging signs already integrated in the production source.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const dir=resolve(process.cwd(),'gallery/visit');
let source=await readFile(resolve(dir,'gallery-phi.js'),'utf8');
const replace=(before,after)=>{
 if(source.split(before).length!==2)throw Error('Room-signs build anchor changed: '+before.slice(0,75));
 source=source.replace(before,after);
};
// Signs are shared in the production source; only navigation differs on test.
replace("import * as THREE from 'three';",
  "import {stagingFloorUrl} from '../../test/virtual-gallery/phi-stage-routing.mjs';\nimport * as THREE from 'three';");
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
console.log('Built staging bundle with shared curated signs and test-safe lift routing.');
