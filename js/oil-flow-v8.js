// Oil V8 experiment: bounded post-contact wet-paint settling and displacement.
// Independent physical model, inspired by the thin-film approach discussed in
// Vitalii Samolovskikh's Pour Dreams; no third-party code or assets copied.
// Operates ONLY within the V7 painted mask. Never alters plan / phi / source RNG.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const modes=new Set(['settle','displace','boundary']);

/**
 * Deterministic, fixed-step bounded thin-film approximation:
 *  1. Conservative flux along horizontal/vertical neighbouring paint pixels
 *     proportional to height difference * h³ (thin-film mobility).
 *  2. For wet-on-wet variants, each existing brush contact contributes a small
 *     velocity stamp. Existing pigment is advected within already painted cells.
 *  3. Optional meniscus pass transfers relief from each paint's inner pixel to
 *     its adjacent colour boundary. It never creates pigment or crosses voids.
 *
 * This is deliberately NOT Pour Dreams' cyclic/implicit infinite-canvas solver:
 * the completed source composition, negative spaces and frame are immovable.
 */
A.oilWetFlowV8=function(pig,relief,voids,scale,opts={}){
 const started=performance.now(),mode=modes.has(opts.mode)?opts.mode:'boundary',
  w=relief.canvas.width,h=relief.canvas.height,n=w*h,
  minHeight=16/255,steps=Math.max(1,Math.min(4,Math.floor(opts.steps||2)));
 if(pig.canvas.width!==w||pig.canvas.height!==h)throw Error('Oil V8: pigment and relief dimensions differ');
 const mask=relief.getImageData(0,0,w,h),md=mask.data,
  occupied=new Uint8Array(n),height=new Float32Array(n),next=new Float32Array(n);
 let paintedPixels=0,protectedPixels=0,massBefore=0;
 // Convert source-space protected regions to pixel-space bounding rectangles.
 // Protection is also guaranteed by the actual V7 mask's paint eligibility.
 const lightingHalo=6; // V7 relief lighting samples up to four neighbouring pixels.
 const boxes=(voids||[]).map(v=>({
   x0:Math.floor(v.x*scale)-lightingHalo,y0:Math.floor(v.y*scale)-lightingHalo,
   x1:Math.ceil((v.x+v.w)*scale)+lightingHalo,
   y1:Math.ceil((v.y+v.h)*scale)+lightingHalo
 }));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,z=p*4,ha=md[z+3]/255;
  if(ha<minHeight)continue;
  let blocked=false;
  for(const b of boxes)if(x>=b.x0&&x<b.x1&&y>=b.y0&&y<b.y1){blocked=true;break}
  if(blocked){protectedPixels++;continue}
  occupied[p]=1;height[p]=ha;massBefore+=ha;paintedPixels++;
 }
 // A single pairwise conservative transfer pass cannot pump paint into paper.
 // The flux is capped to preserve positivity and avoid flattening impasto.
 const fluxCoefficient=.125;
 let transferred=0;
 for(let iteration=0;iteration<steps;iteration++){
  next.set(height);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const p=y*w+x;if(!occupied[p])continue;
   const a=height[p];
   // Evaluate each edge once; no torus and no flow through blank paper.
   for(const q of [p+1,p+w]){
    if(!occupied[q])continue;
    const b=height[q],diff=a-b;
    if(Math.abs(diff)<.005)continue;
    const mobile=fluxCoefficient*Math.pow(Math.max(a,b),3);
    const move=clamp(diff*mobile,-Math.abs(diff)*.28,Math.abs(diff)*.28);
    next[p]-=move;next[q]+=move;transferred+=Math.abs(move);
   }
  }
  height.set(next);
 }
 let pigment=null,pigmentOut=null,colourShiftedPixels=0,
  displacementPixels=0,maxDisplacement=0,edgeRidges=0;
 const contacts=opts.contacts||[];
 if(mode!=='settle'){
  pigment=pig.getImageData(0,0,w,h);
  pigmentOut=new Uint8ClampedArray(pigment.data);
  const src=pigment.data,ux=new Float32Array(n),uy=new Float32Array(n);
  // Only locally recent, existing brush contacts can move paint. They never
  // select new locations globally or consume any composition random numbers.
  const recent=contacts.slice(-200);
  for(const c of recent){
   const cx=c.x*scale,cy=c.y*scale,
     tangent=Math.hypot(c.dx,c.dy)||1,
     dx=c.dx/tangent,dy=c.dy/tangent,
     radius=clamp(c.width*scale*.31,3,18);
   const left=Math.max(1,Math.floor(cx-radius)),right=Math.min(w-2,Math.ceil(cx+radius)),
    top=Math.max(1,Math.floor(cy-radius)),bottom=Math.min(h-2,Math.ceil(cy+radius));
   for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const p=y*w+x;if(!occupied[p])continue;
    const vx=x-cx,vy=y-cy,dd=vx*vx+vy*vy;
    if(dd>radius*radius)continue;
    const smooth=Math.exp(-dd/(radius*radius*.38)),side=clamp((-dy*vx+dx*vy)/radius,-1,1),
       strength=.8*smooth;
    ux[p]+=strength*(dx*.42-dy*side*.66);
    uy[p]+=strength*(dy*.42+dx*side*.66);
   }
  }
  // Semi-Lagrangian backward sampling. Only sample existing painted cells:
  // no invented paint, no spill into negative space, no wraparound edges.
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const p=y*w+x;if(!occupied[p])continue;
   const vx=clamp(ux[p],-1.8,1.8),vy=clamp(uy[p],-1.8,1.8);
   if(Math.abs(vx)+Math.abs(vy)<.12)continue;
   let fx=x-vx,fy=y-vy;
   fx=clamp(fx,0,w-1.001);fy=clamp(fy,0,h-1.001);
   const ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,
     ids=[iy*w+ix,iy*w+ix+1,(iy+1)*w+ix,(iy+1)*w+ix+1],
     ws=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];
   let total=0;
   for(let k=0;k<4;k++)if(occupied[ids[k]])total+=ws[k];
   if(total<.70)continue;
   // Material remains opaque; displacement is colour advection, not fading.
   const z=p*4,mix=mode==='boundary'?.82:.65;
   let changed=false;
   for(let channel=0;channel<3;channel++){
    let sampled=0;
    for(let k=0;k<4;k++)if(occupied[ids[k]])
     sampled+=src[ids[k]*4+channel]*ws[k];
    const v=Math.round(src[z+channel]*(1-mix)+sampled/total*mix);
    if(Math.abs(v-src[z+channel])>=2)changed=true;
    pigmentOut[z+channel]=v;
   }
   if(changed)colourShiftedPixels++;
   displacementPixels++;maxDisplacement=Math.max(maxDisplacement,Math.hypot(vx,vy));
  }
  if(mode==='boundary'){
   // Near two-colour contacts, a thin rim is funded by the interior of
   // the SAME pigment patch, rather than bright highlights drawn on top.
   // Nearest original colour is used to identify an interface.
   for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const p=y*w+x,z=p*4;if(!occupied[p]||height[p]>.965)continue;
    for(const [q,donor] of [[p+1,p-1],[p+w,p-w]]){
     if(!occupied[q]||!occupied[donor])continue;
     const c=q*4,d=donor*4;
     const across=Math.abs(pigmentOut[z]-pigmentOut[c])+
       Math.abs(pigmentOut[z+1]-pigmentOut[c+1])+
       Math.abs(pigmentOut[z+2]-pigmentOut[c+2]);
     const same=Math.abs(pigmentOut[z]-pigmentOut[d])+
       Math.abs(pigmentOut[z+1]-pigmentOut[d+1])+
       Math.abs(pigmentOut[z+2]-pigmentOut[d+2]);
     if(across<68||same>40||height[donor]<.12)continue;
     const delta=Math.min(.028,1-height[p],height[donor]*.09);
     if(delta<=0)continue;
     height[p]+=delta;height[donor]-=delta;edgeRidges++;
    }
   }
  }
  // Overwrite colour only where actual paint was already present.
  const image=pig.createImageData(w,h);image.data.set(pigmentOut);
  pig.putImageData(image,0,0);
 }
 let massAfter=0,changedHeightPixels=0;
 for(let p=0;p<n;p++){
  if(!occupied[p])continue;
  const z=p*4,old=md[z+3],now=Math.round(clamp(height[p],0,1)*255);
  if(now!==old)changedHeightPixels++;
  md[z+3]=now;
  massAfter+=height[p];
 }
 relief.putImageData(mask,0,0);
 return {mode,steps,paintedPixels,protectedPixels,changedHeightPixels,
  displacedPixels:displacementPixels,colourShiftedPixels,edgeRidges,
  contactSamples:contacts.length,maxDisplacementPx:maxDisplacement,
  massBefore,massAfter,massErrorPct:massBefore?100*(massAfter-massBefore)/massBefore:0,
  estimatedFlux:transferred,elapsedMs:performance.now()-started,
  constrainedToSourcePaint:true};
};
})(window.AlgoArt);
