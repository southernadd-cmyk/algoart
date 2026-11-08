import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tissueEditionForDate,validateTissueShareUrl} from '../automation/tissue-edition.mjs';
for(const [day,suffix] of [
 ['2026-10-13','&watercolor=1'],['2026-10-14','&tissue=6'],
 ['2026-10-15','&tissue=7'],['2026-11-08','&tissue=7'],
 ['2026-11-09','&material=tissue-v8'],['2099-11-10','&material=tissue-v8']
]){
 assert.equal(tissueEditionForDate(day).suffix,suffix);
 assert.equal(validateTissueShareUrl(day,'https://example.test/?seed=X'+suffix).suffix,suffix);
}
for(const [day,suffix] of [
 ['2026-11-08','&material=tissue-v8'],['2026-11-09','&tissue=7'],
 ['2026-11-09','&tissue=8'],['2026-11-09','&material=tissue-v8&tissue=7']
])assert.throws(()=>validateTissueShareUrl(day,'https://example.test/?seed=X'+suffix),/disagrees/);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
assert(read('js/app.js').includes('var tissueLayeredV8=true'));
assert(read('js/app.js').includes("params.set('material','tissue-v8')"));
assert(read('js/app.js').includes('tissueLayeredV8=false; // Historical tissue revisions'));
assert(read('js/export.js').includes('A.renderTissueLayeredV8(out,compositionSettings,scale,false)'));
assert(read('js/export.js').includes('A.renderTissueV8(out,compositionSettings,scale,false)'));
assert(read('js/tissue-v8-layered.js').includes('A.renderOil(target,settings,scale,reveal,7)'));
assert(read('about/step-by-step/index.html').includes('A.renderTissueLayeredV8(target,s,renderScale,false)'));
assert(read('automation/generate-social.mjs').includes("tissueEdition.materialVersion==='tissue-v8'"));
console.log('PASS Tissue V8 editor, archive, PNG, gallery/social release policy');
