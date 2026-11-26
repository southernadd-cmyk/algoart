// Isolated Sculpture V2 preview builder. Uses the REAL full-height public tower,
// replaces only the V1 portrait renderer, and emits a distinct route/bundle.
// Reception source metadata/image use immutable R2 URLs; Pages mesh staging is retired.
// Does not touch live production bundles, V1 baked packs or daily generation.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {normalizeGalleryEntry} from './gallery-entry-template.mjs';

const gaussianPreview=process.argv.includes('--gaussian-preview');
const productionSplats=process.argv.includes('--production-splats');
const target=resolve(productionSplats?'gallery/visit/gallery-phi-splats-bundle.js':gaussianPreview?'gallery/visit/gallery-phi-gaussian-preview-bundle.js':'gallery/visit/gallery-phi-sculpture-v2-test-bundle.js');
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
  // One Three.js runtime for the tower, its add-ons and Spark. Normal builds stay bundled.
  ...((gaussianPreview||productionSplats)?{external:['three','three/*','@sparkjsdev/spark']}:{}),
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
        if(productionSplats){
          const inject=(from,to)=>{
            assert.equal(transformed.split(from).length-1,1,'Production splat anchor changed: '+from);
            transformed=transformed.replace(from,()=>to);
          };
          transformed="import {createSculptureSplatRenderer} from '../sculpture-splats/renderer.mjs';\nglobalThis.__ppSplatTowerStarted=true;\n"+transformed;
          inject('createPortraitSculpture, setSculptureArchitecturalMaterials','createPortraitSculpture, setSculptureArchitecturalMaterials, setSculptureSplatEnhancer');
          const fx='const phiPostFX=createPhiPostFX(THREE,renderer,scene,camera,{production:true});';
          inject(fx,fx+"\nconst sculptureSplats=renderer?createSculptureSplatRenderer({THREE,renderer,scene}):null;\nsetSculptureSplatEnhancer(sculptureSplats?.enhance,sculptureSplats?.prefetch);\nwindow.__sculptureSplats=()=>sculptureSplats?.stats();\nconst renderSculptureFrame=(...args)=>sculptureSplats?sculptureSplats.renderFrame(()=>phiPostFX.render(...args)):phiPostFX.render(...args);");
          // Staged, retained and active floor disposal must release Spark-owned buffers.
          transformed=transformed.replaceAll('object.userData.galleryDisposed=true;', 'object.userData.disposeSculptureSplats?.();object.userData.galleryDisposed=true;')
            .replaceAll('child.userData.galleryDisposed=true;', 'child.userData.disposeSculptureSplats?.();child.userData.galleryDisposed=true;');
          // Includes modal rendering and XR; retry a failed Spark frame using meshes.
          assert.equal(transformed.split('phiPostFX.render(dt,').length-1,2,'Expected two tower frame call sites');
          transformed=transformed.replaceAll('phiPostFX.render(dt,','renderSculptureFrame(dt,');
        }
        if(gaussianPreview){
          const inject=(from,to)=>{
            assert.equal(transformed.split(from).length-1,1,'Gaussian preview anchor changed: '+from);
            transformed=transformed.replace(from,()=>to);
          };
          transformed="import {createGaussianLivePreview} from '../gaussian-splat-lab/live-preview.mjs';\nimport {createSculpturePreview} from '../gaussian-splat-lab/sculpture-preview.mjs';\nconst sculptureComparison=new URLSearchParams(location.search).get('experiment')==='sculptures';\n"+transformed;
          // Reposition only the production light pools for the sampled room, never the visitor.
          inject('function updatePhiBoundedRoomLights(){','function updatePhiBoundedRoomLights(position=rig.position){');
          inject('chooseNearestPhiRoomAnchors(phiBoundedRoomAnchors,rig.position)','chooseNearestPhiRoomAnchors(phiBoundedRoomAnchors,position)');
          inject('function updateExhibitLighting(){','function updateExhibitLighting(position=rig.position){');
          const exhibitLightsAnchor='  updatePhiBoundedRoomLights();\n  const nearest=exhibitLightTargets.slice()\n    .sort((a,b)=>a.position.distanceToSquared(rig.position)-b.position.distanceToSquared(rig.position));';
          inject(exhibitLightsAnchor,exhibitLightsAnchor.replace('updatePhiBoundedRoomLights()','updatePhiBoundedRoomLights(position)').replaceAll('distanceToSquared(rig.position)','distanceToSquared(position)'));
          const fxAnchor='const phiPostFX=createPhiPostFX(THREE,renderer,scene,camera,{production:true});';
          inject(fxAnchor,fxAnchor+"\nlet gaussianStartupPreparing=false;\nconst gaussianLab=renderer?(sculptureComparison?createSculpturePreview:createGaussianLivePreview)({THREE,renderer,scene,camera,getDate:()=>exhibitDate,getReady:()=>!!plan?.phi&&!liftTravelling&&(gaussianStartupPreparing||!!welcome?.hidden)&&$('lift').hidden,getExpected:()=>plan?.phi?.exhibition?.sculptures?.length||0,selectBakeLights:position=>{updateExhibitLighting(position);return ()=>updateExhibitLighting();}}):null;");
          // Fixed comparison edition: spawn in a real walkable room before warming the scene.
          inject('function openLift(){','function openLift(){return;');
          inject('function openXRLift(){','function openXRLift(){return;');
          const spawnAnchor="  $('liftMonth').value=(reception?archiveDates[1]:date).slice(0,7);";
          inject(spawnAnchor,`  if(!viaLift&&!reception){
    const phi=plan.phi;
    const candidates=phi.pieces.flatMap(p=>[.5,.3,.7].flatMap(u=>[.5,.3,.7].map(v=>({...phi.world.toWorld(p.x+p.w*u,p.z+p.h*v),area:p.w*p.h}))));
    const clear=candidates.filter(p=>phi.canWalk(p.x,p.z)&&clearOfSculptures(sculpturePlacements,p.x,p.z)&&clearOfSculptures(phiFurnishingObstacles,p.x,p.z)&&!phiDoorBlocked(p.x,p.z)&&(!liftPosition||Math.hypot(p.x-liftPosition.x,p.z-liftPosition.z)>3.5)).sort((a,b)=>b.area-a.area);
    if(!clear.length)throw Error('No safe comparison viewpoint on the pinned floor');
    const sculptureTargets=artExhibits.filter(a=>a.study?.portrait&&!a.normal);
    const nearestDistance=p=>Math.min(...sculptureTargets.map(a=>Math.hypot(a.position.x-p.x,a.position.z-p.z)));
    if(sculptureComparison&&sculptureTargets.length)clear.sort((a,b)=>Math.abs(nearestDistance(a)-3.4)-Math.abs(nearestDistance(b)-3.4));
    const p=clear[0];rig.position.set(p.x,elevation,p.z);
    const eye=rig.position.clone();eye.y+=1.68;
    const art=(sculptureComparison&&sculptureTargets.length?sculptureTargets:artExhibits.filter(a=>a.normal&&a.normal.dot(eye.clone().sub(a.position))>.2)).sort((a,b)=>a.position.distanceToSquared(eye)-b.position.distanceToSquared(eye))[0];
    yaw=art?Math.atan2(p.x-art.position.x,p.z-art.position.z):0;pitch=0;
    rig.rotation.y=yaw;camera.rotation.x=pitch;rig.updateMatrixWorld(true);
    liftWasNear=false;liftPickerConsumed=true;updateExhibitLighting();
  }
`+spawnAnchor);
          const startupAnchor='    await loadEdition(qp&&archiveDates.includes(qp)?qp:RECEPTION);';
          inject(startupAnchor,`    const comparisonDate='2026-11-26';
    if(!archiveDates.includes(comparisonDate))throw Error('Pinned Gaussian comparison floor unavailable');
    await loadEdition(comparisonDate);
    enter.disabled=true;enter.textContent=sculptureComparison?'Preparing sculpture comparisons…':'Preparing full-floor hybrid…';
    const controls=$('spark-tower-preview');controls.inert=true;
    gaussianStartupPreparing=true;
    try{await gaussianLab?.prepareComparison();}
    finally{
      gaussianStartupPreparing=false;controls.inert=false;
      enter.disabled=false;welcome.hidden=true;
      liftWasNear=false;liftPickerConsumed=true;canvas.focus({preventScroll:true});
    }
`);
          const constructAnchor='function constructPhiGallery(layout,studies,{viaLift=false,duringRide=false}={}){';
          inject(constructAnchor,constructAnchor+'\n gaussianLab?.reset();');
          const batchAnchor='window.__phiArchitectureBatches=batchPhiStaticArchitecture(THREE,scene,staticArchitecture);';
          inject(batchAnchor,'const gaussianBefore=new Set(scene.children);\n '+batchAnchor+"\n gaussianLab?.setArchitecture([...staticArchitecture.filter(m=>m.parent===scene),...scene.children.filter(m=>!gaussianBefore.has(m)&&m.name==='phi-static-architecture-batch')]);");
          const tickAnchor="phiStablePointLights.sync('before-render');\n  phiPostFX.render(dt,";
          inject(tickAnchor,"gaussianLab?.beforeRender();\n  "+tickAnchor);
          const endRenderAnchor="phiPostFX.render(dt,(!$('info').hidden&&currentInfoExhibit?.study&&!currentInfoExhibit.study.credits)?currentInfoExhibit.position:null);";
          inject(endRenderAnchor,endRenderAnchor+"\n  gaussianLab?.afterRender();");
        }
        receptionReplacements++;
        return{contents:transformed,loader:'js',resolveDir:dirname(args.path)};
      });
      plugin.onLoad({filter:/[/\\]phi-curation-groups\.mjs$/},async(args)=>{
        if(!gaussianPreview&&!productionSplats)return;
        let contents=await readFile(args.path,'utf8');
        const anchor='if(!sa||!sb||!!sa.portrait!==!!sb.portrait)return false;';
        assert.equal(contents.split(anchor).length-1,1,'Curator compatibility anchor changed');
        contents=contents.replace(anchor,anchor+"\n  const solo=s=>s.portrait&&s.material!=='confluence'&&s.material?.type!=='confluence';\n  if(solo(sa)!==solo(sb))return false;");
        return {contents,loader:'js',resolveDir:dirname(args.path)};
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
const {html:live,mesh:originalUrl}=normalizeGalleryEntry(await readFile('gallery/visit/index.html','utf8'));
assert.equal(live.split(originalUrl).length-1,2,
  'Public tower must use the verified V2 bundle for preload and import');
if(productionSplats){
  const imports={three:'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js','three/':'https://cdn.jsdelivr.net/npm/three@0.187.0/','three/addons/':'https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/','three/webgpu':'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.webgpu.js','three/tsl':'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.tsl.js','@sparkjsdev/spark':'https://sparkjs.dev/releases/spark/2.4.0/spark.module.js'};
  // Same-origin Three modules for live startup; keep the mesh bundle self-contained.
  const vendor='gallery/visit/vendor/three-0.187.0';
  await mkdir(vendor+'/examples',{recursive:true});
  await cp('node_modules/three/build',vendor+'/build',{recursive:true});
  await cp('node_modules/three/examples/jsm',vendor+'/examples/jsm',{recursive:true});
  const html=live.replaceAll(originalUrl,'./gallery-phi-splats-bundle.js?v=gs7-01')
    .replace('<head>','<head>\n<script type="importmap">'+JSON.stringify({imports})+'</script>\n<meta name="robots" content="noindex,nofollow">')
    .replace(/<meta name="robots" content="index,follow,max-image-preview:large">/g,'');
  await writeFile('gallery/visit/splats.html',html);
  console.log('GS3_PRODUCTION_SPLAT_BUNDLE_BUILT');
  process.exit(0);
}
let html=live.replace('<head>',
  '<head>\n<base href="../visit/">\n<meta name="robots" content="noindex,nofollow">');
assert.notEqual(html,live);
html=html.replaceAll(originalUrl,
  gaussianPreview?'./gallery-phi-gaussian-preview-bundle.js?v=sculpture-comparison-01':'./gallery-phi-sculpture-v2-test-bundle.js?v=sculpture-v2-preview-01');
html=html.replaceAll('Virtual Exhibition | PROPORTION PIECE',
  'Sculpture V2 Test Tower | PROPORTION PIECE');
html=html.replace('</body>',
  '<div role="note" style="position:fixed;z-index:31;right:12px;bottom:12px;pointer-events:none;background:#21302ae9;color:#f8f0d8;border:1px solid #b69b62;padding:7px 11px;font:600 12px Arial,Helvetica,sans-serif">SCULPTURE V2 TEST TOWER · NOT THE LIVE EXHIBITION</div></body>');
if(gaussianPreview){
  const imports={three:'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js','three/':'https://cdn.jsdelivr.net/npm/three@0.187.0/','three/addons/':'https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/','three/webgpu':'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.webgpu.js','three/tsl':'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.tsl.js','@sparkjsdev/spark':'https://sparkjs.dev/releases/spark/2.4.0/spark.module.js'};
  html=html.replace('<head>','<head>\n<script type="importmap">'+JSON.stringify({imports})+'</script>');
  html=html.replaceAll('Sculpture V2 Test Tower | PROPORTION PIECE','Gaussian Test Tower | PROPORTION PIECE').replace('SCULPTURE V2 TEST TOWER · NOT THE LIVE EXHIBITION','GAUSSIAN TEST TOWER · NOT THE LIVE EXHIBITION');
  html=html.replace(/<meta name="robots" content="index,follow,max-image-preview:large">/g,'').replace(/<link rel="canonical"[^>]*>/g,'');
  const gaussianControls="<style>\n#spark-tower-preview{position:fixed;z-index:105;left:50%;bottom:12px;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;background:#f0ede6f5;color:#304237;border:1px solid #607665;border-radius:6px;padding:9px 12px;font:12px/1.4 Arial,sans-serif;pointer-events:auto;box-shadow:0 3px 12px #0003}\n#spark-tower-preview .spark-switch{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n#spark-tower-preview button{font:inherit;padding:6px 10px;border:1px solid #607665;border-radius:3px;background:#fff;color:#304237;cursor:pointer}\n#spark-tower-preview button[aria-pressed=\"true\"]{background:#344a3d;color:white;font-weight:bold}\n#spark-tower-preview button:disabled{opacity:.55;cursor:wait}\n#spark-status{max-width:min(520px,calc(100vw - 52px));overflow-wrap:anywhere;margin-top:5px}\n#spark-tower-preview details{margin-top:4px}#spark-tower-preview details p{margin:5px 0}\n@media(max-width:700px){#spark-tower-preview{top:65px;bottom:auto;padding:6px 8px}#spark-tower-preview .spark-switch{gap:4px}}\n#spark-results{max-height:36vh;overflow:auto}#spark-results table{border-collapse:collapse;font-size:11px;width:100%}#spark-results th,#spark-results td{text-align:right;padding:3px 5px;border-bottom:1px solid #60766555}#spark-results th:first-child,#spark-results td:first-child{text-align:left}.spark-benchmark-images{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.spark-benchmark-images img{display:block;width:100%;height:auto}.spark-benchmark-images a{color:inherit}\n#openLift,#floorIndicator,#xr-controls{display:none!important}\n</style>\n<section id=\"spark-tower-preview\" aria-label=\"Gaussian tower renderer comparison\" data-mode=\"triangles\" data-ready=\"false\">\n<div class=\"spark-switch\" role=\"group\" aria-label=\"Rendering mode\"><strong>26 Nov 2026 · Renderer</strong><button id=\"spark-triangles\" type=\"button\" aria-pressed=\"true\" disabled>Triangles</button><button id=\"spark-splats\" type=\"button\" aria-pressed=\"false\" disabled>Full-floor hybrid</button></div>\n<div id=\"spark-status\" role=\"status\">Waiting for the experimental renderer to initialise…</div>\n<details><summary>Floor settings</summary><label>Density <select id=\"spark-density\"><option value=\"12\">Low</option><option value=\"24\" selected>Medium</option><option value=\"40\">High</option></select></label> <button id=\"spark-recapture\" type=\"button\" disabled>Rebuild floor</button> <button id=\"spark-reset\" type=\"button\" disabled>Reset</button><p>This fixed comparison floor opens directly in hybrid mode when preparation is complete. Switch to Triangles instantly; walk freely around the same edition. Artworks, sculptures, lift, trim and other interactive geometry stay as triangles. Lighting is baked using the room light pools without dynamic shadows; density may be reduced to fit the whole-floor budget.</p></details>\n<div class=\"spark-switch\"><button id=\"spark-benchmark\" type=\"button\" disabled>Benchmark all densities</button><button id=\"spark-export\" type=\"button\" disabled>Export JSON</button></div><div id=\"spark-results\" hidden></div>\n</section>";
  html=html.replace('</body>',gaussianControls+'</body>');
  await mkdir('gallery/gaussian-splat-lab',{recursive:true});
  await writeFile('gallery/gaussian-splat-lab/tower.html',html);
}else{
  await mkdir('gallery/sculpture-v2-test',{recursive:true});
  await writeFile('gallery/sculpture-v2-test/index.html',html);
}
console.log('SCULPTURE_V2_TEST_BUILT '+JSON.stringify({
  route:'gallery/sculpture-v2-test/',rendererReplacements,n8aoReplacements,
  receptionReplacements,
  source:'gallery/visit/gallery-phi.js',legacyV1RendererUntouched:true,
  archiveAndDailyBakesUntouched:true,onDemand:false,preparedPacks:true,
  v2Geometry:'sculpture-lab-v4.2.1',pin:'museum'
}));
