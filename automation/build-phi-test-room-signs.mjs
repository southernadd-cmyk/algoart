// Keep the independent test bundle and test lift routing while sharing the
// same curated hanging signs already integrated in the production source.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {bvhTestPlugin} from './phi-bvh-test-plugin.mjs';
import {n8aoTestPlugin} from './phi-n8ao-test-plugin.mjs';
import {stageCurationPlugin} from './phi-stage-curation-plugin.mjs';
const dir=resolve(process.cwd(),'gallery/visit');
let source=await readFile(resolve(dir,'gallery-phi.js'),'utf8');
const replace=(before,after)=>{
 if(source.split(before).length!==2)throw Error('Room-signs build anchor changed: '+before.slice(0,75));
 source=source.replace(before,after);
};
// Performance instrumentation belongs exclusively to the test bundle.
replace("import * as THREE from 'three';",
 "import {mountPhiThreePerf} from '../../test/virtual-gallery/phi-three-perf.mjs';\nimport * as THREE from 'three';");
replace('  renderer.setSize(window.innerWidth, window.innerHeight);',
 '  renderer.setSize(window.innerWidth, window.innerHeight);\n  mountPhiThreePerf(renderer);');
// An opt-in A/B for three staging GLBs. The original URLs and live build
// are never rewritten. This operates through the default GLTFLoader manager.
replace("import * as THREE from 'three';",
 "import * as THREE from 'three';\n"+
 "const phiGltfpackCandidates=new Set(['plants-scene-gallery-optimized.glb','modern-reception-fittings.glb','pothos-plant.glb']);\n"+
 "const phiGltfpackPilot=new URLSearchParams(location.search).get('models')==='gltfpack';\n"+
 "window.__phiGltfpackPilot={enabled:phiGltfpackPilot,redirected:[]};\n"+
 "if(phiGltfpackPilot){THREE.DefaultLoadingManager.setURLModifier(url=>{\n"+
 "  try{const u=new URL(url,location.href);const base=u.pathname.split('/').pop();\n"+
 "   if(phiGltfpackCandidates.has(base)&&u.pathname.includes('/gallery/visit/models/')){\n"+
 "    u.pathname=u.pathname.replace('/gallery/visit/models/','/gallery/visit/models/gltfpack/');\n"+
 "    window.__phiGltfpackPilot.redirected.push(base);return u.href;\n"+
 "   }\n"+
 "  }catch(error){console.warn('[gltfpack pilot]',error);}return url;\n"+
 "});}\n");
// Signs are shared in the production source; only navigation differs on test.
replace("import * as THREE from 'three';",
  "import {stagingFloorUrl} from '../../test/virtual-gallery/phi-stage-routing.mjs';\nimport * as THREE from 'three';");
// Approved Penrose floor treatments are now shared by live and test galleries.
// Only the staging bundle is patched. The live gallery continues to use its
// current URL semantics, and test assets still load from gallery/visit/.
replace("history.replaceState(null,'',date===RECEPTION?location.pathname:'?date='+date);",
 "history.replaceState(null,'',stagingFloorUrl(location.href,date,RECEPTION));");
// The staging archive can be updated after publication; never force-cache its HTML.
replace('fetchGalleryText(url,{cache}),',"fetchGalleryText(url,{cache:'no-store'}),");

// TEST ONLY: warm matte plaster under the existing bronze Penrose shader.
// The material's CanvasTexture keeps USE_MAP and the existing metre-aligned UVs.
replace('let receptionTilePreview=null;', `
function createReceptionPlasterFloorMaterial(THREE,{lowPower=false}={}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4;
  const grain=((((x*73856093)^(y*19349663))>>>8)&255)/255-.5;
  const mottling=2.1*Math.sin(x*Math.PI/64)*Math.cos(y*Math.PI/64)+grain*3.2;
  image.data[i]=238+mottling;image.data[i+1]=233+mottling;
  image.data[i+2]=222+mottling;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 const map=new THREE.CanvasTexture(canvas);
 map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.anisotropy=lowPower?1:2;
 map.userData.galleryPersistent=true;
 const material=new THREE.MeshStandardMaterial({color:0xffffff,map,roughness:.96,metalness:0});
 material.name='Reception plaster with bronze Penrose inlay';
 material.userData={galleryPersistent:true,tileMeters:1.8};
 return material;
}
let receptionTilePreview=null;`);
replace('receptionTilePreview=createReceptionTileMaterial(THREE,{lowPower:galleryFinish.lowPower});',
 'receptionTilePreview=createReceptionPlasterFloorMaterial(THREE,{lowPower:galleryFinish.lowPower});');

// Architectural camera study: use ?camera=wide to restore original 76°.
// Keep locomotion, collision checks, near/far clipping and frame pacing.
replace('const camera = new THREE.PerspectiveCamera(76,',
  "const phiCameraFov=new URLSearchParams(location.search).get('camera')==='wide'?76:60;\nconst phiArtworkStudyEnabled=new URLSearchParams(location.search).get('art')!=='original';\nif(GALLERY_DEBUG)window.__phiVisualStudy={cameraFov:phiCameraFov,artColourStudy:phiArtworkStudyEnabled};\nconst camera = new THREE.PerspectiveCamera(phiCameraFov,");
// Existing artwork uses MeshBasicMaterial deliberately; in one curated
// room, bypass the renderer's global tone mapping for source-faithful art
// colour and a brighter image relative to the matte physical surrounds.
// Other rooms retain the exact original behaviour; no new light or geometry.
replace('face.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide});',
  'face.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide,toneMapped:!(phiArtworkStudyEnabled&&p.room===frameStudyRoom)});');
// Preserve reception's original blue wallpaper map; soften its normal relief
// to work with the existing proportional light placement.
replace(' const roomWall=exhibitDate===RECEPTION?receptionWallMaterial:plaster;',
  ' if(exhibitDate===RECEPTION&&receptionWallMaterial){receptionWallMaterial.roughness=.94;receptionWallMaterial.normalScale.set(.32,.32);}\n const roomWall=exhibitDate===RECEPTION?receptionWallMaterial:plaster;');
// Room selection below is retained only for the independent artwork-colour study.
// The CSM finish applies to all frames, regardless of room.
replace(' for(const p of phi.exhibition.paintings){\n  const study=byId.get(p.studyId);if(!study)continue;',
  " const frameRoomCounts=new Map();\n for(const p of phi.exhibition.paintings)frameRoomCounts.set(p.room,(frameRoomCounts.get(p.room)||0)+1);\n const frameStudyRoom=exhibitDate===RECEPTION?-1:([...frameRoomCounts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??-1);\n if(GALLERY_DEBUG)window.__phiArchitecturalFrameStudy={room:frameStudyRoom,paintings:frameRoomCounts.get(frameStudyRoom)||0};\n for(const p of phi.exhibition.paintings){\n  const study=byId.get(p.studyId);if(!study)continue;");

// Visible ceiling fittings throughout the rooms; illumination uses four pooled fill lights.
replace("import * as THREE from 'three';",
 "import {addPhiRoomLuminaire} from '../../test/virtual-gallery/phi-room-luminaires.mjs';\nimport * as THREE from 'three';");
replace(' for(const room of lightRooms.slice(0,galleryFinish.lowPower?3:7)){',
 ' if(!phiLightingOriginal)for(const room of lightRooms)addPhiRoomLuminaire(THREE,scene,room,elevation,ROOM_HEIGHT);\n for(const room of lightRooms.slice(0,galleryFinish.lowPower?3:7)){');
// Bounded lighting review: keep phi fixtures; cache one sun and one room map.
replace("import * as THREE from 'three';",
 "import {createPhiLightingStudy} from '../../test/virtual-gallery/phi-lighting-study.mjs';\nimport * as THREE from 'three';");
replace("scene.add(new THREE.HemisphereLight('#eaf1ff', '#72796f', 1.08));",
 "const phiLightingOriginal=new URLSearchParams(location.search).get('lighting')==='original';\nscene.add(new THREE.HemisphereLight('#eaf1ff', '#72796f', phiLightingOriginal?1.08:1.18));");
replace("const sun = new THREE.DirectionalLight('#fff5e5', 2.20);",
 "const sun = new THREE.DirectionalLight('#fff5e5', phiLightingOriginal?2.20:2.35);");
replace('const phiPostFX=createPhiPostFX(THREE,renderer,scene,camera,{production:true});',
 'const phiPostFX=createPhiPostFX(THREE,renderer,scene,camera,{production:true});\nconst phiLightingStudy=renderer?createPhiLightingStudy({THREE,renderer,scene,camera,sun}):null;');
replace('const light=new THREE.SpotLight(0xfff3df,12,12,.66,.8,1.5);',
 "const light=new THREE.SpotLight(0xfff3df,phiLightingOriginal?12:14,12,phiLightingOriginal?.66:.70,phiLightingOriginal?.8:.90,1.5);light.name='phi-shadow-room-light';");
replace('power:17});','power:phiLightingOriginal?17:19});');
replace('    applyRefinedPhiRoomLighting(phiRoomLightEntries,plan.phi);',
 '    applyRefinedPhiRoomLighting(phiRoomLightEntries,plan.phi);\n    phiLightingStudy?.editionChanged(elevation);');
replace('function tick() {','function tick() {\n  phiLightingStudy?.update();');

await build({
 stdin:{contents:source,sourcefile:'gallery-phi-test-room-signs.js',resolveDir:dir,loader:'js'},
 bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',
 outfile:'gallery/visit/gallery-phi-test-room-signs-bundle.js',
 plugins:[stageCurationPlugin(),n8aoTestPlugin(),bvhTestPlugin(),{
 name:'architectural-visitor-palette-test-only',
 setup(builder){
  builder.onLoad({filter:/[/\\]visitors[.]mjs$/},async({path})=>{
   let contents=await readFile(path,'utf8');
   const before='const hue=unit(),saturation=.13+unit()*.23,lightness=.30+unit()*.27;';
   if(contents.split(before).length!==2)throw Error('Visitor palette build anchor changed');
   // Three related finishes: warm stone, muted bronze and charcoal.
   // Preserve the existing identity seed, geometry, poses and visitor budget.
   contents=contents.replace(before,`const family=unit();
 const hue=.075+unit()*.035;
 const saturation=family<.382?.08+unit()*.06:family<.764?.24+unit()*.10:.025+unit()*.035;
 const lightness=family<.382?.49+unit()*.10:family<.764?.34+unit()*.09:.24+unit()*.07;`);
   const finish='roughness:.92,metalness:0,';
   if(contents.split(finish).length!==2)throw Error('Visitor finish build anchor changed');
   contents=contents.replace(finish,'roughness:.86,metalness:.02,');
   // Placeholder figures are visible during a slow model load (and remain if
   // the models fail). Previously these retained their unrelated clothing
   // palette, producing the prototype look before the rigged figures arrive.
   // Keep the exact shapes, poses, placement and draw-call budget.
   const placeholderFinishes=[
    ["'#bd8a6f','#e1b293','#78533f','#c99c80','#9c6f55'","'#d8d4cb','#cac4b8','#c9c7c1','#d6d0c2','#bcbab3'"],
    ["'#687984','#9b776b','#808c75','#b5aca0','#49565c'","'#a9a69e','#9f9f99','#bab8ad','#8b8f8c','#c5c1b6'"],
    ["'#38302b','#6c5240','#262b2b','#a07d53','#5b4b42'","'#b0ada4','#999992','#a6a79f','#c0bcb3','#979d9b'"],
    ["'#3b454c','#625c5b','#52534e','#434f5a','#68685d'","'#818481','#a29f97','#959791','#7b7d79','#ada99e'"]
   ];
   for(const [oldPalette,newPalette] of placeholderFinishes){
    if(contents.split(oldPalette).length!==2)throw Error('Visitor fallback palette anchor changed');
    contents=contents.replace(oldPalette,newPalette);
   }
   // If the primary low-poly figures fail and the legacy rig loads, its
   // original brightly coloured GLB material must not reintroduce purple.
   // Re-shade its selected mesh without changing the skeleton or model.
   const oldRig=' for(const mesh of allMeshes)mesh.visible=mesh===selected;';
   if(contents.split(oldRig).length!==2)throw Error('Legacy visitor rig anchor changed');
   contents=contents.replace(oldRig,oldRig+
    "\n selected.material=new THREE.MeshStandardMaterial({color:'#b7b5ae',roughness:.86,metalness:.02,vertexColors:false,side:THREE.DoubleSide});");
   return {contents,loader:'js',resolveDir:dir};
  });
 }
},{
 name:'gramophone-phi-time-markers-test-only',
 setup(builder){
  builder.onLoad({filter:/gallery-music[.]mjs$/},async({path})=>{
   return {contents:"export {createPhiGalleryMusic} from './phi-gramophone-music.mjs';",loader:'js',resolveDir:dir};
  });
 }
}],
 logLevel:'warning'
});
const bundle=await readFile(resolve(dir,'gallery-phi-test-room-signs-bundle.js'));
const sha256=createHash('sha256').update(bundle).digest('hex');
await writeFile(resolve(dir,'test-curator-revision.json'),JSON.stringify({sha256}));
console.log('Built test-only phi curation bundle, revision '+sha256.slice(0,12));
// The isolated review uses the same dialog module and real audio without WebGL.
await build({entryPoints:['gallery/visit/phi-gramophone-music.mjs'],bundle:true,minify:true,
 platform:'browser',format:'esm',target:'es2022',outfile:'gallery/visit/phi-gramophone-preview.js',logLevel:'warning'});
