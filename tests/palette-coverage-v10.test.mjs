// Renderer V10 colour-coverage and V9 source-geometry regression.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const scripts=['random','phi','palettes','marker','generator','oil-surface',
  'oil-material','oil-render'];
const context={window:{AlgoArt:{}}};
for(const name of scripts){
  runInNewContext(readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'),
    context,{filename:name+'.js'});
}
const A=context.window.AlgoArt;
A.supportedRendererVersions=[1,2,3,4,5,6,7,8,9,10];
function canvas(){
  const c=new Proxy({},{
    get(obj,key){
      if(key in obj)return obj[key];
      return (...args)=>{};
    },
    set(obj,key,value){obj[key]=value;return true;}
  });
  return {width:0,height:0,getContext:()=>c};
}
const base={
  seed:'V10-PALETTE-REGRESSION',orientation:'landscape',elements:42,
  density:65,complexity:70,negativeSpace:35,phiStrength:82,
  recursion:5,spiralInfluence:65,goldenAngle:76,nesting:45,
  pen:'felt',thickness:8,wobble:24,overdraw:2,opacity:88,
  pressure:20,dryness:10,curveBias:55,shapeAmount:55,
  overlap:40,rotation:50,lines:true,circles:true,
  rectangles:true,polygons:true,arcs:true,palette:'primary',
  colourCount:12,saturation:78,brightness:53,
  paper:'#f5f0e6',grain:0
};
function draw(version,mode){
  const state={...base,mode};
  A.rendererVersion=version;
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  A.render(canvas(),state,.1,false);
  const paths=A.svgRecorder.paths;
  A.svgRecorder=null;
  return {state,paths,marks:new Set(paths.map(p=>p.mark)).size,
    inks:new Set(paths.map(p=>p.stroke)),
    geometry:paths.map(p=>p.d+'|'+p.width+'|'+p.opacity).join('\n')};
}
for(const name of ['primary','cmyk','warm','cold','earth','marker',
  'neon','pastel','spectrum','golden','mono']){
  A.rendererVersion=9;
  const old=A.hues({...base,palette:name},A.makeR('V10-PALETTE'));
  A.rendererVersion=10;
  const next=A.hues({...base,palette:name},A.makeR('V10-PALETTE'));
  assert.equal(next.length,12,name+' missing colours');
  assert.equal(new Set(next).size,12,name+' repeats inks at 12');
  if(['primary','cmyk'].includes(name))
    assert.ok(new Set(old).size<12,name+' V9 baseline changed unexpectedly');
  if(name==='mono')assert(next.every(c=>/ 0% /.test(c)),'Monochrome lost its greys');
}
const report=[];
for(const mode of ['field','spiral','rects','burst','network',
  'scribble','organic','geometric']){
  const v9=draw(9,mode),v10=draw(10,mode);
  assert.equal(v10.geometry,v9.geometry,mode+' geometry/opacity changed');
  assert.equal(v10.paths.length,v9.paths.length,mode+' source count changed');
  assert.equal(v10.marks,v9.marks,mode+' mark count changed');
  if(v10.marks>=12){
    assert.equal(v10.inks.size,12,mode+' is missing requested pigments');
  }
  if(v10.marks>0)
    assert.equal(v10.inks.size,Math.min(12,v10.marks),
      mode+' unexpected palette collapse');
  if(mode==='network'&&v10.marks>=12){
    const kit=A.tissueKitFromPaths(v10.paths,v10.state,7);
    assert.equal(kit.ink.length,12,
      'Tissue & Graphite received fewer pigments than source drawing');
  }
  report.push(mode+': '+v10.inks.size+' inks / '+v10.marks+' source marks');
}
console.log('V10 palette coverage:',report.join('; '));
console.log('V9 geometry and previous named palette behavior preserved.');
