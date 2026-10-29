// Build an isolated TEST tour bundle from the *current* live gallery source.
// Patches exist only in memory. No live source or live bundle is altered.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';

const root=resolve(process.cwd(),'gallery/visit');
const path=resolve(root,'gallery-phi.js');
let src=await readFile(path,'utf8');
function replace(anchor,replacement){
  if(src.split(anchor).length!==2)throw new Error('Guided tour integration anchor missing or ambiguous: '+anchor.slice(0,90));
  src=src.replace(anchor,replacement);
}

replace("import * as THREE from 'three';",
  "import {createGuidedTour} from '../../test/virtual-gallery/guided-tour.mjs';\nimport * as THREE from 'three';");

const setup=[
  'const guidedTour = createGuidedTour(() => ({',
  ' phi:plan?.phi, date:exhibitDate, reception:RECEPTION,',
  ' entered:welcome.hidden, xr:renderer.xr.isPresenting,',
  ' liftTravelling:liftTravelling||liftArrivalOpening,',
  ' rig, artExhibits,',
  ' clearObstacles:(x,z)=>clearOfPhiSquare(phiSquareObstacles,x,z)&&!phiDoorBlocked(x,z)&&',
  '   clearOfSculptures(phiFurnishingObstacles,x,z)&&clearOfSculptures(sculpturePlacements,x,z),',
  ' setView:(x,z,dir,tilt)=>{rig.position.x=x;rig.position.z=z;',
  '   rig.position.y=currentFloor*FLOOR_SPACING;yaw=dir;pitch=tilt;',
  '   rig.rotation.y=yaw;camera.rotation.x=pitch;},',
  ' yaw:()=>yaw,pitch:()=>pitch,',
  ' clearInputs:()=>{pressed.clear();touchPressed.clear();lookPressed.clear();},',
  ' cancelInspect:()=>resetInspection()',
  '}));',
  ''
].join('\n');
replace('let phiFrameSerial=0;',setup+'let phiFrameSerial=0;');

replace('  updateMovement(dt);\n  if(GALLERY_DEBUG)',
  '  if(!guidedTour.update(dt))updateMovement(dt);\n  if(GALLERY_DEBUG)');
replace(" const l=phi.circulation.lift;\n ctx.fillStyle='#d9c68c';",
  " guidedTour.drawMap({ctx,X,Z,phi});\n const l=phi.circulation.lift;\n ctx.fillStyle='#d9c68c';");
replace('async function loadEdition(date,{viaLift=false,rollback=false,prepared=null}={}) {\n',
  'async function loadEdition(date,{viaLift=false,rollback=false,prepared=null}={}) {\n  guidedTour.onFloorChanging();\n');
replace('  if(plan.phi)constructPhiTowerShell();',
  '  if(plan.phi)constructPhiTowerShell();\n  guidedTour.refresh();');
replace('  welcome.hidden=true;\n  startDeferredGallery();',
  '  welcome.hidden=true;\n  guidedTour.refresh();\n  startDeferredGallery();');
replace('function openLift(){\n',
  'function openLift(){\n  guidedTour.stop();\n');

await build({
  stdin:{contents:src,resolveDir:root,sourcefile:'gallery-phi-tour-test.js',loader:'js'},
  bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
  outfile:'gallery/visit/gallery-phi-tour-test-bundle.js',
  logLevel:'warning'
});
console.log('Built test-only tour bundle without modifying production bundles.');
