import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('gallery/visit/gallery-v2.js','utf8');
const between=(start,end)=>{
  const first=source.indexOf(start),last=source.indexOf(end,first);
  assert.ok(first>=0&&last>first,'Missing gallery section: '+start);
  return source.slice(first,last);
};
const loading=between('function startDeferredGallery(){','function constructGallery(');
const entry=source.match(/renderer\.xr\.addEventListener\('sessionstart', \(\) => \{[\s\S]*?\n  \}\);/)[0];
const desktop=between("enter.addEventListener('click'","$('fullscreen').addEventListener");
const renderLoop=between('function tick() {','// Ensure canvas-rendered entrance');
const reset=source.match(/deferredGalleryJobs=\[\];deferredGalleryRunning=false;/)[0];
const ready=source.match(/if\(viaLift\|\|nextFloor!==0\|\|welcome\.hidden\)startDeferredGallery\(\);/)[0];

function gallery(){
  const events=new Map(),built=[],warnings=[],lift={hidden:true};
  let frame,click;
  const context={
    deferredGalleryJobs:[],deferredGalleryRunning:false,
    scene:{children:[]},camera:{},editionObjects:[],welcome:{hidden:false},plan:{},
    paintFrames:0,towerGraffiti:{paintNext(){context.paintFrames++;}},
    interiorPaintFrames:0,interiorGraffiti:{paintNext(){context.interiorPaintFrames++;}},
    clock:{getDelta:()=>.016},lastFocusCheck:0,mapElapsed:0,
    entranceDoor:null,rig:{position:{}},
    $:()=>lift,canvas:{focus(){}},matchMedia:()=>({matches:false}),
    resetInspection(){},updateExhibitLighting(){},animateLiftDoors(){},
    updateMovement(){},detectArt(){},drawMap(){},
    console:{warn:(...args)=>warnings.push(args)},
    // Standalone/headset browsers may suspend this API throughout VR.
    requestAnimationFrame(){throw new Error('Window frames are unavailable');},
    renderer:{
      xr:{isPresenting:false,addEventListener:(name,fn)=>events.set(name,fn)},
      render(){},setAnimationLoop:fn=>{frame=fn;}
    },
    enter:{addEventListener:(name,fn)=>{if(name==='click')click=fn;}}
  };
  vm.createContext(context);
  vm.runInContext(loading+'\n'+entry+'\n'+desktop+'\n'+renderLoop,context);
  return {
    context,built,warnings,lift,
    queue(name,fail=false){context.deferredGalleryJobs.push(()=>{
      if(fail)throw new Error(name);
      built.push(name);context.scene.children.push({name});
    });},
    vr(){context.renderer.xr.isPresenting=true;events.get('sessionstart')();},
    desktop(){click({detail:0});},
    frame(){frame();},
    finish(){for(let i=0;i<20&&context.deferredGalleryRunning;i++)frame();
      assert.equal(context.deferredGalleryRunning,false,'Exhibits did not finish');},
    floor({viaLift=false,nextFloor=0}={}){
      context.viaLift=viaLift;context.nextFloor=nextFloor;
      vm.runInContext(ready,context);
    },
    reset(){vm.runInContext(reset,context);context.editionObjects=[];}
  };
}

test('direct VR entry builds paintings and sculptures without window frames',()=>{
  const g=gallery();g.queue('painting');g.queue('sculpture');
  g.vr();g.frame();
  assert.equal(g.context.welcome.hidden,true);
  assert.deepEqual(g.built,['painting'],'Only one exhibit is built per render frame');
  g.finish();assert.deepEqual(g.built,['painting','sculpture']);
  assert.equal(g.context.editionObjects.length,2);
});
test('desktop entry keeps the exterior first and starts exhibit loading on entry',()=>{
  const g=gallery();g.queue('painting');g.queue('sculpture');
  g.floor();g.frame();assert.deepEqual(g.built,[]);
  g.desktop();g.finish();assert.deepEqual(g.built,['painting','sculpture']);
});
test('exterior paint progresses before entry and on immersive XR frames',()=>{
  const g=gallery();g.floor();g.frame();assert.equal(g.context.paintFrames,1);
  assert.equal(g.context.interiorPaintFrames,1);
  assert.equal(g.context.welcome.hidden,false);g.vr();g.frame();assert.equal(g.context.paintFrames,2);assert.equal(g.context.interiorPaintFrames,2);
});
test('VR entered before floor preparation starts exhibits once that floor is ready',()=>{
  const g=gallery();g.vr();g.frame();
  g.queue('late painting');g.queue('late sculpture');
  g.floor();g.finish();assert.deepEqual(g.built,['late painting','late sculpture']);
});
test('entering VR while desktop exhibits are loading does not duplicate jobs',()=>{
  const g=gallery();g.queue('painting');g.queue('sculpture');
  g.desktop();g.frame();g.vr();g.vr();g.finish();
  assert.deepEqual(g.built,['painting','sculpture']);
});
test('exiting VR mid-load continues exhibit construction on desktop frames',()=>{
  const g=gallery();g.queue('painting');g.queue('sculpture');
  g.vr();g.frame();g.context.renderer.xr.isPresenting=false;g.finish();
  assert.deepEqual(g.built,['painting','sculpture']);
});
test('changing floors cancels unbuilt exhibits from the previous edition',()=>{
  const g=gallery();g.queue('old painting');g.queue('old sculpture');
  g.vr();g.frame();g.reset();
  g.queue('new painting');g.queue('new sculpture');
  g.floor({viaLift:true,nextFloor:1});g.finish();
  assert.deepEqual(g.built,['old painting','new painting','new sculpture']);
  assert.equal(g.context.editionObjects.length,2);
});
test('loading continues through lift overlays and recovers after an exhibit fails',()=>{
  const g=gallery();g.queue('failed exhibit',true);g.queue('painting');
  g.vr();g.lift.hidden=false;g.finish();
  assert.deepEqual(g.built,['painting']);assert.equal(g.warnings.length,1);
});
test('a floor restored after a failed journey restarts its exhibits in VR',()=>{
  const g=gallery();g.vr();g.reset();g.queue('restored painting');
  g.floor();g.finish();assert.deepEqual(g.built,['restored painting']);
});

