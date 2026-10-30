// Oil V7 brush: V3 silhouettes and RNG order, with unused batched colour
// calculations omitted. Independent scratch caches preserve legacy brush state.
// ALGO/ART Oil Paint V3 production cached tooth compositing contacts — not a released material.
// Only Oil V2 activates this renderer. V1 keeps its historical paths/pixels.
// Source mathematics, seeded palettes, protected voids and marks are unchanged.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const PI=Math.PI,TAU=2*PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const shift=(p,nx,ny,d)=>({x:p.x+nx*d,y:p.y+ny*d});
const css=c=>'rgb('+c.map(x=>Math.round(clamp(x,0,255))).join(',')+')';
// Approximate opaque-pigment mixing in linear-light K/S space. No spectral claims.
const linear=v=>{v=clamp(v/255,0,1);return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
const srgb=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
const mixPaint=(a,b,t)=>a.map((v,i)=>{const Ra=Math.max(.001,linear(v)),Rb=Math.max(.001,linear(b[i]));
 const k=(1-t)*(1-Ra)**2/(2*Ra)+t*(1-Rb)**2/(2*Rb);
 return Math.round(clamp(srgb(1+k-Math.sqrt(k*k+2*k)),0,255));});
// Small tone adjustments should not use high-tint-strength K/S darkening.
const mix=(a,b,t)=>A.oilPigmentActive?.tone?A.oilPigmentActive.tone(a,b,t):
 a.map((v,i)=>Math.round(clamp(srgb((1-t)*linear(v)+t*linear(b[i])),0,255)));
// Module caches are kept per canvas backend. Oil V3 always uses the
// 'default' slot exactly as before; Oil V4 renders inside withCPUCanvases()
// and uses the 'cpu' slot, so a canvas created by one version is never
// reused by the other within the same page (no mixed backends).
const toothSlots={
  default:{stencils:[],scratch:null,ctx:null,patterns:[]},
  cpu:{stencils:[],scratch:null,ctx:null,patterns:[]}
};
function toothSlot(){
  return A.cpuCanvasBackendActive===true?toothSlots.cpu:toothSlots.default;
}
function toothStencil(level){
  const slot=toothSlot();
  if(slot.stencils[level])return slot.stencils[level];
  const c=document.createElement('canvas');c.width=30;c.height=30;
  const g=c.getContext('2d'),img=g.createImageData(30,30);
  const threshold=.32+.075*level;
  for(let y=0;y<30;y++)for(let x=0;x<30;x++){
    // Fixed canvas-space ground weave. No stroke phase or per-hair seed.
    const tooth=.5+.5*Math.cos(x*2*Math.PI/5)*Math.cos(y*2*Math.PI/6);
    const alpha=clamp((tooth-threshold)*5,0,1);
    const i=(y*30+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=255;
    img.data[i+3]=Math.round(alpha*255);
  }
  g.putImageData(img,0,0);return slot.stencils[level]=c;
}
// Reuse bounded tiles rather than a full-resolution scratch surface.
function cachedToothPattern(ctx,level){
  // Patterns belong to a context. Recreate only on scratch resize.
  const slot=toothSlot();
  return slot.patterns[level]||(slot.patterns[level]=ctx.createPattern(toothStencil(level),'repeat'));
}
function depositToothed(pig,mask,path,color,opacity,height,level,box){
  const W=pig.canvas.width,H=pig.canvas.height;
  const x=clamp(Math.floor(box.x),0,W),y=clamp(Math.floor(box.y),0,H);
  const right=clamp(Math.ceil(box.x+box.w),x,W);
  const bottom=clamp(Math.ceil(box.y+box.h),y,H);
  const w=right-x,h=bottom-y;if(w<=0||h<=0)return;
  const slot=toothSlot();
  // Allocate only the stroke bounding box, not the entire artwork.
  if(!slot.scratch||slot.scratch.width<w||slot.scratch.height<h){
    // Both slots use the historical resize rule. Growing to the larger of
    // old/new sizes was tested and CHANGES pixels (scratch size affects
    // anti-aliasing at its edge), so V4 must not alter it.
    slot.scratch=document.createElement('canvas');
    slot.scratch.width=w;slot.scratch.height=h;
    slot.ctx=slot.scratch.getContext('2d');
    slot.patterns.length=0;
  }
  const toothScratch=slot.scratch;
  const s=slot.ctx,m=pig.getTransform();
  s.setTransform(1,0,0,1,-x,-y);
  s.globalAlpha=1;s.globalCompositeOperation='source-over';
  s.clearRect(x,y,w,h);
  s.setTransform(m.a,m.b,m.c,m.d,m.e-x,m.f-y);
  s.fillStyle='#fff';s.fill(path);
  s.setTransform(1,0,0,1,-x,-y);
  s.globalCompositeOperation='destination-in';
  s.fillStyle=cachedToothPattern(s,level);
  s.fillRect(x,y,w,h);
  s.globalCompositeOperation='source-in';
  s.fillStyle=css(color);s.fillRect(x,y,w,h);
  s.globalCompositeOperation='source-over';
  for(const [ctx,alpha] of [[pig,opacity],[mask,height]]){
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=clamp(alpha,0,1);
    ctx.drawImage(toothScratch,0,0,w,h,x,y,w,h);
    ctx.restore();
  }
}
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
  const refined=options.refined===true;
  // Detail is concentrated at the ends of hairs. Fewer vertices in the
  // interior keep path construction affordable, including on mobile.
  const stride=refined?((A.oilStageCScale||1)<=1?3:2):
    ((A.oilStageCScale||1)<=1?2:1);
  for(let i=first;i<=end;i+=stride){
    const frame=frames[i],u=(i-first)/Math.max(1,end-first);
    const begin=Math.min(1,u*5),finish=Math.min(1,(1-u)*7);
    const edge=options.body ? (.08+.92*Math.min(1,(1-u)*5)) :
      (.22+.78*Math.min(begin,finish));
    const wave=.96+.055*Math.sin(frame.s*(options.frequency||.063)+options.phase);
    // Bristle tension follows the CURVED brush tangent. Two correlated
    // frequencies give non-identical bends without independent jitter at
    // each sample (which would produce a pixel-grid sawtooth).
    const bend=refined?(options.bendAmplitude||0)*(.24+.76*u*u)*
      (.68*Math.sin(frame.s*(options.frequency||.063)*.43+options.phase*.91)+
       .32*Math.sin(frame.s*(options.frequency||.063)*1.29+options.phase*1.71)):0;
    const lateral=offset+options.splay*
      Math.sin(frame.s*(options.frequency||.063)*.62+options.phase)+bend;
    // Less pressure and exhausted pigment narrow the actual contact.
    const contact=refined?(.70+.30*frame.pressure)*
      (1-.24*u*(options.depletion||0)):1;
    const half=width*.5*edge*wave*xscale*contact;
    left.push(shift(frame,frame.nx,frame.ny,lateral-half));
    right.push(shift(frame,frame.nx,frame.ny,lateral+half));
  }
  // Keep each hair's actual terminal station, even at adaptive sampling.
  if((end-first)%stride!==0){
    const frame=frames[end],u=1,edge=options.body?.08:.22,
      lateral=offset+options.splay*Math.sin(frame.s*(options.frequency||.063)*.62+options.phase)+
        (refined?(options.bendAmplitude||0)*.58*
        Math.sin(frame.s*(options.frequency||.063)*.43+options.phase*.91):0),
      half=width*.5*edge*(refined?(.70+.30*frame.pressure)*
        (1-.24*(options.depletion||0)):1);
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
    Math.sin(lastFrame.s*(options.frequency||.063)*.62+options.phase)+
    (refined?(options.bendAmplitude||0)*.58*
    Math.sin(lastFrame.s*(options.frequency||.063)*.43+options.phase*.91):0);
  const tipLength=options.tipLength;
  // Each bristle bends at its own lifting tip. The exit angle remains
  // predominantly longitudinal, avoiding the radial "sunray" artifact.
  const terminalLean=refined?options.tipLean*1.30:options.tipLean;
  path.quadraticCurveTo(
    lastFrame.x+lastFrame.tx*tipLength*.68+
      lastFrame.nx*(terminalOffset+terminalLean),
    lastFrame.y+lastFrame.ty*tipLength*.68+
      lastFrame.ny*(terminalOffset+terminalLean),
    lastFrame.x+lastFrame.tx*tipLength+
      lastFrame.nx*(terminalOffset+terminalLean*.45),
    lastFrame.y+lastFrame.ty*tipLength+
      lastFrame.ny*(terminalOffset+terminalLean*.45));
  path.lineTo(right[right.length-1].x,right[right.length-1].y);
  for(let i=right.length-2;i>=0;i--)path.lineTo(right[i].x,right[i].y);
  path.closePath();
  return path;
}
function drawContactBrushV2(pig,mask,points,width,rgb,profile,r,options={}){
  const start=performance.now();
  const refined=A.oilStageDRefinement===true;
  const original=A.oilPaintV4ETest;
  const frames=original.buildBrushFrames(points,width);
  if(frames.length<3)return {
    bristleRuns:0,bristleContacts:0,contactFootprints:0,loadStart:0,
    loadEnd:0,pressureMin:0,pressureMax:0
  };
  const total=Math.max(.001,frames[frames.length-1].s);
  const phase=r.range(0,TAU);
  // Brush-scale and stroke-specific wavelengths prevent canvas-wide stripes.
  const frequency=clamp(.063*32/Math.max(width,8)*r.range(.70,1.40),.009,.16);
  const thickness=clamp(options.thickness??.90,0,1);
  const dryness=clamp(options.drag??.72,0,1);
  const physicalWidth=width*(A.oilStageCScale||1);
  const narrow=physicalWidth<22;
  const sourceCount=narrow?12:(profile==='knife'?26:profile==='dry'?34:
    profile==='flat'?32:30);
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
  let exhausted=0,bent=0,gaps=0;
  // Find a travel station in O(log N) rather than scanning the complete
  // sampled stroke once for every physical hair.
  function atDistance(d){
    let lo=0,hi=frames.length-1;
    while(lo<hi){
      const mid=(lo+hi)>>1;
      if(frames[mid].s<d)lo=mid+1;else hi=mid;
    }
    return lo;
  }
  // Fine hairs alone leave postage-stamp holes in the body of a flat brush.
  // Thin translucent under-contacts provide a coherent loaded paint mass,
  // but stop before the end so the *individual bristle tips* stay visible.
  const baseBodies=profile==='dry'?2:3;
  for(let b=0;b<baseBodies;b++){
    const idx=Math.floor(frames.length*(.89+r.range(0,.045)));
    const body=makeRibbon(frames,0,idx,
      (b-(baseBodies-1)/2)*width*.21,
      width*(profile==='knife'?.41:.46),r,{
       body:true,phase:r.range(0,TAU),frequency,splay:width*.010,
       tipLength:width*r.range(.05,.12),tipLean:r.range(-.016,.016)*width
      });
    if(!body)continue;
    const col=mix(rgb,b===1?[247,228,200]:[52,43,39],b===1?.035:.025);
    // Connected, loaded body stays opaque. The final 15-22% of travel
    // exposes individual hairs, not a brush-wide flush polygon.
    deposit(pig,mask,body,col,profile==='dry'?.28:(.72+.12*thickness),
      profile==='dry'?.18:(.42+.16*thickness));
    footprints++;
  }
  // Hundreds of Path2D fill calls per brush defeat the fast Stage B core.
  // Batch *real individual hair silhouettes*, not cosmetic highlight lines:
  // three colour/height layers each hold a set of disjoint, independently
  // length-varied hair contacts. Geometry is unchanged by batching.
  const groupTotal=narrow?4:12;
  const grouped=Array.from({length:groupTotal},()=>new Path2D());
  const groupCounts=Array(groupTotal).fill(0);
  const m=pig.getTransform(),margin=width*1.7;
  const minX=Math.min(...frames.map(f=>f.x))-margin;
  const minY=Math.min(...frames.map(f=>f.y))-margin;
  const maxX=Math.max(...frames.map(f=>f.x))+margin;
  const maxY=Math.max(...frames.map(f=>f.y))+margin;
  const box={x:minX*m.a+m.e,y:minY*m.d+m.f,
    w:(maxX-minX)*m.a,h:(maxY-minY)*m.d};
  let toothDeposits=0;
  const batch=A.oilStageCNoBatch!==true;
  for(let hair=0;hair<sourceCount;hair++){
    const lane=(hair+.5)/sourceCount-.5;
    const outer=Math.abs(lane)*2;
    const lateral=(lane*.86+r.range(-.008,.008))*width;
    // Widths are narrower than their spacing; overlapping hairs sometimes
    // join, but their ends remain separate and staggered. Central hairs
    // are more likely to carry paint beyond the brush body.
    const filamentWidth=(width/sourceCount)*
      r.range(profile==='dry'?.48:.80,profile==='knife'?1.22:1.40)*
      (1-.12*Math.pow(outer,1.45));
    const startDistance=width*r.range(0,profile==='dry'?.35:.19);
    const endRetreat=width*r.range(0,profile==='dry'?.80:.55)*
      (.62+.38*outer);
    const terminalDistance=Math.max(total*.63,total-endRetreat);
    // Broad, loaded paint already occupies the heel. Fine physical
    // filaments begin farther along the stroke where they matter visibly.
    const contactStart=refined?Math.min(total*.43,
      Math.max(startDistance,total*(profile==='dry'?.32:.26))):
      startDistance;
    // Very short strokes can be shorter than a bristle's start offset.
    // Keep at least three sampled frames available for the terminal ribbon.
    const begin=Math.min(frames.length-3,refined?atDistance(contactStart):
      Math.max(0,frames.findIndex(f=>f.s>=startDistance)));
    let last=refined?atDistance(terminalDistance):
      frames.findIndex(f=>f.s>=terminalDistance);
    if(last<0)last=frames.length-1;
    last=Math.max(begin+2,Math.min(last,frames.length-1));
    const initial=r.range(.71,1.25)*(profile==='dry'?.75:1.0);
    const tipLength=width*r.range(.035,.58)*
      (1-.28*outer)*(profile==='knife'?.58:1);
    const tone=r.range(.009,.067); // stochastic, non-uniform pigment loading
    const target=r.chance(.44)?[51,40,32]:[255,237,209];
    const colour=batch?null:mix(rgb,target,tone);
    const wavePhase=r.range(0,TAU);
    const splay=r.range(.002,.018)*width;
    const tipLean=r.range(-.027,.027)*width;
    const bendAmplitude=refined?width*r.range(.006,.022):0;
    const depletion=refined?clamp(
      .23+.39*(frames[last]?.s||total)/total+
      .19*outer+r.range(-.13,.13),.08,.94):0;
    if(refined&&bendAmplitude) bent++;
    if(refined&&depletion>.57)exhausted++;
    // Some dry paint-starved hairs lift before touching the end. No
    // per-frame independent RNG means no square-pixel / sawtooth edges.
    const missing=profile==='dry'?.10:.04;
    const skipped=r.chance(missing);
    if(skipped){loadStart+=initial;loadEnd+=0;continue}
    let effectiveEnd=last;
    // One coherent break along a minority of dry strands, rather than
    // thousands of random per-frame contact decisions.
    let skipFirst=-1,skipLast=-1;
    if(r.chance(profile==='dry'?.18:dryness*.07)){
      const middle=r.range(.29,.67);
      const gap=r.range(.028,.095);
      skipFirst=Math.floor(begin+(effectiveEnd-begin)*middle);
      skipLast=Math.min(effectiveEnd,skipFirst+Math.max(1,Math.round(frames.length*gap)));
      if(refined)gaps++;
    }
    let fragments=skipFirst>=0?
      [[begin,Math.max(begin+1,skipFirst-1)],
       [Math.min(skipLast+1,effectiveEnd),effectiveEnd]]:
      [[begin,effectiveEnd]];
    for(const [first,end] of fragments){
      if(end-first<2)continue;
      const path=makeRibbon(frames,first,end,lateral,filamentWidth,r,{
        phase:wavePhase,frequency,splay,tipLength:end===effectiveEnd?tipLength:filamentWidth*.28,
        tipLean,body:false,xscale:1,refined,bendAmplitude,depletion
      });
      if(!path)continue;
      // Depletion is tied to travel/pressure, not random light-colored pen lines.
      const averageS=(frames[first].s+frames[end].s)*.5/total;
      const averageLoad=clamp(initial*(1-(refined?.67:.54)*averageS)*
        (refined?(1-.24*depletion):1),.10,1.36);
      const alpha=clamp((.67+.23*averageLoad)*(.72+.28*thickness),.34,.97);
      const relief=clamp((.21+.43*averageLoad)*(.62+.38*thickness),.12,.85);
      if(batch){
        // Three source-palette tone bands by two actual load levels:
        // dry tips are lighter and thinner, rather than all 30 hairs
        // sharing a single opaque overlay or three decorative stripes.
        // Low-frequency lateral bands: correlated, but non-periodic across hairs.
        const drift=Math.sin(lane*5.3+phase)*.70+Math.sin(lane*11.7-phase*.63)*.30;
        const band=clamp(Math.floor(1.5+1.45*drift),0,2);
        const group=narrow?((averageLoad<.56?2:0)+(hair&1)):
          ((averageLoad<.56?6:0)+band*2+(hair&1));
        grouped[group].addPath(path);
        groupCounts[group]++;
      }else{
        deposit(pig,mask,path,colour,alpha,relief);
      }
      runs++;footprints++;
      contacts+=end-first+1;
    }
    loadStart+=initial;
    loadEnd+=initial*(1-.54*frames[effectiveEnd].s/total);
  }
  if(batch){
    for(let g=0;g<groupTotal;g++){
      if(!groupCounts[g])continue;
      const tone=narrow?0:Math.floor((g%6)/2);
      const isDry=narrow?g>=2:g>=6;
      const colour=tone===0?(isDry?mix(rgb,[243,225,196],.105):rgb):
        tone===1?mix(rgb,[247,233,209],isDry?.10:.046):
        mix(rgb,[52,44,35],isDry?.020:.05);
      const alpha=(.72+.09*thickness)*(profile==='dry'?.75:1)*(isDry?.46:1);
      const relief=(.33+.19*thickness)*(profile==='dry'?.72:1)*(isDry?.45:1);
      if(profile==='dry'||isDry){
        depositToothed(pig,mask,grouped[g],colour,alpha,relief,
          profile==='dry'?(isDry?2:1):1,box);
        toothDeposits++;
      }else deposit(pig,mask,grouped[g],colour,alpha,relief);
    }
  }
  // Stats are captured independently from V1. Drawn filament runs have
  // real pigment/relief support; they are not three grouped highlight paths.
  if(A.oilStageCStats){
    const s=A.oilStageCStats;
    s.brushCalls=(s.brushCalls||0)+1;
    if(narrow)s.narrowBrushCalls=(s.narrowBrushCalls||0)+1;
    if(profile==='dry')s.dryRuns=(s.dryRuns||0)+1;
    s.toothDeposits=(s.toothDeposits||0)+toothDeposits;
    s.physicalHairs=(s.physicalHairs||0)+sourceCount;
    s.runs=(s.runs||0)+runs;
    s.footprints=(s.footprints||0)+footprints;
    s.brushMs=(s.brushMs||0)+performance.now()-start;
    s.tipVaried=(s.tipVaried||0)+sourceCount;
    s.batchPaintCalls=(s.batchPaintCalls||0)+
      (batch?groupCounts.filter(Boolean).length:runs);
    s.batchEnabled=batch;
    s.refined=refined;
    s.bent=(s.bent||0)+bent;
    s.exhausted=(s.exhausted||0)+exhausted;
    s.dryGaps=(s.dryGaps||0)+gaps;
  }
  return {bristleRuns:runs,bristleContacts:contacts,
    contactFootprints:footprints,
    loadStart:+(loadStart/sourceCount).toFixed(3),
    loadEnd:+(loadEnd/sourceCount).toFixed(3),
    pressureMin:+pMin.toFixed(3),pressureMax:+pMax.toFixed(3)};
}
if(!A.oilPaintV4ETest?.buildBrushFrames)
  throw Error('Oil Stage C must load after genuine Oil V1 core scripts');
A.oilPaintV4ETest.drawContactBrushV7=drawContactBrushV2;
// Oil V3's output depends on the tooth scratch left over from the PREVIOUS
// render in the page (scratch size affects anti-aliasing), so the first V3
// render after loading differs from later renders of the same seed. Oil V4
// clears its own (CPU) slot before every render, making each V4 render equal
// to a first render. The default (V3) slot is never touched here.
A.oilPaintV4ETest.resetV7ToothSlot=function(name){
  const slot=toothSlots[name];if(!slot)throw Error('Unknown tooth slot '+name);
  slot.scratch=null;slot.ctx=null;slot.patterns.length=0;
};
A.oilPaintStageV7Test={makeRibbon,drawContactBrushV7:drawContactBrushV2};
})(window.AlgoArt);

