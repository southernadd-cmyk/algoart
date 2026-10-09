// Run with: npm run test:orientation
// Lightweight recording canvas: does not need a browser or image snapshot.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
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

const baselineRef='1497968ec1c66f5ba431f21195a39d75e9338e4d';
execFileSync('git',['fetch','--depth=1','origin',baselineRef],{stdio:'pipe'});
const baselineSources=scripts.map(file=>execFileSync('git',['show',baselineRef+':'+file],{encoding:'utf8'}));
const previous=engine(baselineSources),A=engine();
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
for(let version=1;version<=6;version++){
  previous.rendererVersion=A.rendererVersion=version;
  for(const mode of modes)for(const orientation of [undefined,'landscape','portrait']){
    const s=settings(mode,orientation);
    assert.equal(JSON.stringify(render(A,s)),JSON.stringify(render(previous,s)),'V'+version+' '+mode+' '+orientation+' changed');
  }
}
previous.rendererVersion=6;A.rendererVersion=7;
for(const mode of modes)for(const orientation of ['landscape','portrait']){
  if(mode==='organic'&&orientation==='landscape')continue;
  const s=settings(mode,orientation);
  assert.equal(JSON.stringify(render(A,s)),JSON.stringify(render(previous,s)),'V7 unexpectedly changed '+mode+' '+orientation);
}
let cases=0;
for(let i=0;i<20;i++)for(const negativeSpace of [0,41,82,100]){
  const s=settings('organic','landscape','GROWTH-'+i);
  s.elements=36;s.complexity=71;s.recursion=4;s.negativeSpace=negativeSpace;
  const current=render(A,s),repeat=render(A,s);
  assert.equal(JSON.stringify(current),JSON.stringify(repeat),'V7 nondeterministic');
  const segments=current.meta.guide.segments;
  assert.ok(segments.length>0,'Blank growth');
  for(const seg of segments){
    for(const [x,y] of [[seg.x1,seg.y1],[seg.x2,seg.y2]]){
      assert.ok(x>=24&&x<=1376&&y>=24&&y<=976,'Growth outside canvas');
    }
    for(let j=0;j<=32;j++){
      const t=j/32,x=seg.x1+(seg.x2-seg.x1)*t,y=seg.y1+(seg.y2-seg.y1)*t;
      assert.ok(!current.meta.voids.some(v=>x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h),'Growth crosses protected space');
    }
  }
  if(negativeSpace===0){
    const xs=segments.flatMap(p=>[p.x1,p.x2]);
    assert.ok((Math.max(...xs)-Math.min(...xs))/1400>.35,'Insufficient landscape growth span');
  }
  cases++;
}
console.log('PASS: V1–V6 unchanged across all modes/orientations; V7 changes only landscape Organic; '+cases+' deterministic growth/void samples.');
