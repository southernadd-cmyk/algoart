import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const A={};
vm.runInNewContext(readFileSync('js/oil-flow-v8.js','utf8'),{window:{AlgoArt:A},performance},{filename:'oil-flow-v8.js'});
assert.equal(typeof A.oilWetFlowV8,'function');
const w=58,h=44,n=w*h;
function canvasContext(data){
 const c={width:w,height:h};
 return {
  canvas:c,
  getImageData(){return {data:new Uint8ClampedArray(data)}},
  putImageData(img){data.set(img.data)},
  createImageData(){return {data:new Uint8ClampedArray(n*4)}},
  bytes:()=>new Uint8ClampedArray(data)
 };
}
function fixture(){
 const pigments=new Uint8ClampedArray(n*4),heights=new Uint8ClampedArray(n*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const z=(y*w+x)*4,painted=x>7&&x<50&&y>7&&y<38,rgba=x<29?[200,62,49]:[41,104,194];
  pigments[z]=painted?rgba[0]:245;pigments[z+1]=painted?rgba[1]:240;
  pigments[z+2]=painted?rgba[2]:230;pigments[z+3]=255;
  heights[z]=heights[z+1]=heights[z+2]=255;
  heights[z+3]=painted?Math.round(160+28*Math.sin(x*.21)*Math.sin(y*.38)):0;
 }
 return {pig:canvasContext(pigments),mask:canvasContext(heights)};
}
const contacts=[{x:28.6,y:21,dx:1,dy:.12,width:30},
 {x:29.2,y:20.5,dx:1,dy:-.2,width:18},
 {x:30,y:25,dx:1,dy:.4,width:22}];
function run(mode){const f=fixture(),beforeColour=f.pig.bytes(),beforeHeight=f.mask.bytes();
 const stats=A.oilWetFlowV8(f.pig,f.mask,[{x:13,y:11,w:4,h:5}],1,{mode,steps:2,contacts});
 return {...f,stats,beforeColour,beforeHeight};}
for(const mode of ['settle','displace','boundary']){
 const a=run(mode),b=run(mode),{stats}=a;
 assert.deepEqual(a.mask.bytes(),b.mask.bytes(),'Heights replay '+mode);
 assert.deepEqual(a.pig.bytes(),b.pig.bytes(),'Pigment replay '+mode);
 assert(stats.paintedPixels>0&&stats.changedHeightPixels>0,'Actual height redistribution '+mode);
 assert(Math.abs(stats.massErrorPct)<.01,'Conserve relief mass '+mode+' '+stats.massErrorPct);
 assert(stats.constrainedToSourcePaint,'Flow is bounded');
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const z=(y*w+x)*4,outside=x<=7||x>=50||y<=7||y>=38,
    protectedRect=x>=13&&x<17&&y>=11&&y<16;
  if(outside||protectedRect){
   for(let c=0;c<4;c++){
    assert.equal(a.pig.bytes()[z+c],a.beforeColour[z+c],'No pigment change outside footprint / protected '+mode);
    assert.equal(a.mask.bytes()[z+c],a.beforeHeight[z+c],'No height change outside footprint / protected '+mode);
   }
  }
 }
 if(mode==='settle')assert.deepEqual(a.pig.bytes(),a.beforeColour,'Height only never changes colour');
 else assert(stats.colourShiftedPixels>0,'Wet pigment displacement visible '+mode);
 if(mode==='boundary')assert(stats.edgeRidges>0,'Physical colour-boundary ridges present');
 console.log('PASS '+mode+' '+JSON.stringify(stats));
}
assert.throws(()=>A.oilWetFlowV8({canvas:{width:2,height:3}},{canvas:{width:3,height:2}},[],1),/dimensions/);
console.log('PASS Oil V8: conservative bounded solver, 3 stages, real displacement, byte-stable negative space, deterministic.');
