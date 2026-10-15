// Oil v1 source-owned geometry bundle B: verified V5f/V5i/V5j modules.

// ---- composition-interlocking-v5f.js ----
// ALGO/ART V5f: source-anchored interlocking pigment territories.
// This module wraps (never edits) the frozen V5e composition planner.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5eTest||!A.planCompositionV5FromSource)
  throw Error('V5f requires the unchanged V5e colour-field planner');
var previous=A.planCompositionV5FromSource,PI=Math.PI,TAU=2*PI,
    VERSION='v5f-interlocking-territories-1';
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function hash(v){return A.hash(String(v))>>>0}
function rounded(x){return +x.toFixed(2)}
function point(x,y){return{x:rounded(x),y:rounded(y)}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function area(poly){
  var value=0;
  for(var j=0;j<poly.length;j++){
    var a=poly[j],b=poly[(j+1)%poly.length];
    value+=a.x*b.y-b.x*a.y;
  }
  return Math.abs(value)*.5;
}
function box(poly){
  var xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),
      l=Math.min(...xs),r=Math.max(...xs),
      t=Math.min(...ys),b=Math.max(...ys);
  return{x:rounded(l),y:rounded(t),w:rounded(r-l),h:rounded(b-t)};
}
function inside(p,poly){
  var hit=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
function nearestSource(points,p){
  return points.reduce((best,q)=>distance(p,q)<distance(p,best)?q:best,points[0]);
}
function groupsFor(guide,plan){
  if(guide.type==='organic')return A.compositionV5eTest.organicGroups(guide,plan);
  if(guide.type==='spiral')return A.compositionV5eTest.trajectoryGroups(guide);
  if(guide.type==='constructed')return A.compositionV5eTest.constructedGroups(guide);
  return[];
}
// A local area is a softened, concave, source-guided paint territory,
// not an enlarged stroke, convex hull, or a contour copied from V5e.
function localTerritory(field,sourcePoints,index,count,plan){
  var r=A.makeR(String(field.seed)+'|v5f|'+index),
      ordered=sourcePoints.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
      raw=ordered[Math.min(ordered.length-1,
        Math.floor((index+.48)*ordered.length/count))],
      focal=nearestSource(ordered,raw),
      phase=TAU*(index+.32)/count,
      width=field.width,height=field.height,
      // Shift each local centre toward a different real recorded guide point.
      cx=clamp(focal.x*.72+field.x*.28+
        Math.cos(phase)*width*.082,field.box.x+width*.17,
        field.box.x+width*.83),
      cy=clamp(focal.y*.72+field.y*.28+
        Math.sin(phase)*height*.09,field.box.y+height*.17,
        field.box.y+height*.83),
      orient=Math.atan2(focal.y-field.y,focal.x-field.x);
  if(!Number.isFinite(orient))orient=phase;
  // Overlap adjacent local areas so colour can interpenetrate.
  var rx=clamp(width*r.range(.28,.38),42,205),
      ry=clamp(height*r.range(.29,.42),37,190),
      ripple=r.range(0,TAU),ripple2=r.range(0,TAU),
      poly=[];
  for(var k=0;k<40;k++){
    var t=TAU*k/40,global=t+orient*.19,
        // Different wavelengths make indentation and interruption structural,
        // rather than jittering a geometrically regular outline.
        radial=1+.145*Math.sin(3*global+ripple)+
          .104*Math.sin(5*global+ripple2)+
          .047*Math.sin(9*global-ripple*.7),
        probe=point(cx+Math.cos(t)*rx*radial,
          cy+Math.sin(t)*ry*radial);
    // Stay within the original compositional area, except modest bleed.
    var q=0;
    while(q<12&&(!inside(probe,field.contour)||
      probe.x<10||probe.y<10||
      probe.x>plan.width-10||probe.y>plan.height-10)){
      radial*=.90;
      probe=point(cx+Math.cos(t)*rx*radial,
        cy+Math.sin(t)*ry*radial);
      q++;
    }
    poly.push(probe);
  }
  if(area(poly)<2000||A.compositionV5cTest.intersectsProtected(
    poly,plan.protectedVoids))return null;
  var bb=box(poly),palette=field.palette||[field.rgb];
  return {id:field.id+'-P'+index,kind:'interlocking-paint-territory',
    parentId:field.id,sourceGuideId:field.guideId,
    anchor:point(focal.x,focal.y),sourceIndices:field.sources.slice(),
    rgb:palette[index%palette.length].slice(),contour:poly,box:bb,
    x:rounded(cx),y:rounded(cy),width:bb.w,height:bb.h,
    angle:rounded(orient),area:Math.round(area(poly)),
    seed:hash(field.seed+'|patch|'+index),sourceLinked:true};
}
function interpret(source,settings,opts){
  opts=opts||{};
  var plan=previous(source,settings,opts),
      guide=(source.meta&&source.meta.guide)||{},
      groups=groupsFor(guide,plan),
      byId=new Map(groups.map(g=>[g.id,g])),
      total=0;
  for(var i=0;i<plan.colourFields.length;i++){
    var field=plan.colourFields[i],original=byId.get(field.guideId),
        pts=original&&original.points||[];
    field.localTerritories=[];
    if(!pts.length)continue;
    var target=clamp(Math.ceil(pts.length/4),3,5);
    // Constructed guides can contain a single hero point; all local
    // centres still derive from that real source point.
    for(var k=0;k<target;k++){
      var patch=localTerritory(field,pts,k,target,plan);
      if(patch)field.localTerritories.push(patch);
    }
    total+=field.localTerritories.length;
  }
  plan.version=VERSION;
  plan.interpretation='shared-interlocking-paint-territories';
  plan.localTerritoryStats={count:total,parents:plan.colourFields.length,
    sourceLinked:plan.colourFields.every(f=>
      f.localTerritories.every(t=>t.sourceLinked&&t.sourceIndices.length>0)),
    protected:plan.protectedVoids.length};
  return plan;
}
A.compositionV5eFromSource=previous;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5fTest={localTerritory,groupsFor,area,inside};
})(window.AlgoArt);


// ---- v5f-material-adapters.js ----
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


// ---- composition-connected-v5g.js ----
// ALGO/ART V5g: genuinely connected, filled, material-neutral colour areas.
// Experimental, isolated: frozen V5e/f and Faithful remain unchanged.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5fTest||!A.planCompositionV5FromSource)
  throw Error('V5g needs frozen V5f source planner');
var frozen=A.planCompositionV5FromSource,VERSION='v5g-connected-colour-areas-1';
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function pt(x,y){return{x:+x.toFixed(2),y:+y.toFixed(2)}}
function inside(p,poly){
  var result=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
function rectInside(x,y,v){
  return x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h;
}
function polygonArea(p){
  var a=0;for(var i=0;i<p.length;i++){
    var b=p[(i+1)%p.length];a+=p[i].x*b.y-b.x*p[i].y;
  }
  return Math.abs(a)*.5;
}
function bbox(p){
  var xs=p.map(x=>x.x),ys=p.map(x=>x.y),
      l=Math.min.apply(null,xs),r=Math.max.apply(null,xs),
      t=Math.min.apply(null,ys),b=Math.max.apply(null,ys);
  return{x:l,y:t,w:r-l,h:b-t};
}
// The unit test and flat preview can read the very same occupancy data.
// Each true grid cell represents filled INTERIOR, never a path width.
function deriveMask(fields,plan,cell){
  cell=cell||12;
  var nx=Math.ceil(plan.width/cell),ny=Math.ceil(plan.height/cell),
      mask=new Uint8Array(nx*ny),original=new Uint8Array(nx*ny),
      voids=plan.protectedVoids||[];
  function reserved(x,y){return voids.some(v=>rectInside(x,y,v))}
  for(var y=0;y<ny;y++)for(var x=0;x<nx;x++){
    var px=(x+.5)*cell,py=(y+.5)*cell,index=y*nx+x;
    if(px<8||py<8||px>plan.width-8||py>plan.height-8||reserved(px,py))
      continue;
    for(var i=0;i<fields.length;i++){
      var f=fields[i],bb=f.box;
      if(px<bb.x-25||px>bb.x+bb.w+25||
         py<bb.y-25||py>bb.y+bb.h+25)continue;
      // Spatial warping deliberately breaks large convex/cut-paper outlines,
      // without changing the source-derived area or inventing disconnected dabs.
      var dx=Math.sin(py*.020+f.seed%31)*11+
        Math.cos(px*.034+f.seed%13)*5;
      var dy=Math.sin(px*.023+f.seed%23)*10+
        Math.cos(py*.031+f.seed%17)*5;
      if(inside({x:px+dx,y:py+dy},f.contour)){mask[index]=1;break}
    }
  }
  original.set(mask);
  // Morphological closing connects adjacent occupied source territories,
  // then fills narrow channels BETWEEN marks rather than widening every path.
  var grown=new Uint8Array(mask.length),closed=new Uint8Array(mask.length);
  for(y=0;y<ny;y++)for(x=0;x<nx;x++){
    var p=y*nx+x,hit=false;
    for(var dy=-1;dy<=1&&!hit;dy++)for(var dx=-1;dx<=1;dx++){
      var ax=x+dx,ay=y+dy;
      if(ax>=0&&ay>=0&&ax<nx&&ay<ny&&mask[ay*nx+ax]){hit=true;break}
    }
    grown[p]=hit?1:0;
  }
  for(y=0;y<ny;y++)for(x=0;x<nx;x++){
    var cx=(x+.5)*cell,cy=(y+.5)*cell,p=y*nx+x;
    if(reserved(cx,cy))continue;
    var all=true;
    for(dy=-1;dy<=1&&all;dy++)for(dx=-1;dx<=1;dx++){
      var ax=x+dx,ay=y+dy;
      if(ax<0||ay<0||ax>=nx||ay>=ny||!grown[ay*nx+ax]){
        all=false;break;
      }
    }
    // Preserve outermost original source occupancy at the canvas margins.
    closed[p]=all||original[p]?1:0;
  }
  return{mask:closed,nx:nx,ny:ny,cell:cell};
}
function components(g){
  var m=g.mask,nx=g.nx,ny=g.ny,seen=new Uint8Array(m.length),
      parts=[];
  for(var k=0;k<m.length;k++){
    if(!m[k]||seen[k])continue;
    var queue=[k],j=0;seen[k]=1;
    for(;j<queue.length;j++){
      var i=queue[j],x=i%nx,y=Math.floor(i/nx),
          nei=[x>0?i-1:-1,x<nx-1?i+1:-1,
            y>0?i-nx:-1,y<ny-1?i+nx:-1];
      for(var n=0;n<4;n++){
        var v=nei[n];if(v>=0&&m[v]&&!seen[v]){
          seen[v]=1;queue.push(v);
        }
      }
    }
    if(queue.length>=15)parts.push(queue);
  }
  return parts.sort((a,b)=>b.length-a.length);
}
// Extract the connected binary area's actual OUTER outline via oriented
// boundary edges. Holes are recorded separately and are clipped in material.
function contourOf(cells,g){
  var occupied=new Set(cells),nx=g.nx,step=g.cell,edges=new Map();
  function edge(x1,y1,x2,y2){
    var k=x1+','+y1,a=edges.get(k)||[];
    a.push([x2,y2]);edges.set(k,a);
  }
  for(var k=0;k<cells.length;k++){
    var index=cells[k],x=index%nx,y=Math.floor(index/nx);
    if(!occupied.has(index-nx)||y===0)edge(x,y,x+1,y);
    if(!occupied.has(index+1)||x===nx-1)edge(x+1,y,x+1,y+1);
    if(!occupied.has(index+nx))edge(x+1,y+1,x,y+1);
    if(!occupied.has(index-1)||x===0)edge(x,y+1,x,y);
  }
  var loops=[];
  while(edges.size){
    var first=edges.keys().next().value,k=first,coords=[],count=0;
    do{
      var a=edges.get(k);if(!a||!a.length)break;
      var xy=k.split(',').map(Number);
      coords.push(pt(xy[0]*step,xy[1]*step));
      var next=a.pop();if(!a.length)edges.delete(k);
      k=next[0]+','+next[1];
    }while(k!==first&&++count<5000);
    if(coords.length>=4)loops.push(coords);
  }
  if(!loops.length)return[];
  loops.sort((a,b)=>polygonArea(b)-polygonArea(a));
  var outer=loops[0],result=[];
  // Remove redundant collinear grid vertices: the outline remains connected
  // but no longer becomes a visible stepped/pixelated shape.
  for(var i=0;i<outer.length;i++){
    var pre=outer[(i+outer.length-1)%outer.length],
        a=outer[i],post=outer[(i+1)%outer.length];
    if((a.x-pre.x)*(post.y-a.y)===(a.y-pre.y)*(post.x-a.x))continue;
    result.push(a);
  }
  if(result.length<4)return outer;
  return result;
}
function colouredAreas(fields,plan){
  if(!fields.length)return[];
  var g=deriveMask(fields,plan,12),parts=components(g),
      areas=[];
  for(var i=0;i<parts.length;i++){
    var cells=parts[i],contour=contourOf(cells,g);
    if(contour.length<4)continue;
    var bb=bbox(contour),members=fields.filter(f=>{
      // Member fields are those with measurable occupancy of this component.
      var count=0;
      for(var j=0;j<cells.length;j+=Math.max(1,Math.floor(cells.length/80))){
        var index=cells[j],p={x:((index%g.nx)+.5)*g.cell,
          y:(Math.floor(index/g.nx)+.5)*g.cell};
        if(inside(p,f.contour))count++;
      }
      return count>0;
    });
    if(!members.length)members=[fields[0]];
    var unique=[],palette=[];
    members.forEach(f=>{
      (f.sources||[]).forEach(s=>{if(!unique.includes(s))unique.push(s)});
      (f.palette||[f.rgb]).forEach(c=>{
        if(!palette.some(v=>Math.hypot(...v.map((n,i)=>n-c[i]))<40))
          palette.push(c.slice());
      });
    });
    var area=cells.length*g.cell*g.cell;
    if(area<3600||!unique.length)continue;
    areas.push({id:'CA'+areas.length,kind:'connected-colour-area',
      role:areas.length?'supporting':'primary',
      contour:contour,box:bb,x:bb.x+bb.w*.5,y:bb.y+bb.h*.5,
      width:bb.w,height:bb.h,area:area,
      fillFraction:+(area/(bb.w*bb.h)).toFixed(3),
      components:1,occupiedCells:cells.length,gridCell:g.cell,
      palette:palette.slice(0,8),rgb:members[0].rgb.slice(),
      members:members.map(f=>f.id),sources:unique,sourceIndices:unique.slice(),
      seed:A.hash(String(plan.seed)+'|connected|'+i)>>>0,
      // The exact interior mask establishes connectedness, including gaps
      // that would be hidden by a bounding rectangle.
      cells:cells.map(v=>v),
      gridWidth:g.nx,
      protectedVoids:(plan.protectedVoids||[]).map(v=>({x:v.x,y:v.y,w:v.w,h:v.h}))
    });
  }
  return areas;
}
function interpret(source,settings,opts){
  var plan=frozen(source,settings,opts||{});
  plan.connectedFields=colouredAreas(plan.colourFields||[],plan);
  plan.version=VERSION;
  plan.interpretation='connected-colour-areas';
  plan.connectedStats={
    count:plan.connectedFields.length,
    totalArea:plan.connectedFields.reduce((s,f)=>s+f.area,0),
    minFillFraction:plan.connectedFields.length?
      Math.min(...plan.connectedFields.map(f=>f.fillFraction)):0,
    sourceLinked:plan.connectedFields.every(f=>f.sources.length>0),
    allSingleComponent:plan.connectedFields.every(f=>f.components===1)
  };
  return plan;
}
A.compositionV5fFromSource=frozen;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5gTest={deriveMask:deriveMask,components:components,
  contourOf:contourOf,colouredAreas:colouredAreas,inside:inside};
})(window.AlgoArt);


// ---- v5g-material-adapters.js ----
// ALGO/ART V5g: every material uses the same filled connected colour areas.
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


function oilColourField(ctx,mask,area,painter){
  var p=massContour(area),r=rng(area.seed+'|v5g-connected-oil'),
      b=area.box,colours=area.palette||[area.rgb],deposits=0;
  ctx.save();mask.save();
  ctx.clip(p);mask.clip(p);
  // First occupy the complete CONNECTED region with real pigment.
  // Crucially no halo/gradient or individually widened source lines.
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=.80;
  ctx.fillStyle=hex(blend(colours[0],[245,233,212],.06));
  ctx.fill(p);
  mask.globalAlpha=.62;mask.fillStyle='#fff';mask.fill(p);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  // Interleaved source-colour strokes cover the entire interior at
  // differing angles. Pigment and contact-height share true V4e footprints.
  var rows=clamp(Math.ceil(b.h/30),5,20),
      cols=clamp(Math.ceil(b.w/95),2,9);
  for(var j=0;j<rows;j++){
    var yy=b.y+(j+.5)*b.h/rows;
    for(var i=0;i<cols;i++){
      var xx=b.x+(i+.5)*b.w/cols,
          angle=r.range(-.47,.47)+(j%2?.23:-.23),
          len=clamp(b.w/cols*r.range(1.10,1.8),50,190),
          wid=clamp(b.h/rows*r.range(1.35,2.25),19,60),
          pigment=colours[(i+Math.floor(j/2))%colours.length],
          mixed=blend(pigment,j%5===0?[246,227,206]:[60,48,42],
            j%5===0?.068:.025),
          dx=Math.cos(angle)*len*.5,dy=Math.sin(angle)*len*.5;
      painter(ctx,mask,[
        {x:xx-dx,y:yy-dy},
        {x:xx+r.range(-5,5),y:yy+r.range(-6,6)},
        {x:xx+dx,y:yy+dy}],wid,mixed,
        (i+j)%5===0?'flat':'filbert',r,
        {thickness:.95,drag:.57,bristles:.96});
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
    fieldStrokes+=oilColourField(ctx,mask,plan.connectedFields[fi],painter);
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
  var base=area.contour||[],r=rng(area.seed+'|v5g-connected-paper'),
      palette=area.palette||[area.rgb],pieces=0;
  // Always lay one fully occupied, contiguous paper field first.
  // Its physical tissue edge is refined by the individually torn overlays;
  // this prevents translucent splotches from replacing genuine filled areas.
  ctx.save();
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=.84;
  ctx.fillStyle=hex(blend(palette[0],[245,240,231],.065));
  ctx.fill(massContour(area));
  ctx.restore();
  // Real, large, CONNECTED pieces. No airbrush, soft glow, line
  // expansion or partly transparent aura around the Faithful marks.
  // The original source defines one common silhouette for ALL materials.
  for(var layer=0;layer<3;layer++){
    var p=new Path2D(),scale=[1,.93,.77][layer],
        ink=palette[layer%palette.length],
        cx=area.x,cy=area.y;
    for(var i=0;i<base.length;i++){
      var a=base[i],b=base[(i+1)%base.length];
      for(var j=0;j<3;j++){
        var t=j/3,
            x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,
            rag=layer===0?2.8:4.6,
            px=cx+(x-cx)*scale+r.range(-rag,rag),
            py=cy+(y-cy)*scale+r.range(-rag,rag);
        if(i===0&&j===0)p.moveTo(px,py);else p.lineTo(px,py);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=[.73,.34,.25][layer];
    ctx.fillStyle=hex(blend(ink,[245,240,231],layer*.07));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=layer===0?.28:.22;ctx.lineWidth=.7;
    ctx.strokeStyle='rgba(251,244,232,.72)';
    ctx.stroke(p);
    pieces++;
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  return pieces;
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
A.renderInterpretedV5G=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5g-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
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
  var stats={version:'v5g-prototype',interpretation:'areas',
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
  A.lastV5GInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5G=function(target,plan,scale){
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
      var rgb=area.rgb;
      ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fill(p);
      // Trace just the primary areas, not the original source strokes.
      ctx.globalAlpha=.6;ctx.lineWidth=1.2;
      ctx.strokeStyle='#352f2a';ctx.stroke(p);ctx.globalAlpha=1;
    }
    return{areas:plan.connectedFields.length,stats:plan.connectedStats};
  };
})(window.AlgoArt);


// ---- composition-guide-fields-v5h.js ----
// ALGO/ART V5h — source-guide field connections, no invented global mask.
// Ground geometry is the actual V5d semantic guide (φ-cells, branch, arm, item).
// Frozen V5e/f/g modules remain available for same-seed comparison.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5dFromSource||!A.compositionV5cTest)
  throw Error('V5h requires original V5d source guide semantics');
var fromGuides=A.compositionV5dFromSource,
    VERSION='v5h-source-guide-field-connections-1',
    PHI=(1+Math.sqrt(5))/2;
function point(x,y){return{x:+x.toFixed(2),y:+y.toFixed(2)}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function cross(o,a,b){return(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x)}
function hull(points){
  var pts=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))
    .sort((a,b)=>a.x-b.x||a.y-b.y),lo=[],hi=[];
  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)
      lo.pop();
    lo.push(p);
  }
  for(var j=pts.length-1;j>=0;j--){
    var p=pts[j];
    while(hi.length>=2&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)
      hi.pop();
    hi.push(p);
  }
  return lo.slice(0,-1).concat(hi.slice(0,-1)).map(p=>point(p.x,p.y));
}
function bounds(points){
  var xs=points.map(p=>p.x),ys=points.map(p=>p.y),
    x=Math.min(...xs),y=Math.min(...ys);
  return{x:x,y:y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
function area(p){
  var s=0;
  for(var i=0;i<p.length;i++){
    var q=p[(i+1)%p.length];
    s+=p[i].x*q.y-q.x*p[i].y;
  }
  return Math.abs(s)*.5;
}
function inside(p,poly){
  var hit=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
function proximity(a,b){
  // Ranking is grounded in the recorded engine, never raster proximity alone:
  // branch identity/depth, actual trajectory arm/local index, object tiers.
  var d=dist(a,b),bias=1;
  if(a.kind==='organic-branch'){
    if(a.branch===b.branch)bias=.43;
    else if(Math.abs(a.depth-b.depth)<=1)bias=.92;
    else bias=1.5;
  }else if(a.kind==='trajectory-ribbon'){
    if(a.arm===b.arm)bias=.43;
    else bias=1.38;
    bias*=1+Math.abs(a.guideIndex-b.guideIndex)/48;
  }else if(a.kind==='constructed-focal-form'){
    if(a.tier==='hero'||b.tier==='hero')bias=.80;
  }
  return d*bias;
}
function pairFor(a,items,plan,used){
  var options=items.filter(b=>b!==a&&b.kind===a.kind)
    .map(b=>({b:b,score:proximity(a,b),gap:dist(a,b)}))
    .sort((x,y)=>x.score-y.score||x.gap-y.gap||
       x.b.guideIndex-y.b.guideIndex);
  // A connected field must be a real relation between at least TWO guides,
  // and never bridge distant unrelated parts of a whole picture.
  for(var i=0;i<options.length;i++){
    var option=options[i],b=option.b;
    var pairKey=[a.guideId,b.guideId].sort().join('|');
    if(used&&used.has(pairKey))continue;
    if(a.kind==='organic-branch'&&
       a.branch!==b.branch&&Math.abs(a.depth-b.depth)>1)continue;
    if(a.kind==='trajectory-ribbon'&&a.arm!==b.arm)continue;
    var outline=hull(a.contour.concat(b.contour));
    if(outline.length<3)continue;
    var bb=bounds(outline),canvas=plan.width*plan.height,
        total=area(outline);
    if(total>canvas*.225||bb.w>plan.width*.55||bb.h>plan.height*.58)
      continue;
    if(option.gap>Math.hypot(plan.width,plan.height)/PHI/2.35)
      continue;
    if(A.compositionV5cTest.intersectsProtected(outline,
      plan.protectedVoids))continue;
    return{b:b,contour:outline,pairKey:pairKey};
  }
  return null;
}
function occupied(contour,plan){
  var grid=12,nx=Math.ceil(plan.width/grid),ny=Math.ceil(plan.height/grid),
      bb=bounds(contour),cells=[],voids=plan.protectedVoids||[];
  for(var y=Math.max(0,Math.floor(bb.y/grid));y<
        Math.min(ny,Math.ceil((bb.y+bb.h)/grid));y++){
    for(var x=Math.max(0,Math.floor(bb.x/grid));x<
        Math.min(nx,Math.ceil((bb.x+bb.w)/grid));x++){
      var q={x:(x+.5)*grid,y:(y+.5)*grid};
      if(voids.some(v=>q.x>=v.x&&q.x<=v.x+v.w&&
        q.y>=v.y&&q.y<=v.y+v.h))continue;
      if(inside(q,contour))cells.push(y*nx+x);
    }
  }
  if(cells.length<30)return null;
  // Convex hull over TWO real guide boundaries is one filled connected
  // surface, not a stroked or enlarged source axis.
  return{cells:cells,gridCell:grid,gridWidth:nx};
}
function connectedFields(plan,opts){
  var guides=(plan.territories||[]).filter(t=>t.role==='painted'&&
    t.kind!=='rect-cell'&&t.sources&&t.sources.length);
  if(!guides.length)return[];
  var fields=[],usedPairs=new Set(),max=Math.min(9,opts.maxConnectedFields||8);
  // Source hierarchy order is retained. No global closure, Voronoi partition,
  // random splitting, or field invented without a guide connection.
  for(var i=0;i<guides.length&&fields.length<max;i++){
    var a=guides[i],relation=pairFor(a,guides,plan,usedPairs);
    if(!relation)continue;
    var b=relation.b,outline=relation.contour,
        occ=occupied(outline,plan);
    if(!occ)continue;
    usedPairs.add(relation.pairKey);
    var bb=bounds(outline),surface=occ.cells.length*144,
        provenance=[...new Set(a.sources.concat(b.sources))],
        palette=[a.rgb.slice()];
    if(Math.hypot(...a.rgb.map((v,k)=>v-b.rgb[k]))>35)
      palette.push(b.rgb.slice());
    fields.push({id:'GH'+fields.length,
      kind:'source-guide-connection',role:fields.length?'supporting':'primary',
      // Keep BOTH originating guide IDs and their exact engine semantics.
      guideIds:[a.guideId,b.guideId],
      anchorGuideIndex:a.guideIndex,
      relationKind:a.kind,
      branch:a.kind==='organic-branch'?a.branch:undefined,
      depth:a.kind==='organic-branch'?a.depth:undefined,
      arm:a.kind==='trajectory-ribbon'?a.arm:undefined,
      focalTier:a.kind==='constructed-focal-form'?a.tier:undefined,
      members:[a.id,b.id],
      sources:provenance,sourceIndices:provenance.slice(),
      contour:outline,box:bb,x:bb.x+bb.w/2,y:bb.y+bb.h/2,
      width:bb.w,height:bb.h,area:surface,
      fillFraction:+(surface/(bb.w*bb.h)).toFixed(3),
      components:1,occupiedCells:occ.cells.length,
      cells:occ.cells,gridCell:occ.gridCell,gridWidth:occ.gridWidth,
      palette:palette,rgb:a.rgb.slice(),
      seed:A.hash(plan.seed+'|v5h|'+a.guideId+'|'+b.guideId)>>>0
    });
  }
  return fields;
}
function interpret(source,settings,opts){
  opts=opts||{};
  // Read V5d directly — we do NOT build V5e's broad hull groups,
  // V5f's random patches or V5g's mega-mask and retroactively split it.
  var plan=fromGuides(source,settings,opts);
  plan.colourFields=[];plan.fieldStats={count:0};
  plan.connectedFields=connectedFields(plan,opts);
  plan.connectedStats={
    count:plan.connectedFields.length,
    totalArea:plan.connectedFields.reduce((s,f)=>s+f.area,0),
    minFillFraction:plan.connectedFields.length?
      Math.min(...plan.connectedFields.map(f=>f.fillFraction)):0,
    allSingleComponent:plan.connectedFields.every(f=>f.components===1),
    sourceLinked:plan.connectedFields.every(f=>
       f.sources.length>0&&f.guideIds.length===2),
    origin:'V5d source-guide relationships'
  };
  plan.version=VERSION;
  plan.interpretation='source-guide-connected-areas';
  return plan;
}
A.compositionV5gFromSource=A.planCompositionV5FromSource;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.renderInterpretedV5H=function(target,settings,scale,opts){
  var result=A.renderInterpretedV5G(target,settings,scale,opts);
  result.version='v5h-source-guide-geometry';return result;
};
A.renderConnectedPlanV5H=A.renderConnectedPlanV5G;
A.compositionV5Version=VERSION;
A.compositionV5hTest={connectedFields:connectedFields,
  pairFor:pairFor,occupied:occupied};
})(window.AlgoArt);


// ---- composition-guide-fields-v5i.js ----
// ALGO/ART V5i: visible fields from the source guide graph itself.
// Material-neutral geometry. No random polygons, no giant mask union,
// no splitting a finished image, no change to live Faithful or V5c phi cells.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5dFromSource||!A.compositionV5hTest)
  throw Error('V5i needs recorded V5d guide data and frozen V5h');
const prev=A.planCompositionV5FromSource,sourceGuides=A.compositionV5dFromSource;
const PHI=(1+Math.sqrt(5))/2,VERSION='v5i-source-relationship-visible-fields-1';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pt=(x,y)=>({x:+x.toFixed(2),y:+y.toFixed(2)});
function bounds(poly){
 const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
 return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function convexOutline(points){
 const src=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),up=[],down=[];
 for(const p of src){while(up.length>1&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
 for(let k=src.length-1;k>=0;k--){
  const p=src[k];while(down.length>1&&cross(down[down.length-2],down[down.length-1],p)<=0)down.pop();down.push(p)
 }
 return up.slice(0,-1).concat(down.slice(0,-1)).map(p=>pt(p.x,p.y));
}
function polygonArea(poly){
 let sum=0;for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length];
   sum+=a.x*b.y-a.y*b.x;
 }return Math.abs(sum)*.5;
}
function inside(p,polygon){
 let yes=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }return yes;
}
function cellsFor(poly,plan,cell){
 cell=cell||10;
 const nx=Math.ceil(plan.width/cell),ny=Math.ceil(plan.height/cell),box=bounds(poly),
   voids=plan.protectedVoids||[],cells=[];
 for(let y=Math.max(0,Math.floor(box.y/cell));y<Math.min(ny,Math.ceil((box.y+box.h)/cell));y++){
  for(let x=Math.max(0,Math.floor(box.x/cell));x<Math.min(nx,Math.ceil((box.x+box.w)/cell));x++){
   const q={x:(x+.5)*cell,y:(y+.5)*cell};
   if(voids.some(v=>q.x>=v.x&&q.x<=v.x+v.w&&q.y>=v.y&&q.y<=v.y+v.h))continue;
   if(inside(q,poly))cells.push(y*nx+x);
  }
 }
 return{cells,gridCell:cell,gridWidth:nx};
}
function permitted(a,b,plan){
 if(a===b||a.kind!==b.kind)return false;
 // These are ORIGINAL semantic relationships recorded by the generator.
 // Growth: original branch ownership and parent-depth adjacency.
 if(a.kind==='organic-branch'&&a.branch!==b.branch&&
    Math.abs(a.depth-b.depth)>1)return false;
 // Trajectories: never connect distinct golden arms; consecutive order.
 if(a.kind==='trajectory-ribbon'&&a.arm!==b.arm)return false;
 const d=dist(a,b),max=Math.hypot(plan.width,plan.height)/(PHI*2.35);
 if(d>max)return false;
 if(a.kind==='trajectory-ribbon'&&
   Math.abs(a.guideIndex-b.guideIndex)>80)return false;
 return true;
}
// Golden Trajectories can use TWO directed, original-guide anchored territories
// for a related pair of spiral sections. Reach is exactly phi^-2 from EACH
// recorded arm section towards the other, leaving phi-derived negative space
// between the two territories. This does not cut up a completed colour area.
function goldenArmConnection(anchor,related){
  const reach=1/(PHI*PHI);
  const target=related.contour.map(p=>pt(
    anchor.x+(p.x-anchor.x)*reach,
    anchor.y+(p.y-anchor.y)*reach));
  return convexOutline(anchor.contour.concat(target));
}
function candidates(plan,opts){
 const guides=plan.territories.filter(t=>t.role==='painted'&&t.kind!=='rect-cell'&&
   t.sources?.length&&t.contour?.length>=4);
 const all=[],maxArea=plan.width*plan.height*.215;
 for(let i=0;i<guides.length;i++){
  const a=guides[i];
  // A connection can be made only where two independent source guides exist.
  // Consider every lawful pair before choosing which visible connections to
  // paint. Never construct regions from random seeds or a raster partition.
  for(let j=i+1;j<guides.length;j++){
   const b=guides[j];if(!permitted(a,b,plan))continue;
   const configurations=(a.kind==='trajectory-ribbon'||a.kind==='constructed-focal-form')?
     [[a,b,goldenArmConnection(a,b)],[b,a,goldenArmConnection(b,a)]]:
     [[a,b,convexOutline(a.contour.concat(b.contour))]];
   for(const [origin,other,contour] of configurations){
     const bb=bounds(contour);
     if(contour.length<4||bb.w>plan.width*.52||bb.h>plan.height*.56)continue;
     const physical=polygonArea(contour);
     if(physical>maxArea||physical<3200)continue;
     if(A.compositionV5cTest.intersectsProtected(contour,plan.protectedVoids))
       continue;
     const occupancy=cellsFor(contour,plan,10);
     if(occupancy.cells.length<35)continue;
     const pigment=[origin.rgb.slice()];
     if(Math.hypot(...origin.rgb.map((v,k)=>v-other.rgb[k]))>37)
       pigment.push(other.rgb.slice());
     all.push({a:origin,b:other,contour,box:bb,
       cellSet:new Set(occupancy.cells),
       ...occupancy,area:occupancy.cells.length*100,
       palette:pigment,rgb:origin.rgb.slice(),
       guideIds:[origin.guideId,other.guideId],
       pairKey:origin.guideId+'|'+other.guideId,
       sources:[...new Set(origin.sources.concat(other.sources))],
       centre:{x:bb.x+bb.w*.5,y:bb.y+bb.h*.5}});
   }
  }
 }
 return all;
}
function intersect(a,b){
 let n=0;
 const s=a.cellSet.size<=b.cellSet.size?a.cellSet:b.cellSet,
   t=s===a.cellSet?b.cellSet:a.cellSet;
 for(const id of s)if(t.has(id))n++;
 return n;
}
function overlapMetrics(selected){
 const covered=new Set(),n=selected.length;
 const union=[];
 for(const f of selected){let added=0;
   for(const id of f.cellSet)if(!covered.has(id)){covered.add(id);added++}
   union.push(added);
 }
 const backwards=new Set(),exposure=[];
 for(let i=n-1;i>=0;i--){
  const f=selected[i];let visible=0;
  for(const id of f.cellSet)if(!backwards.has(id)){visible++}
  for(const id of f.cellSet)backwards.add(id);
  exposure[i]=visible/f.cellSet.size;
 }
 return {exposure,unionArea:covered.size*100,visibleCount:exposure.filter(x=>x>=.65).length};
}
function selectFields(plan,opts){
 const pool=candidates(plan,opts),chosen=[],max=Math.min(9,opts.maxConnectedFields||8);
 const remaining=pool.slice();
 // This is a maximum-visibility SELECTION among pre-existing guide relations.
 // It neither cuts up nor changes ANY field boundaries. A candidate qualifies
 // when its original colour mass stays visible and does not hide earlier areas.
 while(chosen.length<max&&remaining.length){
  let best=null,bestScore=-Infinity;
  for(const candidate of remaining){
   const overlap=chosen.map(f=>intersect(f,candidate));
   const shared=overlap.reduce((sum,n)=>sum+n,0);
   const union=new Set(chosen.flatMap(f=>f.cells));
   let fresh=0;for(const v of candidate.cells)if(!union.has(v))fresh++;
   const uncovered=fresh/candidate.cells.length;
   if(uncovered<.67)continue;
   if(chosen.some((f,i)=>overlap[i]/f.cells.length>.27))continue;
   const proposed=chosen.concat(candidate);
   const exposure=overlapMetrics(proposed).exposure;
   if(exposure.some(v=>v<.66))continue;
   const distance=chosen.length?Math.min(...chosen.map(f=>dist(f.centre,candidate.centre))):0;
   const newGuideCount=candidate.guideIds.filter(id=>
     chosen.every(f=>!f.guideIds.includes(id))).length;
   const rgbDistance=chosen.length?
     Math.min(...chosen.map(f=>Math.hypot(...f.rgb.map((v,k)=>v-candidate.rgb[k])))):75;
   // Penalise the single huge field that V5h/V5g selected. The chosen
   // geometry must remain readable as multiple autonomous colour forms.
   const targetArea=Math.min(plan.width*plan.height*.016,24000);
   const usable=Math.min(fresh,220);
   const score=usable*100+
     newGuideCount*4400+Math.min(distance,250)*36+
     Math.min(rgbDistance,140)*8+
     Math.max(0,3500-Math.abs(candidate.area-targetArea)*.13)-
     shared*65-
     // Tie breaker is deterministic, anchored to real guide indices.
     (candidate.a.guideIndex+candidate.b.guideIndex)*.01;
   if(score>bestScore){best=candidate;bestScore=score}
  }
  if(!best)break;
  chosen.push(best);
  remaining.splice(remaining.indexOf(best),1);
 }
 return chosen.map((f,i)=>{
   const bb=f.box,seed=A.hash(plan.seed+'|v5i|'+f.pairKey)>>>0;
   return{id:'GI'+i,kind:'guide-connected-visible-field',role:i?'supporting':'primary',
     relationKind:f.a.kind,guideIds:f.guideIds,
     guideIndex:f.a.guideIndex,anchorGuideIndex:f.a.guideIndex,
     branch:f.a.kind==='organic-branch'?f.a.branch:undefined,
     depth:f.a.kind==='organic-branch'?f.a.depth:undefined,
     arm:f.a.kind==='trajectory-ribbon'?f.a.arm:undefined,
     focalTier:f.a.kind==='constructed-focal-form'?f.a.tier:undefined,
     members:[f.a.id,f.b.id],
     sourceIndices:f.sources.slice(),sources:f.sources.slice(),
     contour:f.contour,box:bb,x:f.centre.x,y:f.centre.y,
     width:bb.w,height:bb.h,area:f.area,
     fillFraction:+(f.area/(bb.w*bb.h)).toFixed(3),
     components:1,occupiedCells:f.cells.length,
     cells:f.cells,gridCell:f.gridCell,gridWidth:f.gridWidth,
     rgb:f.rgb,palette:f.palette,seed};
 });
}
function inspect(fields){
 const exposed=[],all=new Set();
 for(let i=fields.length-1;i>=0;i--){
  const f=fields[i];let n=0;
  for(const v of f.cells)if(!all.has(v))n++;
  exposed[i]=n/f.cells.length;
  for(const v of f.cells)all.add(v);
 }
 return{
   count:fields.length,
   visibleFields:exposed.filter(v=>v>=.65).length,
   exposedFractions:exposed.map(v=>+v.toFixed(4)),
   totalUnionArea:all.size*100,
   maxCanvasFraction:null,
   minimumVisibleFraction:exposed.length?Math.min(...exposed):0,
   sourceLinked:fields.every(f=>f.guideIds.length===2&&f.sources.length>0),
   allSingleComponent:fields.every(f=>f.components===1),
   origin:'recorded V5d guide relationships, selected for visible separation'
 };
}
function interpret(source,settings,opts){
 opts=opts||{};
 const plan=sourceGuides(source,settings,opts);
 plan.colourFields=[];plan.fieldStats={count:0};
 plan.connectedFields=selectFields(plan,opts);
 plan.connectedStats=inspect(plan.connectedFields);
 plan.connectedStats.maxCanvasFraction=plan.connectedFields.length?
  Math.max(...plan.connectedFields.map(f=>f.area/(plan.width*plan.height))):0;
 plan.version=VERSION;
 plan.interpretation='visible-source-guide-colour-areas';
 return plan;
}
A.compositionV5hFromSource=prev;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=(settings,opts)=>
  interpret(A.captureCompositionV5(settings,opts),settings,opts);
A.compositionV5iTest={candidates,selectFields,inspect,overlapMetrics};
A.renderInterpretedV5I=(target,settings,scale,opts)=>{
 const stats=A.renderInterpretedV5G(target,settings,scale,opts);
 stats.version=VERSION;return stats;
};
// Debug-only source ownership view. Number only regions that are *actually*
// visible after subsequent fields have been layered. Labels never reach Oil,
// Tissue, the production app, the gallery or the social renderer.
A.renderConnectedPlanV5I=function(target,plan,scale){
 scale=scale||1;target.width=Math.round(plan.width*scale);
 target.height=Math.round(plan.height*scale);
 const ctx=target.getContext('2d');ctx.scale(scale,scale);
 ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,plan.width,plan.height);
 const shapes=[];
 for(const field of plan.connectedFields){
  const poly=field.contour,p=new Path2D();p.moveTo(poly[0].x,poly[0].y);
  for(let i=1;i<poly.length;i++)p.lineTo(poly[i].x,poly[i].y);
  p.closePath();
  const c=field.rgb;
  ctx.fillStyle='rgb('+c.join(',')+')';ctx.fill(p);
  ctx.lineWidth=2.6;ctx.strokeStyle='rgba(37,34,30,.83)';ctx.stroke(p);
  shapes.push(p);
 }
 const later=new Set();
 for(let i=plan.connectedFields.length-1;i>=0;i--){
  const f=plan.connectedFields[i];
  const visible=f.cells.filter(id=>!later.has(id));
  if(visible.length){
   let best=null,bestDist=Infinity;
   for(const idx of visible){
    const x=((idx%f.gridWidth)+.5)*f.gridCell,
          y=(Math.floor(idx/f.gridWidth)+.5)*f.gridCell,
          d=Math.hypot(x-f.x,y-f.y);
    if(d<bestDist){best={x,y};bestDist=d}
   }
   if(best){
    ctx.beginPath();ctx.arc(best.x,best.y,15,0,Math.PI*2);
    ctx.fillStyle='#f5f0e6';ctx.fill();
    ctx.lineWidth=1.8;ctx.strokeStyle='#222';ctx.stroke();
    ctx.fillStyle='#222';ctx.font='bold 17px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(i+1),best.x,best.y);
   }
  }
  for(const idx of f.cells)later.add(idx);
 }
 return{areas:plan.connectedFields.length,stats:plan.connectedStats};
};
A.compositionV5Version=VERSION;
})(window.AlgoArt);


// ---- composition-material-v5j.js ----
// V5j material colour assignment: KEEP V5i's exact source-driven geometry.
// Connected field palettes are local real source pigments, not invented colours.
// Separate material colour from source colour, never recolour geometry metadata.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.compositionV5iTest||!A.planCompositionV5FromSource)
  throw Error('V5j needs frozen source-owned V5i geometry');
const previous=A.planCompositionV5FromSource,VERSION='v5j-material-legibility-1';
const paper=[245,240,230],ink=[43,39,37];
const mix=(a,b,t)=>a.map((x,i)=>Math.round(x*(1-t)+b[i]*t));
const delta=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function variants(field){
  const originals=field.palette?.length?field.palette:[field.rgb];
  const result=[];
  for(const source of originals){
    // Deliberately modest warm-paper and subtractive-ink versions of actual
    // local source pigment: hue identity survives. No arbitrary new palette.
    for(const [kind,t] of [['source',0],['tint',.17],['shade',.15],
                           ['tint',.29],['shade',.26]]){
      result.push({rgb:kind==='source'?source.slice():
        mix(source,kind==='tint'?paper:ink,t),sourceRgb:source.slice(),
        kind,amount:t,change:delta(source,field.rgb)});
    }
  }
  return result.filter(v=>delta(v.rgb,field.rgb)<=74);
}
function assign(fields){
  const painted=[];
  const links=[];
  for(const f of fields){
    const neighbors=painted.filter(g=>distance(f,g)<300);
    const ranks=variants(f).map((v,index)=>{
      let closest=255;
      for(const p of neighbors)closest=Math.min(closest,delta(v.rgb,p.paintRgb));
      const contrast=neighbors.length?Math.min(closest,95):68;
      // Colour differences are only worth pushing if two visible source
      // pieces occupy adjacent parts of the SAME actual composition.
      // Large changes or distant fields never get priority.
      const score=contrast*.86-
        (delta(v.rgb,f.rgb)*.34)-v.change*.13-
        v.amount*10-index*.015;
      return{...v,index,score,contrast};
    }).sort((a,b)=>b.score-a.score||a.index-b.index);
    const chosen=ranks[0];
    f.paintRgb=chosen.rgb.slice();
    f.paintPalette=[chosen.rgb.slice()];
    const original=f.palette||[f.rgb];
    for(const c of original)if(delta(c,chosen.rgb)>22)
      f.paintPalette.push(c.slice());
    f.paintPalette=f.paintPalette.slice(0,3);
    f.paintTone={kind:chosen.kind,amount:chosen.amount,
      sourceRgb:chosen.sourceRgb,deltaFromSource:+delta(chosen.rgb,f.rgb).toFixed(2)};
    for(const n of neighbors)links.push({
      guides:[f.guideIds.join('→'),n.guideIds.join('→')],
      before:+delta(f.rgb,n.rgb).toFixed(1),
      after:+delta(f.paintRgb,n.paintRgb).toFixed(1)});
    painted.push(f);
  }
  return{fields:fields.length,materialPairs:links.length,
    improvedPairs:links.filter(x=>x.after>x.before+8).length,
    unchangedSourceGeometry:true,pairContrasts:links};
}
function interpret(source,settings,opts){
  const plan=previous(source,settings,opts||{});
  plan.materialStats=assign(plan.connectedFields||[]);
  plan.version=VERSION;
  plan.materialInterpretation='local-pigment-contrast-and-physical-handling';
  return plan;
}
A.compositionV5iFromSource=previous;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=(settings,opts)=>
  interpret(A.captureCompositionV5(settings,opts),settings,opts);
A.compositionV5jTest={assign,variants,delta};
A.compositionV5Version=VERSION;
})(window.AlgoArt);


// ---- v5j-material-adapters.js ----
// ALGO/ART V5j: refined physical Oil and Tissue expression of frozen V5i source areas.
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


function oilColourField(ctx,mask,area,painter,plan){
  const poly=massContour(area),r=rng(area.seed+'|v5j-source-bristle'),
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
  ctx.fill(massContour(area));pieces++;
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
A.renderInterpretedV5J=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5j-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
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
  var stats={version:'v5j-prototype',interpretation:'areas',
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
  A.lastV5JInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

// Shared flat debugging view: no physical effect is allowed to invent geometry.
(function(A){
  A.renderConnectedPlanV5J=function(target,plan,scale){
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

