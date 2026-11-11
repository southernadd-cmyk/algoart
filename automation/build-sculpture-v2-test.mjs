// Isolated Sculpture V2 preview builder. Uses the REAL full-height public tower,
// replaces only the V1 portrait renderer, and emits a distinct route/bundle.
// Reception source metadata/image use immutable R2 URLs; Pages mesh staging is retired.
// Does not touch live production bundles, V1 baked packs or daily generation.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';

const target=resolve('gallery/visit/gallery-phi-sculpture-v2-test-bundle.js');
const replacement=resolve('gallery/sculpture-v2-test/sculpture-render-v2.mjs');
const nodeAO=resolve('node_modules/n8ao/dist/N8AO.js');
const original=readFileSync(nodeAO,'utf8');
const getter=/get texture\s*\(\)\s*\{\s*return this\.textures;\s*\}/g;
assert.equal([...original.matchAll(getter)].length,1,
  'Pinned N8AO compatibility anchor changed');
const patched=original.replace(getter,
  'get texture() { return this.textures[0]; }');
const three=JSON.parse(await readFile('node_modules/three/package.json','utf8'));
assert.equal(three.version,'0.187.0','Tower and V4.2 must use the same Three runtime');
let rendererReplacements=0,n8aoReplacements=0,receptionReplacements=0;
await mkdir(dirname(target),{recursive:true});
await build({
  entryPoints:['gallery/visit/gallery-phi.js'],
  bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',
  outfile:target,
  plugins:[{
    name:'sculpture-v2-isolated-preview',
    setup(plugin){
      plugin.onLoad({filter:/[/\\]gallery[/\\]visit[/\\]gallery-phi\.js$/},async(args)=>{
        const original=await readFile(args.path,'utf8');
        const studyAnchor="      seed:bake.seed,title:'Recursive Divisions',href:bake.href,";
        const exhibitAnchor="      phiReceptionProps.push(built.pivot);";
        assert.equal(original.split(studyAnchor).length-1,1,
          'Reception study must have exactly one approved V1 source record');
        assert.equal(original.split(exhibitAnchor).length-1,1,
          'Reception plinth must have exactly one registration point');
        let transformed=original.replace(studyAnchor,
          "      id:'reception-recursive-divisions-v2',"+
          "date:'reception',engine:'recursive-divisions',portrait:true,"+
          "imageFile:'recursive-divisions-portrait.png',receptionPrepared:true,\n"+
          studyAnchor).replace(exhibitAnchor,
          exhibitAnchor+"\n"+
          "      const exhibit={study,position:new THREE.Vector3("+
          "position.x,elevation+1.65,position.z),sculpture:true};\n"+
          "      artExhibits.push(exhibit);\n"+
          "      window.__sculptureV2ReceptionExhibit={"+
          "title:study.title,seed:study.seed,href:study.href};\n"+
          "      window.__sculptureV2ReceptionInspect=()=>showInfo(exhibit);");
        const oldSource="./data/reception-growth-systems.json";
        const oldImage="./data/reception-growth-systems.png";
        const oldGate="!bake.qualities?.desktop?.length";
        const oldPrebuilt="prebuilt:{desktop:bake.qualities.desktop,mobile:bake.qualities.mobile}";
        for(const token of [oldSource,oldImage,oldGate,oldPrebuilt])
          assert.equal(transformed.split(token).length-1,1,
            'Reception source substitution needs one exact anchor: '+token);
        transformed=transformed
          .replace(oldSource,"https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/sculptures-v2/v4.2.1-20261110/reception/source/ecce0addb36639a44d6b415c20cce983abf347202672294169c022a615e4c47a.json")
          .replace(oldImage,"https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/sculptures-v2/v4.2.1-20261110/reception/image/a66e75e6a8d7ad8616de6a1b501ecfe64b5fb0e5c12970ddb1f3f31b55594c3a.png")
          .replace(oldGate,"!(bake.orientation==='portrait'&&bake.width===1000&&bake.height===1400)")
          .replace(oldPrebuilt,"sourcePortrait:true");
        // V2 geometry is obtained only from source-verified R2 packs.
        // Never request a retired daily V1 sculptures.json.gz just to build the floor.
        const legacyPackCall='    loadSculpturePack(date,cache)';
        assert.equal(transformed.split(legacyPackCall).length-1,1,
          'Expected exactly one legacy V1 pack request');
        transformed=transformed.replace(legacyPackCall,'    Promise.resolve({})');
        receptionReplacements++;
        return{contents:transformed,loader:'js',resolveDir:dirname(args.path)};
      });
      plugin.onLoad({filter:/[/\\]sculpture-render-traced\.mjs$/},async()=>{
        rendererReplacements++;
        return{
          contents:await readFile(replacement,'utf8'),loader:'js',
          resolveDir:dirname(replacement)
        };
      });
      plugin.onLoad({filter:/[/\\]n8ao[/\\]dist[/\\]N8AO\.js$/},args=>{
        assert.equal(resolve(args.path),nodeAO);
        n8aoReplacements++;
        return{contents:patched,loader:'js',resolveDir:dirname(nodeAO)};
      });
    }
  }],
  logLevel:'warning'
});
assert.equal(rendererReplacements,1,
  'V1 sculpture renderer was not replaced exactly once');
assert.equal(receptionReplacements,1,
  'The isolated V2 reception study registration was not inserted once');
assert.equal(n8aoReplacements,1,
  'N8AO compatibility patch was not included exactly once');
assert.ok((await readFile(target)).length>200000,
  'V2 test tower did not produce a complete browser bundle');
const live=await readFile('gallery/visit/index.html','utf8');
const originalUrl='./gallery-phi-sculpture-v2-test-bundle.js?v=sculpture-v2-20261111';
assert.equal(live.split(originalUrl).length-1,2,
  'Public tower must use the verified V2 bundle for preload and import');
let html=live.replace('<head>',
  '<head>\n<base href="../visit/">\n<meta name="robots" content="noindex,nofollow">');
assert.notEqual(html,live);
html=html.replaceAll(originalUrl,
  './gallery-phi-sculpture-v2-test-bundle.js?v=sculpture-v2-preview-01');
html=html.replaceAll('Virtual Exhibition | PROPORTION PIECE',
  'Sculpture V2 Test Tower | PROPORTION PIECE');
html=html.replace('</body>',
  '<div role="note" style="position:fixed;z-index:31;right:12px;bottom:12px;pointer-events:none;background:#21302ae9;color:#f8f0d8;border:1px solid #b69b62;padding:7px 11px;font:600 12px Arial,Helvetica,sans-serif">SCULPTURE V2 TEST TOWER · NOT THE LIVE EXHIBITION</div></body>');
await mkdir('gallery/sculpture-v2-test',{recursive:true});
await writeFile('gallery/sculpture-v2-test/index.html',html);
console.log('SCULPTURE_V2_TEST_BUILT '+JSON.stringify({
  route:'gallery/sculpture-v2-test/',rendererReplacements,n8aoReplacements,
  receptionReplacements,
  source:'gallery/visit/gallery-phi.js',legacyV1RendererUntouched:true,
  archiveAndDailyBakesUntouched:true,onDemand:false,preparedPacks:true,
  v2Geometry:'sculpture-lab-v4.2.1',pin:'museum'
}));
