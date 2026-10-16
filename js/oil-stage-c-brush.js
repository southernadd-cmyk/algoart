// ALGO/ART Oil Stage C — experimental individual bristle contacts.
// This script is injected ONLY in the Playwright experiment and is NOT
// referenced by index.html, gallery publishing or the public editor.
// Composition, source palettes, Oil v1 and existing share links stay untouched.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const PI=Math.PI,TAU=2*PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const shift=(p,nx,ny,d)=>({x:p.x+nx*d,y:p.y+ny*d});
const css=c=>'rgb('+c.map(x=>Math.round(clamp(x,0,255))).join(',')+')';
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
function deposit(pig,mask,path,color,opacity,height){
  // A true paint footprint: BOTH pigment and height originate in the exact
  // same bristle contour. No highlight lines painted over a fake solid tip.
  pig.globalAlpha=clamp(opacity,0,1);
  pig.fillStyle=css(color);
  pig.fill(path);
  mask.globalAlpha=clamp(height,0,1);
  mask.fillStyle='#fff';
  mask.fill(path);
}
function makeRibbon(frames,first,last,offset,width,r,options){
  // Body / hair is a tapered physical strip in tangential coordinates.
  const left=[],right=[],count=frames.length;
  const end=Math.max(first+1,Math.min(count-1,last));
  const xscale=options.xscale||1;
  for(let i=first;i<=end;i++){
    const frame=frames[i],u=(i-first)/Math.max(1,end-first);
    const begin=Math.min(1,u*5),finish=Math.min(1,(1-u)*7);
    const edge=options.body ? (.78+.22*Math.min(begin,finish)) :
      (.22+.78*Math.min(begin,finish));
    const wave=.96+.055*Math.sin(frame.s*.063+options.phase);
    const lateral=offset+options.splay*
      Math.sin(frame.s*.039+options.phase);
    const half=width*.5*edge*wave*xscale;
    left.push(shift(frame,frame.nx,frame.ny,lateral-half));
    right.push(shift(frame,frame.nx,frame.ny,lateral+half));
  }
  const path=new Path2D();
  if(left.length<2)return null;
  path.moveTo(left[0].x,left[0].y);
  for(let i=1;i<left.length;i++)path.lineTo(left[i].x,left[i].y);
  const lastFrame=frames[end];
  // End position and direction depend on this hair's terminal contact.
  // Staggered, non-square tips; not radial rays or a common flush edge.
  const terminalOffset=offset+options.splay*
    Math.sin(lastFrame.s*.039+options.phase);
  const tipLength=options.tipLength;
  path.quadraticCurveTo(
    lastFrame.x+lastFrame.tx*tipLength*.68+
      lastFrame.nx*(terminalOffset+options.tipLean),
    lastFrame.y+lastFrame.ty*tipLength*.68+
      lastFrame.ny*(terminalOffset+options.tipLean),
    lastFrame.x+lastFrame.tx*tipLength+
      lastFrame.nx*(terminalOffset+options.tipLean*.45),
    lastFrame.y+lastFrame.ty*tipLength+
      lastFrame.ny*(terminalOffset+options.tipLean*.45));
  path.lineTo(right[right.length-1].x,right[right.length-1].y);
  for(let i=right.length-2;i>=0;i--)path.lineTo(right[i].x,right[i].y);
  path.closePath();
  return path;
}
function drawContactBrushV2(pig,mask,points,width,rgb,profile,r,options={}){
  const start=performance.now();
  const original=A.oilPaintV4ETest;
  const frames=original.buildBrushFrames(points,width);
  if(frames.length<3)return {
    bristleRuns:0,bristleContacts:0,contactFootprints:0,loadStart:0,
    loadEnd:0,pressureMin:0,pressureMax:0
  };
  const total=Math.max(.001,frames[frames.length-1].s);
  const phase=r.range(0,TAU);
  const thickness=clamp(options.thickness??.90,0,1);
  const dryness=clamp(options.drag??.72,0,1);
  const sourceCount=profile==='knife'?26:profile==='dry'?34:
    profile==='flat'?32:30;
  // The count is physical, NOT 3 batched cosmetic lines. Even the
  // fine endings deposit pigment and relief in their own silhouettes.
  let pMin=2,pMax=0;
  for(const frame of frames){
    const nx=-Math.sin(frame.angle),ny=Math.cos(frame.angle);
    frame.nx=nx;frame.ny=ny;
    frame.tx=Math.cos(frame.angle);frame.ty=Math.sin(frame.angle);
    frame.pressure=original.pressureAt(frame.s,total,phase,profile);
    pMin=Math.min(pMin,frame.pressure);
    pMax=Math.max(pMax,frame.pressure);
  }
  let runs=0,contacts=0,footprints=0,loadStart=0,loadEnd=0;
  // Fine hairs alone leave postage-stamp holes in the body of a flat brush.
  // Thin translucent under-contacts provide a coherent loaded paint mass,
  // but stop before the end so the *individual bristle tips* stay visible.
  const baseBodies=profile==='dry'?2:3;
  for(let b=0;b<baseBodies;b++){
    const idx=Math.floor(frames.length*(.64+r.range(0,.10)));
    const body=makeRibbon(frames,0,idx,
      (b-(baseBodies-1)/2)*width*.24,
      width*(profile==='knife'?.32:.35),r,{
       body:true,phase:r.range(0,TAU),splay:width*.012,
       tipLength:width*r.range(.05,.16),tipLean:r.range(-.02,.02)*width
      });
    if(!body)continue;
    const col=mix(rgb,b===1?[247,228,200]:[52,43,39],b===1?.035:.025);
    deposit(pig,mask,body,col,.37+.08*thickness,.16+.14*thickness);
    footprints++;
  }
  for(let hair=0;hair<sourceCount;hair++){
    const lane=(hair+.5)/sourceCount-.5;
    const outer=Math.abs(lane)*2;
    const lateral=(lane*.955+r.range(-.011,.011))*width;
    // Widths are narrower than their spacing; overlapping hairs sometimes
    // join, but their ends remain separate and staggered. Central hairs
    // are more likely to carry paint beyond the brush body.
    const filamentWidth=(width/sourceCount)*
      r.range(profile==='dry'?.38:.67,profile==='knife'?1.14:1.27)*
      (1-.20*Math.pow(outer,1.65));
    const startDistance=width*r.range(0,profile==='dry'?.35:.19);
    const endRetreat=width*r.range(0,profile==='dry'?.80:.55)*
      (.62+.38*outer);
    const terminalDistance=Math.max(total*.63,total-endRetreat);
    const begin=Math.max(0,frames.findIndex(f=>f.s>=startDistance));
    let last=frames.findIndex(f=>f.s>=terminalDistance);
    if(last<0)last=frames.length-1;
    last=Math.max(begin+2,Math.min(last,frames.length-1));
    const initial=r.range(.71,1.25)*(profile==='dry'?.75:1.0);
    const tipLength=width*r.range(.035,.58)*
      (1-.28*outer)*(profile==='knife'?.58:1);
    const tone=r.range(.009,.067);
    const target=r.chance(.44)?[51,40,32]:[255,237,209];
    const colour=mix(rgb,target,tone);
    const wavePhase=r.range(0,TAU);
    const splay=r.range(.002,.018)*width;
    const tipLean=r.range(-.027,.027)*width;
    // Some dry paint-starved hairs lift before touching the end. No
    // per-frame independent RNG means no square-pixel / sawtooth edges.
    const missing=profile==='dry'?.16:.045;
    const skipped=r.chance(missing);
    if(skipped){loadStart+=initial;loadEnd+=0;continue}
    let effectiveEnd=last;
    // One coherent break along a minority of dry strands, rather than
    // thousands of random per-frame contact decisions.
    let skipFirst=-1,skipLast=-1;
    if(r.chance(profile==='dry'?.28:dryness*.085)){
      const middle=r.range(.29,.67);
      const gap=r.range(.028,.095);
      skipFirst=Math.floor((begin+effectiveEnd)*middle);
      skipLast=Math.min(effectiveEnd,skipFirst+Math.max(1,Math.round(frames.length*gap)));
    }
    const fragments=skipFirst>=0?
      [[begin,Math.max(begin+1,skipFirst-1)],
       [Math.min(skipLast+1,effectiveEnd),effectiveEnd]]:
      [[begin,effectiveEnd]];
    for(const [first,end] of fragments){
      if(end-first<2)continue;
      const path=makeRibbon(frames,first,end,lateral,filamentWidth,r,{
        phase:wavePhase,splay,tipLength:end===effectiveEnd?tipLength:filamentWidth*.28,
        tipLean,body:false,xscale:1
      });
      if(!path)continue;
      // Depletion is tied to travel/pressure, not random light-colored pen lines.
      const averageS=(frames[first].s+frames[end].s)*.5/total;
      const averageLoad=clamp(initial*(1-.54*averageS),.10,1.36);
      const alpha=clamp((.67+.23*averageLoad)*(.72+.28*thickness),.34,.97);
      const relief=clamp((.21+.43*averageLoad)*(.62+.38*thickness),.12,.85);
      deposit(pig,mask,path,colour,alpha,relief);
      runs++;footprints++;
      contacts+=end-first+1;
    }
    loadStart+=initial;
    loadEnd+=initial*(1-.54*frames[effectiveEnd].s/total);
  }
  // Stats are captured independently from V1. Drawn filament runs have
  // real pigment/relief support; they are not three grouped highlight paths.
  if(A.oilStageCStats){
    const s=A.oilStageCStats;
    s.brushCalls=(s.brushCalls||0)+1;
    s.physicalHairs=(s.physicalHairs||0)+sourceCount;
    s.runs=(s.runs||0)+runs;
    s.footprints=(s.footprints||0)+footprints;
    s.brushMs=(s.brushMs||0)+performance.now()-start;
    s.tipVaried=(s.tipVaried||0)+sourceCount;
  }
  return {bristleRuns:runs,bristleContacts:contacts,
    contactFootprints:footprints,
    loadStart:+(loadStart/sourceCount).toFixed(3),
    loadEnd:+(loadEnd/sourceCount).toFixed(3),
    pressureMin:+pMin.toFixed(3),pressureMax:+pMax.toFixed(3)};
}
if(!A.oilPaintV4ETest?.buildBrushFrames)
  throw Error('Oil Stage C must load after genuine Oil V1 core scripts');
A.oilPaintV4ETest.drawContactBrushV2=drawContactBrushV2;
A.oilPaintStageCTest={makeRibbon,drawContactBrushV2};
})(window.AlgoArt);
