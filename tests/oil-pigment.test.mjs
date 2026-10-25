import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{AlgoArt:{}}};
vm.runInNewContext(readFileSync('js/oil-pigment.js','utf8'),sandbox);
const P=sandbox.window.AlgoArt.oilPigment;
const plain=v=>JSON.parse(JSON.stringify(v));
const delta=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const valid=c=>assert(c.length===3&&c.every(v=>Number.isInteger(v)&&v>=0&&v<=255),String(c));
for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
 const c=[r,g,b],before=JSON.stringify(c),mapped=P.mapRGB(c);
 valid(mapped);assert.equal(JSON.stringify(c),before);
 const lab=P.toLab(c),roundtrip=P.fromLab(lab).map(v=>Math.round(255*(v<=.0031308?12.92*Math.max(0,v):1.055*Math.max(0,v)**(1/2.4)-.055)));
 assert(delta(c,roundtrip)<=1,'Oklab round trip '+c);
 // 8-bit quantisation contributes up to .0043 L at the darkest samples.
 assert(Math.abs(P.toLab(mapped)[0]-lab[0])<.006,'Lightness preservation '+c);
}
for(let grey=0;grey<=255;grey++)assert.deepEqual(plain(P.mapRGB([grey,grey,grey])),[grey,grey,grey]);
const yellow=P.toLab(P.mapRGB([255,230,0]));
assert(yellow[0]>.85&&Math.hypot(yellow[1],yellow[2])>.14,'Strong bright yellow retained');
assert(Math.hypot(...P.toLab(P.mapRGB([255,0,255])).slice(1))<.23,'Neon magenta compressed');
for(const L of [.3,.6,.85])for(let deg=0;deg<360;deg+=.5){
 const c=h=>P.fromLab([L,.1*Math.cos(h*Math.PI/180),.1*Math.sin(h*Math.PI/180)]).map(v=>Math.round(255*(v<=.0031308?12.92*Math.max(0,v):1.055*Math.max(0,v)**(1/2.4)-.055))).map(v=>Math.min(255,v));
 assert(delta(P.mapRGB(c(deg)),P.mapRGB(c(deg+.5)))<9,'Continuous hue shoulder '+deg);
}
const colours=[[0,0,0],[255,255,255],[245,240,230],[35,55,160],[230,195,24],[170,32,51],[30,160,92]];
for(const a of colours)for(const b of colours)for(const t of [0,.01,.1,.5,.9,.99,1]){
 const aa=a.slice(),bb=b.slice(),c=P.mix(a,b,t);valid(c);
 assert(delta(c,P.mix(b,a,1-t))<=1.75,'Exchange symmetry');
 assert.deepEqual(a,aa);assert.deepEqual(b,bb);
 if(t===0)assert.deepEqual(plain(c),a);if(t===1)assert.deepEqual(plain(c),b);
 assert.deepEqual(plain(P.mix(a,a,t)),a,'Identical-paint identity');
}
const blue=[35,55,160],white=[255,255,255];let previous=P.toLab(blue)[0];
for(let t=.05;t<=1;t+=.05){const L=P.toLab(P.mix(blue,white,t))[0];assert(L>previous,'White tint must lighten');previous=L}
const model=P.createModel();const original=[255,0,255],first=model.mapRGB(original);first[0]=0;
assert.deepEqual(plain(model.mapRGB(original)),plain(P.mapRGB(original)),'Cache result cannot be mutated');
assert.equal(model.stats.cacheHits,1);
console.log('PASS pigment: 4096 colour round trips/gamut cases; 256 neutral values; hue continuity; mixing symmetry, endpoints, tints and cache isolation.');

// Version scope: source planner runs before recolouring; references and all
// switches are restored even if painting fails. Never mutate its input plan.
const A=sandbox.window.AlgoArt,
 originalPlan={connectedFields:[{rgb:[255,0,255],paintRgb:[245,0,245],palette:[[255,0,255]],contour:[{x:1,y:2}]}],
 territories:[],regions:[],gestures:[],accents:[]},before=JSON.stringify(originalPlan);
const planner=()=>originalPlan;
A.planCompositionV5FromSource=planner;
A.renderOilPaintV4=()=>{const plan=A.planCompositionV5FromSource();assert.equal(plan.connectedFields[0].contour,originalPlan.connectedFields[0].contour);return {plan}};
vm.runInNewContext(readFileSync('js/oil-paint-v5.js','utf8'),sandbox);
const rendered=A.renderOilPaintV5({},{});
assert.equal(rendered.version,'oil-paint-v5');assert.equal(JSON.stringify(originalPlan),before);
assert.notDeepEqual(plain(rendered.plan.connectedFields[0].paintRgb),originalPlan.connectedFields[0].paintRgb);
assert.equal(A.planCompositionV5FromSource,planner);assert(!('oilPigmentActive' in A));
const prior={sentinel:true};A.oilPigmentActive=prior;
A.renderOilPaintV4=()=>{throw Error('paint failure')};
assert.throws(()=>A.renderOilPaintV5({},{}),/paint failure/);
assert.equal(A.oilPigmentActive,prior);assert.equal(A.planCompositionV5FromSource,planner);
console.log('PASS V5 scope: original plan intact; success/failure restore planner and prior pigment state.');
