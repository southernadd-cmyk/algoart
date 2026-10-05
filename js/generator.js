window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

function crowdFactor(s){
  return A.clamp((s.elements-36)/104,0,1);
}

function overlapAllowance(s){
  return A.clamp(s.overlap/100,0,1);
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

function hierarchyPlan(total){
  total=Math.max(1,total|0);
  var hero=total>=70?3:(total>=24?2:1);
  var medium=Math.max(2,Math.round(total*.21));
  if(hero+medium>total)medium=Math.max(0,total-hero);

  var tiers=[],i;
  for(i=0;i<hero;i++)tiers.push('hero');
  for(i=0;i<medium;i++)tiers.push('medium');
  while(tiers.length<total)tiers.push('small');
  return tiers;
}

function tierScale(tier){
  if(tier==='hero')return 1.72;
  if(tier==='medium')return 1;
  return .56;
}

function baseElementScale(s){
  return 1/Math.sqrt(Math.max(1,s.elements/48));
}

function makeBaseSize(s,tier,r,territory){
  var scale=baseElementScale(s);
  var density=A.lerp(.76,1.18,s.density/100);
  var raw=r.range(32,215)*density*scale*tierScale(tier);
  var base=Math.max(7,22*scale);
  var size=A.qphi(raw,base,s.phiStrength/100);

  if(tier==='hero')size=Math.max(size,72*scale);
  if(territory)size=Math.min(size,Math.max(20,territory*A.lerp(.78,1.22,overlapAllowance(s))));

  return A.clamp(size,8,410);
}

function minDistanceFor(a,b,s){
  var strict=1-overlapAllowance(s);
  var radii=(a.size+b.size)*.5;
  var tierBoost=(a.tier==='hero'||b.tier==='hero')?1.12:1;
  return radii*A.lerp(.12,.72,strict)*tierBoost;
}

function pairPenalty(a,b,s){
  var dx=a.x-b.x,dy=a.y-b.y;
  var dist=Math.sqrt(dx*dx+dy*dy);
  var desired=minDistanceFor(a,b,s);
  if(dist>=desired)return 0;
  return (desired-dist)/Math.max(1,desired);
}

function placementPenalty(obj,placed,s){
  var p=0;
  for(var i=0;i<placed.length;i++)p+=pairPenalty(obj,placed[i],s);
  return p;
}

function candidatePosition(i,total,s,r,tier,distributed,phase,attempt){
  var d=distributed[(i+attempt*5)%distributed.length];
  var spiral=A.goldenCanvasPoint(i+attempt*.28,total,s,phase+attempt*A.GOLD*.23);
  var phi=A.phiPoint(s,r);
  var spiralMix=A.clamp(s.spiralInfluence/100,0,1);
  var x=A.lerp(phi.x,spiral.x,spiralMix*.78);
  var y=A.lerp(phi.y,spiral.y,spiralMix*.78);

  var crowd=crowdFactor(s);
  var distributionMix=A.lerp(.16,.9,crowd);
  if(tier==='hero')distributionMix*=.62;
  if(tier==='small')distributionMix=Math.min(1,distributionMix*1.08);

  x=A.lerp(x,d.x,distributionMix);
  y=A.lerp(y,d.y,distributionMix);

  var freedom=(1-s.phiStrength/100)*36;
  x+=r.range(-freedom,freedom);
  y+=r.range(-freedom,freedom);

  return{x:x,y:y,territory:d.territory};
}

function makeLayoutPlan(s,seedSuffix){
  var r=A.makeR(s.seed+'|'+JSON.stringify(s)+'|layout|'+seedSuffix);
  var tiers=hierarchyPlan(s.elements);
  var distributed=A.distributedPhiPoints(s.elements,s,r);
  var phase=r.range(0,A.TAU);
  var placed=[];

  for(var i=0;i<tiers.length;i++){
    var tier=tiers[i];
    var best=null,bestPenalty=Infinity;
    var tries=tier==='hero'?28:20;

    for(var t=0;t<tries;t++){
      var pos=candidatePosition(i,tiers.length,s,r,tier,distributed,phase,t);
      var shrink=1-Math.min(.26,t*.012)*(1-overlapAllowance(s));
      var obj={
        tier:tier,
        x:A.clamp(pos.x,28,A.W-28),
        y:A.clamp(pos.y,28,A.H-28),
        size:makeBaseSize(s,tier,r,pos.territory)*shrink,
        rot:r.range(0,A.TAU)*(s.rotation/100),
        territory:pos.territory
      };

      var penalty=placementPenalty(obj,placed,s);
      if(penalty<bestPenalty){
        bestPenalty=penalty;
        best=obj;
      }
      if(penalty<.015)break;
    }

    if(best)placed.push(best);
  }

  return placed;
}

function visualWeight(obj,s){
  var tier=obj.tier==='hero'?1.35:(obj.tier==='medium'?1:.72);
  return obj.size*obj.size*tier*(.55+s.thickness/34)*(.45+s.opacity/150);
}

function scoreLayout(layout,s){
  if(!layout.length)return-1e9;

  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  var collision=0,totalWeight=0,wx=0,wy=0;
  var edgeHits=0,heroSpread=0,heroes=[];

  for(var i=0;i<layout.length;i++){
    var a=layout[i],half=a.size*.5;
    minX=Math.min(minX,a.x-half);
    minY=Math.min(minY,a.y-half);
    maxX=Math.max(maxX,a.x+half);
    maxY=Math.max(maxY,a.y+half);

    var w=visualWeight(a,s);
    totalWeight+=w;
    wx+=a.x*w;
    wy+=a.y*w;

    if(a.x<A.W*.15||a.x>A.W*.85||a.y<A.H*.15||a.y>A.H*.85)edgeHits++;
    if(a.tier==='hero')heroes.push(a);

    for(var j=i+1;j<layout.length;j++)collision+=pairPenalty(a,layout[j],s);
  }

  for(var h=0;h<heroes.length;h++){
    for(var k=h+1;k<heroes.length;k++){
      var hdx=heroes[h].x-heroes[k].x,hdy=heroes[h].y-heroes[k].y;
      heroSpread+=Math.sqrt(hdx*hdx+hdy*hdy)/Math.hypot(A.W,A.H);
    }
  }

  var coverageX=A.clamp((maxX-minX)/A.W,0,1);
  var coverageY=A.clamp((maxY-minY)/A.H,0,1);
  var coverage=(coverageX+coverageY)*86;

  var edgeTarget=.18+.16*crowdFactor(s);
  var edgeRatio=edgeHits/layout.length;
  var edgeScore=28-Math.abs(edgeRatio-edgeTarget)*65;

  var cx=wx/Math.max(1,totalWeight),cy=wy/Math.max(1,totalWeight);
  var targets=[
    {x:A.W*A.INV,y:A.H*A.INV},
    {x:A.W*(1-A.INV),y:A.H*A.INV},
    {x:A.W*A.INV,y:A.H*(1-A.INV)},
    {x:A.W*(1-A.INV),y:A.H*(1-A.INV)}
  ];
  var bestPhi=Infinity;
  for(var p=0;p<targets.length;p++){
    var dx=targets[p].x-cx,dy=targets[p].y-cy;
    bestPhi=Math.min(bestPhi,Math.sqrt(dx*dx+dy*dy));
  }

  var diag=Math.hypot(A.W,A.H);
  var phiScore=(1-bestPhi/diag)*78*(s.phiStrength/100);
  var collisionPenalty=collision*A.lerp(18,5,overlapAllowance(s));
  var hierarchyScore=heroes.length>1?heroSpread*34:12;

  return coverage+edgeScore+phiScore+hierarchyScore-collisionPenalty;
}

function chooseBestLayout(s){
  var candidates=s.elements>110?4:6;
  var best=null,bestScore=-Infinity;

  for(var i=0;i<candidates;i++){
    var layout=makeLayoutPlan(s,i);
    var score=scoreLayout(layout,s);
    if(score>bestScore){
      bestScore=score;
      best=layout;
    }
  }

  return best||[];
}

function drawPlannedElement(ctx,plan,i,s,r,pal){
  var sh=r.chance(s.shapeAmount/100)?r.pick(enabledShapes(s)):'line';
  var c={x:plan.x,y:plan.y};
  var size=plan.size;
  var rot=plan.rot;
  var col=pal[i%pal.length];
  var ratio=A.lerp(r.range(.65,1.68),A.PHI,s.phiStrength/100);

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

  var nest=(s.nesting/160)*A.lerp(1,.65,crowdFactor(s));
  if(plan.tier==='hero')nest*=1.24;
  if(plan.tier==='small')nest*=.66;

  if(r.chance(nest)){
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
  var layout=chooseBestLayout(s);
  var skipChance=s.negativeSpace/300;

  for(var i=0;i<layout.length;i++){
    if(layout[i].tier==='small'&&r.chance(skipChance))continue;
    drawPlannedElement(ctx,layout[i],i,s,r,pal);
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
      var temp={
        tier:i<2?'hero':(i<Math.max(4,Math.round(s.elements*.2))?'medium':'small'),
        x:p.x,y:p.y,
        size:makeBaseSize(s,i<2?'hero':'small',r,d.territory),
        rot:r.range(0,A.TAU)*(s.rotation/100),
        territory:d.territory
      };
      drawPlannedElement(ctx,temp,i,s,r,pal);
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
  var hubs=hubCount===1
    ?[{x:A.W/2,y:A.H/2,territory:Math.min(A.W,A.H)*.7}]
    :A.distributedPhiPoints(hubCount,s,r);

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
      var tier=i<hubCount?'hero':(i<hubCount*4?'medium':'small');
      drawPlannedElement(ctx,{
        tier:tier,x:p.x,y:p.y,
        size:makeBaseSize(s,tier,r,c.territory),
        rot:a,territory:c.territory
      },i,s,r,pal);
    }
  }
}

function nearestNeighbours(layout,index,count){
  var a=layout[index],nearest=[];
  for(var i=0;i<layout.length;i++){
    if(i===index)continue;
    var dx=a.x-layout[i].x,dy=a.y-layout[i].y;
    nearest.push({index:i,d:dx*dx+dy*dy});
  }
  nearest.sort(function(x,y){return x.d-y.d});
  return nearest.slice(0,count);
}

function drawNetwork(ctx,s,r,pal){
  var layout=chooseBestLayout(s);
  var crowd=crowdFactor(s);
  var baseLinks=1+Math.floor(s.complexity/38);
  var edges={};

  for(var i=0;i<layout.length;i++){
    var extra=layout[i].tier==='hero'?1:0;
    var links=Math.max(1,Math.round((baseLinks+extra)*A.lerp(1,.62,crowd)));
    var nearest=nearestNeighbours(layout,i,links);

    for(var n=0;n<nearest.length;n++){
      var other=nearest[n].index;
      var lo=Math.min(i,other),hi=Math.max(i,other),key=lo+'-'+hi;
      if(edges[key])continue;
      edges[key]=true;
      A.drawLine(ctx,layout[i],layout[other],pal[(i+n)%pal.length],s,r);
    }

    if(r.chance((s.shapeAmount/100)*A.lerp(1,.58,crowd))){
      drawPlannedElement(ctx,layout[i],i,s,r,pal);
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
    drawField(ctx,Object.assign({},s,{
      curveBias:Math.max(70,s.curveBias),
      wobble:Math.max(45,s.wobble)
    }),r,pal);
  }else if(s.mode==='geometric'){
    drawField(ctx,Object.assign({},s,{
      curveBias:Math.min(12,s.curveBias),
      shapeAmount:Math.max(82,s.shapeAmount),
      wobble:Math.min(18,s.wobble)
    }),r,pal);
  }

  if(showGeometry)A.geometryOverlay(ctx,s);
};

})(window.AlgoArt);