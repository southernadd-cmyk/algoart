// Run with: npm run test:orientation
// Lightweight recording canvas: does not need a browser or image snapshot.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {runInNewContext} from 'node:vm';

const scripts=[
  'js/random.js','js/phi.js','js/palettes.js','js/marker.js','js/generator.js'
];
function engine(sources=null){
  const sandbox={window:{AlgoArt:{}}};
  for(const [i,file] of scripts.entries()){
    const code=sources?sources[i]:readFileSync(new URL('../'+file,import.meta.url),'utf8');
    runInNewContext(code,sandbox,{filename:file});
  }
  sandbox.window.AlgoArt.rendererVersion=6;
  return sandbox.window.AlgoArt;
}
function capture(){
  let hash=2166136261>>>0,operations=0;
  function record(value){
    for(const c of JSON.stringify(value)){
      hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
    }
    operations++;
  }
  const ctx=new Proxy({},{
    get(obj,key){
      if(!(key in obj))obj[key]=(...args)=>record([key,...args]);
      return obj[key];
    },
    set(obj,key,value){record([key,value]);obj[key]=value;return true;}
  });
  return {
    canvas:{width:0,height:0,getContext:()=>ctx},
    state:()=>({hash,operations})
  };
}
const fields=[
  ['elements',25],['density',32],['complexity',71],['negativeSpace',82],
  ['phiStrength',95],['recursion',4],['spiralInfluence',63],['goldenAngle',93],['nesting',44],
  ['pen','felt'],['thickness',12],['wobble',18],['overdraw',1],['opacity',92],
  ['pressure',25],['dryness',0],['curveBias',60],['shapeAmount',50],
  ['overlap',40],['rotation',35],['lines',true],['circles',true],
  ['rectangles',true],['polygons',true],['arcs',true],
  ['palette','mono'],['colourCount',1],['saturation',75],
  ['brightness',50],['paper','#ffffff'],['grain',0]
];
function settings(mode,orientation,seed='PORTRAIT-TEST-01'){
  const s={seed,mode};
  if(orientation)s.orientation=orientation;
  for(const [key,value] of fields)s[key]=value;
  return s;
}
function render(A,s){
  const rec=capture();
  const meta=A.render(rec.canvas,s,1,false);
  return {...rec.state(),width:rec.canvas.width,height:rec.canvas.height,
    strategy:meta.strategy,meta};
}


const A=engine();
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/render-v1-v7.json',import.meta.url)));
for(const f of fixtures){
  A.rendererVersion=f.version;
  const out=render(A,settings(f.mode,f.orientation));
  assert.equal(out.hash,f.hash,`V${f.version} ${f.mode} ${f.orientation} changed`);
  assert.equal(out.operations,f.operations);
}
A.rendererVersion=8;
const sides=new Set();let edge=0,interior=0,multiple=0,cases=0;
for(const orientation of ['landscape','portrait'])for(let i=0;i<24;i++)for(const negativeSpace of [0,82,100]){
  const s=settings('organic',orientation,'V8-GROWTH-'+i);s.negativeSpace=negativeSpace;s.elements=36;
  const out=render(A,s),again=render(A,s),g=out.meta.guide;
  assert.equal(JSON.stringify(out),JSON.stringify(again),'V8 nondeterministic');
  assert.ok(g.segments.length>=g.roots.length,'Missing root phrases');
  if(g.roots.length>1)multiple++;
  if(g.variant==='EDGE')edge++;else interior++;
  for(const [index,root] of g.roots.entries()){
    assert.ok(g.segments.some(seg=>seg.branch===index&&seg.depth===0),'Root did not draw');
    assert.ok(Math.abs(root.angle/A.GOLD-Math.round(root.angle/A.GOLD))<1e-8);
    if(root.edge){
      sides.add(root.edge);
      const f=(root.edge==='left'||root.edge==='right')?root.y/out.height:root.x/out.width;
      assert.ok(Math.min(Math.abs(f-A.INV),Math.abs(f-(1-A.INV)))<1e-8);
    }
  }
  for(const seg of g.segments){
    for(const [x,y] of [[seg.x1,seg.y1],[seg.x2,seg.y2]])assert.ok(x>=0&&x<=out.width&&y>=0&&y<=out.height);
    for(let j=0;j<=64;j++){
      const t=j/64,x=seg.x1+(seg.x2-seg.x1)*t,y=seg.y1+(seg.y2-seg.y1)*t;
      assert.ok(!out.meta.voids.some(v=>x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h),'Protected space crossed');
    }
  }
  cases++;
}
assert.equal(sides.size,4);assert.ok(edge>0&&interior>0);assert.ok(multiple>cases*.8);
for(const mode of modes.filter(m=>m!=='organic'))for(const orientation of ['landscape','portrait']){
  const f=fixtures.find(f=>f.version===7&&f.mode===mode&&f.orientation===orientation);
  assert.equal(render(A,settings(mode,orientation)).hash,f.hash,'V8 changed '+mode);
}
A.svgRecorder={paths:[]};render(A,settings('organic','landscape'));
assert.ok(A.svgRecorder.paths.length>0);assert.ok(A.svgRecorder.paths.every(p=>!p.transform));
console.log(`PASS: 112 legacy fixtures; ${cases} V8 cases, all four edges, interior variants, ${multiple} multi-root compositions, native SVG geometry.`);
