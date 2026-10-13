// Seeded Tissue & Graphite palette and historic material regressions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
assert.match(app,/select:not\(#exportScale\):not\(#orientation\):not\(#materialStyle\)/,
  'Randomise must never randomise the selected drawing material');
assert.match(app,/tissuePaletteVersion=4/);
assert.match(app,/params\.set\(tissuePaletteVersion>=2\?'tissue':'watercolor'/);
const exports=readFileSync(new URL('../js/export.js',import.meta.url),'utf8');
assert.match(exports,/delete compositionSettings\.tissuePaletteVersion/);

let painting=false,ops=0,hash=2166136261;
function trace(value){
  if(!painting)return;
  ops++;
  for(const ch of String(value))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
}
function ctx(){
  const fields={};
  return new Proxy(fields,{
    get(o,key){
      if(key==='createImageData'||key==='getImageData')return (w,h)=>({
        width:w,height:h,data:new Uint8ClampedArray(w*h*4)
      });
      if(key in o)return o[key];
      return (...args)=>{trace(String(key)+'('+args.join(',')+')')};
    },
    set(o,key,v){o[key]=v;trace(String(key)+'='+String(v));return true}
  });
}
function canvas(){return {width:0,height:0,getContext:()=>ctx()}}
const sandbox={window:{AlgoArt:{}},document:{createElement:()=>canvas()}};
for(const name of ['random','phi','palettes','marker','generator',
    'oil-surface','oil-material','oil-render']){
  runInNewContext(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'),
    sandbox,{filename:name+'.js'});
}
const A=sandbox.window.AlgoArt;
A.rendererVersion=8;
const seed='TISSUE-SEEDED-COLOUR';
function settings(palette,orientation='landscape'){
  return {
    seed,mode:'network',orientation,
    elements:32,density:53,complexity:69,negativeSpace:44,phiStrength:90,
    recursion:4,spiralInfluence:60,goldenAngle:90,nesting:45,
    pen:'fine',thickness:13,wobble:32,overdraw:3,opacity:70,pressure:36,
    dryness:19,curveBias:87,shapeAmount:68,overlap:65,rotation:50,
    lines:true,circles:true,rectangles:true,polygons:true,arcs:true,
    palette,colourCount:5,saturation:91,brightness:61,
    paper:'#e3ebea',grain:13};
}
function marker(s){
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  A.render(canvas(),s,.1,false);
  const paths=A.svgRecorder.paths;
  A.svgRecorder=null;
  return paths;
}
function paint(s,revision){
  hash=2166136261;ops=0;painting=true;
  try{A.renderOil(canvas(),s,.1,false,revision)}
  finally{painting=false}
  return [hash,ops];
}
const all=[];
for(const palette of ['earth','neon','mono','golden']){
  const s=settings(palette),source=marker(s);
  const colourKit=A.tissueKitFromPaths(source,s);
  assert(colourKit.ink.length>0,'Expected seeded source inks');
  assert(colourKit.ink.length<=s.colourCount);
  assert.equal(colourKit.paper,s.paper,'Paper must follow composition settings');
  if(palette==='mono'){
    assert(colourKit.inkRGB.every(([r,g,b])=>r===g&&g===b),
      'Monochrome must stay genuinely monochrome');
  }
  const first=paint(s,2),version=A.lastOilMaterialStats;
  assert.equal(version.tissuePaletteVersion,2);
  assert.equal(version.graphitePaths,0,'Historic tissue=2 must not gain graphite');
  assert.deepEqual(Array.from(version.inkColours),Array.from(colourKit.ink),
    'Tissue pigments must originate from the actual source Marker strokes');
  assert(first[1]>200);
  const repeat=paint(s,2);
  assert.deepEqual(first,repeat,'Identical settings must re-render the same material');
  all.push({palette,inks:Array.from(version.inkColours),signature:first[0]});
}
assert.notDeepEqual(all[0].inks,all[1].inks,'Palette settings must affect Tissue colour');
assert.notDeepEqual(all[1].inks,all[2].inks,'Monochrome must not be fixed teal/umber');
assert.notEqual(all[0].signature,all[1].signature,'Different ink palettes change output');
const s=settings('neon','portrait');
const seededV2=paint(s,2);
const graphiteV3=paint(s,3);
assert.equal(A.lastOilMaterialStats.tissuePaletteVersion,3);
assert(A.lastOilMaterialStats.graphitePaths>0,'New Tissue v3 needs actual charcoal strokes');
assert.notDeepEqual(graphiteV3,seededV2,'Graphite revision must differ visibly from old v2');
assert.deepEqual(paint(s,2),seededV2,'Graphite v3 must not change previous tissue=2 links');
assert.deepEqual(paint(s,3),graphiteV3,'Graphite v3 must remain deterministic');
const paperGraphiteV4=paint(s,4);
assert.equal(A.lastOilMaterialStats.tissuePaletteVersion,4);
assert(A.lastOilMaterialStats.graphitePaths>0,'Tissue v4 needs visible graphite strokes');
assert(A.lastOilMaterialStats.graphiteHatchPaths>25,'Tissue v4 needs fine pencil hatching');
assert.notDeepEqual(paperGraphiteV4,graphiteV3,'v4 should restore a more subdued, detailed look');
assert.deepEqual(paint(s,4),paperGraphiteV4,'Original-look v4 must remain deterministic');
assert.deepEqual(paint(s,3),graphiteV3,'Older Tissue v3 links must stay unchanged');
const historic=paint(s,1);
assert.equal(A.lastOilMaterialStats.tissuePaletteVersion,1);
paint(s,2);
assert.deepEqual(paint(s,1),historic,'v2 must not alter historical fixed-palette pixels');
const markerGeometry=JSON.stringify(marker(s));
paint(s,2);
assert.equal(JSON.stringify(marker(s)),markerGeometry,
  'Material colour selection must never mutate the published V8 geometry');
console.log('PASS Tissue follows actual seeded Marker palette and paper');
console.log('PASS palettes diverge, repeat deterministically, and v1 stays reproducible');
console.log('PASS Randomise excludes selected drawing material');
