// Pin a source-of-truth engine from just before the tuning-name refactor.
// This is NOT a snapshot re-generated from the current code on each run.
// Legacy versions 3, 6 and 7 must continue producing exactly the same
// drawing commands for the same seeds/settings (including 0% φ Pull).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const BASELINE='99611b850bd812354701b8fec464a036d9b2c750';
const files=['js/random.js','js/phi.js','js/palettes.js','js/marker.js','js/generator.js'];

function git(...args){return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
try{git('cat-file','-e',BASELINE+'^{commit}');}
catch{git('fetch','--depth=1','origin',BASELINE);}

function makeEngine(sources){
  const sandbox={window:{AlgoArt:{}}};
  for(let i=0;i<files.length;i++){
    runInNewContext(sources[i],sandbox,{filename:files[i]});
  }
  return sandbox.window.AlgoArt;
}
const baseline=makeEngine(files.map(f=>git('show',BASELINE+':'+f)));
const current=makeEngine(files.map(f=>readFileSync(new URL('../'+f,import.meta.url),'utf8')));

function capture(A,settings,version){
  const hash=createHash('sha256');
  let operations=0;
  const record=(key,value)=>{
    hash.update(JSON.stringify([key,value])+'\\n');
    operations++;
  };
  const ctx=new Proxy({},{
    get(obj,key){
      if(!(key in obj))obj[key]=(...args)=>record(key,args);
      return obj[key];
    },
    set(obj,key,value){record(key,value);obj[key]=value;return true;}
  });
  const canvas={width:0,height:0,getContext:()=>ctx};
  A.rendererVersion=version;
  const meta=A.render(canvas,{...settings},1,false);
  return {
    digest:hash.digest('hex'),operations,width:canvas.width,height:canvas.height,
    strategy:meta.strategy,metadata:JSON.stringify(meta)
  };
}

const modes=['field','spiral','rects','burst','network','organic','geometric','scribble'];
let checked=0;
for(const version of [3,6,7]){
  for(const orientation of ['landscape','portrait']){
    for(const phiStrength of [0,91,100]){
      for(const mode of modes){
        for(const seed of ['CALIBRATION-A','CALIBRATION-B']){
          const settings={
            seed,mode,orientation,elements:30,density:44,complexity:61,
            negativeSpace:32,phiStrength,recursion:4,spiralInfluence:60,
            goldenAngle:80,nesting:36,pen:'felt',thickness:12,wobble:22,
            overdraw:2,opacity:78,pressure:25,dryness:15,curveBias:65,
            shapeAmount:55,overlap:45,rotation:30,
            lines:true,circles:true,rectangles:true,polygons:true,arcs:true,
            palette:'mono',colourCount:1,saturation:75,brightness:50,
            paper:'#f5f0e6',grain:0
          };
          const before=capture(baseline,settings,version);
          const after=capture(current,settings,version);
          assert.deepEqual(after,before,`Drawing changed: V${version}/${mode}/${orientation}/φ${phiStrength}/${seed}`);
          checked++;
        }
      }
    }
  }
}
console.log('PASS: '+checked+' V3/V6/V7 seed/orientation/φ configurations produce byte-identical drawing command digests and metadata against pinned pre-refactor source '+BASELINE+'.');


// Independently exercise every shared φ placement helper, including
// helpers/margins that a particular mode or sample seed might never reach.
// The original V1–V7 helper semantics and RNG draw order must stay identical.
function placementSample(A,orientation,phiStrength,goldenAngle,seed){
  A.W=orientation==='portrait'?1000:1400;
  A.H=orientation==='portrait'?1400:1000;
  const settings={phiStrength,goldenAngle};
  return JSON.stringify({
    goldenCanvas:[
      A.goldenCanvasPoint(0,1,settings,0),
      A.goldenCanvasPoint(2,13,settings,A.GOLD*.5),
      A.goldenCanvasPoint(12,13,settings,0)
    ],
    goldenPoint:A.goldenPoint(4,13,settings,A.makeR(seed+'|unused')),
    phiPoint:A.phiPoint(settings,A.makeR(seed+'|phi-point')),
    defaultCells:A.goldenCells(11),
    explicitCells:A.goldenCells(7,64),
    zeroMarginCells:A.goldenCells(5,0),
    distributed:A.distributedPhiPoints(13,settings,A.makeR(seed+'|distributed')),
    quantified:[A.qphi(17,21,phiStrength/100),A.qphi(120,34,phiStrength/100)]
  });
}
let placementChecks=0;
for(const orientation of ['landscape','portrait']){
  for(const phiStrength of [0,55,100]){
    for(const goldenAngle of [0,50,100]){
      for(const seed of ['PLACEMENT-A','PLACEMENT-B']){
        const before=placementSample(baseline,orientation,phiStrength,goldenAngle,seed);
        const after=placementSample(current,orientation,phiStrength,goldenAngle,seed);
        assert.equal(after,before,
          `φ helper output or RNG changed: ${orientation}/pull${phiStrength}/angle${goldenAngle}/${seed}`);
        placementChecks++;
      }
    }
  }
}
console.log('PASS: '+placementChecks+' exact φ-helper samples match the pinned pre-refactor engine.');
