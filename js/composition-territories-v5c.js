// ALGO/ART V5c: material-neutral semantic territories.
// Interpret existing generator metadata rather than infer painted areas
// from stroke proximity alone. Adds no new source composition or material.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PHI=(1+Math.sqrt(5))/2,VERSION='v5c-territories-1';
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function inside(p,v,margin){
  margin=margin||0;
  return p.x>=v.x+margin&&p.x<=v.x+v.w-margin&&
    p.y>=v.y+margin&&p.y<=v.y+v.h-margin;
}
function overlaps(a,b){
  return a.x<b.x+b.w&&a.x+a.w>b.x&&
    a.y<b.y+b.h&&a.y+a.h>b.y;
}
function sq(a,b){var x=a.x-b.x,y=a.y-b.y;return x*x+y*y}
function rect(c,margin){
  return{x:c.x+margin,y:c.y+margin,
    w:Math.max(0,c.w-2*margin),h:Math.max(0,c.h-2*margin)};
}
function shapeFromRect(c,seed){
  // Composition geometry, not physically torn or bristled edges.
  // A small inset preserves clear distinct rectangular φ territories.
  var r=Math.min(c.w,c.h)*(.055+.025*((A.hash(seed)>>>0)/4294967295));
  return [
    {x:+(c.x+r).toFixed(2),y:+(c.y+r).toFixed(2)},
    {x:+(c.x+c.w-r).toFixed(2),y:+(c.y+r).toFixed(2)},
    {x:+(c.x+c.w-r).toFixed(2),y:+(c.y+c.h-r).toFixed(2)},
    {x:+(c.x+r).toFixed(2),y:+(c.y+c.h-r).toFixed(2)}
  ];
}
function sourceSupport(cell,chains){
  var hits=[],totalInside=0,cx=cell.x+cell.w*.5,
      cy=cell.y+cell.h*.5,
      inset=Math.min(cell.w,cell.h)*.045,
      interior=rect(cell,inset);
  for(var i=0;i<chains.length;i++){
    var c=chains[i],n=c.pts.length,
        insideCount=0,insideStrong=0,samples=0;
    for(var j=0;j<n;j+=Math.max(1,Math.floor(n/14))){
      samples++;
      var p=c.pts[j];
      if(inside(p,cell,-1.5)){
        insideCount++;
        if(inside(p,interior,0))insideStrong++;
      }
    }
    if(!insideCount)continue;
    // Long perimeter or global framing strokes are often present in many
    // cells. A mark mostly LOCAL to this cell should dominate its colour.
    var locality=insideCount/Math.max(samples,1),
        weight=Math.sqrt(Math.max(3,c.length))*insideCount*
          (.14+.86*locality*locality)*
          (1+.075*insideStrong);
    hits.push({id:c.sourceIndex,weight:weight,
      inner:insideStrong,rgb:c.rgb,locality:locality});
    totalInside+=insideStrong;
  }
  hits.sort(function(a,b){return b.weight-a.weight||a.id-b.id});
  // Average only hues genuinely belonging to the dominant pigment family,
  // never all unrelated nearby hues: the latter created brown/grey soup
  // in the first V5c Recursive Divisions colour planes.
  var colour=null;
  if(hits.length){
    var best=hits[0],sum=0,acc=[0,0,0];
    for(i=0;i<hits.length;i++){
      var h=hits[i],d=Math.hypot(
        best.rgb[0]-h.rgb[0],best.rgb[1]-h.rgb[1],best.rgb[2]-h.rgb[2]);
      if(d>62)continue;
      var weight=h.weight;
      sum+=weight;
      for(var k=0;k<3;k++)acc[k]+=h.rgb[k]*weight;
    }
    colour=acc.map(function(v){return Math.round(v/Math.max(sum,.0001))});
  }
  return {sources:hits.slice(0,12).map(function(v){return v.id}),
    rgb:colour,strokes:hits.length,inside:totalInside,
    weight:hits.reduce(function(a,v){return a+v.weight},0),
    centre:{x:cx,y:cy}};
}
function hasInteriorCut(cell,protectedVoids){
  for(var i=0;i<protectedVoids.length;i++){
    if(overlaps(cell,protectedVoids[i]))return true;
  }
  return false;
}
function addRectTerritories(plan,source,opts){
  var guide=source.meta&&source.meta.guide,
      cells=guide&&Array.isArray(guide.cells)?guide.cells:[],
      chains=source.chains||A.compositionV5Test.extract(source.paths||[]),
      w=plan.width,h=plan.height,covered=[],eligible=[];
  for(var i=0;i<cells.length;i++){
    var c=cells[i];
    if(!c||!['x','y','w','h'].every(function(k){return Number.isFinite(c[k])}))continue;
    if(c.w<21||c.h<21||c.x<0||c.y<0||
      c.x+c.w>w+1||c.y+c.h>h+1)continue;
    // The generator's explicit voids take priority over all candidate cells.
    if(hasInteriorCut(c,plan.protectedVoids))continue;
    var support=sourceSupport(c,chains);
    if(!support.rgb||!support.sources.length)continue;
    var id='T'+eligible.length,
        shape=shapeFromRect(c,String(plan.seed)+'|'+i),
        bounding=rect(c,Math.min(c.w,c.h)*.055);
    eligible.push({id:id,role:'framed',kind:'rect-cell',
      x:+(c.x+c.w*.5).toFixed(2),y:+(c.y+c.h*.5).toFixed(2),
      width:+c.w.toFixed(2),height:+c.h.toFixed(2),
      box:{x:c.x,y:c.y,w:c.w,h:c.h},
      area:+(c.w*c.h).toFixed(1),
      depth:c.depth||0,sourceIndices:support.sources,
      sources:support.sources.slice(),rgb:support.rgb,
      interiorEvidence:support.inside,inkSources:support.strokes,
      contour:shape,seed:A.hash(plan.seed+'|v5c-territory|'+i)>>>0,
      fillFraction:0});
  }
  // Do not confuse all bordered cells with filled areas. Select areas
  // that contain marks, while explicitly preserving many framed interiors.
  var ranked=eligible.slice().sort(function(a,b){
    var sa=(a.interiorEvidence>1?6:0)+
      Math.min(4,a.inkSources)+Math.sqrt(a.area)/75+
      ((a.seed%71)/71)*.38;
    var sb=(b.interiorEvidence>1?6:0)+
      Math.min(4,b.inkSources)+Math.sqrt(b.area)/75+
      ((b.seed%71)/71)*.38;
    return sb-sa||a.id.localeCompare(b.id);
  });
  var target=Math.min(opts.maxTerritories||12,
    Math.max(2,Math.floor(ranked.length*(guide.variant==='FRAMED'?.34:.52))));
  for(i=0;i<target&&i<ranked.length;i++){
    var territory=ranked[i];
    if(territory.interiorEvidence===0)continue;
    territory.role='painted';
    territory.fillFraction=.83;
  }
  plan.territories=eligible;
  plan.territoryStats={
    total:eligible.length,
    painted:eligible.filter(function(v){return v.role==='painted'}).length,
    framed:eligible.filter(function(v){return v.role==='framed'}).length,
    skippedReserved:cells.length-eligible.length
  };
}
function intersectsProtected(contour,voids){
  // A mass cannot silently span a protected void. Sample edges as well as
  // vertices; the renderer clips as a second and independent safety layer.
  if(!contour||contour.length<3)return false;
  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    // Prevent plans from placing paint into the explicit source void.
    for(var j=0;j<contour.length;j++){
      var a=contour[j],b=contour[(j+1)%contour.length];
      for(var k=0;k<=8;k++){
        var p={x:a.x+(b.x-a.x)*k/8,y:a.y+(b.y-a.y)*k/8};
        if(inside(p,v,0))return true;
      }
    }
    var cx=v.x+v.w*.5,cy=v.y+v.h*.5;
    // Circumvent a filled area wrapping all four corners of a void.
    if(pointInPolygon({x:cx,y:cy},contour))return true;
  }
  return false;
}
function pointInPolygon(p,poly){
  var insidePoly=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)insidePoly=!insidePoly;
  }
  return insidePoly;
}
function enrich(source,settings,opts){
  opts=opts||{};
  var plan=A.compositionV5BaseFromSource(source,settings,opts);
  plan.version=VERSION;
  plan.interpretation='semantic-territories';
  plan.territories=[];
  plan.territoryStats={total:0,painted:0,framed:0,skippedReserved:0};
  plan.sourceGuideKind=source.meta&&source.meta.guide&&source.meta.guide.type||'unknown';
  plan.regionKinds={mass:0,gesture:0,protected:plan.protectedVoids.length};
  // Guide-annotated rectangles are actual φ-subdivision cells, not assumed
  // closed arbitrary Marker curves. Other engines stay source-local.
  if(settings.mode==='rects'&&plan.sourceGuideKind==='rects')
    addRectTerritories(plan,source,opts);
  var filtered=[];
  for(var i=0;i<plan.regions.length;i++){
    var m=plan.regions[i];
    if(intersectsProtected(m.contour,plan.protectedVoids))continue;
    m.kind='directional-mass';
    m.role='gesture-field';
    filtered.push(m);
  }
  plan.regions=filtered;
  plan.regionKinds.mass=filtered.length;
  plan.regionKinds.gesture=plan.gestures.length;
  // In rectilinear mode the planned cells, not random nearby line clusters,
  // are responsible for broad colour blocking. The latter remain small
  // directional marks and can be disabled by a material adapter.
  for(i=0;i<plan.gestures.length;i++)
    plan.gestures[i].kind='directional-gesture';
  return plan;
}
if(!A.planCompositionV5FromSource||!A.captureCompositionV5)
  throw Error('Load shared V5 planner before V5c semantic territories');
A.compositionV5BaseFromSource=A.planCompositionV5FromSource;
A.planCompositionV5FromSource=enrich;
A.planCompositionV5=function(settings,opts){
  return enrich(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5cTest={
  sourceSupport:sourceSupport,overlaps:overlaps,pointInPolygon:pointInPolygon,
  intersectsProtected:intersectsProtected
};
})(window.AlgoArt);
