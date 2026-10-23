import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ids=['introSplash','introEnter','welcomeLogo','app','materialStyle','art','seed','tab-marker','savePanel','saveSVG'];
for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'),'Missing required editor element '+id);
assert.match(html,/id="tab-marker"[^>]*>Marks<\/button>/,'Marks panel label must remain consistent');
const sources=[...html.matchAll(/<script src="(js\/[^"]+\.js\?v=[^"]+)"><\/script>/g)].map(x=>x[1]);
assert(sources.length>=12,'Core editor JavaScript dependencies are missing');
const versions=new Set(sources.map(x=>new URL(x,'https://example.invalid').searchParams.get('v')));
assert(sources.every(x=>new URL(x,'https://example.invalid').searchParams.get('v')),
  'Every editor script must have its own nonempty cache key');
assert.equal(sources.length,new Set(sources.map(x=>new URL(x,'https://example.invalid').pathname)).size,
  'Editor must not load any script twice');
assert(sources.some(x=>x.startsWith('js/editorial-pigment.js?v=')),
  'Pigment observer belongs to production js/, not test/');
assert(sources.some(x=>x.startsWith('js/material-loader.js?v=')),
  'The editor must load its material dependency manager');
for(const name of ['oil-v1-core-a','oil-v1-core-b','oil-v1-core-c','watercolour-v2s','action-painting-v1']){
  assert(!sources.some(x=>x.startsWith('js/'+name+'.js?')),
    name+' must load only when its material is selected');
}
assert(!html.includes('test/editorial-copy.js')&&!html.includes('test/editorial-pigment.js'),
  'Production must not load abandoned experimental scripts');
for(const source of sources)assert(!source.includes('..'),'Invalid editor script path');
assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1(?:,viewport-fit=cover)?">/);
console.log('PASS lightweight editor markup, critical controls and individually versioned scripts');
