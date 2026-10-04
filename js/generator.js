window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function enabledShapes(s){
  var a=[];
  if(s.lines)a.push('line');
  if(s.circles)a.push('circle');
  if(s.rectangles)a.push('rect');
  if(s.polygons)a.push('poly');
  if(s.arcs)a.push('arc');
  return a.length?a:['line'];
}

function element(ctx,c,i,s,r,pal){
  var sh=r.chance(s.shapeAmount/100)?r.pick(enabledShapes(s)):'line';
  var raw=r.range(24,230)*A.lerp(.7,1.2,s.density/100);
  var size=A.clamp(A.qphi(raw,22,s.phiStrength/100),6,430);
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

  if(r.chance(s.nesting/160)){
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
  for(var i=0;i<s.elements;i++){
    if(r.chance(s.negativeSpace/260))continue;
    var p=A.phiPoint(s,r),sp=A.goldenPoint(i,s.elements,s,r);
    var c={
      x:A.lerp(p.x,sp.x,s.spiralInfluence/180),
      y:A.lerp(p.y,sp.y,s.spiralInfluence/180)
    };
    element(ctx,c,i,s,r,pal);
  }
}

function drawSpiral(ctx,s,r,pal){
  var prev=null;
  for(var i=0;i<s.elements;i++){
    var p=A.goldenPoint(i,s.elements,s,r);
    if(prev&&s.lines&&r.chance(.72))A.drawLine(ctx,prev,p,pal[i%pal.length],s,r);
    if(r.chance(.8))element(ctx,p,i,s,r,pal);
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
  var c={x:A.W/2,y:A.H/2};
  for(var i=0;i<s.elements;i++){
    var a=i*A.lerp(A.TAU/s.elements,A.GOLD,s.goldenAngle/100);
    var len=A.qphi(r.range(80,450),34,s.phiStrength/100);
    var p={x:c.x+Math.cos(a)*len,y:c.y+Math.sin(a)*len};
    A.drawLine(ctx,c,p,pal[i%pal.length],s,r);
    if(r.chance(s.shapeAmount/150))element(ctx,p,i,s,r,pal);
  }
}

function drawNetwork(ctx,s,r,pal){
  var pts=[];
  for(var i=0;i<s.elements;i++)pts.push(A.phiPoint(s,r));
  for(var j=0;j<pts.length;j++){
    var links=1+Math.floor(s.complexity/34);
    for(var k=1;k<=links;k++){
      var b=pts[(j+k+r.int(0,5))%pts.length];
      A.drawLine(ctx,pts[j],b,pal[(j+k)%pal.length],s,r);
    }
    if(r.chance(s.shapeAmount/100))element(ctx,pts[j],j,s,r,pal);
  }
}

function drawScribble(ctx,s,r,pal){
  var p=A.phiPoint(s,r);
  for(var i=0;i<s.elements*2;i++){
    var a=i*A.GOLD+r.range(-.5,.5);
    var len=A.qphi(r.range(18,160),18,s.phiStrength/100);
    var q={
      x:A.clamp(p.x+Math.cos(a)*len,25,A.W-25),
      y:A.clamp(p.y+Math.sin(a)*len,25,A.H-25)
    };
    A.drawLine(ctx,p,q,pal[i%pal.length],s,r);
    p=q;
    if(r.chance(.14))p=A.phiPoint(s,r);
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