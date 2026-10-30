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
  name:'8bars-gramophone-staging-only',
  setup(builder){
    // Alter ONLY the test build's copy of the music panel.
    // Live gallery-music.mjs and its production bundle remain untouched.
    builder.onLoad({filter:/gallery-music[.]mjs$/,async({path})=>{
      let text=await readFile(path,'utf8');
      const swap=(oldText,newText)=>{
        if(text.split(oldText).length!==2)throw Error('Gramophone staging anchor changed: '+oldText.slice(0,70));
        text=text.replace(oldText,newText);
      };
      swap("import {createGramophoneRecord} from './gramophone-record.mjs?v=selectable-tracks-20261027';",
           "import {createPhiTestGramophoneRecord as createGramophoneRecord} from './phi-gramophone-test-controller.mjs';");
      swap("interpretation.textContent=s.track.composer==='Claude Debussy'?",
           "interpretation.textContent=s.track.goldenStudy?'An original 20-second study composed by 8bars: 5+3 phrasing, a change at 61.8%, and two sampled notes with an exact 1:φ frequency relationship. Does it sound harmonious?':s.track.composer==='Claude Debussy'?");
      swap("problem.textContent=s.problem;toggle.textContent=s.playing?'Pause record':'Play record';",
           "problem.textContent=s.loading?'Preparing the 8bars study…':s.problem;toggle.textContent=s.loading?'Cancel preparation':s.playing?'Pause record':'Play record';");
      swap("When it finishes, the next begins; both repeat through the gallery and lift speakers.",
           "The two historical records play in sequence. Golden Frequency loops independently. Sound uses the gallery and lift speakers.");
      swap('<div class="record-tracks" role="group" aria-label="Choose a recording"></div>',
           '<div class="record-tracks" role="group" aria-label="Choose a recording"></div><button type="button" class="record-compose">Compose another</button>');
      swap("trackButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===s.index)));",
           "trackButtons.forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===s.index));if(record.tracks[i]?.goldenStudy)button.textContent=record.tracks[i].composer+' — '+record.tracks[i].title;});panel.querySelector('.record-compose').disabled=!!s.loading;");
      swap("toggle.addEventListener('click',()=>record.toggle());",
           "toggle.addEventListener('click',()=>record.toggle());panel.querySelector('.record-compose').addEventListener('click',()=>record.composeAnother());");
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
