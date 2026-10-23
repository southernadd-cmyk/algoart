// Isolated regression checks for the OPTIONAL, non-generative oil material.
// The published V8 generator and marker renderer must remain unchanged.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const names=['random','phi','palettes','marker','generator','oil-surface','oil-material','oil-render'];
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const exportCode=readFileSync(new URL('../js/export.js',import.meta.url),'utf8');

assert.match(html,/id="materialStyle"/);
assert.match(html,/Tissue &amp; Graphite/);
assert.match(app,/params\.has\('oil'\)/);
assert.match(exportCode,/-tissue-graphite/);
assert.doesNotMatch(html,/<script src="js\/oil-render\.js/,
  'Tissue engine should not block Marker startup');
const loader=readFileSync(new URL('../js/material-loader.js',import.meta.url),'utf8');
assert.match(loader,/'oil-render'/,'Tissue engine must remain available for lazy loading');
assert.match(app,/if\(oilEnabled\(\)\)params\.set\(tissuePaletteVersion>=2\?'tissue':'watercolor'/);
assert.match(app,/if\(e\.id!=='materialStyle'\)useCurrentRenderer\(\)/);
assert.match(exportCode,/delete compositionSettings\.oilRender/);
// The checkbox must NEVER be part of the V8 seed input.
const settingBlock=app.slice(app.indexOf('var SETTING_IDS='),app.indexOf('var PARAM_KEYS='));
assert.doesNotMatch(settingBlock,/oilRender|materialStyle/);

let outputHash=0,operationCount=0,paintTrace=false;
function record(value){
  if(!paintTrace)return;
  operationCount++;
  for(const ch of value) outputHash=Math.imul(outputHash^ch.charCodeAt(0),16777619)>>>0;
}
function context(){
  return new Proxy({}, {
    get(o,key){
      if(key==='createImageData')return (w,h)=>({
        width:w,height:h,data:new Uint8ClampedArray(w*h*4)
      });
      if(key==='getImageData')return (x,y,w,h)=>({
        width:w,height:h,data:new Uint8ClampedArray(w*h*4)
      });
      if(key in o)return o[key];
      return (...args)=>record(String(key)+'|'+args.join(','));
    },
    set(o,key,value){
      o[key]=value;
      record(String(key)+'='+value);
      return true;
    }
  });
}
function canvas(){
  return {width:0,height:0,getContext:()=>context(),toDataURL:()=>''};
}
const document={createElement:(type)=>type==='canvas'?canvas():{
  click(){},set href(v){},set download(v){}
}};
const sandbox={window:{AlgoArt:{}},document};
for(const name of names){
  runInNewContext(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'),
    sandbox,{filename:name+'.js'});
}
const A=sandbox.window.AlgoArt;
function settings(mode,orientation){
  return {
    seed:'OIL-RENDER-REGRESSION',mode,orientation,
    elements:36,density:53,complexity:71,negativeSpace:41,phiStrength:91,
    recursion:4,spiralInfluence:63,goldenAngle:93,nesting:44,
    pen:'fine',thickness:13,wobble:32,overdraw:3,opacity:70,pressure:36,
    dryness:19,curveBias:91,shapeAmount:68,overlap:65,rotation:91,
    lines:true,circles:true,rectangles:true,polygons:true,arcs:true,
    palette:'mono',colourCount:4,saturation:86,brightness:59,paper:'#f5f0e6',grain:13
  };
}

A.rendererVersion=8;
function test(mode,orientation){
  const s=settings(mode,orientation);
  const original=JSON.stringify(s);
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  const base=A.render(canvas(),s,.2,false);
  const markerGeometry=JSON.stringify(A.svgRecorder.paths);
  assert(markerGeometry.length>100,'Expected nonempty seeded marker geometry');
  A.svgRecorder=null;

  let snapshots=[];
  for(let i=0;i<2;i++){
    const old={paths:[],precise:false};
    A.svgRecorder=old;
    operationCount=0;outputHash=2166136261;
    paintTrace=true;
    const target=canvas();
    const oil=A.renderOil(target,s,.2,false);
    paintTrace=false;
    assert.equal(A.svgRecorder,old,'Oil must restore recorder state');
    assert.equal(oil.strategy,base.strategy,'Material toggle cannot change strategy');
    assert.equal(target.width,(orientation==='portrait'?1000:1400)*.2);
    assert.equal(target.height,(orientation==='portrait'?1400:1000)*.2);
    assert(operationCount>100,'Expected procedural paint brushwork');
    assert.equal(A.lastOilMaterialStats?.version,4,'Expected material-buffer oil renderer');
    assert.equal(A.lastOilMaterialStats?.buffer,'pigment+height');
    assert(A.lastOilMaterialStats.width>0&&A.lastOilMaterialStats.height>0);
    snapshots.push([outputHash,operationCount,oil.strategy]);
  }
  assert.deepEqual(snapshots[0],snapshots[1],'Oil output must be deterministic');
  assert.equal(JSON.stringify(s),original,'Painter must not modify composition settings');

  // Reconstruct the marker again: oil generation has not mutated the composer.
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  A.render(canvas(),s,.2,false);
  assert.equal(JSON.stringify(A.svgRecorder.paths),markerGeometry,
    'Switching back must recover identical V8 marker marks');
  A.svgRecorder=null;
  return snapshots[0];
}
for(const [mode,orientation] of [['organic','landscape'],['network','portrait']]){
  const result=test(mode,orientation);
  console.log('PASS',mode,orientation,'paint operations',result[1]);
}
console.log('PASS: oil is deterministic, additive, URL-addressable, and leaves V8 geometry unchanged.');
