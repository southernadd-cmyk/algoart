// Oil v1 source-linked material bundle C: verified V5o planner/V5p oil painter.

// ---- v5k-material-adapters.js ----
// ALGO/ART V5k: material-only physical field edge refining; immutable V5i geometry.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}

// V5k material edge. Keep the source polygon as an immutable ENVELOPE:
// sampled boundary vertices retreat *inwards* at a real physical tip/fibre
// scale; never invent new 2D regions or protrude into protected voids.
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

function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta,
        atmosphere=A.tissueV5kReduceAtmosphere;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      // The faithful material is NEVER altered. The field interpretation
      // alone lowers V7's broad atmospheric glaze, preserving source RNG.
      A.tissueV5kReduceAtmosphere=opts.interpretation==='areas'&&
        opts.hasConnectedFields===true;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta;
      A.tissueV5kReduceAtmosphere=atmosphere}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,area,painter,plan){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
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
      deposits++;
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
      deposits++;
    }
  }
  ctx.restore();mask.restore();
  return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter,plan);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.connectedFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


function tissueColourField(ctx,area){
  const border=area.contour||[],r=rng(area.seed+'|v5j-fibrous-sheets'),
      colours=area.paintPalette||area.palette||[area.rgb],
      pigment=area.paintRgb||area.rgb;
  let pieces=0;
  ctx.save();
  // One continuous source-shaped tissue sheet. It is translucent, not
  // sprayed beyond its boundaries. Multiply keeps overlapping *separate*
  // tissue fields physically darkening, never bleaching out to milky grey.
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.46;
  ctx.fillStyle=hex(blend(pigment,[245,240,230],.11));
  ctx.fill(physicalEdgePath(area,'tissue'));pieces++;
  const centre={x:area.x,y:area.y};
  for(let layer=0;layer<2;layer++){
    const paper=new Path2D(),scale=layer===0?.961:.83;
    for(let i=0;i<border.length;i++){
      const a=border[i],b=border[(i+1)%border.length];
      // Independent torn edges have many slight, jagged fibre offsets.
      for(let j=0;j<5;j++){
        const t=j/5,x=a.x+(b.x-a.x)*t,
          y=a.y+(b.y-a.y)*t,
          rag=layer===0?2.8:4.3,
          px=centre.x+(x-centre.x)*scale+r.range(-rag,rag),
          py=centre.y+(y-centre.y)*scale+r.range(-rag,rag);
        if(i===0&&j===0)paper.moveTo(px,py);
        else paper.lineTo(px,py);
      }
    }
    paper.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.22:.16;
    ctx.fillStyle=hex(blend(colours[(layer+1)%colours.length],
      [244,237,226],.08+layer*.06));
    ctx.fill(paper);
    // Sparse pale fibres, drawn as physical torn sheet edges rather than a
    // softly blurred halo around the entire region.
    ctx.globalCompositeOperation='source-over';
    ctx.lineWidth=layer===0?.9:.6;ctx.globalAlpha=.16;
    ctx.strokeStyle='rgb(244,237,225)';ctx.stroke(paper);
    pieces++;
  }
  ctx.restore();return pieces;
}

function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldPieces+=tissueColourField(ctx,plan.connectedFields[fi]);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.connectedFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines};
}
A.renderInterpretedV5K=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),plan=null;
  if(interpretation==='areas'){
    if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
    plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
      maxRegions:opts.maxRegions||28});
  }
  var sourceMeta=baseline(target,settings,scale,material,
    {...opts,hasConnectedFields:!!(plan&&plan.connectedFields.length)});
  if(interpretation==='faithful')return {
    version:'v5k-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(material==='tissue'&&plan.connectedFields.length){
    // V7's faithful renderer may leave an inherited clip or transform on
    // the target 2D context. Never paint the new fields through that state:
    // preserve the exact pixels, reset the presentation context, then
    // draw connected paper areas over the whole physical sheet.
    var faithfulCopy=document.createElement('canvas');
    faithfulCopy.width=target.width;faithfulCopy.height=target.height;
    faithfulCopy.getContext('2d').drawImage(target,0,0);
    target.width=target.width; // resets clip, transform and composite state
    target.getContext('2d').drawImage(faithfulCopy,0,0);
  }
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5k-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,connectedFields:plan.connectedFields.length,
    connectedStats:plan.connectedStats,fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5KInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5K=function(target,plan,scale){
    scale=scale||1;
    var ctx=target.getContext('2d');
    target.width=Math.round(plan.width*scale);
    target.height=Math.round(plan.height*scale);
    ctx=target.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
    for(var i=0;i<plan.connectedFields.length;i++){
      var area=plan.connectedFields[i],p=new Path2D(),poly=area.contour;
      p.moveTo(poly[0].x,poly[0].y);
      for(var j=1;j<poly.length;j++)p.lineTo(poly[j].x,poly[j].y);
      p.closePath();
      var rgb=area.paintRgb||area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);


// ---- v5l-material-adapters.js ----
// ALGO/ART V5l: prominent source-owned Tissue fields OVER untouched V7; immutable V5i geometry.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}

// V5k material edge. Keep the source polygon as an immutable ENVELOPE:
// sampled boundary vertices retreat *inwards* at a real physical tip/fibre
// scale; never invent new 2D regions or protrude into protected voids.
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

function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta,
        atmosphere=A.tissueV5kReduceAtmosphere;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      // V7's original atmosphere, graphite and all other pigment layers stay.
      // The V5l interpretation adds a physical source-owned layer on top.
      A.tissueV5kReduceAtmosphere=false;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta;
      A.tissueV5kReduceAtmosphere=atmosphere}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,area,painter,plan){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
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
      deposits++;
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
      deposits++;
    }
  }
  ctx.restore();mask.restore();
  return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter,plan);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.connectedFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


function tissueColourField(ctx,area,plan){
  const border=area.contour||[],r=rng(area.seed+'|v5j-fibrous-sheets'),
      colours=area.paintPalette||area.palette||[area.rgb],
      pigment=area.paintRgb||area.rgb;
  let pieces=0,folds=0;
  ctx.save();
  // One continuous source-shaped tissue sheet. It is translucent, not
  // sprayed beyond its boundaries. Multiply keeps overlapping *separate*
  // tissue fields physically darkening, never bleaching out to milky grey.
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.69;
  ctx.fillStyle=hex(blend(pigment,[245,240,230],.11));
  const outer=physicalEdgePath(area,'tissue');
  ctx.fill(outer);pieces++;
  // After the main sheet, every fold, edge and subsequent sheet stays in
  // its original source-owned silhouette. No invented colour territories.
  ctx.clip(outer);
  const centre={x:area.x,y:area.y};
  for(let layer=0;layer<2;layer++){
    const paper=new Path2D(),scale=layer===0?.961:.83;
    for(let i=0;i<border.length;i++){
      const a=border[i],b=border[(i+1)%border.length];
      // Independent torn edges have many slight, jagged fibre offsets.
      for(let j=0;j<5;j++){
        const t=j/5,x=a.x+(b.x-a.x)*t,
          y=a.y+(b.y-a.y)*t,
          rag=layer===0?2.8:4.3,
          px=centre.x+(x-centre.x)*scale+r.range(-rag,rag),
          py=centre.y+(y-centre.y)*scale+r.range(-rag,rag);
        if(i===0&&j===0)paper.moveTo(px,py);
        else paper.lineTo(px,py);
      }
    }
    paper.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.40:.29;
    ctx.fillStyle=hex(blend(colours[(layer+1)%colours.length],
      [244,237,226],.08+layer*.06));
    ctx.fill(paper);
    // Sparse pale fibres, drawn as physical torn sheet edges rather than a
    // softly blurred halo around the entire region.
    ctx.globalCompositeOperation='source-over';
    ctx.lineWidth=layer===0?1.7:1.1;ctx.globalAlpha=.32;
    ctx.strokeStyle='rgb(244,237,225)';ctx.stroke(paper);
    pieces++;
  }
  // Noticeable inward pigment ridges, with torn fibre highlights;
  // V7's soft washes still appear everywhere underneath these sheets.
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.40;
  ctx.lineWidth=10;
  ctx.strokeStyle=hex(blend(pigment,[44,43,40],.30));
  ctx.stroke(outer);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.46;
  ctx.lineWidth=1.7;ctx.strokeStyle='rgb(249,246,232)';ctx.stroke(outer);
  // Material creases are derived only from actual source guide axes.
  const guides=(plan.territories||[]).filter(g=>
    area.guideIds&&area.guideIds.includes(g.guideId));
  for(const guide of guides.slice(0,3)){
    const axis=guide.axis||[];
    if(axis.length<2)continue;
    const crease=new Path2D();
    crease.moveTo(axis[0].x,axis[0].y);
    for(let j=1;j<axis.length;j++)crease.lineTo(axis[j].x,axis[j].y);
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.30;
    ctx.strokeStyle=hex(blend(pigment,[46,42,40],.55));
    ctx.lineWidth=3.7;ctx.stroke(crease);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.22;
    ctx.strokeStyle='rgb(250,247,234)';ctx.lineWidth=1.1;
    ctx.stroke(crease);folds++;
  }
  ctx.restore();return {pieces,folds};
}

function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0,folds=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    var fieldResult=tissueColourField(ctx,plan.connectedFields[fi],plan);
    fieldPieces+=fieldResult.pieces;folds+=fieldResult.folds;
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.connectedFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines,sourceFolds:folds,v7AtmospherePreserved:true};
}
A.renderInterpretedV5L=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),plan=null;
  if(interpretation==='areas'){
    if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
    plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
      maxRegions:opts.maxRegions||28});
  }
  var sourceMeta=baseline(target,settings,scale,material,
    {...opts,hasConnectedFields:!!(plan&&plan.connectedFields.length)});
  if(interpretation==='faithful')return {
    version:'v5l-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(material==='tissue'&&plan.connectedFields.length){
    // V7's faithful renderer may leave an inherited clip or transform on
    // the target 2D context. Never paint the new fields through that state:
    // preserve the exact pixels, reset the presentation context, then
    // draw connected paper areas over the whole physical sheet.
    var faithfulCopy=document.createElement('canvas');
    faithfulCopy.width=target.width;faithfulCopy.height=target.height;
    faithfulCopy.getContext('2d').drawImage(target,0,0);
    target.width=target.width; // resets clip, transform and composite state
    target.getContext('2d').drawImage(faithfulCopy,0,0);
  }
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5l-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,connectedFields:plan.connectedFields.length,
    connectedStats:plan.connectedStats,fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5LInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5L=function(target,plan,scale){
    scale=scale||1;
    var ctx=target.getContext('2d');
    target.width=Math.round(plan.width*scale);
    target.height=Math.round(plan.height*scale);
    ctx=target.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
    for(var i=0;i<plan.connectedFields.length;i++){
      var area=plan.connectedFields[i],p=new Path2D(),poly=area.contour;
      p.moveTo(poly[0].x,poly[0].y);
      for(var j=1;j<poly.length;j++)p.lineTo(poly[j].x,poly[j].y);
      p.closePath();
      var rgb=area.paintRgb||area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);


// ---- v5m-material-adapters.js ----
// ALGO/ART V5m: source-guide-directed translucent physical tissue, preserving V7 and V5i geometry.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}

// V5k material edge. Keep the source polygon as an immutable ENVELOPE:
// sampled boundary vertices retreat *inwards* at a real physical tip/fibre
// scale; never invent new 2D regions or protrude into protected voids.
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

function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta,
        atmosphere=A.tissueV5kReduceAtmosphere;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      // V7's original atmosphere, graphite and all other pigment layers stay.
      // The V5l interpretation adds a physical source-owned layer on top.
      A.tissueV5kReduceAtmosphere=false;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta;
      A.tissueV5kReduceAtmosphere=atmosphere}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,area,painter,plan){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
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
      deposits++;
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
      deposits++;
    }
  }
  ctx.restore();mask.restore();
  return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter,plan);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.connectedFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


// V5m: render physical translucent deposits INSIDE the immutable V5i
// connected source field. Never draw a second polygonal composition.
function tissueColourField(ctx,area,plan){
  const border=area.contour||[],r=rng(area.seed+'|v5m-source-lamination'),
    colours=area.paintPalette||area.palette||[area.rgb],
    pigment=area.paintRgb||area.rgb;
  if(border.length<3)return {pieces:0,folds:0,deposits:0,edgeTouches:0};
  const outer=physicalEdgePath(area,'tissue'),
    guides=(plan.territories||[]).filter(g=>
      area.guideIds&&area.guideIds.includes(g.guideId));
  let pieces=0,folds=0,deposits=0,edgeTouches=0;
  const rgba=(c,a)=>'rgba('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+','+a.toFixed(3)+')';
  const sampleAxis=(axis,t,origin,angle)=>{
    if(axis.length<2)return {x:origin.x,y:origin.y,angle};
    const pos=t*(axis.length-1),j=Math.min(axis.length-2,Math.floor(pos)),
      u=pos-j,p=axis[j],z=axis[j+1];
    return {x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u,
      angle:Math.atan2(z.y-p.y,z.x-p.x)};
  };
  ctx.save();
  // V7's bloom, graphite, ribbons and original coloured washes have already
  // been drawn; do NOT fade or remove any of them.
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.20;
  ctx.fillStyle=hex(blend(pigment,[245,240,230],.19));
  ctx.fill(outer);pieces++;
  // All additions confined to the original field; protected voids were
  // clipped by tissueAdapter before entering this function.
  ctx.clip(outer);
  for(let gi=0;gi<guides.length;gi++){
    const guide=guides[gi],axis=guide.axis||[],
      origin={x:guide.x||area.x,y:guide.y||area.y},
      fallback=(guide.kind==='constructed-focal-form'&&guide.contour?.length)?Math.atan2(guide.contour[0].y-guide.y,guide.contour[0].x-guide.x):(guide.angle||0),
      base=colours[(gi+1)%colours.length]||pigment;
    // Independent wet-pigment deposits follow the ACTUAL guide's tangent.
    // Each has a feathered transversal profile, not a uniform polygon fill
    // or a chain of repeated straight equal-width strokes.
    for(let pass=0;pass<2;pass++){
      const n=pass===0?21:14;
      for(let k=0;k<n;k++){
        const t=clamp((k+.5+r.range(-.38,.38))/n,.015,.985),
          p=sampleAxis(axis,t,origin,fallback),angle=p.angle+
            r.range(-.13,.13),normal=angle+PI/2,
          lateral=r.range(-1,1)*(pass===0?33:48),
          cx=p.x+Math.cos(normal)*lateral,
          cy=p.y+Math.sin(normal)*lateral,
          radius=r.range(pass===0?15:9,pass===0?43:25),
          len=r.range(pass===0?36:19,pass===0?105:60),
          dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2,
          pigmentColour=blend(base,pass===0?pigment:[240,224,203],
            pass===0?.28:.16);
        // Soft transverse pigment gradient. The edges disappear gradually
        // into the original V7 wash instead of outlining a cut-out triangle.
        const grad=ctx.createLinearGradient(
          cx-Math.cos(normal)*radius,cy-Math.sin(normal)*radius,
          cx+Math.cos(normal)*radius,cy+Math.sin(normal)*radius);
        const intensity=(pass===0?.26:.19)*r.range(.65,1.25);
        grad.addColorStop(0,rgba(pigmentColour,.008));
        grad.addColorStop(.25,rgba(pigmentColour,intensity*.65));
        grad.addColorStop(.52,rgba(pigmentColour,intensity));
        grad.addColorStop(.80,rgba(pigmentColour,intensity*.53));
        grad.addColorStop(1,rgba(pigmentColour,.006));
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineJoin='round';
        ctx.strokeStyle=grad;ctx.lineWidth=radius*1.6;
        ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);
        ctx.quadraticCurveTo(cx+r.range(-6,6),cy+r.range(-6,6),
          cx+dx,cy+dy);ctx.stroke();deposits++;
      }
    }
    // Short discontinuous pressed-paper wrinkles parallel to original
    // branch/trajectory directions. No full-length dark graphite outlines.
    // Placed Constructed Forms supply a real guide orientation even when
    // they have no polyline axis. Use that physical direction as well.
    if(axis.length>1||Number.isFinite(guide.angle)){
      for(let i=0;i<(axis.length>1?12:6);i++){
        const t=r.range(.06,.94),p=sampleAxis(axis,t,origin,fallback),
          direction=p.angle+r.range(-.23,.23),
          off=r.range(-24,24),normal=direction+PI/2,
          x=p.x+Math.cos(normal)*off,
          y=p.y+Math.sin(normal)*off,
          len=r.range(7,31),dx=Math.cos(direction)*len/2,
          dy=Math.sin(direction)*len/2;
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=r.range(.13,.26);
        ctx.lineWidth=r.range(1.1,2.7);
        ctx.strokeStyle=hex(blend(pigment,[53,49,48],.48));
        ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);
        ctx.stroke();
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.21;ctx.lineWidth=.95;
        ctx.strokeStyle='#fff8e8';
        ctx.beginPath();ctx.moveTo(x-dx+1,y-dy+1);
        ctx.lineTo(x+dx+1,y+dy+1);ctx.stroke();folds++;
      }
    }
  }
  // Intermittent wetted pigment along real exterior edges, not the
  // V5l solid 10px dark ring. This preserves the visible V7 bloom outside.
  const edgeSeed=rng(area.seed+'|v5m-edge-fibres');
  for(let i=0;i<border.length;i++){
    const p=border[i],z=border[(i+1)%border.length],
      d=Math.hypot(z.x-p.x,z.y-p.y),
      intervals=Math.max(2,Math.ceil(d/18));
    for(let j=0;j<intervals;j++){
      if(!edgeSeed.chance(.56))continue;
      const t=j/intervals,u=Math.min(1,t+edgeSeed.range(.18,.74)/intervals),
        a={x:p.x+(z.x-p.x)*t,y:p.y+(z.y-p.y)*t},
        b={x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u};
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=edgeSeed.range(.13,.28);
      ctx.lineWidth=edgeSeed.range(2.5,5.4);
      ctx.lineCap='round';
      ctx.strokeStyle=hex(blend(pigment,[65,54,45],.28));
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.stroke();
      // Single sparse bright filament beside some torn edges. These stay
      // clipped to the legitimate contour, not outside into protected voids.
      if(edgeSeed.chance(.34)){
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.30;ctx.lineWidth=edgeSeed.range(.6,1.4);
        ctx.strokeStyle='#f9f2df';
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.stroke();
      }
      edgeTouches++;
    }
  }
  ctx.restore();
  return {pieces,folds,deposits,edgeTouches};
}
function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0,folds=0,deposits=0,edgeTouches=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    var fieldResult=tissueColourField(ctx,plan.connectedFields[fi],plan);
    fieldPieces+=fieldResult.pieces;folds+=fieldResult.folds;
    deposits+=fieldResult.deposits;edgeTouches+=fieldResult.edgeTouches;
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.connectedFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines,sourceFolds:folds,guideDeposits:deposits,
    edgeTouches:edgeTouches,v7AtmospherePreserved:true};
}
A.renderInterpretedV5M=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),plan=null;
  if(interpretation==='areas'){
    if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
    plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
      maxRegions:opts.maxRegions||28});
  }
  var sourceMeta=baseline(target,settings,scale,material,
    {...opts,hasConnectedFields:!!(plan&&plan.connectedFields.length)});
  if(interpretation==='faithful')return {
    version:'v5m-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(material==='tissue'&&plan.connectedFields.length){
    // V7's faithful renderer may leave an inherited clip or transform on
    // the target 2D context. Never paint the new fields through that state:
    // preserve the exact pixels, reset the presentation context, then
    // draw connected paper areas over the whole physical sheet.
    var faithfulCopy=document.createElement('canvas');
    faithfulCopy.width=target.width;faithfulCopy.height=target.height;
    faithfulCopy.getContext('2d').drawImage(target,0,0);
    target.width=target.width; // resets clip, transform and composite state
    target.getContext('2d').drawImage(faithfulCopy,0,0);
  }
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5m-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,connectedFields:plan.connectedFields.length,
    connectedStats:plan.connectedStats,fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5MInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5M=function(target,plan,scale){
    scale=scale||1;
    var ctx=target.getContext('2d');
    target.width=Math.round(plan.width*scale);
    target.height=Math.round(plan.height*scale);
    ctx=target.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
    for(var i=0;i<plan.connectedFields.length;i++){
      var area=plan.connectedFields[i],p=new Path2D(),poly=area.contour;
      p.moveTo(poly[0].x,poly[0].y);
      for(var j=1;j<poly.length;j++)p.lineTo(poly[j].x,poly[j].y);
      p.closePath();
      var rgb=area.paintRgb||area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);


// ---- v5n-material-adapters.js ----
// ALGO/ART V5n: material coverage for all source shapes; faithful V7 and V5i geometry stay frozen.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}

// V5k material edge. Keep the source polygon as an immutable ENVELOPE:
// sampled boundary vertices retreat *inwards* at a real physical tip/fibre
// scale; never invent new 2D regions or protrude into protected voids.
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

function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta,
        atmosphere=A.tissueV5kReduceAtmosphere;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      // V7's original atmosphere, graphite and all other pigment layers stay.
      // The V5l interpretation adds a physical source-owned layer on top.
      A.tissueV5kReduceAtmosphere=false;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta;
      A.tissueV5kReduceAtmosphere=atmosphere}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,area,painter,plan){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
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
      deposits++;
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
      deposits++;
    }
  }
  ctx.restore();mask.restore();
  return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter,plan);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.connectedFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


// V5m: render physical translucent deposits INSIDE the immutable V5i
// connected source field. Never draw a second polygonal composition.
function tissueColourField(ctx,area,plan){
  const border=area.contour||[],r=rng(area.seed+'|v5m-source-lamination'),
    colours=area.paintPalette||area.palette||[area.rgb],
    pigment=area.paintRgb||area.rgb;
  if(border.length<3)return {pieces:0,folds:0,deposits:0,edgeTouches:0};
  const outer=physicalEdgePath(area,'tissue'),
    guides=(plan.territories||[]).filter(g=>
      area.guideIds&&area.guideIds.includes(g.guideId));
  let pieces=0,folds=0,deposits=0,edgeTouches=0;
  const rgba=(c,a)=>'rgba('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+','+a.toFixed(3)+')';
  const sampleAxis=(axis,t,origin,angle)=>{
    if(axis.length<2)return {x:origin.x,y:origin.y,angle};
    const pos=t*(axis.length-1),j=Math.min(axis.length-2,Math.floor(pos)),
      u=pos-j,p=axis[j],z=axis[j+1];
    return {x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u,
      angle:Math.atan2(z.y-p.y,z.x-p.x)};
  };
  ctx.save();
  // V7's bloom, graphite, ribbons and original coloured washes have already
  // been drawn; do NOT fade or remove any of them.
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.20;
  ctx.fillStyle=hex(blend(pigment,[245,240,230],.19));
  ctx.fill(outer);pieces++;
  // All additions confined to the original field; protected voids were
  // clipped by tissueAdapter before entering this function.
  ctx.clip(outer);
  for(let gi=0;gi<guides.length;gi++){
    const guide=guides[gi],axis=guide.axis||[],
      origin={x:guide.x||area.x,y:guide.y||area.y},
      fallback=(guide.kind==='constructed-focal-form'&&guide.contour?.length)?Math.atan2(guide.contour[0].y-guide.y,guide.contour[0].x-guide.x):(guide.angle||0),
      base=colours[(gi+1)%colours.length]||pigment;
    // Independent wet-pigment deposits follow the ACTUAL guide's tangent.
    // Each has a feathered transversal profile, not a uniform polygon fill
    // or a chain of repeated straight equal-width strokes.
    for(let pass=0;pass<2;pass++){
      const n=pass===0?21:14;
      for(let k=0;k<n;k++){
        const t=clamp((k+.5+r.range(-.38,.38))/n,.015,.985),
          p=sampleAxis(axis,t,origin,fallback),angle=p.angle+
            r.range(-.13,.13),normal=angle+PI/2,
          lateral=r.range(-1,1)*(pass===0?33:48),
          cx=p.x+Math.cos(normal)*lateral,
          cy=p.y+Math.sin(normal)*lateral,
          radius=r.range(pass===0?15:9,pass===0?43:25),
          len=r.range(pass===0?36:19,pass===0?105:60),
          dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2,
          pigmentColour=blend(base,pass===0?pigment:[240,224,203],
            pass===0?.28:.16);
        // Soft transverse pigment gradient. The edges disappear gradually
        // into the original V7 wash instead of outlining a cut-out triangle.
        const grad=ctx.createLinearGradient(
          cx-Math.cos(normal)*radius,cy-Math.sin(normal)*radius,
          cx+Math.cos(normal)*radius,cy+Math.sin(normal)*radius);
        const intensity=(pass===0?.26:.19)*r.range(.65,1.25);
        grad.addColorStop(0,rgba(pigmentColour,.008));
        grad.addColorStop(.25,rgba(pigmentColour,intensity*.65));
        grad.addColorStop(.52,rgba(pigmentColour,intensity));
        grad.addColorStop(.80,rgba(pigmentColour,intensity*.53));
        grad.addColorStop(1,rgba(pigmentColour,.006));
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineJoin='round';
        ctx.strokeStyle=grad;ctx.lineWidth=radius*1.6;
        ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);
        ctx.quadraticCurveTo(cx+r.range(-6,6),cy+r.range(-6,6),
          cx+dx,cy+dy);ctx.stroke();deposits++;
      }
    }
    // Short discontinuous pressed-paper wrinkles parallel to original
    // branch/trajectory directions. No full-length dark graphite outlines.
    // Placed Constructed Forms supply a real guide orientation even when
    // they have no polyline axis. Use that physical direction as well.
    if(axis.length>1||Number.isFinite(guide.angle)){
      for(let i=0;i<(axis.length>1?12:6);i++){
        const t=r.range(.06,.94),p=sampleAxis(axis,t,origin,fallback),
          direction=p.angle+r.range(-.23,.23),
          off=r.range(-24,24),normal=direction+PI/2,
          x=p.x+Math.cos(normal)*off,
          y=p.y+Math.sin(normal)*off,
          len=r.range(7,31),dx=Math.cos(direction)*len/2,
          dy=Math.sin(direction)*len/2;
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=r.range(.13,.26);
        ctx.lineWidth=r.range(1.1,2.7);
        ctx.strokeStyle=hex(blend(pigment,[53,49,48],.48));
        ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);
        ctx.stroke();
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.21;ctx.lineWidth=.95;
        ctx.strokeStyle='#fff8e8';
        ctx.beginPath();ctx.moveTo(x-dx+1,y-dy+1);
        ctx.lineTo(x+dx+1,y+dy+1);ctx.stroke();folds++;
      }
    }
  }
  // Source-owned diffuse laminations fill the FIELD between paired
  // source guides. V5m pigment was concentrated around narrow axes and left
  // several meaningful forms visually untouched.
  const massR=rng(area.seed+'|v5n-pigment-coverage');
  const anchors=guides.length?guides.map(g=>({x:g.x,y:g.y})):
    [{x:area.x,y:area.y}];
  const spread=Math.max(16,Math.min(75,Math.sqrt(area.area||10000)*.34));
  for(let k=0;k<38;k++){
    const from=anchors[k%anchors.length],t=massR.range(.15,.99),
      angle=Math.atan2(area.y-from.y,area.x-from.x),
      off=massR.range(-spread*.6,spread*.6),
      x=from.x+(area.x-from.x)*t-Math.sin(angle)*off,
      y=from.y+(area.y-from.y)*t+Math.cos(angle)*off,
      rad=spread*massR.range(.4,1),
      c=blend(pigment,colours[k%colours.length]||pigment,.26),
      g=ctx.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,rgba(c,massR.range(.13,.28)));
    g.addColorStop(.65,rgba(c,.09));
    g.addColorStop(1,rgba(c,0));
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
    deposits++;
  }
  // Intermittent wetted pigment along real exterior edges, not the
  // V5l solid 10px dark ring. This preserves the visible V7 bloom outside.
  const edgeSeed=rng(area.seed+'|v5m-edge-fibres');
  for(let i=0;i<border.length;i++){
    const p=border[i],z=border[(i+1)%border.length],
      d=Math.hypot(z.x-p.x,z.y-p.y),
      intervals=Math.max(2,Math.ceil(d/18));
    for(let j=0;j<intervals;j++){
      if(!edgeSeed.chance(.56))continue;
      const t=j/intervals,u=Math.min(1,t+edgeSeed.range(.18,.74)/intervals),
        a={x:p.x+(z.x-p.x)*t,y:p.y+(z.y-p.y)*t},
        b={x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u};
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=edgeSeed.range(.13,.28);
      ctx.lineWidth=edgeSeed.range(2.5,5.4);
      ctx.lineCap='round';
      ctx.strokeStyle=hex(blend(pigment,[65,54,45],.28));
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.stroke();
      // Single sparse bright filament beside some torn edges. These stay
      // clipped to the legitimate contour, not outside into protected voids.
      if(edgeSeed.chance(.34)){
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.30;ctx.lineWidth=edgeSeed.range(.6,1.4);
        ctx.strokeStyle='#f9f2df';
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.stroke();
      }
      edgeTouches++;
    }
  }
  ctx.restore();
  return {pieces,folds,deposits,edgeTouches};
}
// Physical treatment of PAINTED source guides left out of V5i's
// maximal-visibility PAIR selection. Never interpret framed negative space.
function tissueUnpairedGuide(ctx,guide){
  const poly=guide.contour||[];
  if(poly.length<4||!guide.sources?.length||guide.role!=='painted')return 0;
  const p=new Path2D(),r=rng(guide.seed+'|v5n-single-guide');
  p.moveTo(poly[0].x,poly[0].y);
  for(let i=1;i<poly.length;i++)p.lineTo(poly[i].x,poly[i].y);
  p.closePath();
  const colour=guide.rgb,axis=guide.axis||[],
    origin={x:guide.x,y:guide.y},
    theta=guide.kind==='constructed-focal-form'?
      Math.atan2(poly[0].y-origin.y,poly[0].x-origin.x):
      (guide.angle||0),
    spread=Math.max(11,Math.min(42,Math.min(guide.width,guide.height)*.4));
  ctx.save();ctx.clip(p);
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.21;
  ctx.fillStyle=hex(blend(colour,[245,240,230],.3));ctx.fill(p);
  for(let k=0;k<19;k++){
    const t=(k+.5)/19,q=axis.length>1?
      axis[Math.min(axis.length-1,Math.floor(t*(axis.length-1)))]:origin,
      dx=Math.cos(theta),dy=Math.sin(theta),offset=r.range(-spread,spread),
      x=q.x-dy*offset,y=q.y+dx*offset,rad=spread*r.range(.5,1.25),
      grad=ctx.createRadialGradient(x,y,0,x,y,rad),
      clr=colour.join(',');
    grad.addColorStop(0,'rgba('+clr+','+r.range(.12,.25).toFixed(3)+')');
    grad.addColorStop(.7,'rgba('+clr+',.05)');
    grad.addColorStop(1,'rgba('+clr+',0)');
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
  }
  ctx.restore();return 19;
}
function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0,folds=0,deposits=0,edgeTouches=0,
    unpairedGuides=0,unpairedDeposits=0,paintedGuides=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    var fieldResult=tissueColourField(ctx,plan.connectedFields[fi],plan);
    fieldPieces+=fieldResult.pieces;folds+=fieldResult.folds;
    deposits+=fieldResult.deposits;edgeTouches+=fieldResult.edgeTouches;
  }
  // V5i keeps only a visible subset of the true source relations.
  // Give remaining painted source shapes a restrained original-contour glaze.
  if((plan.connectedFields||[]).length){
    const paired=new Set(plan.connectedFields.flatMap(f=>f.guideIds));
    for(const g of (plan.territories||[])){
      if(g.role!=='painted'||g.kind==='rect-cell'||!g.sources?.length)continue;
      paintedGuides++;
      if(paired.has(g.guideId))continue;
      const amount=tissueUnpairedGuide(ctx,g);
      if(amount){unpairedGuides++;unpairedDeposits+=amount;}
    }
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.connectedFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines,sourceFolds:folds,guideDeposits:deposits,
    edgeTouches:edgeTouches,unpairedGuides:unpairedGuides,
    unpairedDeposits:unpairedDeposits,paintedGuides:paintedGuides,
    v7AtmospherePreserved:true};
}
A.renderInterpretedV5N=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),plan=null;
  if(interpretation==='areas'){
    if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
    plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
      maxRegions:opts.maxRegions||28});
  }
  var sourceMeta=baseline(target,settings,scale,material,
    {...opts,hasConnectedFields:!!(plan&&plan.connectedFields.length)});
  if(interpretation==='faithful')return {
    version:'v5n-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(material==='tissue'&&plan.connectedFields.length){
    // V7's faithful renderer may leave an inherited clip or transform on
    // the target 2D context. Never paint the new fields through that state:
    // preserve the exact pixels, reset the presentation context, then
    // draw connected paper areas over the whole physical sheet.
    var faithfulCopy=document.createElement('canvas');
    faithfulCopy.width=target.width;faithfulCopy.height=target.height;
    faithfulCopy.getContext('2d').drawImage(target,0,0);
    target.width=target.width; // resets clip, transform and composite state
    target.getContext('2d').drawImage(faithfulCopy,0,0);
  }
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5n-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,connectedFields:plan.connectedFields.length,
    connectedStats:plan.connectedStats,fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5NInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5N=function(target,plan,scale){
    scale=scale||1;
    var ctx=target.getContext('2d');
    target.width=Math.round(plan.width*scale);
    target.height=Math.round(plan.height*scale);
    ctx=target.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
    for(var i=0;i<plan.connectedFields.length;i++){
      var area=plan.connectedFields[i],p=new Path2D(),poly=area.contour;
      p.moveTo(poly[0].x,poly[0].y);
      for(var j=1;j<poly.length;j++)p.lineTo(poly[j].x,poly[j].y);
      p.closePath();
      var rgb=area.paintRgb||area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);


// ---- composition-broad-connections-v5o.js ----
// V5o experiment: broad source-connected pigment masses. Composition geometry
// is derived ONLY from recorded V5d guides and their meaningful relations.
// This does not raster-segment a finished image or change faithful V7.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5jTest||!A.compositionV5iTest||!A.planCompositionV5FromSource)
  throw Error('V5o requires recorded V5d/V5i guides and V5j pigments');
const previous=A.planCompositionV5FromSource;
const PHI=(1+Math.sqrt(5))/2, VERSION='v5o-expanded-source-connections-1';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hull(points){
 const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),
   cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),
   lower=[],upper=[];
 for(const p of sorted){
   while(lower.length>1&&cross(lower[lower.length-2],lower.at(-1),p)<=0)lower.pop();
   lower.push(p);
 }
 for(let i=sorted.length-1;i>=0;i--){
   const p=sorted[i];
   while(upper.length>1&&cross(upper[upper.length-2],upper.at(-1),p)<=0)upper.pop();
   upper.push(p);
 }
 return lower.slice(0,-1).concat(upper.slice(0,-1)).map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2)}));
}
function bounds(poly){
 const xx=poly.map(p=>p.x),yy=poly.map(p=>p.y),
   x=Math.min(...xx),y=Math.min(...yy);
 return {x,y,w:Math.max(...xx)-x,h:Math.max(...yy)-y};
}
function area(poly){
 let v=0;for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];v+=a.x*b.y-b.x*a.y;
 }
 return Math.abs(v)/2;
}
function inside(p,poly){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a.y>p.y)!==(b.y>p.y)&&p.x<
     (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }
 return yes;
}
function occupancy(poly,plan){
 const step=10,nx=Math.ceil(plan.width/step),
   ny=Math.ceil(plan.height/step),rect=bounds(poly),cells=[];
 for(let y=Math.max(0,Math.floor(rect.y/step));y<Math.min(ny,Math.ceil((rect.y+rect.h)/step));y++)
 for(let x=Math.max(0,Math.floor(rect.x/step));x<Math.min(nx,Math.ceil((rect.x+rect.w)/step));x++){
  const p={x:(x+.5)*step,y:(y+.5)*step};
  if((plan.protectedVoids||[]).some(v=>
    p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h))continue;
  if(inside(p,poly))cells.push(y*nx+x);
 }
 return {cells,gridCell:step,gridWidth:nx};
}
function linked(a,b,plan){
 if(a===b||a.kind!==b.kind||a.role!=='painted'||b.role!=='painted')
   return false;
 const d=dist(a,b),limit=Math.hypot(plan.width,plan.height)/(PHI*1.70);
 if(d>limit)return false;
 if(a.kind==='organic-branch')return (
   a.branch===b.branch||
   (Math.abs(a.depth-b.depth)<=1&&Math.abs(a.guideIndex-b.guideIndex)<=9));
 if(a.kind==='trajectory-ribbon')return (
   a.arm===b.arm&&Math.abs(a.guideIndex-b.guideIndex)<=100);
 if(a.kind==='constructed-focal-form')return (
   a.tier==='hero'||b.tier==='hero'||d<limit*.65);
 return false;
}
function candidates(plan){
 const guides=(plan.territories||[]).filter(g=>g.role==='painted'&&
   g.kind!=='rect-cell'&&g.sources?.length&&g.contour?.length>=4);
 const framed=(plan.territories||[]).filter(g=>g.role==='framed'&&
   g.kind!=='rect-cell'&&g.contour?.length>=4);
 const chosen=[],seen=new Set(),maxArea=plan.width*plan.height;
 const eligible=(group)=>{
  const key=group.map(g=>g.guideId).sort().join('|');
  if(seen.has(key))return;
  seen.add(key);
  if(group.length<2||group.length>4)return;
  const contour=hull(group.flatMap(g=>g.contour));
  if(contour.length<3)return;
  const b=bounds(contour),physical=area(contour),
    fraction=physical/maxArea;
  // True linked masses can be larger than old V5i 2-3% territories,
  // but must not swallow an entire portrait or its retained voids.
  if(fraction<(plan.guideStats?.kind==='constructed'?.018:.030)||fraction>.115||b.w>plan.width*.69||
       b.h>plan.height*.72)return;
  if(A.compositionV5cTest.intersectsProtected(contour,plan.protectedVoids))return;
  // Framed guide centres are explicitly NOT part of the painted mass.
  if(framed.some(f=>inside({x:f.x,y:f.y},contour)))return;
  const occ=occupancy(contour,plan);
  if(occ.cells.length<210)return;
  const involved=new Set(group.map(g=>g.guideId)),
    support=group.map(g=>g.sources||[]).flat(),
    seed=A.hash(plan.seed+'|v5o|'+key)>>>0,
    cx=b.x+b.w/2,cy=b.y+b.h/2;
  chosen.push({id:key,guideIds:group.map(g=>g.guideId),
    sources:[...new Set(support)],contour,box:b,
    x:cx,y:cy,area:occ.cells.length*100,seed,
    cells:occ.cells,...occ,
    rgb:group[0].rgb.slice(),
    palette:group.map(g=>g.rgb.slice()),fraction,
    guideCount:group.length});
 };
 // Connect actual existing edges of the source graph. Three/four-guide
 // chains are only allowed if each next node relates to a member already
 // selected; none can jump between distinct golden arms.
 for(let i=0;i<guides.length;i++)
 for(let j=i+1;j<guides.length;j++){
   const a=guides[i],b=guides[j];
   if(!linked(a,b,plan))continue;
   eligible([a,b]);
   for(let k=j+1;k<guides.length;k++){
     const c=guides[k];
     if(!linked(a,c,plan)&&!linked(b,c,plan))continue;
     eligible([a,b,c]);
     for(let m=k+1;m<guides.length;m++){
       const d=guides[m];
       if(linked(a,d,plan)||linked(b,d,plan)||linked(c,d,plan))
         eligible([a,b,c,d]);
     }
   }
 }
 return chosen;
}
function enrich(source,settings,opts){
 opts=opts||{};
 const plan=previous(source,settings,opts),
   original=plan.connectedFields||[];
 if(!original.length){plan.broadConnectionStats={count:0};return plan}
 const pool=candidates(plan),existing=new Set(original.flatMap(f=>f.guideIds)),
   unionOfOriginal=new Set(original.flatMap(f=>f.cells)),
   large=[],occupied=new Set(),target=Math.min(5,opts.maxBroadConnections||4);
 const footprint=c=>new Set(c.cells);
 const ratio=(a,b)=>{let count=0;
   for(const x of a)if(b.has(x))count++;
   return count/a.size;
 };
 const ranked=pool.map(c=>{
   const cells=footprint(c);
   let novelty=0;for(const x of cells)if(!unionOfOriginal.has(x))novelty++;
   const unique=c.guideIds.filter(g=>!existing.has(g)).length;
   const size=c.area/(plan.width*plan.height);
   return {...c,set:cells,novelty:novelty/cells.size,
      score:size*115+unique*3+c.guideCount*.42+
        novelty/cells.size*5.5};
 }).filter(c=>c.novelty>=.20).sort((a,b)=>b.score-a.score||
    a.id.localeCompare(b.id));
 // Prefer several distinct medium/large source-connected relationships.
 // Four-guide spans can lead the hierarchy, but after that, select linked
 // two/three-guide bridges before any more large four-guide envelopes.
 const preferred=[...ranked.filter(c=>c.guideCount<=3),
   ...ranked.filter(c=>c.guideCount===4)];
 const first=ranked[0];
 if(first&&first.guideCount===4)preferred.unshift(first);
 const placed=new Set();
 for(const c of preferred){
   if(large.length>=target)break;
   if(placed.has(c.id))continue;
   placed.add(c.id);
   // Refuse nearly identical coverage, but permit distinct, overlapping
   // links where the source graph really shares a branch/arm/form.
   if(large.some(other=>ratio(c.set,other.set)>.76&&
     ratio(other.set,c.set)>.76))continue;
   const idEdges=c.guideIds.flatMap((id,i)=>c.guideIds.slice(i+1)
     .map(z=>[id,z].sort().join('|')));
   const existingEdges=new Set(large.flatMap(f=>
     f.guideIds.flatMap((id,i)=>f.guideIds.slice(i+1)
       .map(z=>[id,z].sort().join('|')))));
   if(large.length&&idEdges.every(e=>existingEdges.has(e)))continue;
   large.push(c);
 }
 // Larger, source-owned spans lie BELOW the old small connected fields;
 // they support composition without painting over all local details.
 const broad=large.map((c,i)=>{
   const guideIds=c.guideIds.slice();
   return {id:'GO'+i,kind:'guide-chain-colour-mass',
      role:i?'supporting':'primary',relationKind:plan.guideStats.kind,
      guideIds,sourceIndices:c.sources.slice(),sources:c.sources.slice(),
      contour:c.contour,box:c.box,x:c.x,y:c.y,width:c.box.w,height:c.box.h,
      area:c.area,fillFraction:c.area/(c.box.w*c.box.h),
      components:1,occupiedCells:c.cells.length,
      cells:c.cells,gridCell:c.gridCell,gridWidth:c.gridWidth,
      rgb:c.rgb,palette:c.palette,seed:c.seed,guideCount:c.guideCount,
      geometricSource:'existing painted V5d guide contours and semantic graph'};
 });
 plan.connectedFields=broad.concat(original);
 plan.materialStats=A.compositionV5jTest.assign(plan.connectedFields);
 plan.broadConnectionStats={
   count:broad.length,candidates:pool.length,
   originalCount:original.length,totalCount:plan.connectedFields.length,
   originalUnion:unionOfOriginal.size*100,
   newSpans:broad.map(f=>({id:f.id,guideIds:f.guideIds,
     fraction:+(f.area/(plan.width*plan.height)).toFixed(4),
     sourceCount:f.sources.length,guideCount:f.guideCount})),
   maxSpanFraction:broad.length?Math.max(...broad.map(f=>
     f.area/(plan.width*plan.height))):0};
 plan.connectedStats={...plan.connectedStats,
   count:plan.connectedFields.length,broadCount:broad.length,
   totalUnionArea:(new Set(plan.connectedFields.flatMap(f=>f.cells))).size*100,
   sourceLinked:plan.connectedFields.every(f=>f.guideIds.length>=2&&
     f.sources.length>0)};
 plan.version=VERSION;
 plan.interpretation='source-connected-broad-guide-chains';
 return plan;
}
A.compositionV5jFromSource=previous;
A.planCompositionV5FromSource=enrich;
A.planCompositionV5=(settings,opts)=>enrich(A.captureCompositionV5(settings,opts),settings,opts);
A.compositionV5oTest={candidates,linked,occupancy,area,hull};
A.compositionV5Version=VERSION;
})(window.AlgoArt);


// ---- v5o-material-adapters.js ----
// ALGO/ART V5o: more and larger real guide connections. Preserve faithful V7.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}

// V5k material edge. Keep the source polygon as an immutable ENVELOPE:
// sampled boundary vertices retreat *inwards* at a real physical tip/fibre
// scale; never invent new 2D regions or protrude into protected voids.
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

function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta,
        atmosphere=A.tissueV5kReduceAtmosphere;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      // V7's original atmosphere, graphite and all other pigment layers stay.
      // The V5l interpretation adds a physical source-owned layer on top.
      A.tissueV5kReduceAtmosphere=false;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta;
      A.tissueV5kReduceAtmosphere=atmosphere}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,area,painter,plan){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
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
      deposits++;
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
      deposits++;
    }
  }
  ctx.restore();mask.restore();
  return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter,plan);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.connectedFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


// V5m: render physical translucent deposits INSIDE the immutable V5i
// connected source field. Never draw a second polygonal composition.
function tissueColourField(ctx,area,plan){
  const border=area.contour||[],r=rng(area.seed+'|v5m-source-lamination'),
    colours=area.paintPalette||area.palette||[area.rgb],
    pigment=area.paintRgb||area.rgb;
  if(border.length<3)return {pieces:0,folds:0,deposits:0,edgeTouches:0};
  const outer=physicalEdgePath(area,'tissue'),
    guides=(plan.territories||[]).filter(g=>
      area.guideIds&&area.guideIds.includes(g.guideId));
  let pieces=0,folds=0,deposits=0,edgeTouches=0;
  const rgba=(c,a)=>'rgba('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+','+a.toFixed(3)+')';
  const sampleAxis=(axis,t,origin,angle)=>{
    if(axis.length<2)return {x:origin.x,y:origin.y,angle};
    const pos=t*(axis.length-1),j=Math.min(axis.length-2,Math.floor(pos)),
      u=pos-j,p=axis[j],z=axis[j+1];
    return {x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u,
      angle:Math.atan2(z.y-p.y,z.x-p.x)};
  };
  ctx.save();
  // V7's bloom, graphite, ribbons and original coloured washes have already
  // been drawn; do NOT fade or remove any of them.
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.20;
  ctx.fillStyle=hex(blend(pigment,[245,240,230],.19));
  ctx.fill(outer);pieces++;
  // All additions confined to the original field; protected voids were
  // clipped by tissueAdapter before entering this function.
  ctx.clip(outer);
  for(let gi=0;gi<guides.length;gi++){
    const guide=guides[gi],axis=guide.axis||[],
      origin={x:guide.x||area.x,y:guide.y||area.y},
      fallback=(guide.kind==='constructed-focal-form'&&guide.contour?.length)?Math.atan2(guide.contour[0].y-guide.y,guide.contour[0].x-guide.x):(guide.angle||0),
      base=colours[(gi+1)%colours.length]||pigment;
    // Independent wet-pigment deposits follow the ACTUAL guide's tangent.
    // Each has a feathered transversal profile, not a uniform polygon fill
    // or a chain of repeated straight equal-width strokes.
    for(let pass=0;pass<2;pass++){
      const n=pass===0?21:14;
      for(let k=0;k<n;k++){
        const t=clamp((k+.5+r.range(-.38,.38))/n,.015,.985),
          p=sampleAxis(axis,t,origin,fallback),angle=p.angle+
            r.range(-.13,.13),normal=angle+PI/2,
          lateral=r.range(-1,1)*(pass===0?33:48),
          cx=p.x+Math.cos(normal)*lateral,
          cy=p.y+Math.sin(normal)*lateral,
          radius=r.range(pass===0?15:9,pass===0?43:25),
          len=r.range(pass===0?36:19,pass===0?105:60),
          dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2,
          pigmentColour=blend(base,pass===0?pigment:[240,224,203],
            pass===0?.28:.16);
        // Soft transverse pigment gradient. The edges disappear gradually
        // into the original V7 wash instead of outlining a cut-out triangle.
        const grad=ctx.createLinearGradient(
          cx-Math.cos(normal)*radius,cy-Math.sin(normal)*radius,
          cx+Math.cos(normal)*radius,cy+Math.sin(normal)*radius);
        const intensity=(pass===0?.26:.19)*r.range(.65,1.25);
        grad.addColorStop(0,rgba(pigmentColour,.008));
        grad.addColorStop(.25,rgba(pigmentColour,intensity*.65));
        grad.addColorStop(.52,rgba(pigmentColour,intensity));
        grad.addColorStop(.80,rgba(pigmentColour,intensity*.53));
        grad.addColorStop(1,rgba(pigmentColour,.006));
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineJoin='round';
        ctx.strokeStyle=grad;ctx.lineWidth=radius*1.6;
        ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);
        ctx.quadraticCurveTo(cx+r.range(-6,6),cy+r.range(-6,6),
          cx+dx,cy+dy);ctx.stroke();deposits++;
      }
    }
    // Short discontinuous pressed-paper wrinkles parallel to original
    // branch/trajectory directions. No full-length dark graphite outlines.
    // Placed Constructed Forms supply a real guide orientation even when
    // they have no polyline axis. Use that physical direction as well.
    if(axis.length>1||Number.isFinite(guide.angle)){
      for(let i=0;i<(axis.length>1?12:6);i++){
        const t=r.range(.06,.94),p=sampleAxis(axis,t,origin,fallback),
          direction=p.angle+r.range(-.23,.23),
          off=r.range(-24,24),normal=direction+PI/2,
          x=p.x+Math.cos(normal)*off,
          y=p.y+Math.sin(normal)*off,
          len=r.range(7,31),dx=Math.cos(direction)*len/2,
          dy=Math.sin(direction)*len/2;
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=r.range(.13,.26);
        ctx.lineWidth=r.range(1.1,2.7);
        ctx.strokeStyle=hex(blend(pigment,[53,49,48],.48));
        ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);
        ctx.stroke();
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.21;ctx.lineWidth=.95;
        ctx.strokeStyle='#fff8e8';
        ctx.beginPath();ctx.moveTo(x-dx+1,y-dy+1);
        ctx.lineTo(x+dx+1,y+dy+1);ctx.stroke();folds++;
      }
    }
  }
  // Source-owned diffuse laminations fill the FIELD between paired
  // source guides. V5m pigment was concentrated around narrow axes and left
  // several meaningful forms visually untouched.
  const massR=rng(area.seed+'|v5n-pigment-coverage');
  const anchors=guides.length?guides.map(g=>({x:g.x,y:g.y})):
    [{x:area.x,y:area.y}];
  const spread=Math.max(16,Math.min(75,Math.sqrt(area.area||10000)*.34));
  for(let k=0;k<38;k++){
    const from=anchors[k%anchors.length],t=massR.range(.15,.99),
      angle=Math.atan2(area.y-from.y,area.x-from.x),
      off=massR.range(-spread*.6,spread*.6),
      x=from.x+(area.x-from.x)*t-Math.sin(angle)*off,
      y=from.y+(area.y-from.y)*t+Math.cos(angle)*off,
      rad=spread*massR.range(.4,1),
      c=blend(pigment,colours[k%colours.length]||pigment,.26),
      g=ctx.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,rgba(c,massR.range(.13,.28)));
    g.addColorStop(.65,rgba(c,.09));
    g.addColorStop(1,rgba(c,0));
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
    deposits++;
  }
  // Intermittent wetted pigment along real exterior edges, not the
  // V5l solid 10px dark ring. This preserves the visible V7 bloom outside.
  const edgeSeed=rng(area.seed+'|v5m-edge-fibres');
  for(let i=0;i<border.length;i++){
    const p=border[i],z=border[(i+1)%border.length],
      d=Math.hypot(z.x-p.x,z.y-p.y),
      intervals=Math.max(2,Math.ceil(d/18));
    for(let j=0;j<intervals;j++){
      if(!edgeSeed.chance(.56))continue;
      const t=j/intervals,u=Math.min(1,t+edgeSeed.range(.18,.74)/intervals),
        a={x:p.x+(z.x-p.x)*t,y:p.y+(z.y-p.y)*t},
        b={x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u};
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=edgeSeed.range(.13,.28);
      ctx.lineWidth=edgeSeed.range(2.5,5.4);
      ctx.lineCap='round';
      ctx.strokeStyle=hex(blend(pigment,[65,54,45],.28));
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.stroke();
      // Single sparse bright filament beside some torn edges. These stay
      // clipped to the legitimate contour, not outside into protected voids.
      if(edgeSeed.chance(.34)){
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.30;ctx.lineWidth=edgeSeed.range(.6,1.4);
        ctx.strokeStyle='#f9f2df';
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.stroke();
      }
      edgeTouches++;
    }
  }
  ctx.restore();
  return {pieces,folds,deposits,edgeTouches};
}
// Physical treatment of PAINTED source guides left out of V5i's
// maximal-visibility PAIR selection. Never interpret framed negative space.
function tissueUnpairedGuide(ctx,guide){
  const poly=guide.contour||[];
  if(poly.length<4||!guide.sources?.length||guide.role!=='painted')return 0;
  const p=new Path2D(),r=rng(guide.seed+'|v5n-single-guide');
  p.moveTo(poly[0].x,poly[0].y);
  for(let i=1;i<poly.length;i++)p.lineTo(poly[i].x,poly[i].y);
  p.closePath();
  const colour=guide.rgb,axis=guide.axis||[],
    origin={x:guide.x,y:guide.y},
    theta=guide.kind==='constructed-focal-form'?
      Math.atan2(poly[0].y-origin.y,poly[0].x-origin.x):
      (guide.angle||0),
    spread=Math.max(11,Math.min(42,Math.min(guide.width,guide.height)*.4));
  ctx.save();ctx.clip(p);
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.21;
  ctx.fillStyle=hex(blend(colour,[245,240,230],.3));ctx.fill(p);
  for(let k=0;k<19;k++){
    const t=(k+.5)/19,q=axis.length>1?
      axis[Math.min(axis.length-1,Math.floor(t*(axis.length-1)))]:origin,
      dx=Math.cos(theta),dy=Math.sin(theta),offset=r.range(-spread,spread),
      x=q.x-dy*offset,y=q.y+dx*offset,rad=spread*r.range(.5,1.25),
      grad=ctx.createRadialGradient(x,y,0,x,y,rad),
      clr=colour.join(',');
    grad.addColorStop(0,'rgba('+clr+','+r.range(.12,.25).toFixed(3)+')');
    grad.addColorStop(.7,'rgba('+clr+',.05)');
    grad.addColorStop(1,'rgba('+clr+',0)');
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
  }
  ctx.restore();return 19;
}
function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0,folds=0,deposits=0,edgeTouches=0,
    unpairedGuides=0,unpairedDeposits=0,paintedGuides=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    var fieldResult=tissueColourField(ctx,plan.connectedFields[fi],plan);
    fieldPieces+=fieldResult.pieces;folds+=fieldResult.folds;
    deposits+=fieldResult.deposits;edgeTouches+=fieldResult.edgeTouches;
  }
  // V5i keeps only a visible subset of the true source relations.
  // Give remaining painted source shapes a restrained original-contour glaze.
  if((plan.connectedFields||[]).length){
    const paired=new Set(plan.connectedFields.flatMap(f=>f.guideIds));
    for(const g of (plan.territories||[])){
      if(g.role!=='painted'||g.kind==='rect-cell'||!g.sources?.length)continue;
      paintedGuides++;
      if(paired.has(g.guideId))continue;
      const amount=tissueUnpairedGuide(ctx,g);
      if(amount){unpairedGuides++;unpairedDeposits+=amount;}
    }
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.connectedFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines,sourceFolds:folds,guideDeposits:deposits,
    edgeTouches:edgeTouches,unpairedGuides:unpairedGuides,
    unpairedDeposits:unpairedDeposits,paintedGuides:paintedGuides,
    v7AtmospherePreserved:true};
}
A.renderInterpretedV5O=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),plan=null;
  if(interpretation==='areas'){
    if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
    plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
      maxRegions:opts.maxRegions||28});
  }
  var sourceMeta=baseline(target,settings,scale,material,
    {...opts,hasConnectedFields:!!(plan&&plan.connectedFields.length)});
  if(interpretation==='faithful')return {
    version:'v5o-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(material==='tissue'&&plan.connectedFields.length){
    // V7's faithful renderer may leave an inherited clip or transform on
    // the target 2D context. Never paint the new fields through that state:
    // preserve the exact pixels, reset the presentation context, then
    // draw connected paper areas over the whole physical sheet.
    var faithfulCopy=document.createElement('canvas');
    faithfulCopy.width=target.width;faithfulCopy.height=target.height;
    faithfulCopy.getContext('2d').drawImage(target,0,0);
    target.width=target.width; // resets clip, transform and composite state
    target.getContext('2d').drawImage(faithfulCopy,0,0);
  }
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5o-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,connectedFields:plan.connectedFields.length,
    connectedStats:plan.connectedStats,fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5OInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5O=function(target,plan,scale){
    scale=scale||1;
    var ctx=target.getContext('2d');
    target.width=Math.round(plan.width*scale);
    target.height=Math.round(plan.height*scale);
    ctx=target.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
    for(var i=0;i<plan.connectedFields.length;i++){
      var area=plan.connectedFields[i],p=new Path2D(),poly=area.contour;
      p.moveTo(poly[0].x,poly[0].y);
      for(var j=1;j<poly.length;j++)p.lineTo(poly[j].x,poly[j].y);
      p.closePath();
      var rgb=area.paintRgb||area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);


// ---- v5p-material-adapters.js ----
// ALGO/ART V5p: torn edges, source-link tissue sheets and joint pooling on frozen V5o geometry.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}

// V5k material edge. Keep the source polygon as an immutable ENVELOPE:
// sampled boundary vertices retreat *inwards* at a real physical tip/fibre
// scale; never invent new 2D regions or protrude into protected voids.
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

function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72,
      reuseCompositionCapture:opts.reuseCompositionCapture===true,
      sourceCapture:opts.sourceCapture||null});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta,
        atmosphere=A.tissueV5kReduceAtmosphere;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      // V7's original atmosphere, graphite and all other pigment layers stay.
      // The V5l interpretation adds a physical source-owned layer on top.
      A.tissueV5kReduceAtmosphere=false;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta;
      A.tissueV5kReduceAtmosphere=atmosphere}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,area,painter,plan){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
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
      deposits++;
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
      deposits++;
    }
  }
  ctx.restore();mask.restore();
  return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter,plan);
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var adapterProfile=A.oilStageEAdapterProfile||null,adapterStart=performance.now();
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  if(adapterProfile)adapterProfile.canvasReadMs=performance.now()-adapterStart;
  adapterStart=performance.now();
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var cached=A.oilStageECachedLightingExperimental===true,
      // Never pay for a rolling cache in tiny previews; the larger export
      // pass amortises its row setup and uses only 7*width*8 extra bytes.
      rolling=!cached&&h>10&&(A.oilStageERollingLightingExperimental===true||
        (A.oilStageEAdaptiveLightingExperimental===true&&w*h>=900000)),
      heights=null,rows=null,fillOpticalRow=null;
  if(cached){
    // Float64 preserves the original Math.log1p without quantisation.
    // PNG parity is the release gate, not a visually approximate cache.
    heights=new Float64Array(field.length);
    for(i=0;i<field.length;i++){
      if(field[i]>0)heights[i]=Math.log1p(field[i]*.66);
    }
  }else if(rolling){
    // Seven-row sliding window instead of 11.2 MB at 1400x1000.
    // Reuse the row 7 behind; neighbouring normals need at most +/-3.
    rows=Array.from({length:7},function(){return new Float64Array(w)});
    fillOpticalRow=function(row){
      var targetRow=rows[row%7],sourceStart=row*w;
      for(var xx=0;xx<w;xx++){
        var hVal=field[sourceStart+xx];
        targetRow[xx]=hVal>0?Math.log1p(hVal*.66):0;
      }
    };
    for(var initialRow=1;initialRow<=7;initialRow++)fillOpticalRow(initialRow);
  }
  if(adapterProfile){
    adapterProfile.heightPrepMs=performance.now()-adapterStart;
    adapterProfile.extraHeightBytes=heights?heights.byteLength:rows?7*w*8:0;
  }
  adapterStart=performance.now();
  var sample=0;
  for(var y=4;y<h-4;y++){
    for(var x=4;x<w-4;x++){
      var index=y*w+x; if(field[index]<.06)continue;
      var light=cached?
          A.oilPaintV4ETest.surfaceLightingCached(heights,w,h,x,y,.88):
          rolling?A.oilPaintV4ETest.surfaceLightingCachedRows(rows,x,y,.88):
          A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
          z=index*4;
      for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
        pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
      sample++;
    }
    if(rolling&&y+4<h)fillOpticalRow(y+4);
  }
  if(adapterProfile){
    adapterProfile.shadeMs=performance.now()-adapterStart;
    adapterProfile.raisedPixels=sample;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.connectedFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


// V5m: render physical translucent deposits INSIDE the immutable V5i
// connected source field. Never draw a second polygonal composition.

// V5p1/2/3: MATERIAL handling only for V5o's existing broader fields.
// There are NO new composition polygons. Every contour is clipped to the
// exact old V5o source-owned hull and every tissue strip follows a verified
// existing semantic connection between actual V5d guide centres.
function tissueBroadFieldV5P(ctx,area,plan,stage){
  const PHI=(1+Math.sqrt(5))/2;
  const source=area.contour||[];
  if(source.length<3)return {pieces:0,folds:0,deposits:0,edgeTouches:0,
    laminations:0,junctionPools:0};
  const r=rng(area.seed+'|v5p-physical-sheets');
  const pigment=area.paintRgb||area.rgb;
  const palette=area.paintPalette||area.palette||[pigment];
  const centres=new Map((plan.territories||[])
    .filter(g=>area.guideIds?.includes(g.guideId)).map(g=>[g.guideId,g]));
  const guides=area.guideIds.map(id=>centres.get(id)).filter(Boolean);
  const fullHull=massContour(area),edge=new Path2D(),
    cx=area.x,cy=area.y;
  let pieces=0,folds=0,deposits=0,edgeTouches=0,
    laminations=0,junctionPools=0;
  const rgbAlpha=(col,a)=>'rgba('+col.map(v=>Math.round(clamp(v,0,255))).join(',')+
     ','+clamp(a,0,1).toFixed(3)+')';
  // The original convex hull is a NON-PAINTABLE hard envelope, not a
  // visually rendered straight-edged polygon. Retreat and vary each edge
  // by several frequencies at actual fibre scales. No outward overspray.
  const sampled=[];
  let travel=0;
  for(let i=0;i<source.length;i++){
    const a=source[i],b=source[(i+1)%source.length],
      len=Math.hypot(b.x-a.x,b.y-a.y),
      count=Math.max(3,Math.ceil(len/4.5));
    for(let j=0;j<count;j++){
      const t=j/count,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,
        d=Math.hypot(x-cx,y-cy)||1,
        // Long irregular runs break the perceived original straight hull,
        // with shorter separate tear/fibre variations laid above.
        slow=Math.sin((travel+len*t)*.026+i*.57),
        mid=Math.sin((travel+len*t)*.108+i*1.7),
        fast=Math.sin((travel+len*t)*.45+i*.29),
        inset=clamp(7+4.9*slow+2.4*mid+1.35*fast+r.range(-1.45,1.45),1.1,16.2);
      sampled.push({x:x+(cx-x)/d*inset,y:y+(cy-y)/d*inset});
    }
    travel+=len;
  }
  sampled.forEach((p,i)=>{
    if(i===0)edge.moveTo(p.x,p.y);else edge.lineTo(p.x,p.y);
  });
  edge.closePath();
  ctx.save();
  ctx.clip(fullHull); // exact source envelope, retains reserved void clipping
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.14;ctx.fillStyle=hex(blend(pigment,[246,242,234],.18));
  ctx.fill(edge);pieces++;
  // All following effects are also clipped to the irregular physical edge.
  ctx.clip(edge);
  // Separated little soaked edge fibres; never one continuous CAD outline.
  const span=Math.max(3,Math.floor(sampled.length/90));
  for(let j=0;j<sampled.length;j+=span){
    if(!r.chance(.34))continue;
    const a=sampled[j],b=sampled[Math.min(j+Math.max(1,span),sampled.length-1)];
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=r.range(.10,.23);ctx.lineWidth=r.range(1,3.8);
    ctx.strokeStyle=hex(blend(pigment,[58,50,44],.24));ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    if(r.chance(.38)){
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.19;
      ctx.strokeStyle='#fff6e4';ctx.lineWidth=r.range(.5,1.15);
      ctx.beginPath();ctx.moveTo(a.x+1.2,a.y+.7);
      ctx.lineTo(b.x+1.2,b.y+.7);ctx.stroke();
    }
    edgeTouches++;
  }
  if(stage==='edge'){ctx.restore();return{pieces,folds,deposits,edgeTouches,
    laminations,junctionPools}}
  // Edges between original V5d guides are immutable graph relationships.
  // These are translucent paper *fragments*, NOT newly planned regions.
  const joins=[];
  for(let i=0;i<guides.length;i++)for(let j=i+1;j<guides.length;j++){
    const a=guides[i],b=guides[j];
    if(A.compositionV5oTest?.linked(a,b,plan))
      joins.push({a,b,d:Math.hypot(b.x-a.x,b.y-a.y)});
  }
  joins.sort((a,b)=>b.d-a.d||a.a.guideId.localeCompare(b.a.guideId));
  const chosen=joins.slice(0,Math.min(4,Math.max(2,joins.length)));
  for(let i=0;i<chosen.length;i++){
    const {a,b,d}=chosen[i],
      tx=(b.x-a.x)/Math.max(1,d),ty=(b.y-a.y)/Math.max(1,d),
      nx=-ty,ny=tx,ptsL=[],ptsR=[],
      // Source connection distance and φ proportions govern physical sheet
      // breadth; they are bounded by the existing field, never extrapolated.
      width=clamp(Math.min(Math.sqrt(area.area||20000)*.23,d/PHI),
        21,95)*r.range(.79,1.17),
      strip=new Path2D();
    for(let j=0;j<=28;j++){
      const t=j/28,taper=.22+.78*Math.pow(Math.max(.001,Math.sin(PI*t)),.53),
        bend=Math.sin(t*TAU*1.4+i*.65)*width*.09,
        x=a.x+(b.x-a.x)*t+nx*bend,
        y=a.y+(b.y-a.y)*t+ny*bend,
        left=width*taper*(.57+r.range(-.085,.085)),
        right=width*taper*(.57+r.range(-.085,.085));
      ptsL.push({x:x+nx*left,y:y+ny*left});
      ptsR.push({x:x-nx*right,y:y-ny*right});
    }
    ptsL.forEach((p,j)=>j?strip.lineTo(p.x,p.y):strip.moveTo(p.x,p.y));
    ptsR.reverse().forEach(p=>strip.lineTo(p.x,p.y));
    strip.closePath();
    const ink=blend(palette[i%palette.length],pigment,.31);
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=(.27+i%3*.055)*r.range(.86,1.11);
    ctx.fillStyle=hex(blend(ink,[243,234,221],.09));
    ctx.fill(strip);pieces++;laminations++;
    // Lower pigmented torn rim and irregular warm raised fibre at the
    // actual strip edge, restrained to avoid hard black outlines.
    ctx.globalAlpha=.11;ctx.lineWidth=r.range(2.1,4.4);
    ctx.strokeStyle=hex(blend(ink,[58,53,46],.29));
    ctx.stroke(strip);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.11;ctx.lineWidth=.85;
    ctx.strokeStyle='#fff8ea';ctx.stroke(strip);
    // Guide-aligned physical wrinkles only on the actual sheet segment.
    ctx.globalCompositeOperation='multiply';ctx.lineCap='round';
    for(let fold=0;fold<5;fold++){
      const t=r.range(.12,.89),offset=r.range(-width*.34,width*.34),
        x=a.x+(b.x-a.x)*t+nx*offset,
        y=a.y+(b.y-a.y)*t+ny*offset,
        length=r.range(9,38);
      ctx.globalAlpha=r.range(.11,.19);
      ctx.lineWidth=r.range(.85,2.2);
      ctx.strokeStyle=hex(blend(ink,[64,55,50],.37));
      ctx.beginPath();ctx.moveTo(x-tx*length*.5,y-ty*length*.5);
      ctx.lineTo(x+tx*length*.5,y+ty*length*.5);ctx.stroke();
      folds++;
    }
  }
  if(stage==='layers'){ctx.restore();return{pieces,folds,deposits,edgeTouches,
    laminations,junctionPools}}
  // Pooling on only ORIGINAL shared anchors of 2+ genuine source links:
  // subtractive pigmentation layers accumulate darker at real join points.
  const incidence=new Map();
  for(const j of chosen){
    for(const g of [j.a,j.b])
      incidence.set(g.guideId,(incidence.get(g.guideId)||0)+1);
  }
  for(const g of guides){
    if((incidence.get(g.guideId)||0)<2)continue;
    for(let k=0;k<4;k++){
      const cx=g.x+r.range(-13,13),cy=g.y+r.range(-13,13),
        radius=r.range(17,43),
        col=blend(pigment,palette[k%palette.length],.28),
        grad=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
      grad.addColorStop(0,rgbAlpha(col,.22));
      grad.addColorStop(.53,rgbAlpha(col,.11));
      grad.addColorStop(1,rgbAlpha(col,0));
      ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);
      ctx.fill();junctionPools++;deposits++;
    }
  }
  ctx.restore();
  return{pieces,folds,deposits,edgeTouches,laminations,junctionPools};
}

function tissueColourField(ctx,area,plan){
  const border=area.contour||[],r=rng(area.seed+'|v5m-source-lamination'),
    colours=area.paintPalette||area.palette||[area.rgb],
    pigment=area.paintRgb||area.rgb;
  if(border.length<3)return {pieces:0,folds:0,deposits:0,edgeTouches:0};
  const outer=physicalEdgePath(area,'tissue'),
    guides=(plan.territories||[]).filter(g=>
      area.guideIds&&area.guideIds.includes(g.guideId));
  let pieces=0,folds=0,deposits=0,edgeTouches=0;
  const rgba=(c,a)=>'rgba('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+','+a.toFixed(3)+')';
  const sampleAxis=(axis,t,origin,angle)=>{
    if(axis.length<2)return {x:origin.x,y:origin.y,angle};
    const pos=t*(axis.length-1),j=Math.min(axis.length-2,Math.floor(pos)),
      u=pos-j,p=axis[j],z=axis[j+1];
    return {x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u,
      angle:Math.atan2(z.y-p.y,z.x-p.x)};
  };
  ctx.save();
  // V7's bloom, graphite, ribbons and original coloured washes have already
  // been drawn; do NOT fade or remove any of them.
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.20;
  ctx.fillStyle=hex(blend(pigment,[245,240,230],.19));
  ctx.fill(outer);pieces++;
  // All additions confined to the original field; protected voids were
  // clipped by tissueAdapter before entering this function.
  ctx.clip(outer);
  for(let gi=0;gi<guides.length;gi++){
    const guide=guides[gi],axis=guide.axis||[],
      origin={x:guide.x||area.x,y:guide.y||area.y},
      fallback=(guide.kind==='constructed-focal-form'&&guide.contour?.length)?Math.atan2(guide.contour[0].y-guide.y,guide.contour[0].x-guide.x):(guide.angle||0),
      base=colours[(gi+1)%colours.length]||pigment;
    // Independent wet-pigment deposits follow the ACTUAL guide's tangent.
    // Each has a feathered transversal profile, not a uniform polygon fill
    // or a chain of repeated straight equal-width strokes.
    for(let pass=0;pass<2;pass++){
      const n=pass===0?21:14;
      for(let k=0;k<n;k++){
        const t=clamp((k+.5+r.range(-.38,.38))/n,.015,.985),
          p=sampleAxis(axis,t,origin,fallback),angle=p.angle+
            r.range(-.13,.13),normal=angle+PI/2,
          lateral=r.range(-1,1)*(pass===0?33:48),
          cx=p.x+Math.cos(normal)*lateral,
          cy=p.y+Math.sin(normal)*lateral,
          radius=r.range(pass===0?15:9,pass===0?43:25),
          len=r.range(pass===0?36:19,pass===0?105:60),
          dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2,
          pigmentColour=blend(base,pass===0?pigment:[240,224,203],
            pass===0?.28:.16);
        // Soft transverse pigment gradient. The edges disappear gradually
        // into the original V7 wash instead of outlining a cut-out triangle.
        const grad=ctx.createLinearGradient(
          cx-Math.cos(normal)*radius,cy-Math.sin(normal)*radius,
          cx+Math.cos(normal)*radius,cy+Math.sin(normal)*radius);
        const intensity=(pass===0?.26:.19)*r.range(.65,1.25);
        grad.addColorStop(0,rgba(pigmentColour,.008));
        grad.addColorStop(.25,rgba(pigmentColour,intensity*.65));
        grad.addColorStop(.52,rgba(pigmentColour,intensity));
        grad.addColorStop(.80,rgba(pigmentColour,intensity*.53));
        grad.addColorStop(1,rgba(pigmentColour,.006));
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineJoin='round';
        ctx.strokeStyle=grad;ctx.lineWidth=radius*1.6;
        ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);
        ctx.quadraticCurveTo(cx+r.range(-6,6),cy+r.range(-6,6),
          cx+dx,cy+dy);ctx.stroke();deposits++;
      }
    }
    // Short discontinuous pressed-paper wrinkles parallel to original
    // branch/trajectory directions. No full-length dark graphite outlines.
    // Placed Constructed Forms supply a real guide orientation even when
    // they have no polyline axis. Use that physical direction as well.
    if(axis.length>1||Number.isFinite(guide.angle)){
      for(let i=0;i<(axis.length>1?12:6);i++){
        const t=r.range(.06,.94),p=sampleAxis(axis,t,origin,fallback),
          direction=p.angle+r.range(-.23,.23),
          off=r.range(-24,24),normal=direction+PI/2,
          x=p.x+Math.cos(normal)*off,
          y=p.y+Math.sin(normal)*off,
          len=r.range(7,31),dx=Math.cos(direction)*len/2,
          dy=Math.sin(direction)*len/2;
        ctx.globalCompositeOperation='multiply';
        ctx.globalAlpha=r.range(.13,.26);
        ctx.lineWidth=r.range(1.1,2.7);
        ctx.strokeStyle=hex(blend(pigment,[53,49,48],.48));
        ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);
        ctx.stroke();
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.21;ctx.lineWidth=.95;
        ctx.strokeStyle='#fff8e8';
        ctx.beginPath();ctx.moveTo(x-dx+1,y-dy+1);
        ctx.lineTo(x+dx+1,y+dy+1);ctx.stroke();folds++;
      }
    }
  }
  // Source-owned diffuse laminations fill the FIELD between paired
  // source guides. V5m pigment was concentrated around narrow axes and left
  // several meaningful forms visually untouched.
  const massR=rng(area.seed+'|v5n-pigment-coverage');
  const anchors=guides.length?guides.map(g=>({x:g.x,y:g.y})):
    [{x:area.x,y:area.y}];
  const spread=Math.max(16,Math.min(75,Math.sqrt(area.area||10000)*.34));
  for(let k=0;k<38;k++){
    const from=anchors[k%anchors.length],t=massR.range(.15,.99),
      angle=Math.atan2(area.y-from.y,area.x-from.x),
      off=massR.range(-spread*.6,spread*.6),
      x=from.x+(area.x-from.x)*t-Math.sin(angle)*off,
      y=from.y+(area.y-from.y)*t+Math.cos(angle)*off,
      rad=spread*massR.range(.4,1),
      c=blend(pigment,colours[k%colours.length]||pigment,.26),
      g=ctx.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,rgba(c,massR.range(.13,.28)));
    g.addColorStop(.65,rgba(c,.09));
    g.addColorStop(1,rgba(c,0));
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
    deposits++;
  }
  // Intermittent wetted pigment along real exterior edges, not the
  // V5l solid 10px dark ring. This preserves the visible V7 bloom outside.
  const edgeSeed=rng(area.seed+'|v5m-edge-fibres');
  for(let i=0;i<border.length;i++){
    const p=border[i],z=border[(i+1)%border.length],
      d=Math.hypot(z.x-p.x,z.y-p.y),
      intervals=Math.max(2,Math.ceil(d/18));
    for(let j=0;j<intervals;j++){
      if(!edgeSeed.chance(.56))continue;
      const t=j/intervals,u=Math.min(1,t+edgeSeed.range(.18,.74)/intervals),
        a={x:p.x+(z.x-p.x)*t,y:p.y+(z.y-p.y)*t},
        b={x:p.x+(z.x-p.x)*u,y:p.y+(z.y-p.y)*u};
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=edgeSeed.range(.13,.28);
      ctx.lineWidth=edgeSeed.range(2.5,5.4);
      ctx.lineCap='round';
      ctx.strokeStyle=hex(blend(pigment,[65,54,45],.28));
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.stroke();
      // Single sparse bright filament beside some torn edges. These stay
      // clipped to the legitimate contour, not outside into protected voids.
      if(edgeSeed.chance(.34)){
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=.30;ctx.lineWidth=edgeSeed.range(.6,1.4);
        ctx.strokeStyle='#f9f2df';
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.stroke();
      }
      edgeTouches++;
    }
  }
  ctx.restore();
  return {pieces,folds,deposits,edgeTouches};
}
// Physical treatment of PAINTED source guides left out of V5i's
// maximal-visibility PAIR selection. Never interpret framed negative space.
function tissueUnpairedGuide(ctx,guide){
  const poly=guide.contour||[];
  if(poly.length<4||!guide.sources?.length||guide.role!=='painted')return 0;
  const p=new Path2D(),r=rng(guide.seed+'|v5n-single-guide');
  p.moveTo(poly[0].x,poly[0].y);
  for(let i=1;i<poly.length;i++)p.lineTo(poly[i].x,poly[i].y);
  p.closePath();
  const colour=guide.rgb,axis=guide.axis||[],
    origin={x:guide.x,y:guide.y},
    theta=guide.kind==='constructed-focal-form'?
      Math.atan2(poly[0].y-origin.y,poly[0].x-origin.x):
      (guide.angle||0),
    spread=Math.max(11,Math.min(42,Math.min(guide.width,guide.height)*.4));
  ctx.save();ctx.clip(p);
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.21;
  ctx.fillStyle=hex(blend(colour,[245,240,230],.3));ctx.fill(p);
  for(let k=0;k<19;k++){
    const t=(k+.5)/19,q=axis.length>1?
      axis[Math.min(axis.length-1,Math.floor(t*(axis.length-1)))]:origin,
      dx=Math.cos(theta),dy=Math.sin(theta),offset=r.range(-spread,spread),
      x=q.x-dy*offset,y=q.y+dx*offset,rad=spread*r.range(.5,1.25),
      grad=ctx.createRadialGradient(x,y,0,x,y,rad),
      clr=colour.join(',');
    grad.addColorStop(0,'rgba('+clr+','+r.range(.12,.25).toFixed(3)+')');
    grad.addColorStop(.7,'rgba('+clr+',.05)');
    grad.addColorStop(1,'rgba('+clr+',0)');
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=1;
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,rad,0,TAU);ctx.fill();
  }
  ctx.restore();return 19;
}
function tissueAdapter(target,plan,scale,stage){
  var ctx=target.getContext('2d'),pieces=0,lines=0,folds=0,deposits=0,edgeTouches=0,
    unpairedGuides=0,unpairedDeposits=0,paintedGuides=0,
    laminations=0,junctionPools=0,broadFields=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.connectedFields||[]).length;fi++){
    var field=plan.connectedFields[fi],
      isBroad=field.kind==='guide-chain-colour-mass',
      fieldResult=isBroad?tissueBroadFieldV5P(ctx,field,plan,stage):
        tissueColourField(ctx,field,plan);
    if(isBroad)broadFields++;
    fieldPieces+=fieldResult.pieces;folds+=fieldResult.folds;
    deposits+=fieldResult.deposits;edgeTouches+=fieldResult.edgeTouches;
    laminations+=fieldResult.laminations||0;
    junctionPools+=fieldResult.junctionPools||0;
  }
  // V5i keeps only a visible subset of the true source relations.
  // Give remaining painted source shapes a restrained original-contour glaze.
  if((plan.connectedFields||[]).length){
    const paired=new Set(plan.connectedFields.flatMap(f=>f.guideIds));
    for(const g of (plan.territories||[])){
      if(g.role!=='painted'||g.kind==='rect-cell'||!g.sources?.length)continue;
      paintedGuides++;
      if(paired.has(g.guideId))continue;
      const amount=tissueUnpairedGuide(ctx,g);
      if(amount){unpairedGuides++;unpairedDeposits+=amount;}
    }
  }
  for(var ti=0;ti<((plan.connectedFields||[]).length?0:(plan.territories||[]).length);ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<((plan.connectedFields||[]).length?0:plan.regions.length);i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<((plan.connectedFields||[]).length?0:plan.gestures.length);i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.connectedFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines,sourceFolds:folds,guideDeposits:deposits,
    edgeTouches:edgeTouches,unpairedGuides:unpairedGuides,
    unpairedDeposits:unpairedDeposits,paintedGuides:paintedGuides,
    broadFields:broadFields,laminations:laminations,
    junctionPools:junctionPools,v7AtmospherePreserved:true};
}
A.renderInterpretedV5P=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),plan=null,sharedCapture=null;
  if(interpretation==='areas'){
    if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
    var planOptions={phiFraming:opts.phiFraming===true,
      maxRegions:opts.maxRegions||28};
    if(material==='oil'&&opts.reuseCompositionCapture===true&&
       A.captureCompositionV5&&A.planCompositionV5FromSource){
      sharedCapture=A.captureCompositionV5(settings,planOptions);
      plan=A.planCompositionV5FromSource(sharedCapture,settings,planOptions);
    }else{
      plan=A.planCompositionV5(settings,planOptions);
    }
  }
  var sourceMeta=baseline(target,settings,scale,material,
    {...opts,sourceCapture:sharedCapture,
      hasConnectedFields:!!(plan&&plan.connectedFields.length)});
  if(interpretation==='faithful')return {
    version:'v5p-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(material==='tissue'&&plan.connectedFields.length){
    // V7's faithful renderer may leave an inherited clip or transform on
    // the target 2D context. Never paint the new fields through that state:
    // preserve the exact pixels, reset the presentation context, then
    // draw connected paper areas over the whole physical sheet.
    var faithfulCopy=document.createElement('canvas');
    faithfulCopy.width=target.width;faithfulCopy.height=target.height;
    faithfulCopy.getContext('2d').drawImage(target,0,0);
    target.width=target.width; // resets clip, transform and composite state
    target.getContext('2d').drawImage(faithfulCopy,0,0);
  }
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale,opts.stage||'pooled');
  var stats={version:'v5p-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,connectedFields:plan.connectedFields.length,
    connectedStats:plan.connectedStats,fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5PInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5P=function(target,plan,scale){
    scale=scale||1;
    var ctx=target.getContext('2d');
    target.width=Math.round(plan.width*scale);
    target.height=Math.round(plan.height*scale);
    ctx=target.getContext('2d');ctx.scale(scale,scale);
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
    for(var i=0;i<plan.connectedFields.length;i++){
      var area=plan.connectedFields[i],p=new Path2D(),poly=area.contour;
      p.moveTo(poly[0].x,poly[0].y);
      for(var j=1;j<poly.length;j++)p.lineTo(poly[j].x,poly[j].y);
      p.closePath();
      var rgb=area.paintRgb||area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);

