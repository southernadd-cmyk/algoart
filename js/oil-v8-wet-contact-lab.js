// PROPORTION PIECE: replacement Oil V8, controlled wet-contact laboratory.
// All bristle geometry comes from the existing Oil V7 physical contact brush.
// Each contact interacts with a persistent wet pigment/height field IMMEDIATELY,
// before the next stroke. This does not use the rejected V8 final-image pass.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GROUND=[245,240,230], TAU=Math.PI*2;
const SCENARIOS={
 single:{title:'Loaded stroke / depletion',description:'One physical brush stroke, with extra pigment accumulating at the first contact and a drier tail.',
  strokes:[{points:[[74,340],[175,272],[340,170],[480,194],[643,128]],width:69,rgb:[189,71,53],profile:'filbert'}]},
 wet:{title:'Wet-on-wet crossing',description:'A teal brush cuts through a still-wet terracotta stroke and physically drags and redistributes its pigment.',
  strokes:[{points:[[65,258],[210,239],[390,257],[655,246]],width:93,rgb:[199,83,61],profile:'flat'},
   {points:[[400,57],[362,158],[377,260],[415,388]],width:82,rgb:[30,117,146],profile:'filbert'}]},
 dry:{title:'Dry-over-dry crossing',description:'The same crossings and brush marks, but the first stroke is dry before the second touches it.',
  strokes:[{points:[[65,258],[210,239],[390,257],[655,246]],width:93,rgb:[199,83,61],profile:'flat'},
   {points:[[400,57],[362,158],[377,260],[415,388]],width:82,rgb:[30,117,146],profile:'filbert'}],dryBefore:1},
 turn:{title:'Tight turn / accumulated paint',description:'A substantial brush reversal should gather a raised ridge at the compressed, slower change in direction.',
  strokes:[{points:[[71,362],[214,310],[363,296],[491,226],[443,152],[318,100]],width:76,rgb:[64,118,88],profile:'filbert'},
   {points:[[344,95],[417,169],[482,242]],width:58,rgb:[215,141,66],profile:'filbert'}]},
 stops:{title:'Stop / restart',description:'Two aligned brush contacts, showing pigment loading at the stop and the new entry.',
  strokes:[{points:[[82,282],[172,245],[282,234]],width:82,rgb:[177,85,123],profile:'flat'},
   {points:[[309,229],[463,213],[652,184]],width:82,rgb:[177,85,123],profile:'flat'}]}
};
const SIZE=[720,460];
function surface(w,h){
 const n=w*h;
 return {w,h,r:new Float32Array(n),g:new Float32Array(n),b:new Float32Array(n),
  height:new Float32Array(n),cover:new Float32Array(n),wet:new Float32Array(n),
  stroke:new Uint16Array(n),stats:{contacts:0,crossedPixels:0,colourMixedPixels:0,
    displacedMass:0,ridgePixels:0,loadedPixels:0}};
}
function sampleStroke(points,x,y){
 let best=Infinity,travel=0,span=0, along=0,tx=1,ty=0;
 for(let k=1;k<points.length;k++){
  const a=points[k-1],b=points[k],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
  const length=Math.sqrt(d2),t=length?clamp(((x-a.x)*dx+(y-a.y)*dy)/d2,0,1):0;
  const px=a.x+dx*t,py=a.y+dy*t,d=(x-px)**2+(y-py)**2;
  if(d<best){best=d;along=travel+t*length;tx=length?dx/length:1;ty=length?dy/length:0}
  travel+=length;
 }
 span=Math.max(1,travel);
 return {fraction:along/span,tx,ty,distance:Math.sqrt(best)};
}
function makeFootprint(stroke,seed,index){
 const [w,h]=SIZE;
 const pigment=document.createElement('canvas'),relief=document.createElement('canvas');
 pigment.width=relief.width=w;pigment.height=relief.height=h;
 const pg=pigment.getContext('2d',{willReadFrequently:true});
 const mg=relief.getContext('2d',{willReadFrequently:true});
 const pts=stroke.points.map(([x,y])=>({x,y}));
 const r=A.makeR('OIL-V8-REPLACEMENT-LAB|'+seed+'|'+index);
 A.oilPaintV4ETest.drawContactBrushV7(pg,mg,pts,stroke.width,
  stroke.rgb,stroke.profile,r,{thickness:.94,drag:.52,bristles:.96});
 return {pigment,relief,points:pts,
  pic:pg.getImageData(0,0,w,h).data,mask:mg.getImageData(0,0,w,h).data};
}
function addToSurface(field,foot,stroke,index,isDry){
 const {w,h,stats}=field;
 const p=foot.pic,m=foot.mask,prevH=field.height,prevC=field.cover,prevW=field.wet;
 const nextH=new Float32Array(prevH),nextR=new Float32Array(field.r),
   nextG=new Float32Array(field.g),nextB=new Float32Array(field.b),
   nextC=new Float32Array(prevC),nextWet=new Float32Array(prevW);
 const rim=new Float32Array(w*h), rimR=new Float32Array(w*h),
   rimG=new Float32Array(w*h),rimB=new Float32Array(w*h);
 let covered=0,overlap=0,mixed=0,shifted=0,pooled=0;
 if(isDry)nextWet.fill(0);
 // Each footprint pixel originates in an actual V7 bristle or brush body.
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
  const i=y*w+x,z=i*4,a=p[z+3]/255;
  if(a<.045)continue;
  const mH=m[z+3]/255;
  const prev=prevH[i],oldWet=isDry?0:prevW[i];
  const s=sampleStroke(foot.points,x,y),load=1.28-.47*s.fraction,
   freshH=Math.max(.003,mH)*load*(1+.23*(1-s.fraction));
  const wetCollision=prev>.07&&oldWet>.13;
  const fraction=wetCollision?clamp(.30+.43*oldWet,0,.75):0;
  const newColour=[p[z],p[z+1],p[z+2]];
  if(wetCollision){
   overlap++;stats.crossedPixels++;
   // Existing wet pigment is picked into the newly deposited oil film.
   const mix=.48*oldWet*a;
   nextR[i]=newColour[0]*(1-mix)+field.r[i]*mix;
   nextG[i]=newColour[1]*(1-mix)+field.g[i]*mix;
   nextB[i]=newColour[2]*(1-mix)+field.b[i]*mix;
   if(mix>.09){mixed++;stats.colourMixedPixels++;}
   // Displace a bounded amount of the previous paint toward the advancing
   // brush's side, accumulating OUTSIDE the new bristle footprint.
   // This is a local contact event, never a final-image filter.
   if(s.distance>stroke.width*.17 && s.distance<stroke.width*.65){
    const sign=((x-foot.points[0].x)*(-s.ty)+(y-foot.points[0].y)*s.tx)>=0?1:-1;
    const dist=5+Math.min(10,stroke.width*.11);
    const qx=Math.round(x-s.ty*sign*dist+s.tx*3),qy=Math.round(y+s.tx*sign*dist+s.ty*3);
    if(qx>=2&&qx<w-2&&qy>=2&&qy<h-2){
     const j=qy*w+qx,qz=j*4;
     // Restrict lip deposits to a short envelope of this genuine brush contact.
     if(p[qz+3]<.28*255 && prevH[j]+prevH[i]>.08){
      const amount=Math.min(prev*.16, freshH*.17)*oldWet;
      if(amount>.001){
       nextH[i]-=amount;rim[j]+=amount;
       rimR[j]+=field.r[i]*amount;rimG[j]+=field.g[i]*amount;rimB[j]+=field.b[i]*amount;
       shifted++;stats.displacedMass+=amount;
      }
     }
    }
   }
  }else{
   const oldWeight=clamp(prevC[i]*.20,0,.25);
   nextR[i]=newColour[0]*(1-oldWeight)+field.r[i]*oldWeight;
   nextG[i]=newColour[1]*(1-oldWeight)+field.g[i]*oldWeight;
   nextB[i]=newColour[2]*(1-oldWeight)+field.b[i]*oldWeight;
  }
  // Actual V7 bristle load is added, not just tinted onto a flattened image.
  nextH[i]+=freshH;
  nextC[i]=1-(1-prevC[i])*(1-a*.95);
  nextWet[i]=.97;field.stroke[i]=index+1;
  covered++;stats.loadedPixels++;
 }
 // Thick ridges inherit their pigment from the wet paint that the new
 // bristle contact displaced. Do not emit any pigment into remote positions.
 for(let i=0;i<rim.length;i++){
  const amount=rim[i];if(amount<=0)continue;
  const old=nextH[i],total=old+amount;
  if(total>.0001){
   nextR[i]=(nextR[i]*old+rimR[i])/total;
   nextG[i]=(nextG[i]*old+rimG[i])/total;
   nextB[i]=(nextB[i]*old+rimB[i])/total;
  }
  nextH[i]+=amount;
  nextC[i]=Math.max(nextC[i],clamp(.58+.65*amount,0,.97));
  nextWet[i]=Math.max(nextWet[i],.82);
  stats.ridgePixels++;pooled++;
 }
 // Paint stays wet but gets more resistant at each subsequent contact.
 for(let i=0;i<nextWet.length;i++)if(nextWet[i]>.01)nextWet[i]*=.89;
 field.height=nextH;field.r=nextR;field.g=nextG;field.b=nextB;
 field.cover=nextC;field.wet=nextWet;stats.contacts++;
 return {covered,overlap,mixed,shifted,pooled};
}
function shadeField(ctx,field,variant){
 const {w,h,height:rH,cover,wet}=field;
 const rgb=ctx.createImageData(w,h),px=rgb.data;
 let ink=0,heavy=0,maxHeight=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,z=i*4,v=rH[i],c=cover[i];
  let R=GROUND[0],G=GROUND[1],B=GROUND[2];
  if(v>.003){
   const at=(xx,yy)=>rH[clamp(yy,0,h-1)*w+clamp(xx,0,w-1)];
   const dx=at(x+2,y)-at(x-2,y),dy=at(x,y+2)-at(x,y-2);
   // Same restrained directional light in both panels; only V8 changes paint.
   const diffuse=clamp(.98-.25*dx-.21*dy,.76,1.20);
   const specular=Math.pow(clamp(.5+.60*(-dx-dy),0,1),10)*Math.min(23,v*13);
   const alpha=clamp(c,0,1);
   R=GROUND[0]*(1-alpha)+alpha*(field.r[i]*diffuse+specular);
   G=GROUND[1]*(1-alpha)+alpha*(field.g[i]*diffuse+specular*.93);
   B=GROUND[2]*(1-alpha)+alpha*(field.b[i]*diffuse+specular*.85);
   ink++;maxHeight=Math.max(maxHeight,v);
   if(v>.65)heavy++;
  }
  px[z]=Math.round(clamp(R,0,255));
  px[z+1]=Math.round(clamp(G,0,255));
  px[z+2]=Math.round(clamp(B,0,255));px[z+3]=255;
 }
 ctx.putImageData(rgb,0,0);
 return {inkPixels:ink,heavyPixels:heavy,maxHeight};
}
function baseline(ctx,scenario,seed){
 const [w,h]=SIZE;
 const pigment=document.createElement('canvas'),height=document.createElement('canvas');
 pigment.width=height.width=w;pigment.height=height.height=h;
 const pg=pigment.getContext('2d',{willReadFrequently:true}),mg=height.getContext('2d',{willReadFrequently:true});
 // Render exactly the same individual V7 brush footprints and paint-order.
 for(let i=0;i<scenario.strokes.length;i++){
  const foot=makeFootprint(scenario.strokes[i],seed,i);
  pg.drawImage(foot.pigment,0,0);mg.drawImage(foot.relief,0,0);
 }
 const field=surface(w,h),pc=pg.getImageData(0,0,w,h).data,ma=mg.getImageData(0,0,w,h).data;
 for(let i=0;i<w*h;i++){
  const z=i*4,cover=pc[z+3]/255;
  field.cover[i]=cover;
  field.height[i]=ma[z+3]/255;
  field.r[i]=pc[z];field.g[i]=pc[z+1];field.b[i]=pc[z+2];
 }
 return shadeField(ctx,field,'v7');
}
function wet(ctx,scenario,seed){
 const field=surface(...SIZE),events=[];
 for(let i=0;i<scenario.strokes.length;i++){
  const stroke=scenario.strokes[i],foot=makeFootprint(stroke,seed,i);
  events.push(addToSurface(field,foot,stroke,i,scenario.dryBefore===i));
 }
 const pixels=shadeField(ctx,field,'v8');
 return {...pixels,...field.stats,events};
}
function render(target,scenarioName,variant,seed='OIL-V8-LAB-01'){
 const scenario=SCENARIOS[scenarioName];
 if(!scenario)throw Error('Unknown Oil V8 laboratory scenario: '+scenarioName);
 if(!['v7','v8'].includes(variant))throw Error('Unknown Oil V8 lab renderer');
 if(!A.oilPaintV4ETest?.drawContactBrushV7)throw Error('Load physical Oil V7 bristle renderer first');
 target.width=SIZE[0];target.height=SIZE[1];
 return A.withCPUCanvases(()=>{
  const previous={refined:A.oilStageDRefinement,scale:A.oilStageCScale,opaque:A.oilOpaquePaint,pigment:A.oilPigmentActive};
  try{
   A.oilStageDRefinement=true;A.oilStageCScale=1;A.oilOpaquePaint=true;
   if(A.oilPigment)A.oilPigmentActive=A.oilPigment.createModel();
   A.oilPaintV4ETest.resetV7ToothSlot('cpu');
   const temp=document.createElement('canvas');temp.width=SIZE[0];temp.height=SIZE[1];
   const ctx=temp.getContext('2d');
   const started=performance.now();
   const stats=variant==='v7'?baseline(ctx,scenario,seed):wet(ctx,scenario,seed);
   const paintMs=performance.now()-started;
   target.getContext('2d').drawImage(temp,0,0);
   return {...stats,paintMs,scenario:scenarioName,variant,seed};
  }finally{
   if(previous.refined===undefined)delete A.oilStageDRefinement;else A.oilStageDRefinement=previous.refined;
   if(previous.scale===undefined)delete A.oilStageCScale;else A.oilStageCScale=previous.scale;
   if(previous.opaque===undefined)delete A.oilOpaquePaint;else A.oilOpaquePaint=previous.opaque;
   if(previous.pigment===undefined)delete A.oilPigmentActive;else A.oilPigmentActive=previous.pigment;
  }
 });
}
A.oilV8WetLab={render,scenarios:SCENARIOS,size:SIZE};
})(window.AlgoArt);
