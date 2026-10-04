window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function crowdFactor(s){
  return A.clamp((s.elements-36)/104,0,1);
}

function elementScale(s){
  return 1/Math.sqrt(Math.max(1,s.elements/48));
}

function enabledShapes(s){
  var a=[];
  if(s.lines)a.push('line');
  if(s.circles)a.push('circle');
  if(s.rectangles)a.push('rect');
  if(s.polygons)a.push('poly');
  if(s.arcs)a.push('arc');
  return a.length?a:['line'];
}

function element(ctx,c,i,s,r,pal,territory){
  var sh=r.chance(s.shapeAmount/100)?r.pick(enabledShapes(s)):'line';
  var scale=elementScale(s);
  var raw=r.range(24,230)*A.lerp(.7,1.2,s.density/100)*scale;
  var size=A.clamp(A.qphi(raw,Math.max(8,22*scale),s.phiStrength/100),6,430*scale);

  if(territory){
    size=Math.min(size,Math.max(18,territory*A.PHI*.95));
  }

  var rot=r.range(0,A.TAU)*(s.rotation/100);
  var col=pal[i%pal.length];
  var ratio=A.lerp(r.range(.6,1.7),A.PHI,s.phiStrength/100);

  if(sh==='line'){
    var a={x:c.x-Math.cos(rot)*size/2,y:c.y-Math.sin(rot)*size/2};
    var b={x:c.x+Math.cos(rot)*size/2,y:c.y+Math.sin(rot)*size/2};
    A.drawLine(ctx,a,b,col,s,r);
  }else if(sh==='circle'){
    A.ellipse(ctx,c,size/2,size/(2*ratio),rot,col,s,r);
  }else if(sh==='rect'){
    A.rect(ctx,c,size,size/ratio,rot,col,s,r);
  }else if(sh==='poly'){
    A.poly(ctx,c,size/2,r.pick([3,5,8]),rot,col,s,r);
  }else{
    A.arc(ctx,c,size/2,rot,A.TAU*r.pick([A.INV,1-A.INV,.5,.75]),col,s,r);
  }

  if(r.chance((s.nesting/160)*A.lerp(1,.62,crowdFactor(s)))){
    var nc=pal[(i+1)%pal.length],n=size/A.PHI;
    if(sh==='rect'){
      A.rect(ctx,c,n,n/A.PHI,rot+A.GOLD,nc,s,r);
    }else if(sh==='circle'){
      A.ellipse(ctx,c,n/2,n/(2*A.PHI),rot+A.GOLD,nc,s,r);
    }else if(sh==='poly'){
      A.poly(ctx,c,n/2,5,rot+A.GOLD,nc,s,r);
    }
  }
}

function drawField(ctx,s,r,pal){
  var crowd=crowdFactor(s);
  var distributed=A.distributedPhiPoints(s.elements,s,r);
  var phase=r.range(0,A.TAU);

  for(var i=0;i<s.elements;i++){
    if(r.chance(s.negativeSpace/260))continue;

    var p=A.phiPoint(s,r);
    var sp=A.goldenCanvasPoint(i,s.elements,s,phase);
    var old={
      x:A.lerp(p.x,sp.x,s.spiralInfluence/180),
      y:A.lerp(p.y,sp.y,s.spiralInfluence/180)
    };
    var d=distributed[i];
    var c={
      x:A.lerp(old.x,d.x,crowd),
      y:A.lerp(old.y,d.y,crowd)
    };

    element(ctx,c,i,s,r,pal,d.territory);
  }
}

function drawSpiral(ctx,s,r,pal){
  var prev=null;
  var phase=r.range(0,A.TAU);
  var points=A.distributedPhiPoints(s.elements,s,r);
  var crowd=crowdFactor(s);

  for(var i=0;i<s.elements;i++){
    var spiral=A.goldenCanvasPoint(i,s.elements,s,phase);
    var d=points[i];
    var p={
      x:A.lerp(spiral.x,d.x,crowd*.32),
      y:A.lerp(spiral.y,d.y,crowd*.32)
    };

    if(prev&&s.lines&&r.chance(A.lerp(.72,.46,crowd))){
      A.drawLine(ctx,prev,p,pal[i%pal.length],s,r);
    }
    if(r.chance(A.lerp(.8,.68,crowd))){
      element(ctx,p,i,s,r,pal,d.territory);
    }
    prev=p;
  }
}

function drawRects(ctx,s,r,pal){
  var x=A.W*.08,y=A.H*.08,w=A.W*.84,h=A.H*.84;
  var depth=Math.max(2,s.recursion+Math.round(s.complexity/35));
  for(var i=0;i<depth;i++){
    var c={x:x+w/2,y:y+h/2};
    A.rect(ctx,c,w,h,r.range(-.06,.06)*(1-s.phiStrength/100),pal[i%pal.length],s,r);
    if(r.chance(s.nesting/100)){
      A.ellipse(ctx,c,Math.min(w,h)*.28,Math.min(w,h)*.28/A.PHI,A.GOLD*i,pal[(i+1)%pal.length],s,r);
    }
    w/=A.PHI;
    h/=A.PHI;
    x=c.x-w/2+(i%2?r.range(-30,30):0);
    y=c.y-h/2+r.range(-20,20);
  }
}

function drawBurst(ctx,s,r,pal){
  var crowd=crowdFactor(s);
  var hubCount=1+Math.floor(crowd*2.8);
  var hubs;

  if(hubCount===1){
    hubs=[{x:A.W/2,y:A.H/2,territory:Math.min(A.W,A.H)*.7}];
  }else{
    hubs=A.distributedPhiPoints(hubCount,s,r);
  }

  var localCounts=[];
  for(var h=0;h<hubCount;h++)localCounts[h]=0;

  for(var i=0;i<s.elements;i++){
    var hubIndex=i%hubCount;
    var c=hubs[hubIndex];
    var local=localCounts[hubIndex]++;
    var perHub=Math.ceil(s.elements/hubCount);
    var a=local*A.lerp(A.TAU/perHub,A.GOLD,s.goldenAngle/100);
    var len=A.qphi(r.range(70,420)*A.lerp(1,.68,crowd),34,s.phiStrength/100);
    var p={
      x:A.clamp(c.x+Math.cos(a)*len,24,A.W-24),
      y:A.clamp(c.y+Math.sin(a)*len,24,A.H-24)
    };

    A.drawLine(ctx,c,p,pal[i%pal.length],s,r);
    if(r.chance((s.shapeAmount/150)*A.lerp(1,.55,crowd))){
      element(ctx,p,i,s,r,pal,c.territory);
    }
  }
}

function drawNetwork(ctx,s,r,pal){
  var crowd=crowdFactor(s);
  var distributed=A.distributedPhiPoints(s.elements,s,r);
  var pts=[];

  for(var i=0;i<s.elements;i++){
    var loose=A.phiPoint(s,r);
    var d=distributed[i];
    var mix=A.lerp(.28,1,crowd);
    pts.push({
      x:A.lerp(loose.x,d.x,mix),
      y:A.lerp(loose.y,d.y,mix),
      territory:d.territory
    });
  }

  var desired=1+Math.floor(s.complexity/34);
  var links=Math.max(1,Math.round(desired*A.lerp(1,.48,crowd)));
  var edges={};

  for(var j=0;j<pts.length;j++){
    var nearest=[];
    for(var k=0;k<pts.length;k++){
      if(k===j)continue;
      var dx=pts[j].x-pts[k].x,dy=pts[j].y-pts[k].y;
      nearest.push({index:k,d:dx*dx+dy*dy});
    }
    nearest.sort(function(a,b){return a.d-b.d});

    for(var n=0;n<links&&n<nearest.length;n++){
      var other=nearest[n].index;
      var lo=Math.min(j,other),hi=Math.max(j,other);
      var key=lo+'-'+hi;
      if(edges[key])continue;
      edges[key]=true;
      A.drawLine(ctx,pts[j],pts[other],pal[(j+n)%pal.length],s,r);
    }

    if(r.chance((s.shapeAmount/100)*A.lerp(1,.52,crowd))){
      element(ctx,pts[j],j,s,r,pal,pts[j].territory);
    }
  }
}

function drawScribble(ctx,s,r,pal){
  var crowd=crowdFactor(s);
  var segments=Math.round(s.elements*A.lerp(2,1.3,crowd));
  var anchors=A.distributedPhiPoints(Math.max(2,Math.ceil(segments/14)),s,r);
  var anchorIndex=0;
  var p=anchors[0];

  for(var i=0;i<segments;i++){
    var a=i*A.GOLD+r.range(-.5,.5);
    var len=A.qphi(r.range(18,160)*A.lerp(1,.72,crowd),18,s.phiStrength/100);
    var q={
      x:A.clamp(p.x+Math.cos(a)*len,25,A.W-25),
      y:A.clamp(p.y+Math.sin(a)*len,25,A.H-25)
    };
    A.drawLine(ctx,p,q,pal[i%pal.length],s,r);
    p=q;

    if(r.chance(.12+crowd*.17)){
      anchorIndex=(anchorIndex+1)%anchors.length;
      p=anchors[anchorIndex];
    }
  }
}

A.geometryOverlay=function(ctx,s){
  ctx.save();
  ctx.globalAlpha=.38;
  ctx.lineWidth=1;
  ctx.strokeStyle='#111';
  ctx.setLineDash([7,7]);

  [A.INV,1-A.INV].forEach(function(v){
    ctx.beginPath();
    ctx.moveTo(A.W*v,0);
    ctx.lineTo(A.W*v,A.H);
    ctx.moveTo(0,A.H*v);
    ctx.lineTo(A.W,A.H*v);
    ctx.stroke();
  });

  ctx.setLineDash([]);
  ctx.strokeStyle='#b8860b';
  ctx.beginPath();
  for(var i=0;i<180;i++){
    var t=i/179,a=i*A.GOLD*.12;
    var rr=Math.pow(t,A.INV)*Math.min(A.W,A.H)*.43;
    var x=A.W/2+Math.cos(a)*rr,y=A.H/2+Math.sin(a)*rr;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.restore();
};

A.render=function(target,s,scale,showGeometry){
  scale=scale||1;
  target.width=A.W*scale;
  target.height=A.H*scale;

  var ctx=target.getContext('2d');
  if(scale!==1)ctx.scale(scale,scale);

  var r=A.makeR(s.seed+'|'+JSON.stringify(s));
  A.paper(ctx,s,r);
  var pal=A.hues(s,r);

  if(s.mode==='field'){
    drawField(ctx,s,r,pal);
  }else if(s.mode==='spiral'){
    drawSpiral(ctx,s,r,pal);
  }else if(s.mode==='rects'){
    drawRects(ctx,s,r,pal);
  }else if(s.mode==='burst'){
    drawBurst(ctx,s,r,pal);
  }else if(s.mode==='network'){
    drawNetwork(ctx,s,r,pal);
  }else if(s.mode==='scribble'){
    drawScribble(ctx,s,r,pal);
  }else if(s.mode==='organic'){
    var organic=Object.assign({},s,{
      curveBias:Math.max(70,s.curveBias),
      wobble:Math.max(45,s.wobble)
    });
    drawField(ctx,organic,r,pal);
  }else if(s.mode==='geometric'){
    var geometric=Object.assign({},s,{
      curveBias:Math.min(12,s.curveBias),
      shapeAmount:Math.max(82,s.shapeAmount),
      wobble:Math.min(18,s.wobble)
    });
    drawField(ctx,geometric,r,pal);
  }

  if(showGeometry)A.geometryOverlay(ctx,s);
};

})(window.AlgoArt);