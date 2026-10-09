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
// Compare against actual main/V6 source instead of recording fixture hashes
// from a different JS execution environment. CI can fetch the protected main
// baseline without committing an old duplicate generator into this branch.
execFileSync('git',['fetch','--depth=1','origin','main:refs/remotes/origin/main'],{stdio:'pipe'});
const baselineSources=scripts.map(file=>execFileSync('git',['show','origin/main:'+file],{encoding:'utf8'}));
const mainEngine=engine(baselineSources);
const A=engine();
const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
for(const mode of modes){
  const baseline=render(mainEngine,settings(mode));
  const historical=render(A,settings(mode));
  const explicit=render(A,settings(mode,'landscape'));
  assert.equal(historical.hash,baseline.hash,mode+' historical landscape changed from main');
  assert.equal(explicit.hash,baseline.hash,mode+' explicit landscape changed from main');
  assert.equal(historical.operations,baseline.operations,mode+' command count changed from main');
  assert.equal(explicit.strategy,baseline.strategy,mode+' composition strategy changed from main');
  assert.equal(historical.width,1400);
  assert.equal(historical.height,1000);
  assert.equal(explicit.operations,historical.operations);
  for(const seed of ['PORTRAIT-TEST-01','PORTRAIT-TEST-02','PORTRAIT-TEST-03','PORTRAIT-TEST-04']){
    const p=render(A,settings(mode,'portrait',seed));
    const repeat=render(A,settings(mode,'portrait',seed));
    assert.equal(p.width,1000,mode+' portrait width');
    assert.equal(p.height,1400,mode+' portrait height');
    assert.equal(p.hash,repeat.hash,mode+' portrait not deterministic');
    assert.ok(p.operations>50,mode+' unexpectedly empty portrait drawing');
    assert.ok(p.strategy,mode+' missing composition strategy');
  }
}
console.log('PASS: all 8 modes match live main/V6 landscape drawing commands and render reproducible portrait compositions across 4 seeds each.');


// Portrait refinement regression: verify visual territory coverage and
// protected negative-space geometry across multiple seeds and densities.
// KNOT intentionally concentrates its gestures, so it is not forced to
// fill the vertical canvas like RIBBON or CLUSTERS.
function insideVoid(x,y,voids){
  return voids.some(v=>x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h);
}
let refinedChecks=0;
const sampleSeeds=['PORTRAIT-PREVIEW-2026',...Array.from({length:11},(_,i)=>'PROBE-'+(i+1))];
for(const mode of ['organic','scribble']){
  for(const negativeSpace of [15,41,82]){
    for(const seed of sampleSeeds){
      const s=settings(mode,'portrait',seed);
      s.elements=36;s.density=53;s.complexity=71;s.recursion=4;s.negativeSpace=negativeSpace;
      const {meta}=render(A,s);
      const voids=meta.voids||[];
      if(mode==='organic'){
        const segments=meta.guide.segments;
        assert.ok(segments.length>=8,'Portrait organic growth stopped: '+seed+' / '+negativeSpace);
        const y=segments.flatMap(seg=>[seg.y1,seg.y2]);
        const verticalSpan=(Math.max(...y)-Math.min(...y))/1400;
        assert.ok(verticalSpan>.22,'Portrait organic has lost vertical coverage: '+seed);
        for(const seg of segments){
          for(let i=0;i<=16;i++){
            const t=i/16,x=seg.x1+(seg.x2-seg.x1)*t,y=seg.y1+(seg.y2-seg.y1)*t;
            assert.equal(insideVoid(x,y,voids),false,
              'Organic branch enters protected negative space: '+seed+'/'+negativeSpace);
          }
        }
      }else{
        const anchors=meta.guide.anchors;
        for(const a of anchors)assert.equal(insideVoid(a.x,a.y,voids),false,
          'Scribble anchor in protected void: '+seed+'/'+negativeSpace);
        if(meta.guide.variant!=='KNOT'){
          const y=anchors.map(a=>a.y);
          const verticalSpan=(Math.max(...y)-Math.min(...y))/1400;
          assert.ok(verticalSpan>.40,'Portrait scribble loses vertical rhythm: '+seed);
        }
      }
      refinedChecks++;
    }
  }
}
console.log('PASS: '+refinedChecks+' portrait refinement samples avoid protected voids and retain vertical composition.');


// Extended sweep of portrait Organic Growth and Scribble, including the
// three formerly failing high-void seeds. A larger sample catches endpoint
// clipping mistakes that a small fixture set can miss.
let broadCases=0;
for(const mode of ['organic','scribble']){
  for(const negativeSpace of [0,15,41,82,100]){
    for(let i=0;i<60;i++){
      const seed='BROAD-'+String(i).padStart(3,'0');
      // Match the real Compose panel's field order: adding a key at another
      // point in the settings object changes the seeded RNG sequence.
      const s={orientation:'portrait',elements:36,density:53,complexity:71,
        negativeSpace,phiStrength:91,recursion:4,spiralInfluence:63,
        goldenAngle:93,nesting:44,pen:'felt',thickness:12,wobble:15,
        overdraw:1,opacity:92,pressure:25,dryness:0,curveBias:60,
        shapeAmount:50,overlap:40,rotation:35,lines:true,circles:true,
        rectangles:true,polygons:true,arcs:true,palette:'mono',colourCount:1,
        saturation:75,brightness:50,paper:'#f5f0e6',grain:0,mode,seed};
      const {meta}=render(A,s),voids=meta.voids||[];
      if(mode==='organic'){
        const segments=meta.guide.segments;
        assert.ok(segments.length>0,'Portrait organic unexpectedly blank: '+seed+' / '+negativeSpace);
        for(const seg of segments){
          for(let j=0;j<=32;j++){
            const t=j/32;
            const x=seg.x1+(seg.x2-seg.x1)*t,y=seg.y1+(seg.y2-seg.y1)*t;
            assert.equal(insideVoid(x,y,voids),false,
              'Organic branch crosses protected void: '+seed+' / '+negativeSpace);
          }
        }
      }else{
        for(const a of meta.guide.anchors){
          assert.equal(insideVoid(a.x,a.y,voids),false,
            'Scribble anchor crosses protected void: '+seed+' / '+negativeSpace);
        }
      }
      broadCases++;
    }
  }
}
console.log('PASS: '+broadCases+' broad high-void portrait samples with no blank organic output or sampled void crossings.');
