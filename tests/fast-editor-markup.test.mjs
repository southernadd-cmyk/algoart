import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const about=readFileSync(new URL('../about/index.html',import.meta.url),'utf8');
const ids=['introSplash','introEnter','welcomeLogo','app','materialStyle','art','seed','tab-marker','savePanel','saveSVG'];
for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'),'Missing required editor element '+id);
assert.match(html,/id="tab-marker"[^>]*>Marks<\/button>/,'Marks panel label must remain consistent');
assert.match(html,/id="variations"[^>]*>Four at once<\/button>/);
assert.match(html,/id="variationsTitle">FOUR AT ONCE<\/strong>/);
assert.match(html,/id="shuffleVariations">SHOW FOUR MORE<\/button>/);
assert.match(html,/F four at once · S new seed/);
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
