import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const photoImport="import {photorealEnabled} from '../../test/virtual-gallery/photoreal-materials.mjs';\n";
function replaceOnce(source,before,after){
 if(source.split(before).length!==2)throw Error('Photoreal test integration anchor changed: '+before.slice(0,90));
 return source.replace(before,after);
}
export function instrumentPhotorealSource(source){
 source="import {createPhotorealEnvironment,refinePhotorealGlass,photorealBox,installPhotorealComparison} from '../../test/virtual-gallery/photoreal-environment.mjs';\n"+
 "import {photorealEnabled,createPhotorealReceptionFloor} from '../../test/virtual-gallery/photoreal-materials.mjs';\n"+source;
 source=replaceOnce(source,"from './architectural-materials.mjs?v=ambientcg-ceiling-20261022'","from '../../test/virtual-gallery/photoreal-materials.mjs'");
 source=replaceOnce(source,'const wall=galleryFinish.wall;',
  'const phiPhotoreal=photorealEnabled()&&renderer?createPhotorealEnvironment({THREE,renderer,scene,finishes:galleryFinish,postFX:phiPostFX}):null;\ninstallPhotorealComparison(photorealEnabled());\nconst wall=galleryFinish.wall;');
 source=replaceOnce(source,'function createReceptionPlasterFloorMaterial(THREE,{lowPower=false}={}){',
  'function createReceptionPlasterFloorMaterial(THREE,{lowPower=false}={}){\n if(photorealEnabled())return createPhotorealReceptionFloor(THREE,{lowPower});');
 source=replaceOnce(source,'function block(w, h, d, x, y, z, material = wall) {\n  const geometry=new THREE.BoxGeometry(w,h,d);',
  'function block(w, h, d, x, y, z, material = wall) {\n  const geometry=photorealEnabled()?photorealBox(w,h,d):new THREE.BoxGeometry(w,h,d);');
 source=replaceOnce(source,'  phiLightingStudy?.update();','  phiLightingStudy?.update();\n  phiPhotoreal?.update();');
 source=replaceOnce(source,'    phiLightingStudy?.editionChanged(elevation);',
  '    phiLightingStudy?.editionChanged(elevation);\n    phiPhotoreal?.editionChanged();');
 source=replaceOnce(source,'const walkwayGlassMaterials=createWalkwayGlassMaterials(THREE,{lowPower:galleryFinish.lowPower});',
  'const walkwayGlassMaterials=createWalkwayGlassMaterials(THREE,{lowPower:galleryFinish.lowPower});\nif(photorealEnabled())refinePhotorealGlass(walkwayGlassMaterials.glass);');
 return source;
}
export function patchPhotorealExterior(source){
 source="import {photographicPaving} from '../../test/virtual-gallery/photoreal-environment.mjs';\n"+photoImport+source;
 source=replaceOnce(source,'  plan.backdrop=addProceduralBackdrop(',
  '  plan.backdrop=photorealEnabled()?null:addProceduralBackdrop(');
 source=replaceOnce(source,'if(globalThis.__phiReceptionTestRefresh){','if(globalThis.__phiReceptionTestRefresh&&!photorealEnabled()){');
 source=replaceOnce(source,'    const stoneMap=surfaceTexture(THREE,\'stone\');',
  "    if(photorealEnabled())photographicPaving(THREE,paving,p.halfWidth*2/4,p.halfDepth*2/4,lowPower);\n    const stoneMap=surfaceTexture(THREE,'stone');");
 source=replaceOnce(source,'    const bronze=new THREE.MeshStandardMaterial(',
  '    if(photorealEnabled())photographicPaving(THREE,stoneEdge,1,1,lowPower);\n    const bronze=new THREE.MeshStandardMaterial(');
 // Ground beyond the square is scanned concrete as well, rather than a
 // procedural green chequerboard. Preserve its vertex-alpha horizon fade.
 source=replaceOnce(source,"  const ground=new THREE.Mesh(groundGeo,new THREE.MeshLambertMaterial({",
  "  const ground=new THREE.Mesh(groundGeo,new (photorealEnabled()?THREE.MeshStandardMaterial:THREE.MeshLambertMaterial)({");
 source=replaceOnce(source,'  ground.position.set(plan.centerX,0,plan.centerZ);',
  "  if(photorealEnabled()){const colors=ground.geometry.getAttribute('color');for(let i=0;i<colors.count;i++)colors.setXYZ(i,1,1,1);colors.needsUpdate=true;photographicPaving(THREE,ground.material,plan.size/6,plan.size/6,lowPower);}\n  ground.position.set(plan.centerX,0,plan.centerZ);");
 return source;
}
export function phiPhotorealTestPlugin(){return {name:'photoreal-environment-test-only',setup(builder){
 builder.onLoad({filter:/[/\\]environment-render[.]mjs$/},async({path})=>({contents:patchPhotorealExterior(await readFile(path,'utf8')),loader:'js',resolveDir:dirname(path)}));
}};}
export function patchPhotorealVisitors(source){
 source=photoImport+source;
 source=replaceOnce(source,'export function renderVisitors(THREE,scene,plan){',
  'export function renderVisitors(THREE,scene,plan){\n if(photorealEnabled())plan={...plan,people:[]};');
 source=replaceOnce(source,'export function renderPlazaSeatedVisitors(THREE,scene,plaza){',
  'export function renderPlazaSeatedVisitors(THREE,scene,plaza){\n if(photorealEnabled())return null;');
 return source;
}
