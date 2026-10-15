// ALGO/ART V5q — REAL renderer, four separate material interpretations.
// This is an isolated *experiment*. The V5o source geometry, V5p Tissue,
// main marker, released Watercolour V2R and original Oil V4e are not modified.
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
function materialStroke(ctx,from,to,width,ink,alpha,curve){
 const dx=to.x-from.x,dy=to.y-from.y,dist=Math.hypot(dx,dy)||1;
 const mx=(from.x+to.x)/2-dy/dist*curve,
       my=(from.y+to.y)/2+dx/dist*curve;
 ctx.globalAlpha=alpha;
 ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle=typeof ink==='string'?ink:rgb(ink);
 ctx.beginPath();ctx.moveTo(from.x,from.y);
 ctx.quadraticCurveTo(mx,my,to.x,to.y);ctx.stroke();
}
function overlayMarker(ctx,mask,field,edges,rr){
 const ink=field.paintPalette||field.palette||[field.rgb],
   base=field.paintRgb||field.rgb;
 let strokes=0;
 // Actual marker strokes stay identifiable: overlapping translucent
 // hand-drawn felt-tip passes. No "tissue" blur or watercolour bloom.
 for(let k=0;k<edges.length;k++){
   const e=edges[k],d=e.d,nx=-(e.b.y-e.a.y)/d,ny=(e.b.x-e.a.x)/d,
     breadth=clamp(d/PHI*.31,18,73);
   for(let layer=0;layer<3;layer++){
     const offset=(layer-1)*breadth*.27+rr.range(-3.5,3.5),
       a={x:e.a.x+nx*offset,y:e.a.y+ny*offset},
       b={x:e.b.x+nx*offset,y:e.b.y+ny*offset},
       col=mix(ink[(k+layer)%ink.length],base,.27);
     ctx.globalCompositeOperation='multiply';
     materialStroke(ctx,a,b,breadth*(layer===1?1.2:.75),col,
       rr.range(.12,.23),rr.range(-d*.065,d*.065));
     strokes++;
     // Short dry-tip striations along the SAME source-owned strokes.
     for(let s=0;s<6;s++){
       const t=(s+.5)/6,j=rr.range(-breadth*.30,breadth*.30),
         x=e.a.x+(e.b.x-e.a.x)*t+nx*j,
         y=e.a.y+(e.b.y-e.a.y)*t+ny*j,
         len=rr.range(8,22),tx=(e.b.x-e.a.x)/d,ty=(e.b.y-e.a.y)/d;
       materialStroke(ctx,
         {x:x-tx*len*.5,y:y-ty*len*.5},
         {x:x+tx*len*.5,y:y+ty*len*.5},
         rr.range(.6,1.5),col,.19,0);
     }
   }
 }
 return {strokes,pools:0};
}
function overlayWatercolour(ctx,mask,field,edges,rr){
 const palette=field.paintPalette||field.palette||[field.rgb],
       base=field.paintRgb||field.rgb;
 let strokes=0,pools=0;
 // Real source spans become wet-on-wet multi-wash ribbons: soft radial
 // deposition through the existing geometry, not a rectangular fill.
 for(let i=0;i<edges.length;i++){
   const e=edges[i],d=e.d,angle=Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x),
     nx=-Math.sin(angle),ny=Math.cos(angle),
     width=clamp(d*.32,25,105);
   for(let k=0;k<5;k++){
     const t=(k+.5)/5,x=e.a.x+(e.b.x-e.a.x)*t+rr.range(-13,13),
       y=e.a.y+(e.b.y-e.a.y)*t+rr.range(-13,13),
       rad=width*rr.range(.75,1.18),
       c=mix(palette[(i+k)%palette.length],base,.42),
       g=ctx.createRadialGradient(x,y,0,x,y,rad);
     g.addColorStop(0,rgba(c,rr.range(.19,.34)));
     g.addColorStop(.60,rgba(c,.11));
     g.addColorStop(1,rgba(c,0));
     ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
     ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,
       rad*1.2,rad*.82,angle,0,TAU);ctx.fill();strokes++;
   }
   // Thin staggered wet rims only on this valid graph connection.
   const aa={x:e.a.x+nx*rr.range(-13,13),y:e.a.y+ny*rr.range(-13,13)},
         bb={x:e.b.x+nx*rr.range(-13,13),y:e.b.y+ny*rr.range(-13,13)},
         c=mix(base,palette[i%palette.length],.5);
   ctx.globalCompositeOperation='multiply';
   materialStroke(ctx,aa,bb,rr.range(4,12),c,rr.range(.08,.15),
     rr.range(-d*.05,d*.05));strokes++;
 }
 // Pool at authentic *shared* graph anchors, not at fabricated centres.
 const counts=new Map();
 for(const e of edges)for(const g of [e.a,e.b])
   counts.set(g.guideId,(counts.get(g.guideId)||0)+1);
 for(const e of edges)for(const g of [e.a,e.b]){
   if(counts.get(g.guideId)<2)continue;
   const c=mix(base,palette[pools%palette.length],.25),
     rad=rr.range(24,51),
     grad=ctx.createRadialGradient(g.x,g.y,0,g.x,g.y,rad);
   grad.addColorStop(0,rgba(c,.20));
   grad.addColorStop(.5,rgba(c,.09));
   grad.addColorStop(1,rgba(c,0));
   ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
   ctx.fillStyle=grad;ctx.beginPath();ctx.arc(g.x,g.y,rad,0,TAU);
   ctx.fill();pools++;
 }
 return {strokes,pools};
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
     result=material==='marker'?overlayMarker(ctx,mask,field,edges,rr):
       material==='watercolour'?overlayWatercolour(ctx,mask,field,edges,rr):
       overlayOil(ctx,mask,field,edges,rr);
   broad++;links+=edges.length;strokes+=result.strokes;pools+=result.pools;
   ctx.restore();mask.restore();
 }
 ctx.restore();mask.restore();
 const out=target.getContext('2d');
 // Source output is not changed until all the brush/wash passes finish.
 out.save();out.globalCompositeOperation=material==='oil'?'source-over':'multiply';
 out.globalAlpha=material==='oil'?.78:1;
 out.drawImage(pass,0,0);out.restore();
 return{broadFields:broad,sourceLinks:links,materialContacts:strokes,
   junctionPools:pools,sourceFieldCount:plan.connectedFields.length};
}
A.renderInterpretedV5Q=function(target,settings,scale,opts){
 opts=opts||{};scale=scale||1;
 const material=opts.material||'marker',
       interpretation=opts.interpretation||'areas';
 if(!['marker','watercolour','oil','tissue'].includes(material))
   throw Error('Unknown V5q material '+material);
 const plan=interpretation==='areas'?
   A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
     maxRegions:opts.maxRegions||28}):null;
 // Native faithful material renderers are called directly. Tissue delegates
 // all source-linked physical paper handling to the tested V5p material.
 if(material==='tissue')
   return A.renderInterpretedV5P(target,settings,scale,{
     ...opts,material:'tissue',interpretation,stage:'pooled'});
 let source;
 if(material==='marker')source=A.render(target,settings,scale,false);
 else if(material==='watercolour')
   source=A.renderWatercolourV2R(target,settings,scale,false);
 else source=A.renderInterpretedV5P(target,settings,scale,{
   ...opts,material:'oil',interpretation});
 if(!plan||!plan.connectedFields.length)return{
   version:'v5q-prototype',material,interpretation,
   sourceSeed:settings.seed,source,plan,work:null};
 if(material==='watercolour'||material==='marker')
   cleanPresentation(target);
 const work=paintMaterialConnections(target,plan,scale,material);
 return{version:'v5q-prototype',material,interpretation,
   sourceSeed:settings.seed,source,plan,work};
};
})(window.AlgoArt);
