// ALGO/ART V5e: genuine two-dimensional colour-field layout.
// Standalone, material-neutral and optional: no renderer edits.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.planCompositionV5FromSource||!A.compositionV5dTest)
  throw Error('V5e requires the material-neutral V5d guide interpreter');
var previous=A.planCompositionV5FromSource,
    VERSION='v5e-colour-fields-1',PI=Math.PI;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function d(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function point(x,y){return{x:+x.toFixed(2),y:+y.toFixed(2)}}
function hash(s){return A.hash(s)>>>0}
function bounds(pts){
  var xx=pts.map(function(p){return p.x}),yy=pts.map(function(p){return p.y});
  return{x:Math.min.apply(null,xx),y:Math.min.apply(null,yy),
    w:Math.max.apply(null,xx)-Math.min.apply(null,xx),
    h:Math.max.apply(null,yy)-Math.min.apply(null,yy)};
}
function hull(points){
  var q=points.slice().sort(function(a,b){return a.x-b.x||a.y-b.y}),
      cross=function(o,a,b){return(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x)},
      lo=[],hi=[],i;
  for(i=0;i<q.length;i++){
    while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],q[i])<=0)lo.pop();
    lo.push(q[i]);
  }
  for(i=q.length-1;i>=0;i--){
    while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],q[i])<=0)hi.pop();
    hi.push(q[i]);
  }
  return lo.slice(0,-1).concat(hi.slice(0,-1));
}
function smooth(p){
  var out=[];
  for(var i=0;i<p.length;i++){
    var a=p[i],b=p[(i+1)%p.length];
    out.push(point(a.x*.75+b.x*.25,a.y*.75+b.y*.25));
    out.push(point(a.x*.25+b.x*.75,a.y*.25+b.y*.75));
  }
  return out;
}
// Fields have an AREA and a perimeter, not a path width.
// Expand the hull around *multiple related marks* and round its boundary.
// A degenerate single branch gets a substantial elliptical body rather than
// a 30-pixel-wide vector stroke. Deliberately avoid the source paths' tips.
function broadContour(sourcePoints,margin,seed,plan){
  var points=sourcePoints.filter(function(p){return Number.isFinite(p.x)&&
    Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&
    p.x<=plan.width&&p.y<=plan.height});
  if(points.length<2)return [];
  var raw=hull(points),bb=bounds(points),cx=bb.x+bb.w*.5,cy=bb.y+bb.h*.5,
      random=A.makeR(String(seed)),outline=[];
  if(raw.length<3||bb.w<20||bb.h<20){
    var angle=Math.atan2(points[points.length-1].y-points[0].y,
      points[points.length-1].x-points[0].x),
        rx=Math.max(70,Math.hypot(bb.w,bb.h)*.52+margin*.55),
        ry=Math.max(54,Math.min(90,margin*.9));
    for(var k=0;k<20;k++){
      var t=2*PI*k/20,ripple=1+.055*Math.sin(k*2.3+seed%19),
          u=Math.cos(t)*rx*ripple,v=Math.sin(t)*ry*ripple;
      outline.push(point(cx+Math.cos(angle)*u-Math.sin(angle)*v,
        cy+Math.sin(angle)*u+Math.cos(angle)*v));
    }
  }else{
    for(k=0;k<raw.length;k++){
      var p=raw[k],vx=p.x-cx,vy=p.y-cy,len=Math.hypot(vx,vy)||1,
          extra=margin*random.range(.80,1.21);
      outline.push(point(p.x+vx/len*extra,p.y+vy/len*extra));
    }
    // Natural, gently lobed field perimeter independent of paper tears/oil.
    outline=smooth(smooth(outline));
  }
  outline=outline.map(function(p){return point(
    clamp(p.x,9,plan.width-9),clamp(p.y,9,plan.height-9))});
  // Preserve actual generator-declared negative-space cells. Rather than
  // invent a chopped-out filled polygon, reject fields spanning a void.
  if(A.compositionV5cTest.intersectsProtected(outline,plan.protectedVoids))
    return [];
  return outline;
}
function makeField(plan,src,guideId,points,margin,mode,groupIndex){
  var contour=broadContour(points,margin,hash(plan.seed+'|'+guideId),plan);
  if(contour.length<6)return null;
  var colour=A.compositionV5dTest.sourcePigment(points,src,
    Math.max(margin*1.4,90));
  if(!colour||!colour.sources.length)return null;
  var box=bounds(contour),cx=box.x+box.w/2,cy=box.y+box.h/2,
      surface=Math.round(box.w*box.h);
  if(surface<9000)return null;
  return {id:'F'+plan.colourFields.length,kind:'source-colour-field',
    role:'painted',guideId:guideId,guideIndex:groupIndex,
    mode:mode,x:+cx.toFixed(2),y:+cy.toFixed(2),
    width:+box.w.toFixed(2),height:+box.h.toFixed(2),
    box:box,area:surface,contour:contour,sourcePoints:points.length,
    sources:colour.sources.slice(),sourceIndices:colour.sources.slice(),
    rgb:colour.rgb,seed:hash(plan.seed+'|v5e-field|'+guideId),
    fillFraction:.83};
}
function organicGroups(guide,plan){
  var groups=new Map();
  for(var i=0;i<(guide.segments||[]).length;i++){
    var seg=guide.segments[i];if(seg.depth>3)continue;
    var key=seg.branch;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({x:seg.x1,y:seg.y1});
    groups.get(key).push({x:seg.x2,y:seg.y2});
  }
  return [...groups].map(function(v){return{id:'growth-branch-'+v[0],
    points:v[1],padding:75+Math.min(30,v[1].length*.70)}});
}
function trajectoryGroups(guide){
  var groups=new Map(),raw=guide.points||[];
  for(var i=0;i<raw.length;i++){
    var p=raw[i],arm=Number.isFinite(p.arm)?p.arm:0;
    if(!groups.has(arm))groups.set(arm,[]);
    groups.get(arm).push(p);
  }
  var fields=[];
  for(const [arm,items] of groups){
    items.sort(function(a,b){return(a.local||0)-(b.local||0)});
    var partitions=Math.min(4,Math.max(2,Math.floor(items.length/9)));
    for(var part=0;part<partitions;part++){
      var min=Math.max(0,Math.floor(part*items.length/partitions)-2),
          max=Math.min(items.length,Math.ceil((part+1)*items.length/partitions)+2),
          points=items.slice(min,max);
      if(points.length<4)continue;
      fields.push({id:'trajectory-arm-'+arm+'-field-'+part,
        points:points,padding:Math.min(115,80+items.length*.8)});
    }
  }
  return fields;
}
function constructedGroups(guide){
  var items=(guide.items||[]).filter(function(i){return i&&
      Number.isFinite(i.x)&&Number.isFinite(i.y)&&i.size>=25}),
      heroes=items.filter(function(i){return i.tier==='hero'})
        .sort(function(a,b){return b.size-a.size});
  if(!heroes.length)heroes=items.slice().sort(function(a,b){
    return b.size-a.size}).slice(0,2);
  return heroes.slice(0,3).map(function(hero,index){
    var satellites=items.filter(function(v){
      return v!==hero&&d(v,hero)<Math.max(180,hero.size*1.18)})
      .sort(function(a,b){return d(a,hero)-d(b,hero)}).slice(0,6);
    var points=[hero].concat(satellites).map(function(i){return{x:i.x,y:i.y}});
    // Use actual field of influence around the source's prominent form,
    // rather than linearly tracing the perimeters of its marks.
    return{id:'constructed-hero-'+index,
      points:points,padding:clamp(hero.size*.45,72,125)};
  });
}
function interpret(source,settings,opts){
  opts=opts||{};
  var plan=previous(source,settings,opts),
      guide=source.meta&&source.meta.guide||{},type=guide.type,
      groups=type==='organic'?organicGroups(guide,plan):
        type==='spiral'?trajectoryGroups(guide):
        type==='constructed'?constructedGroups(guide):[];
  plan.version=VERSION;
  plan.interpretation='shared-colour-fields';
  plan.colourFields=[];
  // Rectangular cells are *already filled fields* in V5c, unchanged.
  // New fields should live between/outside related marks for non-rect modes.
  for(var i=0;i<groups.length&&plan.colourFields.length<
      Math.min(opts.maxColourFields||5,6);i++){
    var g=groups[i],candidate=makeField(plan,source,g.id,g.points,
      g.padding,type,i);
    if(!candidate)continue;
    // Focal fields can overlap slightly like true painted colour, but
    // prevent redundant identical-sized fields swallowing all negative space.
    var near=plan.colourFields.some(function(old){
      return d(old,candidate)<Math.min(old.width,old.height)*.39});
    if(!near)plan.colourFields.push(candidate);
  }
  plan.fieldStats={type:type||'unknown',count:plan.colourFields.length,
    area:plan.colourFields.reduce(function(sum,f){return sum+f.area},0),
    sourceLinked:plan.colourFields.every(function(f){return f.sources.length>0})};
  return plan;
}
A.compositionV5dFromSource=previous;
A.planCompositionV5FromSource=interpret;
A.planCompositionV5=function(settings,opts){
  return interpret(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5eTest={broadContour:broadContour,organicGroups:organicGroups,
  trajectoryGroups:trajectoryGroups,constructedGroups:constructedGroups};
})(window.AlgoArt);
