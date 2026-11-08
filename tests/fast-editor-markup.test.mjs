import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const about=readFileSync(new URL('../about/index.html',import.meta.url),'utf8');
const ids=['introSplash','introEnter','welcomeLogo','app','materialStyle','art','seed','tab-marker','savePanel','saveSVG'];
for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'),'Missing required editor element '+id);
assert.match(html,/id="tab-marker"[^>]*>Marks<\/button>/,'Marks panel label must remain consistent');
assert.match(html,/id="variations"[^>]*aria-label="Phi Four:[^"]*"[^>]*>φ Four<\/button>/);
assert.match(html,/id="variationsTitle">φ FOUR<\/strong>/);
assert.match(html,/Same seed and settings · only additional φ pull changes/);
assert.match(app,/PHI_COMPARISON_STEPS=Object\.freeze\(\[0,38\.2,61\.8,100\]\)/);
assert.match(app,/Object\.assign\(\{\},base,\{phiStrength:pull\}\)/);
assert.doesNotMatch(app,/variationSeed\(/);
assert.match(html,/id="phiStrength"[^>]*step="0\.1"/);
assert.doesNotMatch(html,/id="shuffleVariations"/);
assert.match(html,/F Phi Four · S new seed/);
assert.doesNotMatch(html,/Four at once/);
const readme=readFileSync(new URL("../README.md",import.meta.url),"utf8");
for(const copy of [readme,about]){
  assert.match(copy,/φ Four \(Phi Four\)/,"Phi Four must appear in documentation");
  assert.match(copy,/0%, 38\.2%, 61\.8% and 100%/,"All comparison pull values must be documented");
  assert.match(copy,/0%[^\n]*φ|φ[^\n]*0%/,"0% must not imply φ is absent");
  assert.doesNotMatch(copy,/Four at once/,"Remove outdated feature name");
}
assert.match(html,/id="newSeed"[^>]*title="New seed \(S\)"/);
assert.match(app,/if\(key==='n'\)\$\('randomise'\)\.click\(\)/);
assert.match(app,/else if\(key==='f'\)openVariations\(\)/);
assert.match(app,/else if\(key==='s'\)\$\('newSeed'\)\.click\(\)/);
assert(!html.includes('V variations')&&!html.includes('SHUFFLE FOUR'));
assert.match(html,/id="descriptionPhiFit" hidden/);
assert.match(app,/Fit to φ: /);
assert.match(about,/1400 × 1000 pixels.*not a golden rectangle:/);
const sources=[...html.matchAll(/<script src="(js\/[^"]+\.js\?v=[^"]+)"><\/script>/g)].map(x=>x[1]);
assert(sources.length>=20,'Editor JavaScript dependencies are missing');
const versions=new Set(sources.map(x=>new URL(x,'https://example.invalid').searchParams.get('v')));
assert(sources.every(x=>new URL(x,'https://example.invalid').searchParams.get('v')),
  'Every editor script must have its own nonempty cache key');
assert.equal(sources.length,new Set(sources.map(x=>new URL(x,'https://example.invalid').pathname)).size,
  'Editor must not load any script twice');
assert(sources.some(x=>x.startsWith('js/editorial-pigment.js?v=')),
  'Pigment observer belongs to production js/, not test/');
assert(!html.includes('test/editorial-copy.js')&&!html.includes('test/editorial-pigment.js'),
  'Production must not load abandoned experimental scripts');
for(const source of sources)assert(!source.includes('..'),'Invalid editor script path');
assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1(?:,viewport-fit=cover)?">/);
console.log('PASS lightweight editor markup, critical controls and individually versioned scripts');
