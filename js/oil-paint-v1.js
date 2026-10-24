// ALGO/ART Oil Paint v1. This is the Oil path from the genuine 8-artwork V5q experiment.
// Does not publish the experimental Marker, Watercolour or Tissue modifications.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const PI=Math.PI,TAU=2*PI,PHI=(1+Math.sqrt(5))/2;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
const rgb=c=>'rgb('+c.map(x=>Math.round(clamp(x,0,255))).join(',')+')';
const rgba=(c,a)=>'rgba('+c.map(x=>Math.round(clamp(x,0,255))).join(',')+','+clamp(a,0,1).toFixed(4)+')';
const rand=seed=>A.makeR(String(seed));
const pathOf=f=>{
 const p=new Path2D(),poly=f.contour||[];
 if(poly.length<3)return p;
 p.moveTo(poly[0].x,poly[0].y);
 for(let i=1;i<poly.length;i++)p.lineTo(poly[i].x,poly[i].y);
 p.closePath();return p;
};
function voidClip(ctx,plan){
 if(!plan.protectedVoids?.length)return;
 const clip=new Path2D();clip.rect(0,0,plan.width,plan.height);
 for(const v of plan.protectedVoids)clip.rect(v.x,v.y,v.w,v.h);
 ctx.clip(clip,'evenodd');
}
function cleanPresentation(canvas){
 // Watercolour/Tissue can leave residual clip/transform on the output
 // 2D context. Reset only the canvas state, retaining exact source pixels.
 const copy=document.createElement('canvas');
 copy.width=canvas.width;copy.height=canvas.height;
 copy.getContext('2d').drawImage(canvas,0,0);
 canvas.width=canvas.width;
 canvas.getContext('2d').drawImage(copy,0,0);
}
function approvedEdges(f,plan){
 const guides=new Map((plan.territories||[])
   .filter(g=>f.guideIds.includes(g.guideId))
   .map(g=>[g.guideId,g]));
 const legal=[];
 for(let i=0;i<f.guideIds.length;i++)
 for(let j=i+1;j<f.guideIds.length;j++){
   const a=guides.get(f.guideIds[i]),b=guides.get(f.guideIds[j]);
   if(!a||!b||!A.compositionV5oTest.linked(a,b,plan))continue;
   const d=Math.hypot(b.x-a.x,b.y-a.y);
   if(d>6)legal.push({a,b,d});
 }
 legal.sort((a,b)=>b.d-a.d||a.a.guideId.localeCompare(b.a.guideId));
 return legal.slice(0,4);
}

function overlayOil(ctx,mask,field,edges,rr){
 const palette=field.paintPalette||field.palette||[field.rgb],
       paint=A.oilPaintV4ETest?.drawContactBrush;
 if(typeof paint!=='function')throw Error('Oil V4e loaded contact brush unavailable');
 let strokes=0,pools=0;
 // Pigment and height are painted together by the actual V4e physical
 // brush, retaining directional bristle marks and skips.
 for(let i=0;i<edges.length;i++){
   const e=edges[i],d=e.d,tx=(e.b.x-e.a.x)/d,
     ty=(e.b.y-e.a.y)/d,nx=-ty,ny=tx,
     breadth=clamp(d*.28,18,82);
   for(let layer=0;layer<4;layer++){
     const off=(layer-1.5)*breadth*.24+rr.range(-9,9),
       a={x:e.a.x+nx*off,y:e.a.y+ny*off},
       b={x:e.b.x+nx*off,y:e.b.y+ny*off},
       middle={x:(a.x+b.x)/2+nx*rr.range(-12,12),
         y:(a.y+b.y)/2+ny*rr.range(-12,12)},
       c=mix(palette[(i+layer)%palette.length],
         layer%3===0?[246,224,196]:[61,51,46],layer%3===0?.06:.025);
     paint(ctx,mask,[a,middle,b],breadth*rr.range(.35,.57),
       c,layer%3===0?'flat':'filbert',rr,{
         thickness:rr.range(.66,.92),drag:rr.range(.42,.81),
         bristles:rr.range(.85,.99)});
     strokes++;
   }
 }
 return {strokes,pools};
}

function paintMaterialConnections(target,plan,scale,material){
 const pass=document.createElement('canvas');
 pass.width=target.width;pass.height=target.height;
 const ctx=pass.getContext('2d'),maskCanvas=document.createElement('canvas');
 maskCanvas.width=pass.width;maskCanvas.height=pass.height;
 const mask=maskCanvas.getContext('2d');
 ctx.scale(scale,scale);mask.scale(scale,scale);
 ctx.save();mask.save();voidClip(ctx,plan);voidClip(mask,plan);
 let broad=0,links=0,strokes=0,pools=0;
 for(const field of plan.connectedFields){
   if(field.kind!=='guide-chain-colour-mass')continue;
   const edges=approvedEdges(field,plan);
   if(!edges.length)continue;
   const boundary=pathOf(field);
   ctx.save();mask.save();ctx.clip(boundary);mask.clip(boundary);
   const rr=rand(field.seed+'|v5q|'+material),
     result=overlayOil(ctx,mask,field,edges,rr);
   broad++;links+=edges.length;strokes+=result.strokes;pools+=result.pools;
   ctx.restore();mask.restore();
 }
 ctx.restore();mask.restore();
 const out=target.getContext('2d');
 // Source output is not changed until all the brush/wash passes finish.
 out.save();out.globalCompositeOperation='source-over';
 out.globalAlpha=.78;
 out.drawImage(pass,0,0);out.restore();
 return{broadFields:broad,sourceLinks:links,materialContacts:strokes,
   junctionPools:pools,sourceFieldCount:plan.connectedFields.length};
}

A.renderOilPaintV1=function(target,settings,scale,reveal){
 scale=scale||1;
 const opts={material:'oil',interpretation:'areas',
   phiFraming:A.phiFramingEnabled===true,maxRegions:28,
   // Test-only switch; default and released V1 links remain untouched.
   reuseCompositionCapture:A.oilPerfExperimental===true};
 const base=A.renderInterpretedV5P(target,settings,scale,opts);
 if(A.materialStageCapture)A.materialStageCapture('oil-paint-base',target);
 const plan=base.plan;
 const applied=plan&&plan.connectedFields.length?
   paintMaterialConnections(target,plan,scale,'oil'):
   {broadFields:0,sourceLinks:0,materialContacts:0,junctionPools:0};
 if(A.materialStageCapture)A.materialStageCapture('oil-paint-connections',target);
 // V4e already captured the actual V8 source's guide and void metadata.
 // Before this fix Oil v1 discarded it, and ignored `reveal`: the button
 // changed state but no scaffold was drawn and hover hit-testing failed.
 // The V5p areas result reports its plan/work, not its baseline stats.
 // Read the dedicated V4e capture created by that same synchronous render.
 // (The previous fix erroneously expected `base.baseline` to be present.)
 const oilStats=A.lastOilPaintV4EStats;
 const sourceMeta=oilStats&&oilStats.sourceRenderMeta;
 if(!sourceMeta||!sourceMeta.guide)
   throw Error('Oil Paint v1 cannot recover the source composition metadata');
 const meta={
   strategy:sourceMeta.strategy,
   guide:sourceMeta.guide,
   voids:sourceMeta.voids||[]
 };
 if(sourceMeta.phiSheetFrame)meta.phiSheetFrame=sourceMeta.phiSheetFrame;
 if(reveal){
   // Render LAST, above the finished oil painting. A.geometryOverlay
   // draws in original logical canvas coordinates, while V4e painting
   // rendered at the requested physical pixel scale.
   const ctx=target.getContext('2d');
   ctx.save();ctx.setTransform(scale,0,0,scale,0,0);
   A.W=settings.orientation==='portrait'?1000:1400;
   A.H=settings.orientation==='portrait'?1400:1000;
   A.geometryOverlay(ctx,settings,meta);
   ctx.restore();
 }
 A.lastRenderMeta=meta;
 A.lastPhiSheetFrame=meta.phiSheetFrame||null;
 return {...base,...meta,material:'oil',version:'oil-paint-v1',
   work:{...base.work,oilV1:applied},sourceMeta:oilStats};
};
})(window.AlgoArt);
