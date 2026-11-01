// Verify graffiti is genuinely absent from both tower runtime import graphs,
// rather than simply hiding its geometry. Preserve the architectural square.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const root of ['gallery/visit','test/virtual-gallery']){
 test(root+' no graffiti imports, paint jobs or entry/lift wait conditions',()=>{
  const main=file(root+'/gallery-phi.js');
  const square=file(root+'/phi-square-no-graffiti.mjs');
  assert.match(main,/import \{createPhiSquare,clearOfPhiSquare\} from '\.\/phi-square-no-graffiti\.mjs'/);
  assert.doesNotMatch(main,/import .*graffiti\.mjs|exterior-graffiti|interior-graffiti-plan|square-graffiti-atlas|tag-engine/);
  assert.doesNotMatch(main,/towerGraffiti\.|interiorGraffiti\.|phiSquare\.paintNext\(/);
  assert.doesNotMatch(main,/isBusy:[^,]+graffiti/i);
  assert.doesNotMatch(square,/^import .*graffiti|tag-engine|createTowerGraffiti|paintSquareWall|planSquareTags/m);
  assert.match(square,/phi-spiral-architectural-reflection/);
  assert.match(square,/phi-spiral-reflecting-water/);
  assert.match(square,/phi-square-.*o\.id/);
  assert.match(square,/export function clearOfPhiSquare/);
  assert.match(square,/return \{root,obstacles,walls:4,monuments:3,tags:0\}/);
 });
}
test('no-graffiti square has identical pool and paved geometry',()=>{
 const original=file('test/virtual-gallery/phi-square-graffiti.mjs');
 const clean=file('test/virtual-gallery/phi-square-no-graffiti.mjs');
 const first='    // Test-square architectural refresh: all finishes come from the existing material bank.';
 const last='   parent.add(root);activeRoot=root;';
 const shared=src=>src.slice(src.indexOf(first),src.indexOf(last));
 assert.ok(shared(original).length>6000);
 const before=shared(original).replace('   for(const manager of managers)manager.addTo(root,[],0);\n','');
 assert.equal(shared(clean),before);
});
