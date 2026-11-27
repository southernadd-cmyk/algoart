import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {runInNewContext} from 'node:vm';

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
  assert.match(html,/gallery-phi-sculpture-v2-test-bundle\.js\?v=sculpture-v2-20\d{6}(?:-[a-z0-9-]+)?/);
  assert.doesNotMatch(html,/gallery-phi-bundle\.js\?v=classical-aac/);
  const receptionFlag=html.indexOf('globalThis.__phiReceptionTestRefresh=true');
  // The bundle is selected by a test-query conditional, so the import is dynamic.
  // Check that reception is initialised before that import statement itself.
  assert.ok(receptionFlag>=0&&receptionFlag<html.indexOf('await import(',receptionFlag),'Reception must be enabled before the production bundle loads');
  assert.doesNotMatch(html,/cdn\.jsdelivr\.net/);
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
  assert.match(html,/data-algo-nav href="\.\.\/\.\.\/about\/">about this project<\/a>/);
  assert.match(html,/class="hint" id="hint">W A S D move · arrow keys look · Shift faster<\/div>/);
  assert.match(html,/id="infoMeta"/);
  assert.match(html,/Dates marked with a dot/);
  assert.match(html,/Each daily collection occupies its own floor/);
  assert.doesNotMatch(html,/Chrome loading diagnosis/);
  const app=read(resolve(root,'gallery-phi.js'));
  assert.match(html,/id="liftReception"/);assert.match(html,/phi-gallery\.css/);
  assert.doesNotMatch(html,/Gallery preview|Architecture study/);
  // GS6 uses the same pinned local Three.js modules for both renderers.
  const maps=[...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
  assert.equal(maps.length,1,'Exactly one approved import map');
  const imports=JSON.parse(maps[0][1]).imports;
  assert.deepEqual(imports,{
    'three':'./vendor/three-0.187.0/build/three.module.js',
    'three/':'./vendor/three-0.187.0/',
    'three/addons/':'./vendor/three-0.187.0/examples/jsm/',
    'three/webgpu':'./vendor/three-0.187.0/build/three.webgpu.js',
    'three/tsl':'./vendor/three-0.187.0/build/three.tsl.js',
    '@sparkjsdev/spark':'https://sparkjs.dev/releases/spark/2.4.0/spark.module.js'
  });
  for(const target of Object.values(imports).filter(x=>x.startsWith('./')))
    assert.ok(existsSync(resolve(root,target)),'Missing import map target '+target);
  assert.ok(maps[0].index<html.indexOf('<script type="module">'),'Import map must precede module startup');
  assert.doesNotMatch(app,/loadPrebuiltTower|tower-geometry\.bin/);
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
    ...['pothos-plant','cardboard-boxes','gothic-entrance-door','succulent-planter','vintage-world-map','magazine-cabinet','paper-clutter','modern-reception-fittings','reception-gramophone','ceiling-speaker'].map(n=>'models/'+n+'.glb'),
    'credits.html','phi-gallery.css','legacy.html','phi-tower-preview.png',
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
  const legacy=read(resolve('test/virtual-gallery/index.html')); // Restored test entry loads its own copy of the live bundle.
  assert.doesNotMatch(legacy,/location\.replace\(/);
  assert.match(legacy,/test\/virtual-gallery\/gallery-phi-bundle\.js/);
  assert.match(legacy,/<base href="\.\.\/\.\.\/gallery\/visit\/">/);
});


test('production visitor models use the bundled Meshopt decoder',()=>{
  const visitors=read(resolve(root,'visitors.mjs'));
  assert.ok(visitors.includes('three/addons/libs/meshopt_decoder.module.js'));
  assert.ok(!visitors.includes('cdn.jsdelivr.net/npm/meshoptimizer'));
  const bundle=read(resolve(root,'gallery-phi-bundle.js'));
  assert.ok(!bundle.includes('cdn.jsdelivr.net/npm/meshoptimizer'));
});

test('production lift keeps painting readiness and uses approved loading overlap',()=>{
 const app=read(resolve(root,'gallery-phi.js'));
 const html=read(resolve(root,'index.html'));
 const preloader=read(resolve(root,'phi-artwork-preload.mjs'));
 assert.ok(app.includes("get('liftpipeline')!=='0'"));
 assert.ok(app.includes('warmPhiLiftDestination({'),'Lift must precompile destination renderables');
 assert.ok(app.includes('cameraAware:true'),'Point pool must count camera-renderable lights');
 assert.ok(app.includes("phiStablePointLights.sync('before-render')"),'Point pool must rebalance before every render');
 assert.ok(app.includes('batchSize:Math.max(1,phiArrivalMeshes.stats().total)'),'Lift must reveal the tested single batch');
 assert.ok(!app.includes('liftcompiletest')&&!app.includes('phiPaintingTrace'),'Release must exclude lift experiment and profiler');
 assert.ok(app.includes('phiPaintingGate.wait'));
 assert.ok(app.includes('await phiMarkerReady;'));
 assert.ok(preloader.includes('releaseAfterDecode'));
 // Gaussian startup has two entry bundles, not one static modulepreload.
 const entry=html.match(/\/\* GS6_ENTRY_START \*\/([\s\S]*?)\/\* GS6_ENTRY_END \*\//)?.[1];
 assert.ok(entry,'Missing production renderer selection');
 const imports=[...entry.matchAll(/await import\('([^']+)'\)/g)].map(m=>m[1]);
 const [mesh,splats,fallback]=imports;
 assert.equal(imports.length,3);
 assert.match(mesh,/^\.\/gallery-phi-sculpture-v2-test-bundle\.js\?v=sculpture-v2-20\d{6}(?:-[a-z0-9-]+)?$/);
 assert.match(splats,/^\.\/gallery-phi-splats-bundle\.js\?v=gs[0-9]+-[0-9]+$/);
 assert.equal(fallback,mesh,'Fallback must use the same approved mesh bundle');
 for(const specifier of [mesh,splats])
   assert.ok(existsSync(resolve(root,specifier.split('?')[0])),'Missing entry bundle '+specifier);
 const head=html.match(/<!-- GS6_HEAD_START -->([\s\S]*?)<!-- GS6_HEAD_END -->/)?.[1];
 assert.ok(head,'Missing renderer preload');
 const script=head.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Missing dynamic preload script');
 for(const [search,expected] of [['',splats],['?sculptures=mesh',mesh],['?date=2026-11-27',splats]]){
   const links=[];
   runInNewContext(script,{
     URLSearchParams,location:{search},
     document:{createElement(tag){assert.equal(tag,'link');return {};},head:{append(link){links.push(link);}}}
   },{timeout:1000});
   assert.equal(links.length,1);
   assert.equal(links[0].rel,'modulepreload');
   assert.equal(links[0].href,expected,'Preload must match selected renderer');
 }
 assert.match(entry,/if\(meshOnly\)\{[\s\S]*?__ppSculptureMode='mesh'/);
 assert.match(entry,/__ppSculptureMode='splats'/);
 assert.match(entry,/catch\(splatError\)/);
 assert.match(entry,/__ppSculptureMode='mesh-fallback'/);
 assert.match(entry,/rollback\.searchParams\.set\('sculptures','mesh'\)/);
});
