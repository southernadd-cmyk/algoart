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
  const rngCalls=[];
  function tracedR(seed){
    const rng=A.makeR(seed);
    return Object.fromEntries(Object.keys(rng).map(method=>[method,(...args)=>{
      const value=rng[method](...args);
      rngCalls.push([seed,method,args,value]);
      return value;
    }]));
  }
  return JSON.stringify({
    goldenCanvas:[
      A.goldenCanvasPoint(0,1,settings,0),
      A.goldenCanvasPoint(2,13,settings,A.GOLD*.5),
      A.goldenCanvasPoint(12,13,settings,0)
    ],
    goldenPoint:A.goldenPoint(4,13,settings,tracedR(seed+'|unused')),
    phiPoint:A.phiPoint(settings,tracedR(seed+'|phi-point')),
    defaultCells:A.goldenCells(11),
    explicitCells:A.goldenCells(7,64),
    zeroMarginCells:A.goldenCells(5,0),
    distributed:A.distributedPhiPoints(13,settings,tracedR(seed+'|distributed')),
    quantified:[A.qphi(17,21,phiStrength/100),A.qphi(120,34,phiStrength/100)],
    rngCalls
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


// Element hierarchy calibration is especially sensitive at 24 and 70
// elements: hero counts jump there. Cover both sides of each boundary,
// all dominant layout strategies, very weak/strong φ pull, extreme
// density and overlap, and portrait/landscape for legacy V6 and V7.
// These are full drawing-stream comparisons with the pinned original.
const hierarchyModes=['field','network','spiral'];
const hierarchyStrategies=['BALANCED','MONUMENT','EDGE'];
const allStrategies=['BALANCED','VOID','TENSION','ORBIT','EDGE','MONUMENT','DIAGONAL'];
function seedForStrategy(mode,strategy){
  for(let i=0;i<1000;i++){
    const seed='HIERARCHY-EDGE-CASE-'+i;
    if(allStrategies[baseline.hash(seed+'|'+mode+'|composition-strategy')%allStrategies.length]===strategy)return seed;
  }
  throw Error('Unable to select strategy '+mode+'/'+strategy);
}
let boundaryChecks=0;
for(const mode of hierarchyModes){
  for(const strategy of hierarchyStrategies){
    const seed=seedForStrategy(mode,strategy);
    for(const elements of [1,23,24,69,70,140]){
      for(const orientation of ['landscape','portrait']){
        for(const phiStrength of [0,100]){
          const settings={
            seed,mode,orientation,elements,density:phiStrength===0?0:100,
            complexity:61,negativeSpace:32,phiStrength,recursion:4,
            spiralInfluence:60,goldenAngle:80,nesting:36,pen:'felt',
            thickness:12,wobble:22,overdraw:2,opacity:78,
            pressure:25,dryness:15,curveBias:65,shapeAmount:55,
            overlap:elements>=70?100:0,rotation:30,lines:true,
            circles:true,rectangles:true,polygons:true,arcs:true,
            palette:'mono',colourCount:1,saturation:75,
            brightness:50,paper:'#f5f0e6',grain:0
          };
          const a=capture(baseline,settings,7);
          const b=capture(current,settings,7);
          assert.deepEqual(b,a,
            `Element sizing drift: ${mode}/${strategy}/n${elements}/${orientation}/φ${phiStrength}`);
          boundaryChecks++;
        }
      }
    }
  }
}
console.log('PASS: '+boundaryChecks+' element-sizing boundary compositions match pinned baseline drawing commands and metadata.');


// Protected-void and collision-threshold regression. Values 8, 42 and 70
// lie exactly at the enable/second-void boundaries; the next integer
// should cross the respective strict comparison only where intended.
// Cover both edge and VOID strategies, crowded / uncrowded layouts,
// portrait / landscape and both ends of the allowed overlap scale.
// Compare every drawing command and returned geometry to pinned legacy code.
let placementConstraintChecks=0;
for(const mode of ['field','network']){
  for(const strategy of ['VOID','EDGE']){
    const seed=seedForStrategy(mode,strategy);
    for(const negativeSpace of [0,8,42,43,70,71,100]){
      for(const overlap of [0,100]){
        for(const orientation of ['landscape','portrait']){
          const settings={
            seed,mode,orientation,elements:overlap===0?24:70,
            density:75,complexity:61,negativeSpace,phiStrength:91,
            recursion:4,spiralInfluence:60,goldenAngle:80,nesting:36,
            pen:'felt',thickness:12,wobble:22,overdraw:2,opacity:78,
            pressure:25,dryness:15,curveBias:65,shapeAmount:55,
            overlap,rotation:30,lines:true,circles:true,rectangles:true,
            polygons:true,arcs:true,palette:'mono',colourCount:1,
            saturation:75,brightness:50,paper:'#f5f0e6',grain:0
          };
          const before=capture(baseline,settings,7);
          const after=capture(current,settings,7);
          assert.deepEqual(after,before,
            `Placement changed: ${mode}/${strategy}/void${negativeSpace}/overlap${overlap}/${orientation}`);
          placementConstraintChecks++;
        }
      }
    }
  }
}
console.log('PASS: '+placementConstraintChecks+' protected-void/collision boundary layouts reproduce pinned drawing commands and metadata.');


// Field-family scoring regression: V2 uses the original relationship model;
// V3 and V7 use the V3 model. The 7 strategy branches (especially ORBIT,
// MONUMENT, EDGE and DIAGONAL) exercise different snapping/alignment paths.
// Check entire drawing streams and metadata at both hero-count boundaries.
let relationshipChecks=0;
for(const version of [2,3,7]){
  for(const strategy of allStrategies){
    const seed=seedForStrategy('field',strategy);
    for(const elements of [24,70]){
      for(const orientation of ['landscape','portrait']){
        for(const phiStrength of [0,100]){
          const settings={
            seed,mode:'field',orientation,elements,density:62,
            complexity:65,negativeSpace:43,phiStrength,recursion:4,
            spiralInfluence:64,goldenAngle:80,nesting:35,
            pen:'felt',thickness:12,wobble:19,overdraw:2,
            opacity:85,pressure:25,dryness:15,curveBias:65,
            shapeAmount:80,overlap:30,rotation:45,
            lines:true,circles:true,rectangles:true,polygons:true,
            arcs:true,palette:'mono',colourCount:3,saturation:75,
            brightness:50,paper:'#f5f0e6',grain:0
          };
          const before=capture(baseline,settings,version);
          const after=capture(current,settings,version);
          assert.deepEqual(after,before,
            `Field family relationship drift: V${version}/${strategy}/n${elements}/${orientation}/φ${phiStrength}`);
          relationshipChecks++;
        }
      }
    }
  }
}
console.log('PASS: '+relationshipChecks+' legacy/V3 field relationship scoring and alignment compositions reproduce the pinned renderer.');


// Dedicated strategy placement + V4 spiral geometry compatibility.
// V2 exercises pre-V4 candidate stepping; V4 and V7 use the later
// logarithmic spiral. Exercise all seven strategy attraction branches
// across portrait/landscape and both endpoints of Additional φ Pull.
let geometryStrategyChecks=0;
for(const version of [2,4,7]){
  for(const strategy of allStrategies){
    const seed=seedForStrategy('field',strategy);
    for(const elements of [24,70]){
      for(const orientation of ['landscape','portrait']){
        for(const phiStrength of [0,100]){
          const settings={
            seed,mode:'field',orientation,elements,density:65,
            complexity:61,negativeSpace:32,phiStrength,
            recursion:4,spiralInfluence:100,goldenAngle:80,
            nesting:36,pen:'felt',thickness:12,wobble:22,
            overdraw:2,opacity:78,pressure:25,dryness:15,
            curveBias:65,shapeAmount:55,overlap:45,rotation:30,
            lines:true,circles:true,rectangles:true,
            polygons:true,arcs:true,palette:'mono',colourCount:3,
            saturation:75,brightness:50,paper:'#f5f0e6',grain:0
          };
          const before=capture(baseline,settings,version);
          const after=capture(current,settings,version);
          assert.deepEqual(after,before,
            `Strategy geometry changed: V${version}/${strategy}/n${elements}/${orientation}/φ${phiStrength}`);
          geometryStrategyChecks++;
        }
      }
    }
  }
}
console.log('PASS: '+geometryStrategyChecks+' strategy-specific placement compositions reproduce the pinned pre-refactor engine.');

// Verify Golden Trajectories throughout historical stepping changes and
// at both ends of Golden Angle and φ Pull. This is independent of the
// shared field-placement tests above, and guards mode-specific output.
let spiralGeometryChecks=0;
for(const version of [3,4,6,7]){
  for(const orientation of ['landscape','portrait']){
    for(const goldenAngle of [0,100]){
      for(const phiStrength of [0,100]){
        const settings={
          seed:'GEOMETRY-SPIRAL-ARCHIVE',mode:'spiral',orientation,
          elements:36,density:44,complexity:61,negativeSpace:32,
          phiStrength,recursion:4,spiralInfluence:90,goldenAngle,
          nesting:36,pen:'felt',thickness:12,wobble:22,overdraw:2,
          opacity:78,pressure:25,dryness:15,curveBias:65,
          shapeAmount:55,overlap:45,rotation:30,
          lines:true,circles:true,rectangles:true,polygons:true,
          arcs:true,palette:'mono',colourCount:3,saturation:75,
          brightness:50,paper:'#f5f0e6',grain:0
        };
        assert.deepEqual(capture(current,settings,version),
          capture(baseline,settings,version),
          `Spiral-mode regression: V${version}/${orientation}/angle${goldenAngle}/φ${phiStrength}`);
        spiralGeometryChecks++;
      }
    }
  }
}
console.log('PASS: '+spiralGeometryChecks+' historical spiral-mode drawings reproduce pinned originals.');


// Constructed Forms: six deliberately distinct substyles share one drawing
// engine. Force each substyle through the original variant-selection hash,
// and exercise both extrema of complexity, item count, nesting, styles,
// phi pull and canvas orientation. Draw command and geometry metadata must
// reproduce the pinned pre-refactor engine for earlier and current versions.
const constructedVariants=['BALANCE','STACK','AXIS','COLLISION','FLOAT','CROP'];
function constructedVariantSeed(variant){
  const target=constructedVariants.indexOf(variant);
  assert.notEqual(target,-1,'Unknown Constructed Forms variant');
  for(let i=0;i<2000;i++){
    const seed='CONSTRUCTED-CALIBRATION-'+i;
    if(baseline.hash(seed+'|constructed-variant')%constructedVariants.length===target)return seed;
  }
  throw Error('No deterministic seed for Constructed Forms variant '+variant);
}
let constructedChecks=0;
for(const version of [2,5,7]){
  for(const variant of constructedVariants){
    const seed=constructedVariantSeed(variant);
    for(const orientation of ['landscape','portrait']){
      for(const phiStrength of [0,100]){
        for(const complexity of [0,100]){
          const settings={
            seed,mode:'geometric',orientation,
            elements:complexity===0?1:200,
            density:complexity,complexity,negativeSpace:90,
            phiStrength,recursion:4,spiralInfluence:60,
            goldenAngle:80,nesting:complexity,
            pen:'felt',thickness:complexity===0?5:26,
            wobble:100,curveBias:100,overdraw:5,
            opacity:complexity===0?20:95,
            pressure:25,dryness:15,shapeAmount:100,
            overlap:45,rotation:30,lines:true,circles:true,
            rectangles:true,polygons:true,arcs:true,
            palette:'mono',colourCount:3,saturation:75,
            brightness:50,paper:'#f5f0e6',grain:0
          };
          const before=capture(baseline,settings,version);
          const after=capture(current,settings,version);
          assert.deepEqual(after,before,
            `Constructed Forms drift: V${version}/${variant}/${orientation}/phi${phiStrength}/complexity${complexity}`);
          constructedChecks++;
        }
      }
    }
  }
}
console.log('PASS: '+constructedChecks+' Constructed Forms variant/geometry/style cases reproduce pinned drawing commands and metadata.');
