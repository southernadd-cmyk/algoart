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
 name:'gramophone-phi-spectrum-staging-only',
 setup(builder){
  builder.onLoad({filter:/gallery-music[.]mjs$/},async({path})=>{
   let text=await readFile(path,'utf8');
   const swap=(from,to)=>{
    if(text.split(from).length!==2)throw Error('φ spectrum staging anchor changed: '+from.slice(0,85));
    text=text.replace(from,to);
   };
   swap("import {createGramophoneRecord} from './gramophone-record.mjs?v=selectable-tracks-20261027';",
     "import {createGramophonePhiSpectrum} from './phi-gramophone-spectrum.mjs';\\nimport {createGramophoneRecord} from './gramophone-record.mjs?v=selectable-tracks-20261027';");
   swap(" const position=new THREE.Vector3();",
     " const phiSpectrum=createGramophonePhiSpectrum(record.audio);\\n const phiButton=document.createElement('button');phiButton.type='button';phiButton.className='record-phi-spectrum';phiButton.textContent='Hear φ spectrum';phiButton.setAttribute('aria-pressed','false');toggle.insertAdjacentElement('afterend',phiButton);\\n const phiInfo=document.createElement('small');phiInfo.textContent='Test the same recording through six frequency bands separated by φ. Original pitch and timing are preserved.';phiButton.insertAdjacentElement('afterend',phiInfo);\\n const position=new THREE.Vector3();");
   swap(" toggle.addEventListener('click',()=>record.toggle());",
     " toggle.addEventListener('click',()=>record.toggle());\\n phiButton.addEventListener('click',async()=>{phiButton.disabled=true;try{const active=await phiSpectrum.toggle();phiButton.setAttribute('aria-pressed',String(active));phiButton.textContent=active?'Hear original recording':'Hear φ spectrum';problem.textContent='';}catch(error){problem.textContent=error?.message||'The φ spectrum is unavailable';}finally{phiButton.disabled=false;}});");
   swap("  dispose(){record.dispose();",
     "  dispose(){phiSpectrum.dispose();record.dispose();");
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
