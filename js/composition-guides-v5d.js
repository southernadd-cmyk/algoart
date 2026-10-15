// ALGO/ART V5d: semantic interpretation of SOURCE GUIDES.
// Composition only; never render colour, paint, paper, or pixels here.
// Loaded after shared V5 and V5c. All their code and historic defaults stay frozen.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
if(!A.planCompositionV5FromSource||!A.captureCompositionV5||!A.compositionV5cTest)
  throw Error('V5d requires the source-preserving V5c semantic planner');
var PI=Math.PI,PHI=(1+Math.sqrt(5))/2,VERSION='v5d-guides-1',
    previous=A.planCompositionV5FromSource;
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function rotate(x,y,a){return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
function point(x,y){return{x:+x.toFixed(2),y:+y.toFixed(2)}}
function inside(p,plan,pad){return p.x>=pad&&p.y>=pad&&
  p.x<=plan.width-pad&&p.y<=plan.height-pad}
function protect(poly,plan){
  return A.compositionV5cTest.intersectsProtected(poly,plan.protectedVoids);
}
function bounds(poly){
  var x=poly.map(function(p){return p.x}),y=poly.map(function(p){return p.y});
  return {x:Math.min.apply(null,x),y:Math.min.apply(null,y),
    w:Math.max.apply(null,x)-Math.min.apply(null,x),
    h:Math.max.apply(null,y)-Math.min.apply(null,y)};
}
// Isolated source support: distance to source path, not arbitrary colour
// guesses or global means. Match pigment family to nearest local path, and
// retain exact source recorder indices in every planned guide territory.
function sourcePigment(points,source,maxRadius){
  var chains=source.chains||A.compositionV5Test.extract(source.paths||[]),
      hits=[];
  for(var i=0;i<chains.length;i++){
    var c=chains[i],best=Infinity;
    for(var k=0;k<points.length;k++){
      var q=points[k],stride=Math.max(1,Math.floor(c.pts.length/35));
      for(var j=0;j<c.pts.length;j+=stride){
        var d=distance(q,c.pts[j]);if(d<best)best=d;
      }
    }
    if(best<=maxRadius)hits.push({sourceIndex:c.sourceIndex,colour:c.rgb,
      dist:best,length:c.length});
  }
  hits.sort(function(a,b){return a.dist-b.dist||
    b.length-a.length||a.sourceIndex-b.sourceIndex});
  if(!hits.length)return null;
  // Explicit local colour family: adjacent unrelated hues never average
  // into grey, unlike the initial V5c territory prototype.
  var lead=hits[0].colour,sum=0,mix=[0,0,0];
  for(i=0;i<Math.min(hits.length,10);i++){
    var h=hits[i],cd=Math.hypot(h.colour[0]-lead[0],
      h.colour[1]-lead[1],h.colour[2]-lead[2]);
    if(cd>63)continue;
    var weight=1/(3+h.dist);sum+=weight;
    for(k=0;k<3;k++)mix[k]+=h.colour[k]*weight;
  }
  return {sources:hits.slice(0,12).map(function(h){return h.sourceIndex}),
    rgb:mix.map(function(v){return Math.round(v/Math.max(sum,.00001))}),
    nearest:+hits[0].dist.toFixed(2)};
}
function ribbon(points,halfwidth){
  var left=[],right=[];
  for(var i=0;i<points.length;i++){
    var p=points[i],before=points[Math.max(0,i-1)],
        after=points[Math.min(points.length-1,i+1)],
        angle=Math.atan2(after.y-before.y,after.x-before.x),
        taper=.37+.63*Math.pow(Math.max(0,Math.sin(PI*i/
          Math.max(1,points.length-1))),.47),
        h=halfwidth*taper,
        nx=-Math.sin(angle),ny=Math.cos(angle);
    left.push(point(p.x+nx*h,p.y+ny*h));
    right.push(point(p.x-nx*h,p.y-ny*h));
  }
  return left.concat(right.reverse());
}
function ellipse(cx,cy,rx,ry,theta){
  var pts=[];
  for(var i=0;i<20;i++){
    var ang=2*PI*i/20,q=rotate(rx*Math.cos(ang),ry*Math.sin(ang),theta);
    pts.push(point(cx+q.x,cy+q.y));
  }
  return pts;
}
function centre(poly){
  var x=0,y=0;for(var i=0;i<poly.length;i++){x+=poly[i].x;y+=poly[i].y}
  return {x:x/poly.length,y:y/poly.length};
}
function asTerritory(plan,source,role,kind,pts,outline,radius,
    guideId,sourceGuideIndex,painted){
  if(!Array.isArray(outline)||outline.length<4||
    !pts.length)return null;
  if(outline.some(function(p){return !inside(p,plan,4)}))return null;
  if(protect(outline,plan))return null;
  var pigment=sourcePigment(pts,source,radius);
  if(!pigment||!pigment.sources.length)return null;
  var b=bounds(outline),c=centre(outline),
      angle=Math.atan2(pts[pts.length-1].y-pts[0].y,
        pts[pts.length-1].x-pts[0].x);
  return{id:'D'+plan.territories.length,role:painted?'painted':'framed',
    kind:kind,guideId:guideId,guideIndex:sourceGuideIndex,
    x:+c.x.toFixed(2),y:+c.y.toFixed(2),width:+b.w.toFixed(2),
    height:+b.h.toFixed(2),box:b,area:+(b.w*b.h).toFixed(1),
    angle:+angle.toFixed(5),sourceIndices:pigment.sources.slice(),
    sources:pigment.sources.slice(),rgb:pigment.rgb,
    sourceDistance:pigment.nearest,axis:pts.map(function(p){
      return point(p.x,p.y)}),contour:outline,
    seed:A.hash(plan.seed+'|'+VERSION+'|'+guideId)>>>0,
    fillFraction:painted?.72:0};
}
function addOrganic(plan,source,opts){
  var guide=source.meta.guide,segs=guide.segments||[],eligible=[];
  // Depth and branch are the *true growth hierarchy* recorded at draw-time.
  // Keep the trunk + meaningful early extensions, never fill an entire
  // disconnected garden just because some thin lines are near each other.
  for(var i=0;i<segs.length;i++){
    var s=segs[i],a={x:s.x1,y:s.y1},b={x:s.x2,y:s.y2},
        len=distance(a,b);
    if(s.depth>2||len<38||!inside(a,plan,2)||!inside(b,plan,2))continue;
    var halfway={x:(a.x+b.x)/2,y:(a.y+b.y)/2},
        pad=clamp(len/(PHI*12),13,46),
        axis=[a,halfway,b],shape=ribbon(axis,pad);
    var region=asTerritory(plan,source,'branch',
      'organic-branch',axis,shape,Math.max(38,pad*1.8),
      'organic-'+s.branch+'-'+i,i,true);
    if(region){
      region.depth=s.depth;region.branch=s.branch;
      eligible.push(region);
    }
    if(eligible.length>=Math.min(opts.maxGuideTerritories||13,14))break;
  }
  // At least some branches must remain lines, not massed-out trees.
  eligible.forEach(function(t,i){
    if(i%5===4){t.role='framed';t.fillFraction=0}
    t.id='D'+plan.territories.length;plan.territories.push(t);
  });
}
function addTrajectories(plan,source,opts){
  var guide=source.meta.guide,raw=guide.points||[],
      groups=new Map(),eligible=[];
  // The recorded guide actually has arm IDs and ordered local positions.
  // A trajectory ribbon occupies one consecutive run on one real arm,
  // never the convex hull surrounding a whole logarithmic spiral.
  for(var i=0;i<raw.length;i++){
    var p=raw[i],arm=Number.isFinite(p.arm)?p.arm:0;
    if(!groups.has(arm))groups.set(arm,[]);
    groups.get(arm).push(p);
  }
  for(const [arm,points] of groups){
    points.sort(function(a,b){return (a.local||0)-(b.local||0)});
    var window=Math.max(4,Math.floor(points.length/5));
    for(var start=0;start<points.length-window;start+=Math.max(3,Math.floor(window*.88))){
      var sampled=points.slice(start,start+window)
        .filter(function(p){return inside(p,plan,18)});
      if(sampled.length<4)continue;
      var len=0;for(i=1;i<sampled.length;i++)len+=distance(sampled[i-1],sampled[i]);
      if(len<50||len>850)continue;
      var pts=sampled.filter(function(p,i){
        return i%Math.max(1,Math.floor(sampled.length/9))===0||
          i===sampled.length-1}).map(function(p){return{x:p.x,y:p.y}});
      var pad=clamp(16+len/(PHI*23),20,50),
          outline=ribbon(pts,pad);
      var t=asTerritory(plan,source,'sweep','trajectory-ribbon',
        pts,outline,Math.max(48,pad*2.0),
        'trajectory-'+arm+'-'+start,start,true);
      if(t){
        t.arm=arm;t.guideVariant=guide.variant;t.golden=true;
        eligible.push(t);
      }
      if(eligible.length>=Math.min(opts.maxGuideTerritories||13,16))break;
    }
    if(eligible.length>=Math.min(opts.maxGuideTerritories||13,16))break;
  }
  eligible.forEach(function(t,i){
    if(i%4===3){t.role='framed';t.fillFraction=0}
    t.id='D'+plan.territories.length;plan.territories.push(t);
  });
}
function addConstructed(plan,source,opts){
  var items=source.meta.guide.items||[],order=items.map(function(v,i){
    return{item:v,index:i}}).filter(function(x){return x.item&&x.item.size>=45})
      .sort(function(a,b){
        return (b.item.tier==='hero'?1:0)-(a.item.tier==='hero'?1:0)||
          b.item.size-a.item.size||a.index-b.index;
      });
  for(var i=0;i<Math.min(order.length,opts.maxGuideTerritories||10);i++){
    var v=order[i].item,
        rx=clamp(v.size*.35,19,112),
        ry=clamp(v.size/(PHI*3.3),14,76),
        c={x:v.x,y:v.y},
        contour=ellipse(v.x,v.y,rx,ry,v.rot||0),
        t=asTerritory(plan,source,'form','constructed-focal-form',
          [c],contour,Math.max(rx,ry)*1.6,
          'constructed-'+order[i].index,order[i].index,true);
    if(!t)continue;
    t.tier=v.tier||'small';
    if(v.tier!=='hero'&&i%3===2){
      t.role='framed';t.fillFraction=0;
    }
    t.id='D'+plan.territories.length;plan.territories.push(t);
  }
}
function enrich(source,settings,opts){
  opts=opts||{};
  var plan=previous(source,settings,opts);
  var guide=source.meta&&source.meta.guide||{},type=guide.type||'none';
  plan.version=VERSION;
  plan.interpretation='guide-semantic-masses';
  plan.guideSemantics=type;
  if(type==='organic'&&Array.isArray(guide.segments))
    addOrganic(plan,source,opts);
  else if(type==='spiral'&&Array.isArray(guide.points))
    addTrajectories(plan,source,opts);
  else if(type==='constructed'&&Array.isArray(guide.items))
    addConstructed(plan,source,opts);
  // Preserve V5c's exact φ-cell territories for Recursive Divisions.
  plan.territoryStats={
    total:plan.territories.length,
    painted:plan.territories.filter(function(t){return t.role==='painted'}).length,
    framed:plan.territories.filter(function(t){return t.role==='framed'}).length,
    skippedReserved:plan.territoryStats.skippedReserved
  };
  plan.guideStats={
    kind:type,
    branches:plan.territories.filter(function(t){return t.kind==='organic-branch'}).length,
    ribbons:plan.territories.filter(function(t){return t.kind==='trajectory-ribbon'}).length,
    constructed:plan.territories.filter(function(t){return t.kind==='constructed-focal-form'}).length
  };
  return plan;
}
A.compositionV5cFromSource=previous;
A.planCompositionV5FromSource=enrich;
A.planCompositionV5=function(settings,opts){
  return enrich(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5dTest={ribbon:ribbon,sourcePigment:sourcePigment,
  addOrganic:addOrganic,addTrajectories:addTrajectories,addConstructed:addConstructed};
})(window.AlgoArt);
