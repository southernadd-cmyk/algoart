import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
import {planPhiReceptionWindow,RECEPTION_WINDOW_BORDER} from '../gallery/visit/phi-reception-window.mjs';
test('the test reception poster is visually left of the map and workrooms stay out of the public foyer',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const p=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
  const r=planPhiReception(p.floor,p.circulation,p.physical),poster=r.signage[1],map=r.worldMap;
  assert.ok((poster.x-map.x)*-map.normal.z>(map.width+poster.width)/2,'Poster must be on the viewer’s left with a clear gap');
  assert.ok(r.backrooms.every(room=>room.room!==r.desk.room),'Public foyer must not be filled with storage workbenches');
  const position={x:r.desk.x+4.4,z:r.desk.z+2.35};
  for(const [dx,dz] of [[-.625,-.425],[-.625,.425],[.625,-.425],[.625,.425]])assert.ok(p.canWalk(position.x+dx,position.z+dz),'Gramophone must fit its room');
  assert.ok(Math.hypot(position.x-r.entrance.x,position.z-r.entrance.z)>3);
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});

test('all four reception credit posters remain on the original wall and move toward the windows at φ',()=>{
 const p=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
 const placement=planPhiReception(p.floor,p.circulation,p.physical).credits;
 const door=p.circulation.publicEntrance;
 const first=planPhiReceptionWindow(door)?.windows?.[0];
 assert.ok(placement&&first,'Reception must have both credits and its front windows');
 assert.equal(placement.axis,'z','Posters must remain on their original z-axis wall');
 assert.equal(placement.normal.z,1,'Posters must retain their original inward-facing normal');
 assert.ok(Math.abs(placement.z-(door.at+.15))<.1,'The same front wall depth is maintained');
 const direction=Math.sign(first.x-door.centre);
 const groupHalfWidth=.83+.68/2+.03;
 const doorEdge=door.centre+direction*door.width/2;
 const windowEdge=first.x-direction*(first.width/2+RECEPTION_WINDOW_BORDER);
 const start=doorEdge+direction*(groupHalfWidth+.32);
 const end=windowEdge-direction*(groupHalfWidth+.32);
 const fraction=(placement.x-start)/(end-start);
 assert.ok(Math.abs(fraction-1/((1+Math.sqrt(5))/2))<.025,'Credits should occupy the golden division of usable solid wall');
 assert.ok((placement.x-doorEdge)*direction>groupHalfWidth+.25,'Credit poster group must clear door');
 assert.ok((windowEdge-placement.x)*direction>groupHalfWidth+.25,'Credit poster group must clear nearest window arch');
 assert.ok(Math.abs(first.x-placement.x)<Math.abs(door.centre-placement.x),'Credit posters must be nearer to the windows than the door');
});

test('test reception locates three living monitors on a solid backroom wall facing the lift',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const phi=buildPhiRendererPlan('__phi_reception__',Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:i%3===0?.75:1.4})));
  const furnishing=planPhiReception(phi.floor,phi.circulation,phi.physical);
  assert.ok(furnishing.backrooms.length>0,'The test layout needs an actual backroom, not a fallback room');
  const mount=planPhiReceptionMonitorWall(furnishing.backrooms[0],furnishing.lift,phi.physical.walls);
  assert.ok(mount,'Three monitors must have a mountable back wall');
  assert.equal(mount.fromPhysical,true,'Monitors should use physical wall segments, not a guessed rectangle');
  assert.ok(mount.width>=.35,'Three monitors must fit the selected wall');
  const room=furnishing.backrooms[0];
  const aim={x:furnishing.lift.x-room.x,z:furnishing.lift.z-room.z};
  const dot=mount.normal.x*aim.x+mount.normal.z*aim.z;
  assert.ok(dot>=0,'Screens must face towards the lift');
  assert.ok((3*mount.width+2*mount.gap)<=mount.span-.20,'All three screens must fit without overlapping a doorway');
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});


test('live and test share charcoal exterior brick on reception feature walls, with truthful active credits',()=>{
 const src=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const wallpaper=readFileSync(new URL('../gallery/visit/reception-wall-material.mjs',import.meta.url),'utf8');
 const panels=readFileSync(new URL('../gallery/visit/phi-reception-decor.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/credits.html',import.meta.url),'utf8');
 const staging=readFileSync(new URL('../test/virtual-gallery/credits.html',import.meta.url),'utf8');
 assert.match(src,/const receptionBlackBrickMaterial=galleryFinish\.exteriorBrick;/);
 assert.ok(src.includes('receptionBlackBrickMaterial,receptionWallMaterial'));
 assert.ok(src.includes('receptionWallMaterial,receptionBlackBrickMaterial'));
 assert.doesNotMatch(wallpaper,/ambientcg-painted-plaster-007|PaintedPlaster007/);
 for(const page of [panels,live,staging]){
  assert.match(page,/Bricks055/);
  assert.doesNotMatch(page,/PaintedPlaster007/);
 }
 assert.doesNotMatch(staging,/Vintage Framed World Map|Small succulent in planter/);
});

test('live and test credits contain only concise source, creator and licence attributions',()=>{
 for(const path of ['../gallery/visit/index.html','../test/virtual-gallery/index.html','../test/virtual-gallery/full-engine.html']){
  const html=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(html,/>Credits<\/a>/);
  assert.doesNotMatch(html,/credits\\.html#licence-review|Credits and licence notes/);
 }
 for(const path of ['../gallery/visit/credits.html','../test/virtual-gallery/credits.html']){
  const html=readFileSync(new URL(path,import.meta.url),'utf8');
  for(const term of ['Elevator — Game Ready','Big5shadow','Sketchfab Standard','Bricks055','Decorative Wall 2','CC BY 4.0','OpenGameArt','Three.js'])assert.ok(html.includes(term),'Missing attribution: '+term);
  assert.doesNotMatch(html,/licence-review|permission|confirmed directly|permitted use confirmed|HDRMAPS|active-versus-archived|licence notes|original world map|Mr\./i);
 }
});

test('old panorama is no longer in the published test assets',()=>{assert.equal(existsSync(new URL('../test/virtual-gallery/assets/jedlina-zdroj-1k.jpg',import.meta.url)),false);});
