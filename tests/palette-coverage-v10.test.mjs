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
function canvas(strokes){
  const c=new Proxy({},{
    get(obj,key){
      if(key==='stroke'&&strokes)return ()=>strokes.push(obj.strokeStyle);
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
  colourCount:14,saturation:78,brightness:53,
  paper:'#f5f0e6',grain:0
};
function draw(version,mode,colourCount,palette=base.palette){
  const state={...base,mode,colourCount,palette};
  A.rendererVersion=version;
  A.svgRecorder={precise:true,paths:[],paperMarks:[]};
  A.render(canvas(),state,.1,false);
  const paths=A.svgRecorder.paths;
  A.svgRecorder=null;
  return {state,paths,marks:new Set(paths.map(p=>p.mark)).size,
    inks:new Set(paths.map(p=>p.stroke)),
    geometry:paths.map(p=>p.d+'|'+p.width+'|'+p.opacity).join('\n')};
}
const modes=['field','spiral','rects','burst','network',
  'scribble','organic','geometric'];
const palettes=['primary','cmyk','warm','cold','earth','marker',
  'neon','pastel','spectrum','golden','mono'];
// The Colour slider ranges to FOURTEEN, not twelve. Verify every setting,
// including the maximum, produces that number of unique source pigments.
for(const name of palettes){
  for(let colourCount=1;colourCount<=14;colourCount++){
    A.rendererVersion=10;
    const requested={...base,palette:name,colourCount};
    const next=A.hues(requested,A.makeR('V10-PALETTE'));
    assert.equal(next.length,colourCount,name+' missing colours at '+colourCount);
    assert.equal(new Set(next).size,colourCount,
      name+' repeats inks at '+colourCount);
    const hues=next.map(c=>{
      const parsed=/^hsl\\(([-.\\d]+) ([-.\\d]+)% ([-.\\d]+)%\\)$/.exec(c);
      assert(parsed,'Expected parseable source HSL pigment '+name+': '+c);
      return {h:Number(parsed[1]),s:Number(parsed[2]),l:Number(parsed[3])};
    });
    if(name==='mono'){
      assert(hues.every(c=>c.s===0),'Monochrome must remain neutral grayscale');
      assert.equal(new Set(hues.map(c=>c.l)).size,colourCount,
        'Monochrome must offer '+colourCount+' distinct grey values');
    }else{
      assert.equal(new Set(hues.map(c=>c.h)).size,colourCount,
        name+' must use '+colourCount+' distinct hue ANGLES, not value/chroma shifts');
      for(let i=0;i<hues.length;i++)for(let j=i+1;j<hues.length;j++){
        const span=Math.abs(hues[i].h-hues[j].h);
        const circularSeparation=Math.min(span,360-span);
        assert(circularSeparation>=6-1e-7,
          name+' '+colourCount+' hues too close: '+hues[i].h+' and '+hues[j].h);
      }
    }
  }
  A.rendererVersion=9;
  const old=A.hues({...base,palette:name,colourCount:14},A.makeR('V10-PALETTE'));
  if(['primary','cmyk'].includes(name))
    assert.ok(new Set(old).size<14,name+' V9 baseline changed unexpectedly');
}
const report=[];
for(const colourCount of [12,14]){
  for(const mode of modes){
    const v9=draw(9,mode,colourCount),v10=draw(10,mode,colourCount);
    assert.equal(v10.geometry,v9.geometry,mode+' geometry/opacity changed at '+colourCount);
    assert.equal(v10.paths.length,v9.paths.length,mode+' source count changed');
    assert.equal(v10.marks,v9.marks,mode+' mark count changed');
    assert.equal(v10.inks.size,Math.min(colourCount,v10.marks),
      mode+' palette collapsed at '+colourCount);
    if(mode==='field'){
      const hero=new Set(v10.paths.filter(p=>p.group?.tier==='hero').map(p=>p.stroke));
      const heroMarks=new Set(v10.paths.filter(p=>p.group?.tier==='hero').map(p=>p.mark)).size;
      if(heroMarks>=2)assert.ok(hero.size>=2,'Hero forms still collapse to one hue');
      const direct=[];
      A.rendererVersion=10;A.svgRecorder=null;
      A.render(canvas(direct),v10.state,.1,false);
      assert.deepEqual(direct,v10.paths.map(p=>p.stroke),
        'Marker colours differ depending on SVG material capture at '+colourCount);
    }
    if(mode==='network'&&v10.marks>=colourCount){
      const kit=A.tissueKitFromPaths(v10.paths,v10.state,7);
      assert.equal(kit.ink.length,colourCount,
        'Tissue & Graphite received fewer pigments than '+colourCount);
    }
    report.push(mode+': '+v10.inks.size+' inks / '+v10.marks+' marks at '+colourCount);
  }
}
// Check every hue family survives every engine at the slider maximum,
// not only the primary palette used in the single material preview seed.
for(const palette of palettes){
  for(const mode of modes){
    const result=draw(10,mode,14,palette);
    assert.equal(result.inks.size,Math.min(14,result.marks),
      palette+'/'+mode+' dropped one of 14 source pigments');
  }
}
console.log('V10 14-hue engine coverage: all 11 palettes × 8 engines. Mono stays 14 greys.');
console.log('V10 palette coverage 1–14 (all palette families), 12/14 (all modes):',report.join('; '));
console.log('V9 geometry and previous named palette behavior preserved.');
