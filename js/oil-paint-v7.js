// Oil V7 prototype: one source capture, one paint surface, one relief pass.
// Separate entry point; no changes to Oil V1–V6 or editor routing.
// Uses the project's existing source planner, V3 contact brush and V5 pigments.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const PI=Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hex=c=>'rgb('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+')';
const rng=s=>A.makeR(String(s));
const shifted=(p,a,d)=>({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d});
const blend=(a,b,t)=>A.oilPigmentActive.tone(a,b,t);
function massContour(area){
 const out=new Path2D(),pts=area.contour||[];
 if(pts.length){out.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))out.lineTo(p.x,p.y);out.closePath();}
 return out;
}
function physicalEdgePath(area,material){
  const poly=area.contour||[],out=new Path2D();
  if(poly.length<3)return massContour(area);
  const r=rng(area.seed+'|v5k|physical-edge|'+material),
      step=material==='tissue'?6.0:8.0,
      edgeDepth=material==='tissue'?7.1:13.3,
      center={x:area.x,y:area.y};
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],
      len=Math.hypot(b.x-a.x,b.y-a.y),
      n=Math.max(1,Math.ceil(len/step));
    for(let j=0;j<n;j++){
      const t=j/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,
        vx=center.x-x,vy=center.y-y,
        radius=Math.max(1,Math.hypot(vx,vy)),
        // Multiple physical edge frequencies: no pixel grid, Voronoi
        // masks, thick Gaussian blur, or evenly repeating sawtooth.
        wave=.52+.23*Math.sin(i*1.73+t*13.7)+
          .12*Math.sin(i*2.11+t*37.4)+r.range(-.13,.13),
        inset=Math.max(.55,edgeDepth*clamp(wave,.12,.95)),
        px=x+vx/radius*inset,py=y+vy/radius*inset;
      if(i===0&&j===0)out.moveTo(px,py);else out.lineTo(px,py);
    }
  }
  out.closePath();
  return out;
}

function oilColourField(ctx,mask,area,painter,plan,progress){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=A.oilOpaquePaint===true?1:.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
  // Real paint checkpoints, taken during the source-field brush passes.
  // This is capture-only: it never changes brush order, pigment or randomness.
  const expected=guides.reduce((sum,g)=>sum+clamp(Math.floor((g.width+g.height)/36),5,11),0)+(guides.length>=2?9:0);
  let nextCheckpoint=1;
  const checkpointCount=12;
  const record=()=>{
    while(progress && nextCheckpoint<=checkpointCount && deposits>=Math.ceil(expected*nextCheckpoint/checkpointCount)){
      progress(nextCheckpoint,checkpointCount);nextCheckpoint++;
    }
  };
  // Gesture geometry comes from the actual branches, ordered trajectory
  // points, or rotated placed objects already present in V5d.
  guides.forEach(function(g,gi){
    const axis=(g.axis||[]),origin=axis.length?axis[Math.floor(axis.length/2)]:
      {x:g.x,y:g.y},ang=g.angle||0;
    const centres=axis.length>1?axis:[
      shifted(origin,ang,-Math.min(g.width,g.height)*.37),
      origin,shifted(origin,ang,Math.min(g.width,g.height)*.37)];
    const strokes=clamp(Math.floor((g.width+g.height)/36),5,11);
    for(let k=0;k<strokes;k++){
      const id=Math.floor((k+.35)*centres.length/strokes),
            here=centres[Math.min(centres.length-1,id)],
            prev=centres[Math.max(0,id-1)],
            next=centres[Math.min(centres.length-1,id+1)],
            direction=Math.atan2(next.y-prev.y,next.x-prev.x)||ang,
            normal=direction+PI/2,
            offset=r.range(-16,16)*(1+.16*gi),
            cx=here.x+Math.cos(normal)*offset,
            cy=here.y+Math.sin(normal)*offset,
            len=clamp(Math.min(b.w,b.h)*r.range(.21,.48),27,115),
            width=clamp(r.range(12,28),11,35),
            dx=Math.cos(direction)*len*.5,
            dy=Math.sin(direction)*len*.5,
            source=colours[(gi+k)%colours.length],
            mixed=blend(source,k%6===0?[242,219,190]:[53,47,43],k%6===0?.085:.029);
      painter(ctx,mask,[
       {x:cx-dx,y:cy-dy},
       {x:cx+r.range(-7,7),y:cy+r.range(-7,7)},
       {x:cx+dx,y:cy+dy}],
        width,mixed,k%4===0?'flat':'filbert',r,
        {thickness:r.range(.76,1.02),drag:r.range(.39,.82),
         bristles:r.range(.82,.99)});
      deposits++;record();
    }
  });
  // The bridge is itself the source-owned relationship between the two
  // guides, so place a few irregular shorter impasto touches along it.
  if(guides.length>=2){
    const a=guides[0],z=guides[1],
      angle=Math.atan2(z.y-a.y,z.x-a.x),normal=angle+PI/2;
    for(let k=0;k<9;k++){
      const t=(k+.5)/9,offset=r.range(-21,21),
        x=a.x+(z.x-a.x)*t+Math.cos(normal)*offset,
        y=a.y+(z.y-a.y)*t+Math.sin(normal)*offset,
        turn=angle+r.range(-.67,.67),
        len=r.range(25,66),dx=Math.cos(turn)*len*.5,
        dy=Math.sin(turn)*len*.5,
        source=colours[k%colours.length];
      painter(ctx,mask,[{x:x-dx,y:y-dy},
       {x:x+r.range(-6,6),y:y+r.range(-6,6)},
       {x:x+dx,y:y+dy}],
       r.range(15,34),blend(source,[242,227,207],k%4===0?.09:.025),
       k%3===0?'flat':'filbert',r,
       {thickness:r.range(.75,1.0),drag:r.range(.40,.83),
        bristles:r.range(.80,.99)});
      deposits++;record();
    }
  }
  if(progress && !expected)progress(checkpointCount,checkpointCount);
  ctx.restore();mask.restore();
  return deposits;
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

function overlayOil(ctx,mask,field,edges,rr,paint){
 const palette=field.paintPalette||field.palette||[field.rgb];
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
       c=blend(palette[(i+layer)%palette.length],
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

// Logical-space pigment history. It estimates paint carried across previous
// contacts, without synchronous canvas reads. It is not a fluid simulation.
function pigmentHistory(width,height,model,voids){
 const cell=14,cols=Math.ceil(width/cell),rows=Math.ceil(height/cell);
 const colours=new Float32Array(cols*rows*3),loads=new Float32Array(cols*rows);
 let pickups=0;
 const inside=p=>!voids.some(v=>p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h);
 function index(p){return clamp(Math.floor(p.y/cell),0,rows-1)*cols+clamp(Math.floor(p.x/cell),0,cols-1);}
 return {
  colour(points,rgb){
   let selected=-1,weight=0;
   for(let j=1;j<=5;j++){
    const p=points[Math.min(points.length-1,Math.floor(j*points.length/6))];
    if(!inside(p))continue;
    const k=index(p);
    if(loads[k]>weight){weight=loads[k];selected=k;}
   }
   if(selected<0||weight<.2)return rgb;
   pickups++;
   const k=selected*3;
   return model.mix(rgb,[colours[k],colours[k+1],colours[k+2]],Math.min(.20,weight*.16));
  },
  deposit(points,width,rgb){
   const radius=Math.min(5,Math.max(0,Math.floor(width/(cell*2))));
   let previous=-1;
   function stamp(p){
    if(!inside(p))return;
    const k=index(p);if(k===previous)return;previous=k;
    const x=k%cols,y=Math.floor(k/cols);
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
     if(dx*dx+dy*dy>radius*radius+1)continue;
     const xx=x+dx,yy=y+dy;
     if(xx<0||xx>=cols||yy<0||yy>=rows)continue;
     if(!inside({x:(xx+.5)*cell,y:(yy+.5)*cell}))continue;
     const n=yy*cols+xx,z=n*3,t=loads[n]>.01?.72:1;
     for(let c=0;c<3;c++)colours[z+c]+=t*(rgb[c]-colours[z+c]);
     loads[n]=Math.min(1,loads[n]+.34);
    }
   }
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(cell*.7)));
    for(let j=0;j<=steps;j++){const t=j/steps;stamp({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
   }
  },
  stats:()=>({pigmentPickups:pickups,historyBytes:colours.byteLength+loads.byteLength})
 };
}
function lightSurface(pig,mask,stats){
 const w=pig.canvas.width,h=pig.canvas.height;
 const started=performance.now(),height=mask.getImageData(0,0,w,h).data;
 const image=pig.getImageData(0,0,w,h),pixels=image.data;
 // Alpha is discrete: calculate each optical height once, not for every
 // neighbour of every shaded pixel. Seven rows keep auxiliary RAM bounded.
 const optical=Float64Array.from({length:256},(_,a)=>a/255>.007?Math.log1p((a/255*1.42)*.66):0);
 const rows=Array.from({length:7},()=>new Float64Array(w));
 const fill=y=>{const row=rows[y%7];for(let x=0;x<w;x++)row[x]=optical[height[(y*w+x)*4+3]];};
 for(let y=1;y<=Math.min(7,h-1);y++)fill(y);
 let active=0;
 for(let y=4;y<h-4;y++){
  for(let x=4;x<w-4;x++){
   const z=(y*w+x)*4;
   if(height[z+3]/255*1.42<.06)continue;
   const l=A.oilPaintV4ETest.surfaceLightingCachedRows(rows,x,y,.88);
   pixels[z]=clamp(Math.round(pixels[z]*l.shade+l.shine),0,255);
   pixels[z+1]=clamp(Math.round(pixels[z+1]*l.shade+l.shine*.87),0,255);
   pixels[z+2]=clamp(Math.round(pixels[z+2]*l.shade+l.shine*.77),0,255);
   active++;
  }
  if(y+4<h)fill(y+4);
 }
 pig.putImageData(image,0,0);
 Object.assign(stats,{reliefMs:performance.now()-started,raisedPixels:active,lightingPasses:1,
  finalReadbacks:2,strokeReadbacks:0,lightingCacheBytes:7*w*8+optical.byteLength});
}
A.renderOilPaintV7=function(target,settings,scale=1,reveal=false){
 if(!A.captureCompositionV5||!A.oilPaintV4ETest?.drawContactBrushV3||!A.oilPigment)
  throw Error('Oil V7 requires the source planner, V3 contact brush and V5 pigments');
 if(!(Number.isFinite(scale)&&scale>0&&scale<=8))throw Error('Oil V7 scale must be >0 and <=8');
 const saved={},keys=['oilPigmentActive','oilStageDRefinement','oilStageCScale','oilStageCStats','oilOpaquePaint'];
 for(const k of keys)saved[k]={own:Object.prototype.hasOwnProperty.call(A,k),value:A[k]};
 const stats={sourceCaptures:1,brushCalls:0};
 const started=performance.now();
 let meta;
 try{
  meta=A.renderViaCPUCanvas(canvas=>{
   const model=A.oilPigment.createModel();
   A.oilPigmentActive=model;A.oilOpaquePaint=true;A.oilStageDRefinement=true;A.oilStageCScale=scale;A.oilStageCStats={};
   A.oilPaintV4ETest.resetToothSlot('cpu');
   const opts={phiFraming:A.phiFramingEnabled===true,maxRegions:28};
   const capture=A.captureCompositionV5(settings,opts);
   const plan=A.planCompositionV5FromSource(capture,settings,opts);
   stats.planMs=performance.now()-started;
   const w=Math.round(plan.width*scale),h=Math.round(plan.height*scale);
   canvas.width=Math.max(1,w);canvas.height=Math.max(1,h);
   const pig=canvas.getContext('2d'),maskCanvas=document.createElement('canvas');
   maskCanvas.width=canvas.width;maskCanvas.height=canvas.height;
   const mask=maskCanvas.getContext('2d');
   pig.scale(scale,scale);mask.scale(scale,scale);
   pig.fillStyle=settings.paper||'#f5f0e6';pig.fillRect(0,0,plan.width,plan.height);
   // Restrained ground tooth stays visible in the paper reserves.
   pig.fillStyle='rgba(110,96,78,.022)';
   for(let x=0;x<plan.width;x+=5)pig.fillRect(x,0,.55,plan.height);
   for(let y=0;y<plan.height;y+=6)pig.fillRect(0,y,plan.width,.45);
   pig.save();mask.save();
   if(plan.protectedVoids.length){
    const clip=new Path2D();clip.rect(0,0,plan.width,plan.height);
    for(const v of plan.protectedVoids)clip.rect(v.x,v.y,v.w,v.h);
    pig.clip(clip,'evenodd');mask.clip(clip,'evenodd');
   }
   const history=pigmentHistory(plan.width,plan.height,model,plan.protectedVoids);
   const physical=A.oilPaintV4ETest.drawContactBrushV3;
   const paint=(ctx,height,points,width,rgb,profile,r,options)=>{
    const colour=history.colour(points,rgb);
    const result=physical(ctx,height,points,width,colour,profile,r,options);
    history.deposit(points,width,colour);stats.brushCalls++;
    return result;
   };
   const checkpoint=name=>{if(A.materialStageCapture)A.materialStageCapture(name,canvas);};
   checkpoint('oil-v7-ground');
   let chains=capture.chains.filter(c=>c.length>=6&&c.pts.length>=2);
   stats.eligibleChains=chains.length;
   if(chains.length>540){
    chains=chains.map(c=>({c,score:Math.sqrt(c.length)*(2+Math.min(c.width,15))+(c.length<75?25:0)}))
     .sort((a,b)=>b.score-a.score||a.c.sourceIndex-b.c.sourceIndex).slice(0,540)
     .map(x=>x.c).sort((a,b)=>a.sourceIndex-b.sourceIndex);
   }
   stats.sourceChains=chains.length;stats.droppedChains=stats.eligibleChains-chains.length;
   const r=rng(settings.seed+'|oil-v7|'+settings.mode);
   const paintStart=performance.now();
   for(let i=0;i<chains.length;i++){
    const c=chains[i],width=clamp(6+c.width*1.8,9,58)*1.828*r.range(.90,1.08);
    const profile=['rects','geometric'].includes(settings.mode)?(r.chance(.28)?'knife':'flat'):
     r.chance(.22)?'dry':'filbert';
    paint(pig,mask,c.pts,width,model.mapRGB(c.rgb),profile,r,{thickness:.9,drag:.72,bristles:.92});
    if(i<12||((i+1)%Math.max(1,Math.ceil(chains.length/10))===0))checkpoint('oil-v7-source-'+(i+1));
   }
   stats.fieldStrokes=0;
   for(const area of plan.connectedFields){
    const field={...area,paintRgb:model.mapRGB(area.paintRgb||area.rgb),
     paintPalette:(area.paintPalette||area.palette||[area.rgb]).map(c=>model.mapRGB(c))};
    stats.fieldStrokes+=oilColourField(pig,mask,field,paint,plan);
    checkpoint('oil-v7-field-'+area.id);
   }
   stats.connectionStrokes=0;
   for(const area of plan.connectedFields){
    if(area.kind!=='guide-chain-colour-mass')continue;
    const edges=approvedEdges(area,plan);if(!edges.length)continue;
    const field={...area,paintPalette:(area.paintPalette||area.palette||[area.rgb]).map(c=>model.mapRGB(c))};
    const boundary=massContour(field);
    pig.save();mask.save();pig.clip(boundary);mask.clip(boundary);
    const result=overlayOil(pig,mask,field,edges,rng(field.seed+'|v5q|oil'),paint);
    stats.connectionStrokes+=result.strokes;
    pig.restore();mask.restore();
   }
   pig.restore();mask.restore();pig.setTransform(1,0,0,1,0,0);
   stats.paintMs=performance.now()-paintStart;
   checkpoint('oil-v7-before-relief');
   lightSurface(pig,mask,stats);
   checkpoint('oil-v7-after-relief');
   if(reveal){
    pig.save();pig.setTransform(scale,0,0,scale,0,0);
    A.W=plan.width;A.H=plan.height;A.geometryOverlay(pig,settings,capture.meta);pig.restore();
   }
   Object.assign(stats,history.stats());
   return {...capture.meta,version:'oil-paint-v7',material:'oil',plan,work:stats,
    pigment:{model:model.name,...model.stats}};
  },target,'oil-paint-v7');
 }finally{
  for(const k of keys){if(saved[k].own)A[k]=saved[k].value;else delete A[k];}
 }
 stats.totalMs=performance.now()-started;
 A.lastRenderMeta={strategy:meta.strategy,guide:meta.guide,voids:meta.voids||[],
  ...(meta.phiSheetFrame?{phiSheetFrame:meta.phiSheetFrame}:{})};
 A.lastPhiSheetFrame=meta.phiSheetFrame||null;
 return meta;
};
})(window.AlgoArt);

