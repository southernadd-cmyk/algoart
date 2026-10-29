import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clearTourLine,findTourPath,tourWorldBounds,createGuidedTour} from '../test/virtual-gallery/guided-tour.mjs';

test('route walks through a door rather than through a separating wall',()=>{
 const root={x:0,z:0,w:10,h:8};
 const safe=(x,z)=>x>.4&&x<9.6&&z>.4&&z<7.6&&
   !(Math.abs(x-5)<.43&&(z<3.0||z>5.0));
 const start={x:1,z:1},end={x:9,z:1};
 assert.equal(clearTourLine(start,end,safe),false);
 const path=findTourPath(start,end,safe,root);
 assert.ok(path&&path.length>2,'should find a route around the solid wall sections');
 for(let i=1;i<path.length;i++)assert.ok(clearTourLine(path[i-1],path[i],safe), 'no leg crosses a wall');
 const crossesDoor=path.slice(1).some((p,i)=>{
   const a=path[i];
   if((a.x-5)*(p.x-5)>0||a.x===p.x)return false;
   const z=a.z+(5-a.x)/(p.x-a.x)*(p.z-a.z);
   return z>=3&&z<=5;
 });
 assert.ok(crossesDoor,'route passes through the available door');
});
test('unreachable artworks are excluded safely',()=>{
 const root={x:0,z:0,w:10,h:8};
 const safe=(x,z)=>x>.4&&x<9.6&&z>.4&&z<7.6&&Math.abs(x-5)>.43;
 assert.equal(findTourPath({x:1,z:1},{x:9,z:1},safe,root),null);
});
test('golden-angle floor bounds are calculated in rotated world coordinates',()=>{
 const phi={floor:{root:{x:-8,z:-3,w:16,h:6}},world:{toWorld:(x,z)=>({x:-z+2,z:x+5})}};
 assert.deepEqual(tourWorldBounds(phi),{x:-1,z:-3,w:6,h:16});
});


test('test tour button is enabled on reception and after floor changes',()=>{
 const source=readFileSync(new URL('../test/virtual-gallery/guided-tour.mjs',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../automation/build-test-guided-tour.mjs',import.meta.url),'utf8');
 const staging=readFileSync(new URL('../test/virtual-gallery/full-engine.html',import.meta.url),'utf8');
 assert.match(source,/trigger\.disabled=false/);
 assert.doesNotMatch(source,/trigger\.disabled\s*=\s*!/);
 assert.match(source,/c\.openLift\(\)/);
 assert.match(builder,/openLift:\(\)=>openLift\(\)/);
 assert.match(staging,/gallery-phi-tour-test-bundle\.js\?v=guided-tour-test-button-fix-v4/);
});


test('reception tour button is genuinely clickable and opens the lift',()=>{
 const oldDocument=globalThis.document;
 const makeNode=()=>({
   hidden:true,style:{},textContent:'',disabled:false,
   events:{},
   addEventListener(type,callback){this.events[type]=callback;},
   click(){this.events.click?.({});}
 });
 const trigger=makeNode(),panel=makeNode(),top={insertBefore(el){assert.equal(el,trigger);}};
 const ui=new Map([
   ['#testTourTitle',makeNode()],['#testTourMeta',makeNode()],
   ['[data-tour=toggle]',makeNode()],['#testTourProgress',makeNode()],
   ['[data-tour=back]',makeNode()],['[data-tour=next]',makeNode()]
 ]);
 panel.querySelector=selector=>ui.get(selector);
 const doc={
   querySelector:selector=>selector==='.topbar .top-actions'?top:null,
   createElement:tag=>tag==='button'?trigger:panel,
   body:{appendChild(){}},
   addEventListener(){},
   exitPointerLock(){}
 };
 let liftOpens=0;
 let date='__phi_reception__';
 const getContext=()=>({
   phi:{floor:{root:{x:0,z:0,w:10,h:8}}},date,
   reception:'__phi_reception__',entered:true,xr:false,liftTravelling:false,
   openLift(){liftOpens++;},artExhibits:[],
   rig:{position:{x:1,z:1}}
 });
 try{
   globalThis.document=doc;
   const tour=createGuidedTour(getContext);
   tour.refresh();
   assert.equal(trigger.disabled,false,'button must not have native disabled state in reception');
   trigger.click();
   assert.equal(liftOpens,1,'reception click opens the floor selector');
   date='2026-10-28';
   tour.refresh();
   assert.equal(trigger.disabled,false,'button must remain enabled after a lift trip');
   trigger.click();
   assert.equal(panel.hidden,false,'dated-floor click opens the tour controls');
 }finally{globalThis.document=oldDocument;}
});
