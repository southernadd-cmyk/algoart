import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';

const root=resolve('gallery/visit');
const read=path=>readFileSync(path,'utf8');

test('production imports have complete files and consistent version specifiers',()=>{
  const imported=new Map();
  for(const name of readdirSync(root).filter(x=>/\.(?:mjs|js)$/.test(x))){
    const full=resolve(root,name);
    for(const [,specifier] of read(full).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.[^'"]+)['"]/g)){
      const target=resolve(dirname(full),specifier.split(/[?#]/)[0]);
      assert.ok(existsSync(target),name+' references missing '+specifier);
      const suffix=specifier.includes('?')?specifier.slice(specifier.indexOf('?')):'';
      const uses=imported.get(target)||new Set();
      uses.add(suffix);
      imported.set(target,uses);
    }
  }
  for(const [target,uses] of imported)
    assert.equal(uses.size,1,'Duplicate import versions for '+target+': '+[...uses].join(', '));
});
test('public metadata and essential production assets exist',()=>{
  const html=read(resolve(root,'index.html'));
  assert.match(html,/<title>Virtual Exhibition \| PROPORTION PIECE<\/title>/);
  assert.match(html,/rel="canonical" href="https:\/\/southernadd-cmyk\.github\.io\/algoart\/gallery\/visit\/"/);
  assert.doesNotMatch(html,/noindex/);
  assert.match(html,/gallery-v2\.js\?v=/);
  assert.match(html,/class="algo-global-header gallery-global-header"/);
  assert.match(html,/--gallery-ui-bottom/);
  assert.match(html,/ResizeObserver\(update\)/);
  assert.match(html,/gallery\.css\?v=accessibility-20261023/);
  assert.match(html,/\.\.\/\.\.\/css\/nav-lettering\.css/);
  assert.match(html,/\.\.\/\.\.\/js\/nav-lettering\.js/);
  assert.match(html,/<nav class="algo-site-nav" aria-label="Site navigation">/);
  assert.match(html,/data-algo-nav href="\.\.\/\.\.\/">try it out<\/a>/);
  assert.match(html,/data-algo-nav href="\.\.\/">daily gallery<\/a>/);
  assert.doesNotMatch(html,/aria-current="page"/);
  assert.match(html,/data-algo-nav href="\.\.\/\.\.\/about\/">how it works<\/a>/);
  assert.match(html,/class="hint" id="hint">W A S D move · arrow keys look · Shift faster<\/div>/);
  assert.match(html,/id="infoMeta"/);
  assert.match(html,/Dates marked with a dot/);
  assert.match(html,/Each daily collection occupies its own floor/);
  assert.doesNotMatch(html,/Chrome loading diagnosis/);
  const app=read(resolve(root,'gallery-v2.js'));
  assert.doesNotMatch(app,/window[.]prompt/);
  assert.doesNotMatch(app,/Temporary diagnostic for the unexplained entrance overlay/);
  assert.match(app,/infoMeta/);
  for(const file of [
    'models/quaternius-male-meshopt.glb',
    'models/quaternius-female-meshopt.glb',
    'models/human-male-female-rigged-optimized.glb',
    'models/polyhaven-street-lamp-01-optimized.glb',
    'models/twin-surface-spotlight.glb',
    'models/elevator-game-ready.glb',
    'assets/day-environment-hdri-101-1k.jpg',
    'assets/day-environment-hdri-101-2k.jpg',
    'textures/OfficeCeiling001_Color.jpg',
    'tower-still.svg'
  ])assert.ok(existsSync(resolve(root,file)),'Missing production asset '+file);
  for(const file of ['../tower-geometry.bin.gz','../tower-layouts.json','../archive.json'])
    assert.ok(existsSync(resolve(root,file)),'Missing archive dependency '+file);
});
test('every archived edition links to its exact 3D floor',()=>{
  const gallery=resolve('gallery');
  const archive=JSON.parse(read(resolve(gallery,'archive.json')));
  const index=read(resolve(gallery,'index.html'));
  assert.match(index,/class="visit-band"/);
  assert.match(index,/\.\/visit\//);
  assert.ok(archive.days.length>0);
  for(const {date} of archive.days)
    assert.ok(read(resolve(gallery,date,'index.html')).includes('../visit/?date='+date),
      'Missing floor link on '+date);
  const legacy=read(resolve('test/virtual-gallery/index.html'));
  assert.doesNotMatch(legacy,/location\\.replace\\(/);
  assert.match(legacy,/gallery-bundle\\.js/);
  assert.match(legacy,/<base href="\\.\\.\\/\\.\\.\\/gallery\\/visit\\/">/);
});
