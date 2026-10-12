// Deterministic Watercolor v2 and immutable historical Watercolor v1 regression.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const exportCode=readFileSync(new URL('../js/export.js',import.meta.url),'utf8');
assert.match(html,/js\/watercolor-v2\.js/);
assert.match(app,/var watercolorVersion=2/);
assert.match(app,/materialCode==='1'\|\|materialCode==='2'/);
assert.match(app,/params\.set\('watercolor',String\(watercolorVersion\)\)/);
assert.match(exportCode,/delete compositionSettings\.watercolorVersion/);
assert.match(exportCode,/settings\.watercolorVersion\|\|1/);

let active=false,hash=2166136261,ops=0;
function trace(str){
  if(!active)return;
  ops++;
  for(const ch of str)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
}
function mockCtx(){
  const values={};
  return new Proxy(values,{
    get(obj,key){
      if(key==='createImageData'||key==='getImageData')return (w,h)=>({
        width:w,height:h,data:new Uint8ClampedArray(w*h*4)
      });
      if(key==='createLinearGradient')return (...args)=>{
        trace('gradient:'+args.join(','));
        return {addColorStop:(at,col)=>trace('stop:'+at+':'+col)};
      };
      if(key in obj)return obj[key];
      return (...args)=>trace(String(key)+'('+args.join(',')+')');
    },
    set(obj,key,value){
      obj[key]=value;trace(String(key)+'='+String(value));return true;
    }
  });
}
function canvas(){
  return {width:0,height:0,getContext:()=>mockCtx(),toDataURL:()=>''};
}
const sandbox={window:{AlgoArt:{}},document:{createElement:()=>canvas()}};
const modules=['random','phi','palettes','marker','generator','oil-surface',
  'oil-material','watercolor-v2','oil-render'];
for(const name of modules)runInNewContext(
  readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'),
  sandbox,{filename:name+'.js'});
const A=sandbox.window.AlgoArt;
A.rendererVersion=8;
function settings(mode,orientation){
  return {seed:'WET-WASH-REGRESSION',mode,orientation,
    elements:36,density:53,complexity:71,negativeSpace:41,phiStrength:91,
    recursion:4,spiralInfluence:63,goldenAngle:93,nesting:44,
    pen:'fine',thickness:13,wobble:32,overdraw:3,opacity:70,pressure:36,
    dryness:19,curveBias:91,shapeAmount:68,overlap:65,rotation:91,
    lines:true,circles:true,rectangles:true,polygons:true,arcs:true,
    palette:'mono',colourCount:4,saturation:86,brightness:59,
    paper:'#f5f0e6',grain:13};
}
function render(s,revision){
  const target=canvas();
  hash=2166136261;ops=0;active=true;
  const meta=A.renderOil(target,s,.2,false,revision);
  active=false;
  return {hash,ops,meta,target};
}
for(const [mode,orientation] of [['organic','landscape'],['network','portrait']]){
  const s=settings(mode,orientation),before=JSON.stringify(s);
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  A.render(canvas(),s,.2,false);
  const marker=JSON.stringify(A.svgRecorder.paths);
  A.svgRecorder=null;
  const legacyA=render(s,1);
  assert.equal(A.lastOilMaterialStats.version,4);
  const wetA=render(s,2);
  assert.equal(A.lastWatercolorV2Stats.version,2);
  assert.equal(A.lastWatercolorV2Stats.heightMap,false);
  assert(A.lastWatercolorV2Stats.washes>=1,'Expected wet washes');
  assert(wetA.ops>120,'Expected layered wash commands');
  assert.notEqual(wetA.hash,legacyA.hash,'Watercolor v2 should differ from v1');
  const wetB=render(s,2);
  assert.deepEqual([wetA.hash,wetA.ops],[wetB.hash,wetB.ops],
    'Watercolor v2 should reproduce identical operations');
  const legacyB=render(s,1);
  assert.deepEqual([legacyA.hash,legacyA.ops],[legacyB.hash,legacyB.ops],
    'Existing watercolor v1 links must remain stable');
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  A.render(canvas(),s,.2,false);
  assert.equal(JSON.stringify(A.svgRecorder.paths),marker,
    'Neither watercolor treatment can change V8 marker geometry');
  A.svgRecorder=null;
  assert.equal(JSON.stringify(s),before,'Material rendering must not mutate settings');
  console.log('PASS',mode,orientation,'wet wash operations',wetA.ops);
}
console.log('PASS watercolor v2 deterministic, versioned and V8 immutable');
