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
  "import {stagingFloorUrl} from '../../test/virtual-gallery/phi-stage-routing.mjs';\nimport * as THREE from 'three';");
// Approved Penrose floor treatments are now shared by live and test galleries.
// Only the staging bundle is patched. The live gallery continues to use its
// current URL semantics, and test assets still load from gallery/visit/.
replace("history.replaceState(null,'',date===RECEPTION?location.pathname:'?date='+date);",
 "history.replaceState(null,'',stagingFloorUrl(location.href,date,RECEPTION));");
// The staging archive can be updated after publication; never force-cache its HTML.
replace('fetchGalleryText(url,{cache}),',"fetchGalleryText(url,{cache:'no-store'}),");

// Lighting experiment exists only in the staging bundle. Keep production source intact.
replace("import * as THREE from 'three';",
 "import {createPhiLightingComparison} from '../../test/virtual-gallery/phi-lighting-comparison.mjs';\nimport * as THREE from 'three';\nconst phiLightingComparison=createPhiLightingComparison();");
replace(' const staticArchitecture=[];', ' phiLightingComparison.reset();\n const staticArchitecture=[];');
replace('  scene.add(light,light.target);\n }\n // Put visible portal frames',
 '  scene.add(light,light.target);\n  if(exhibitDate!==RECEPTION)phiLightingComparison.register({light,mount,fallback,cell:{...cell},power:light.intensity});\n }\n // Put visible portal frames');
replace('    if(plan.phi)transformPhiActiveFloor(sceneBeforeConstruction);',
 '    if(plan.phi)transformPhiActiveFloor(sceneBeforeConstruction);\n    phiLightingComparison.finish(plan.phi?.world);');

await build({
 stdin:{contents:source,sourcefile:'gallery-phi-test-room-signs.js',resolveDir:dir,loader:'js'},
 bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',
 outfile:'gallery/visit/gallery-phi-test-room-signs-bundle.js',
 plugins:[stageCurationPlugin(),{
 name:'gramophone-phi-time-markers-test-only',
 setup(builder){
  builder.onLoad({filter:/gallery-music[.]mjs$/},async({path})=>{
   return {contents:"export {createPhiGalleryMusic} from './phi-gramophone-music.mjs';",loader:'js',resolveDir:dir};
  });
 }
}],
 logLevel:'warning'
});
const bundle=await readFile(resolve(dir,'gallery-phi-test-room-signs-bundle.js'));
const sha256=createHash('sha256').update(bundle).digest('hex');
await writeFile(resolve(dir,'test-curator-revision.json'),JSON.stringify({sha256}));
console.log('Built test-only phi curation bundle, revision '+sha256.slice(0,12));
// The isolated review uses the same dialog module and real audio without WebGL.
await build({entryPoints:['gallery/visit/phi-gramophone-music.mjs'],bundle:true,minify:true,
 platform:'browser',format:'esm',target:'es2022',outfile:'gallery/visit/phi-gramophone-preview.js',logLevel:'warning'});
