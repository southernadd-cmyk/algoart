import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {phiLiftIndicatorState} from '../test/virtual-gallery/phi-lift-indicator.mjs';
const source=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
test('overlap is opt-in and original ride still completes',()=>{
 assert.match(source,/get\('liftoverlap'\)==='1'/);
 assert.match(source,/ready:!elastic,elastic/);
});
test('the visible moving cabin owns the current lift indicator',()=>{
 assert.match(source,/cabin\.userData\.phiLiftIndicator=phiLiftIndicator/);
 assert.match(source,/visibleLiftIndicator=phiMovingCabin\?\.userData\?\.phiLiftIndicator\|\|phiLiftIndicator/);
 assert.match(source,/currentFloor:phiRideState\?\.departureFloor\?\?currentFloor/);
});
test('constructing the hidden destination cannot move the camera to the landing',()=>{
 assert.match(source,/function constructPhiGallery\(layout,studies,\{viaLift=false,duringRide=false\}=\{\}\)/);
 assert.match(source,/if\(!duringRide\)rig\.position\.copy\(liftCabinPosition\)/);
 assert.match(source,/constructPhiGallery\(plan,studyList,\{viaLift,duringRide\}\)/);
});
test('floor label follows physical height even after currentFloor switches',()=>{
 const dates=['__phi_reception__',...Array.from({length:24},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0'))];
 const halfway=phiLiftIndicatorState({height:6.2*11,dates,currentFloor:24,targetFloor:24,phase:'moving'});
 assert.equal(halfway.floor,11);
 assert.match(halfway.primary,/^11 · /);
 const ground=phiLiftIndicatorState({height:0,dates,currentFloor:24,targetFloor:0,phase:'moving'});
 assert.equal(ground.primary,'G · Reception');
});
