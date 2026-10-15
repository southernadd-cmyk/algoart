// ALGO/ART V5f experimental interpretation — interlocking paint fields.
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
function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta}
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


function oilColourField(ctx,mask,field,painter){
  var local=field.localTerritories||[],painted=0;
  // Different local subfields interact by layered translucent underpainting
  // and physical bristle deposition. No single convex outer silhouette fill.
  for(var t=0;t<local.length;t++){
    var patch=local[t],r=rng(patch.seed+'|v5f-oil-contact'),
        path=massContour(patch),c=patch.rgb,
        palette=field.palette||[c],b=patch.box,
        reach=Math.max(patch.width,patch.height)*.60,
        grad=ctx.createRadialGradient(patch.x,patch.y,
          Math.min(patch.width,patch.height)*.065,
          patch.x,patch.y,Math.max(reach,15)),
        count=clamp(Math.round(patch.area/3100),7,18);
    // Opacity diminishes towards independently lobed boundaries instead of
    // making opaque cut-paper shapes. Overlap builds actual mixed colour.
    grad.addColorStop(0, 'rgba('+c.join(',')+',0.48)');
    grad.addColorStop(.53, 'rgba('+c.join(',')+',0.34)');
    grad.addColorStop(.86, 'rgba('+c.join(',')+',0.13)');
    grad.addColorStop(1, 'rgba('+c.join(',')+',0)');
    ctx.save();mask.save();
    ctx.globalAlpha=1;ctx.fillStyle=grad;ctx.fill(path);
    ctx.globalAlpha=1;mask.globalAlpha=1;
    for(var i=0;i<count;i++){
      var angle=patch.angle+r.range(-.96,.96),
          px=patch.x+r.range(-.24,.24)*b.w,
          py=patch.y+r.range(-.24,.24)*b.h,
          length=clamp(Math.min(b.w,b.h)*r.range(.38,.82),32,165),
          width=clamp(Math.min(b.w,b.h)*r.range(.13,.27),13,55),
          dx=Math.cos(angle)*length*.5,dy=Math.sin(angle)*length*.5,
          base=i%4===0?palette[(t+i)%palette.length]:c,
          pigment=blend(base,i%5===0?[244,220,188]:[65,52,44],
            i%5===0?.08:.027),
          nodes=[{x:px-dx,y:py-dy},
            {x:px+r.range(-8,8),y:py+r.range(-8,8)},
            {x:px+dx,y:py+dy}];
      // Never clip bristle ends to the clean graphic shape edge.
      painter(ctx,mask,nodes,width,pigment,
        i%4===0?'flat':'filbert',r,
        {thickness:.94,drag:.61,bristles:.95});
      painted++;
    }
    ctx.restore();mask.restore();
  }
  return painted;
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
  for(var fi=0;fi<(plan.colourFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.colourFields[fi],painter);
  }
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<plan.regions.length;i++){
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
  for(i=0;i<plan.gestures.length;i++){
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
    colourFields:(plan.colourFields||[]).length,fieldStrokes:fieldStrokes,
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


function tissueColourField(ctx,field){
  var local=field.localTerritories||[],pieces=0;
  // Each local territory becomes its own independently torn paper piece;
  // shared source plan does not encode material-specific tears.
  for(var t=0;t<local.length;t++){
    var territory=local[t],contour=territory.contour,
        r=rng(territory.seed+'|v5f-tissue-tear'),colour=territory.rgb;
    for(var layer=0;layer<2;layer++){
      var scale=layer===0?1:.83,p=new Path2D();
      for(var i=0;i<contour.length;i++){
        var a=contour[i],b=contour[(i+1)%contour.length];
        for(var k=0;k<2;k++){
          var f=k/2,fringe=layer===0?2.8:3.7,
              px=a.x+(b.x-a.x)*f,py=a.y+(b.y-a.y)*f,
              x=territory.x+(px-territory.x)*scale+
                r.range(-fringe,fringe),
              y=territory.y+(py-territory.y)*scale+
                r.range(-fringe,fringe);
          if(i===0&&k===0)p.moveTo(x,y);
          else p.lineTo(x,y);
        }
      }
      p.closePath();
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=layer===0?.21:.16;
      ctx.fillStyle=hex(blend(colour,[245,240,230],
        layer===0?.11:.22));
      ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.24;ctx.lineWidth=.65;
      ctx.strokeStyle='rgba(248,243,232,.43)';
      ctx.stroke(p);pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  return pieces;
}

function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.colourFields||[]).length;fi++){
    fieldPieces+=tissueColourField(ctx,plan.colourFields[fi]);
  }
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
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
  for(var i=0;i<plan.regions.length;i++){
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
  for(i=0;i<plan.gestures.length;i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.colourFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines};
}
A.renderInterpretedV5F=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5f-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5f-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,
    fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5FInterpretation=stats;
  return stats;
};
})(window.AlgoArt);
