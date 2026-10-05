window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

var STRATEGIES=['BALANCED','VOID','TENSION','ORBIT','EDGE','MONUMENT','DIAGONAL'];

function crowdFactor(s){
  return A.clamp((s.elements-36)/104,0,1);
}

function overlapAllowance(s){
  return A.clamp(s.overlap/100,0,1);
}

function chooseStrategy(s){
  return STRATEGIES[A.hash(s.seed+'|'+s.mode+'|composition-strategy')%STRATEGIES.length];
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

function hierarchyPlan(total,strategy){
  total=Math.max(1,total|0);
  var hero;

  if(strategy==='MONUMENT')hero=1;
  else hero=total>=70?3:(total>=24?2:1);

  var medium=Math.max(2,Math.round(total*(strategy==='MONUMENT'?.16:.21)));
  if(hero+medium>total)medium=Math.max(0,total-hero);

  var tiers=[],i;
  for(i=0;i<hero;i++)tiers.push('hero');
  for(i=0;i<medium;i++)tiers.push('medium');
  while(tiers.length<total)tiers.push('small');
  return tiers;
}

function tierScale(tier,strategy){
  if(tier==='hero')return strategy==='MONUMENT'?2.35:1.72;
  if(tier==='medium')return 1;
  return strategy==='MONUMENT'?.48:.56;
}

function baseElementScale(s){
  return 1/Math.sqrt(Math.max(1,s.elements/48));
}

function makeBaseSize(s,tier,r,territory,strategy){
  var scale=baseElementScale(s);
  var density=A.lerp(.76,1.18,s.density/100);
  var raw=r.range(32,215)*density*scale*tierScale(tier,strategy);
  var base=Math.max(7,22*scale);
  var size=A.qphi(raw,base,s.phiStrength/100);

  if(tier==='hero')size=Math.max(size,(strategy==='MONUMENT'?110:72)*scale);
  if(territory)size=Math.min(size,Math.max(20,territory*A.lerp(.78,1.22,overlapAllowance(s))));

  return A.clamp(size,8,strategy==='MONUMENT'?470:410);
}

function makeReservedVoids(s,strategy,r){
  var strength=A.clamp(s.negativeSpace/100,0,1);
  if(strength<.08)return[];

  var cells=A.goldenCells(10,54).slice();
  cells.sort(function(a,b){return b.w*b.h-a.w*a.h});

  var count=strength>.7?2:1;
  if(strategy==='VOID'&&strength>.42)count=2;

  var start=r.int(1,Math.min(4,cells.length-1));
  var out=[];

  for(var i=0;i<count;i++){
    var c=cells[(start+i*3)%Math.min(8,cells.length)];
    var scale=A.lerp(.46,.88,strength)*(strategy==='VOID'?1.08:1);
    var w=A.clamp(c.w*scale,110,A.W*.43);
    var h=A.clamp(c.h*scale,90,A.H*.43);

    out.push({
      x:A.clamp(c.x+c.w/2-w/2,34,A.W-w-34),
      y:A.clamp(c.y+c.h/2-h/2,34,A.H-h-34),
      w:w,h:h
    });
  }

  return out;
}

function pointInVoid(x,y,voids){
  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    if(x>=v.x&&x<=v.x+v.w&&y>=v.y&&y<=v.y+v.h)return true;
  }
  return false;
}

function objectVoidPenalty(obj,voids,s){
  if(!voids.length)return 0;

  var radius=obj.size*.38;
  var pad=A.lerp(4,34,s.negativeSpace/100);
  var total=0;

  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    var cx=A.clamp(obj.x,v.x,v.x+v.w);
    var cy=A.clamp(obj.y,v.y,v.y+v.h);
    var dx=obj.x-cx,dy=obj.y-cy;
    var dist=Math.sqrt(dx*dx+dy*dy);
    var desired=radius+pad;
    if(dist<desired)total+=(desired-dist)/Math.max(1,desired);
  }

  return total;
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

function placementPenalty(obj,placed,s,voids){
  var p=objectVoidPenalty(obj,voids,s)*A.lerp(4,14,s.negativeSpace/100);
  for(var i=0;i<placed.length;i++)p+=pairPenalty(obj,placed[i],s);
  return p;
}

function phiTargets(){
  return[
    {x:A.W*A.INV,y:A.H*A.INV},
    {x:A.W*(1-A.INV),y:A.H*A.INV},
    {x:A.W*A.INV,y:A.H*(1-A.INV)},
    {x:A.W*(1-A.INV),y:A.H*(1-A.INV)}
  ];
}

function applyStrategyPosition(pos,i,total,tier,strategy,s){
  var targets=phiTargets();
  var t,edge,diagY;

  if(strategy==='TENSION'&&tier==='hero'){
    t=targets[i%2===0?0:3];
    pos.x=A.lerp(pos.x,t.x,.72);
    pos.y=A.lerp(pos.y,t.y,.72);
  }else if(strategy==='ORBIT'){
    var orbit=A.goldenCanvasPoint(i,total,s,A.GOLD*.5);
    pos.x=A.lerp(pos.x,orbit.x,.48);
    pos.y=A.lerp(pos.y,orbit.y,.48);
  }else if(strategy==='EDGE'&&tier!=='hero'){
    edge=i%4;
    if(edge===0)pos.x=A.lerp(pos.x,38,.38);
    if(edge===1)pos.x=A.lerp(pos.x,A.W-38,.38);
    if(edge===2)pos.y=A.lerp(pos.y,38,.38);
    if(edge===3)pos.y=A.lerp(pos.y,A.H-38,.38);
  }else if(strategy==='MONUMENT'){
    if(tier==='hero'){
      t=targets[0];
      pos.x=A.lerp(pos.x,t.x,.68);
      pos.y=A.lerp(pos.y,t.y,.68);
    }else{
      pos.x=A.lerp(pos.x,A.W*.62,.12);
      pos.y=A.lerp(pos.y,A.H*.58,.12);
    }
  }else if(strategy==='DIAGONAL'){
    var reverse=(A.hash(s.seed+'|diag')%2)===1;
    diagY=(pos.x/A.W)*A.H;
    if(reverse)diagY=A.H-diagY;
    pos.y=A.lerp(pos.y,diagY,.42);
  }

  return pos;
}

function candidatePosition(i,total,s,r,tier,distributed,phase,attempt,strategy){
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

  var pos={
    x:A.lerp(x,d.x,distributionMix),
    y:A.lerp(y,d.y,distributionMix),
    territory:d.territory
  };

  pos=applyStrategyPosition(pos,i,total,tier,strategy,s);

  var freedom=(1-s.phiStrength/100)*36;
  pos.x+=r.range(-freedom,freedom);
  pos.y+=r.range(-freedom,freedom);

  return pos;
}

function makeLayoutPlan(s,seedSuffix,strategy,voids){
  var r=A.makeR(s.seed+'|'+JSON.stringify(s)+'|layout|'+seedSuffix+'|'+strategy);
  var tiers=hierarchyPlan(s.elements,strategy);
  var distributed=A.distributedPhiPoints(s.elements,s,r);
  var phase=r.range(0,A.TAU);
  var placed=[];

  for(var i=0;i<tiers.length;i++){
    var tier=tiers[i];
    var best=null,bestPenalty=Infinity;
    var tries=tier==='hero'?30:22;

    for(var t=0;t<tries;t++){
      var pos=candidatePosition(i,tiers.length,s,r,tier,distributed,phase,t,strategy);
      var shrink=1-Math.min(.28,t*.012)*(1-overlapAllowance(s));
      var obj={
        tier:tier,
        x:A.clamp(pos.x,28,A.W-28),
        y:A.clamp(pos.y,28,A.H-28),
        size:makeBaseSize(s,tier,r,pos.territory,strategy)*shrink,
        rot:r.range(0,A.TAU)*(s.rotation/100),
        territory:pos.territory
      };

      var penalty=placementPenalty(obj,placed,s,voids);
      if(penalty<bestPenalty){
        bestPenalty=penalty;
        best=obj;
      }
      if(penalty<.012)break;
    }

    if(best)placed.push(best);
  }

  return placed;
}

function visualWeight(obj,s){
  var tier=obj.tier==='hero'?1.35:(obj.tier==='medium'?1:.72);
  return obj.size*obj.size*tier*(.55+s.thickness/34)*(.45+s.opacity/150);
}

function strategyScore(layout,s,strategy,voids){
  var score=0,i,dx,dy;
  var targets=phiTargets();
  var heroes=layout.filter(function(o){return o.tier==='hero'});

  if(strategy==='VOID'){
    for(i=0;i<layout.length;i++)score-=objectVoidPenalty(layout[i],voids,s)*24;
    score+=voids.length*18;
  }else if(strategy==='TENSION'&&heroes.length>1){
    dx=heroes[0].x-heroes[1].x;
    dy=heroes[0].y-heroes[1].y;
    score+=Math.sqrt(dx*dx+dy*dy)/Math.hypot(A.W,A.H)*55;
  }else if(strategy==='ORBIT'){
    var phase=A.GOLD*.5;
    for(i=0;i<layout.length;i++){
      var gp=A.goldenCanvasPoint(i,layout.length,s,phase);
      dx=layout[i].x-gp.x;dy=layout[i].y-gp.y;
      score+=Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/420)*1.5;
    }
  }else if(strategy==='EDGE'){
    var edge=0;
    for(i=0;i<layout.length;i++){
      if(layout[i].x<A.W*.12||layout[i].x>A.W*.88||layout[i].y<A.H*.12||layout[i].y>A.H*.88)edge++;
    }
    score+=edge/layout.length*45;
  }else if(strategy==='MONUMENT'&&heroes.length){
    var avg=0;
    for(i=0;i<layout.length;i++)avg+=layout[i].size;
    avg/=layout.length;
    score+=Math.min(55,(heroes[0].size/Math.max(1,avg))*14);
  }else if(strategy==='DIAGONAL'){
    var reverse=(A.hash(s.seed+'|diag')%2)===1;
    for(i=0;i<layout.length;i++){
      var expected=(layout[i].x/A.W)*A.H;
      if(reverse)expected=A.H-expected;
      score+=Math.max(0,1-Math.abs(layout[i].y-expected)/(A.H*.55));
    }
    score=score/layout.length*40;
  }else{
    var cx=0,cy=0;
    for(i=0;i<layout.length;i++){cx+=layout[i].x;cy+=layout[i].y}
    cx/=layout.length;cy/=layout.length;
    dx=cx-A.W*.5;dy=cy-A.H*.5;
    score+=Math.max(0,24-Math.sqrt(dx*dx+dy*dy)/18);
  }

  return score;
}

function scoreLayout(layout,s,strategy,voids){
  if(!layout.length)return-1e9;

  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  var collision=0,totalWeight=0,wx=0,wy=0;
  var edgeHits=0,heroSpread=0,heroes=[];
  var voidPenalty=0;

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
    voidPenalty+=objectVoidPenalty(a,voids,s);

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

  var edgeTarget=strategy==='EDGE'?.36:(.18+.16*crowdFactor(s));
  var edgeRatio=edgeHits/layout.length;
  var edgeScore=28-Math.abs(edgeRatio-edgeTarget)*65;

  var cx=wx/Math.max(1,totalWeight),cy=wy/Math.max(1,totalWeight);
  var targets=phiTargets();
  var bestPhi=Infinity;

  for(var p=0;p<targets.length;p++){
    var dx=targets[p].x-cx,dy=targets[p].y-cy;
    bestPhi=Math.min(bestPhi,Math.sqrt(dx*dx+dy*dy));
  }

  var diag=Math.hypot(A.W,A.H);
  var phiScore=(1-bestPhi/diag)*78*(s.phiStrength/100);
  var collisionPenalty=collision*A.lerp(18,5,overlapAllowance(s));
  var hierarchyScore=heroes.length>1?heroSpread*34:12;
  var reservedPenalty=voidPenalty*A.lerp(8,26,s.negativeSpace/100);

  return coverage+edgeScore+phiScore+hierarchyScore+strategyScore(layout,s,strategy,voids)-collisionPenalty-reservedPenalty;
}

function chooseBestLayout(s){
  var strategy=chooseStrategy(s);
  var voidR=A.makeR(s.seed+'|'+s.mode+'|voids|'+strategy);
  var voids=makeReservedVoids(s,strategy,voidR);
  var candidates=s.elements>110?4:6;
  var best=null,bestScore=-Infinity;

  for(var i=0;i<candidates;i++){
    var layout=makeLayoutPlan(s,i,strategy,voids);
    var score=scoreLayout(layout,s,strategy,voids);
    if(score>bestScore){
      bestScore=score;
      best=layout;
    }
  }

  return{layout:best||[],strategy:strategy,voids:voids,score:bestScore};
}

function drawPlannedElement(ctx,plan,i,s,r,pal,strategy){
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
  var result=chooseBestLayout(s);
  for(var i=0;i<result.layout.length;i++){
    drawPlannedElement(ctx,result.layout[i],i,s,r,pal,result.strategy);
  }
  return result;
}

function drawSpiral(ctx,s,r,pal){
  var variants=['SHELL','DOUBLE','BROKEN','OFFSET','VOID','LOOSE'];
  var variant=variants[A.hash(s.seed+'|spiral-variant')%variants.length];
  var direction=(A.hash(s.seed+'|spiral-direction')%2===0)?1:-1;
  var baseStrategy=chooseStrategy(s);
  var voids=variant==='VOID'
    ?makeReservedVoids(s,'VOID',A.makeR(s.seed+'|spiral-voids'))
    :[];
  var targets=phiTargets();
  var targetIndex=A.hash(s.seed+'|spiral-centre')%targets.length;
  var phase=r.range(0,A.TAU);
  var arms=variant==='DOUBLE'?2:1;
  var perArm=Math.ceil(s.elements/arms);
  var prev=new Array(arms).fill(null);
  var crowd=crowdFactor(s);
  var step=A.lerp(A.GOLD*.72,A.GOLD,s.goldenAngle/100);

  var centres=[];
  if(variant==='DOUBLE'){
    centres=[
      {x:A.W*(1-A.INV),y:A.H*A.INV},
      {x:A.W*A.INV,y:A.H*(1-A.INV)}
    ];
  }else if(variant==='OFFSET'||variant==='VOID'){
    centres=[{
      x:A.lerp(A.W*.5,targets[targetIndex].x,.72),
      y:A.lerp(A.H*.5,targets[targetIndex].y,.72)
    }];
  }else{
    centres=[{x:A.W*.5,y:A.H*.5}];
  }

  function spiralRadius(t){
    var exponent=A.INV;
    var scale=1;

    if(variant==='SHELL'){
      exponent=.52;
      scale=.88;
    }else if(variant==='LOOSE'){
      exponent=.76;
      scale=1.04;
    }else if(variant==='BROKEN'){
      exponent=.62;
      scale=.96;
    }else if(variant==='DOUBLE'){
      exponent=.66;
      scale=.7;
    }else if(variant==='OFFSET'||variant==='VOID'){
      exponent=.6;
      scale=.9;
    }

    return Math.pow(A.clamp(t,0,1),exponent)*scale;
  }

  function isHero(local){
    var a=Math.round((perArm-1)*A.INV);
    var b=Math.round((perArm-1)*(1-A.INV));
    return local===a||local===b;
  }

  for(var i=0;i<s.elements;i++){
    var arm=i%arms;
    var local=Math.floor(i/arms);
    var t=(local+.6)/Math.max(1,perArm);
    var centre=centres[arm%centres.length];
    var radial=spiralRadius(t);
    var armPhase=arm===0?0:Math.PI;
    var angle=phase+armPhase+direction*(local*step);

    if(variant==='BROKEN'){
      angle+=Math.sin(local*A.GOLD)*.18;
    }else if(variant==='LOOSE'){
      angle+=Math.sin(local*A.INV)*.1;
    }

    var rx=A.W*(variant==='DOUBLE'?.29:.455)*radial;
    var ry=A.H*(variant==='LOOSE'?.47:(variant==='DOUBLE'?.31:.435))*radial;

    var p={
      x:centre.x+Math.cos(angle)*rx,
      y:centre.y+Math.sin(angle)*ry
    };

    if(variant==='SHELL'){
      p.x+=Math.cos(angle+A.GOLD)*Math.pow(t,1.4)*A.W*.035;
      p.y+=Math.sin(angle+A.GOLD)*Math.pow(t,1.4)*A.H*.035;
    }

    if(crowd>.28&&variant!=='DOUBLE'){
      var spread=A.goldenCanvasPoint(i,s.elements,s,phase);
      var mix=crowd*.12;
      p.x=A.lerp(p.x,spread.x,mix);
      p.y=A.lerp(p.y,spread.y,mix);
    }

    p.x=A.clamp(p.x,24,A.W-24);
    p.y=A.clamp(p.y,24,A.H-24);

    if(pointInVoid(p.x,p.y,voids)){
      prev[arm]=null;
      continue;
    }

    var breakLine=false;
    if(variant==='BROKEN'){
      var cycle=4+(A.hash(s.seed+'|spiral-breaks')%4);
      breakLine=(local%cycle===0)||(local%cycle===cycle-1);
    }

    var lineChance=A.lerp(.82,.5,crowd);
    if(variant==='LOOSE')lineChance*=.68;
    if(variant==='DOUBLE')lineChance*=.78;

    if(prev[arm]&&s.lines&&!breakLine&&r.chance(lineChance)){
      A.drawLine(ctx,prev[arm],p,pal[i%pal.length],s,r);
    }

    var tier=isHero(local)?'hero':(local<Math.max(5,Math.round(perArm*.24))?'medium':'small');
    var drawChance=A.lerp(.88,.7,crowd);

    if(variant==='BROKEN')drawChance=.82;
    if(variant==='VOID')drawChance=.9;

    if(r.chance(drawChance)){
      var territory=Math.max(70,Math.min(A.W,A.H)/(2+Math.sqrt(perArm)*.28));
      var temp={
        tier:tier,
        x:p.x,y:p.y,
        size:makeBaseSize(s,tier,r,territory,baseStrategy),
        rot:angle+Math.PI/2,
        territory:territory
      };
      drawPlannedElement(ctx,temp,i,s,r,pal,baseStrategy);
    }

    if(s.arcs&&variant==='SHELL'&&r.chance((s.shapeAmount/100)*.13)){
      A.arc(
        ctx,p,
        Math.max(10,makeBaseSize(s,'small',r,120,baseStrategy)*.62),
        angle,
        A.TAU*A.INV,
        pal[(i+2)%pal.length],
        s,r
      );
    }

    prev[arm]=p;
  }

  return{strategy:'SPIRAL-'+variant,voids:voids};
}

function drawRects(ctx,s,r,pal){
  var variants=['MOSAIC','CASCADE','CROSSCUT','FRAMED'];
  var variant=variants[A.hash(s.seed+'|rect-variant')%variants.length];
  var margin=A.qphi(r.range(42,96),34,s.phiStrength/100);
  var root={x:margin,y:margin,w:A.W-margin*2,h:A.H-margin*2,depth:0,branch:0};
  var target=Math.max(7,Math.min(56,
    Math.round(5+s.recursion*2+s.complexity/9+s.elements/16)
  ));
  var active=[root],leaves=[],splitCount=0;
  var minSide=A.lerp(70,34,s.complexity/100);

  function area(cell){return cell.w*cell.h}

  function chooseCellIndex(){
    if(variant==='CASCADE')return active.length-1;

    if(variant==='CROSSCUT'){
      var sorted=active.map(function(c,i){return{c:c,i:i}})
        .sort(function(a,b){return area(b.c)-area(a.c)});
      var pool=Math.max(1,Math.min(sorted.length,4));
      return sorted[r.int(0,pool-1)].i;
    }

    var best=0,bestScore=-1;
    for(var i=0;i<active.length;i++){
      var score=area(active[i]);
      if(variant==='FRAMED')score*=1+active[i].depth*.08;
      score*=r.range(.92,1.08);
      if(score>bestScore){bestScore=score;best=i}
    }
    return best;
  }

  function splitCell(cell){
    var aspect=cell.w/Math.max(1,cell.h);
    var vertical;

    if(aspect>A.PHI*.92)vertical=true;
    else if(aspect<1/(A.PHI*.92))vertical=false;
    else if(variant==='CROSSCUT')vertical=(splitCount%2===0);
    else vertical=r.chance(.5);

    var phiCut=r.chance(.5)?A.INV:(1-A.INV);
    var cut=A.lerp(.5,phiCut,s.phiStrength/100);
    cut=A.clamp(cut,.28,.72);

    var a,b;
    if(vertical){
      var w1=cell.w*cut;
      a={x:cell.x,y:cell.y,w:w1,h:cell.h,depth:cell.depth+1,branch:splitCount};
      b={x:cell.x+w1,y:cell.y,w:cell.w-w1,h:cell.h,depth:cell.depth+1,branch:splitCount};
    }else{
      var h1=cell.h*cut;
      a={x:cell.x,y:cell.y,w:cell.w,h:h1,depth:cell.depth+1,branch:splitCount};
      b={x:cell.x,y:cell.y+h1,w:cell.w,h:cell.h-h1,depth:cell.depth+1,branch:splitCount};
    }
    splitCount++;
    return[a,b];
  }

  while(active.length&&active.length+leaves.length<target){
    var index=chooseCellIndex();
    var cell=active.splice(index,1)[0];

    if(Math.min(cell.w,cell.h)<minSide||cell.depth>=Math.max(4,s.recursion+2)){
      leaves.push(cell);
      continue;
    }

    var children=splitCell(cell);

    if(variant==='CASCADE'){
      var recurse=r.chance(.5)?0:1;
      leaves.push(children[1-recurse]);
      active.push(children[recurse]);
    }else if(variant==='FRAMED'&&r.chance(.42)){
      var framed=r.chance(.5)?0:1;
      leaves.push(children[framed]);
      active.push(children[1-framed]);
    }else{
      active.push(children[0],children[1]);
    }
  }

  leaves=leaves.concat(active);
  leaves.sort(function(a,b){
    if(variant==='CASCADE')return a.depth-b.depth;
    return area(b)-area(a);
  });

  var voidCount=Math.round(leaves.length*(s.negativeSpace/100)*.24);
  var voids=[];
  var voidMap={};

  if(voidCount>0){
    var candidates=leaves.map(function(c,i){return{c:c,i:i}})
      .sort(function(a,b){return area(b.c)-area(a.c)});

    var start=Math.min(candidates.length-1,r.int(0,Math.min(3,candidates.length-1)));
    for(var v=0;v<voidCount&&start+v<candidates.length;v++){
      var chosen=candidates[start+v];
      voidMap[chosen.i]=true;
      voids.push({x:chosen.c.x,y:chosen.c.y,w:chosen.c.w,h:chosen.c.h});
    }
  }

  var rectStyle=Object.assign({},s,{
    curveBias:Math.min(8,s.curveBias),
    wobble:Math.min(18,s.wobble)
  });

  if(s.rectangles!==false){
    A.rect(ctx,{x:A.W/2,y:A.H/2},root.w,root.h,0,pal[0],rectStyle,r);
  }

  for(var i=0;i<leaves.length;i++){
    if(voidMap[i])continue;

    var leaf=leaves[i];
    var inset=Math.min(leaf.w,leaf.h)*r.range(.025,.12);
    var w=Math.max(8,leaf.w-inset*2);
    var h=Math.max(8,leaf.h-inset*2);
    var c={x:leaf.x+leaf.w/2,y:leaf.y+leaf.h/2};
    var rot=r.range(-.045,.045)*(s.rotation/100);
    var col=pal[i%pal.length];

    if(s.rectangles!==false){
      A.rect(ctx,c,w,h,rot,col,rectStyle,r);
    }

    if(s.lines&&r.chance(.24+s.complexity/150)){
      var diag=(i+leaf.depth)%2===0;
      var p1={x:c.x+(diag?-w:w)/2,y:c.y-h/2};
      var p2={x:c.x+(diag?w:-w)/2,y:c.y+h/2};
      A.drawLine(ctx,p1,p2,pal[(i+1)%pal.length],rectStyle,r);
    }

    if(s.circles&&r.chance((s.shapeAmount/100)*.46)){
      var rad=Math.min(w,h)*r.range(.16,.34);
      A.ellipse(ctx,c,rad,rad/A.PHI,rot+A.GOLD*(i+1),pal[(i+2)%pal.length],rectStyle,r);
    }

    if(s.arcs&&r.chance((s.shapeAmount/100)*.3)){
      var arcRad=Math.min(w,h)*r.range(.18,.4);
      A.arc(ctx,c,arcRad,A.GOLD*i,A.TAU*A.INV,pal[(i+3)%pal.length],rectStyle,r);
    }

    if(s.polygons&&r.chance((s.shapeAmount/100)*.22)){
      var polyRad=Math.min(w,h)*r.range(.12,.27);
      A.poly(ctx,c,polyRad,r.pick([3,5,8]),A.GOLD*i,pal[(i+4)%pal.length],rectStyle,r);
    }

    if(r.chance((s.nesting/100)*.62)){
      var nw=w/A.PHI,nh=h/A.PHI;
      A.rect(ctx,c,nw,nh,rot+A.GOLD*.08,pal[(i+5)%pal.length],rectStyle,r);
    }
  }

  return{strategy:'RECT-'+variant,voids:voids};
}

function drawBurst(ctx,s,r,pal){
  var variants=['SINGLE','TWIN','TRIAD','CROPPED','VOID','SATELLITE'];
  var variant=variants[A.hash(s.seed+'|burst-variant')%variants.length];
  var baseStrategy=chooseStrategy(s);
  var crowd=crowdFactor(s);
  var voids=variant==='VOID'
    ?makeReservedVoids(s,'VOID',A.makeR(s.seed+'|burst-voids'))
    :[];
  var targets=phiTargets();
  var hubs=[];
  var distributed=A.distributedPhiPoints(4,s,A.makeR(s.seed+'|burst-hubs'));

  function hub(x,y,territory,weight){
    return{x:x,y:y,territory:territory,weight:weight};
  }

  if(variant==='SINGLE'){
    var singleTarget=targets[A.hash(s.seed+'|burst-single-centre')%targets.length];
    var centreMix=baseStrategy==='MONUMENT'?.34:.16;
    hubs=[hub(
      A.lerp(A.W*.5,singleTarget.x,centreMix),
      A.lerp(A.H*.5,singleTarget.y,centreMix),
      Math.min(A.W,A.H)*.72,
      1
    )];
  }else if(variant==='TWIN'){
    var diagonal=A.hash(s.seed+'|burst-twin-diagonal')%2;
    var pair=diagonal===0?[targets[0],targets[3]]:[targets[1],targets[2]];
    hubs=[
      hub(pair[0].x,pair[0].y,Math.min(A.W,A.H)*.48,1),
      hub(pair[1].x,pair[1].y,Math.min(A.W,A.H)*.48,1)
    ];
  }else if(variant==='TRIAD'){
    for(var ti=0;ti<3;ti++){
      hubs.push(hub(
        distributed[ti].x,
        distributed[ti].y,
        Math.min(A.W,A.H)*.38,
        ti===0?1.15:.92
      ));
    }
  }else if(variant==='CROPPED'){
    var edge=A.hash(s.seed+'|burst-crop-edge')%4;
    var along=.28+(A.hash(s.seed+'|burst-crop-pos')%45)/100;
    var cx=A.W*.5,cy=A.H*.5;
    if(edge===0){cx=-A.W*.07;cy=A.H*along}
    if(edge===1){cx=A.W*1.07;cy=A.H*along}
    if(edge===2){cx=A.W*along;cy=-A.H*.07}
    if(edge===3){cx=A.W*along;cy=A.H*1.07}
    hubs=[hub(cx,cy,Math.min(A.W,A.H)*.96,1)];
  }else if(variant==='VOID'){
    var vc=voids.length
      ?{x:voids[0].x+voids[0].w/2,y:voids[0].y+voids[0].h/2}
      :{x:A.W*.5,y:A.H*.5};
    var far=targets[0],farD=-1;
    for(var ft=0;ft<targets.length;ft++){
      var fdx=targets[ft].x-vc.x,fdy=targets[ft].y-vc.y;
      var fd=fdx*fdx+fdy*fdy;
      if(fd>farD){farD=fd;far=targets[ft]}
    }
    hubs=[hub(far.x,far.y,Math.min(A.W,A.H)*.58,1)];
  }else{
    var mainTarget=targets[A.hash(s.seed+'|burst-main-target')%targets.length];
    hubs.push(hub(
      mainTarget.x,
      mainTarget.y,
      Math.min(A.W,A.H)*.56,
      1.7
    ));
    for(var si=0;si<3;si++){
      var d=distributed[si];
      hubs.push(hub(
        d.x,
        d.y,
        Math.min(A.W,A.H)*.3,
        .48
      ));
    }
  }

  function allocateCounts(total,items){
    var n=items.length;
    var alloc=new Array(n).fill(1);
    var remaining=Math.max(0,total-n);
    if(remaining===0)return alloc;

    var totalWeight=0;
    for(var i=0;i<n;i++)totalWeight+=items[i].weight;

    var fractions=[],used=0;
    for(var j=0;j<n;j++){
      var raw=remaining*(items[j].weight/totalWeight);
      var add=Math.floor(raw);
      alloc[j]+=add;
      used+=add;
      fractions.push({i:j,f:raw-add});
    }

    fractions.sort(function(a,b){return b.f-a.f});
    var left=remaining-used;
    for(var k=0;k<left;k++)alloc[fractions[k%fractions.length].i]++;

    return alloc;
  }

  var allocations=allocateCounts(s.elements,hubs);
  var itemIndex=0;

  function burstTier(local,count,hubIndex){
    var heroA=Math.round((count-1)*A.INV);
    var heroB=Math.round((count-1)*(1-A.INV));

    if(local===0||local===heroA||local===heroB)return'hero';
    if(local<Math.max(3,Math.round(count*.24)))return'medium';
    if(variant==='SATELLITE'&&hubIndex===0&&local<Math.max(5,Math.round(count*.34)))return'medium';
    return'small';
  }

  function burstRadius(local,count,h,hubIndex){
    var t=(local+.7)/Math.max(1,count);
    var exponent=.66;
    var scale=1;

    if(variant==='SINGLE'){exponent=.62;scale=1}
    else if(variant==='TWIN'){exponent=.7;scale=.88}
    else if(variant==='TRIAD'){exponent=.76;scale=.78}
    else if(variant==='CROPPED'){exponent=.56;scale=1.12}
    else if(variant==='VOID'){exponent=.68;scale=.94}
    else if(variant==='SATELLITE'){
      exponent=hubIndex===0?.62:.8;
      scale=hubIndex===0?.95:.66;
    }

    var raw=Math.pow(t,exponent)*h.territory*scale;
    return A.qphi(raw,28,s.phiStrength/100);
  }

  for(var hi=0;hi<hubs.length;hi++){
    var h=hubs[hi];
    var count=allocations[hi];
    var startPhase=r.range(0,A.TAU);
    var step=A.lerp(A.TAU/Math.max(1,count),A.GOLD,s.goldenAngle/100);

    for(var local=0;local<count;local++){
      var angle=startPhase+local*step;

      if(variant==='TWIN'&&hi===1)angle+=Math.PI/A.PHI;
      if(variant==='TRIAD')angle+=hi*(A.TAU/3);
      if(variant==='SATELLITE'&&hi>0)angle+=hi*A.GOLD*.58;
      if(variant==='CROPPED')angle+=Math.sin(local*A.INV)*.08;

      var len=burstRadius(local,count,h,hi);
      var px=h.x+Math.cos(angle)*len;
      var py=h.y+Math.sin(angle)*len;

      if(variant==='VOID'&&voids.length){
        var tries=0;
        while(pointInVoid(px,py,voids)&&tries<5){
          angle+=A.GOLD*.72;
          px=h.x+Math.cos(angle)*len;
          py=h.y+Math.sin(angle)*len;
          tries++;
        }
        if(pointInVoid(px,py,voids)){
          itemIndex++;
          continue;
        }
      }

      var p={
        x:A.clamp(px,24,A.W-24),
        y:A.clamp(py,24,A.H-24)
      };

      var lineChance=A.lerp(.95,.7,crowd);
      if(variant==='TRIAD')lineChance*=.88;
      if(variant==='SATELLITE'&&hi>0)lineChance*=.74;
      if(variant==='VOID')lineChance*=.9;

      if(s.lines&&r.chance(lineChance)){
        A.drawLine(ctx,{x:h.x,y:h.y},p,pal[itemIndex%pal.length],s,r);
      }

      var tier=burstTier(local,count,hi);
      var shapeChance=(s.shapeAmount/100)*A.lerp(.92,.63,crowd);
      if(tier==='hero')shapeChance=Math.min(1,shapeChance*1.24);

      if(r.chance(shapeChance)){
        drawPlannedElement(ctx,{
          tier:tier,
          x:p.x,
          y:p.y,
          size:makeBaseSize(s,tier,r,h.territory,baseStrategy),
          rot:angle,
          territory:h.territory
        },itemIndex,s,r,pal,baseStrategy);
      }

      if(variant==='SATELLITE'&&hi===0&&local%Math.max(3,Math.round(count*.16))===0){
        for(var sh=1;sh<hubs.length;sh++){
          if(s.lines&&r.chance(.32)){
            A.drawLine(ctx,p,hubs[sh],pal[(itemIndex+sh)%pal.length],s,r);
          }
        }
      }

      if(variant==='VOID'&&s.arcs&&r.chance((s.shapeAmount/100)*.14)){
        A.arc(
          ctx,
          p,
          Math.max(10,makeBaseSize(s,'small',r,120,baseStrategy)*.58),
          angle,
          A.TAU*A.INV,
          pal[(itemIndex+2)%pal.length],
          s,r
        );
      }

      if(variant==='TRIAD'&&s.circles&&local===0){
        var ring=Math.max(14,h.territory/A.PHI/A.PHI/A.PHI);
        A.ellipse(
          ctx,
          {x:h.x,y:h.y},
          ring,
          ring/A.PHI,
          startPhase,
          pal[(itemIndex+1)%pal.length],
          s,r
        );
      }

      itemIndex++;
    }
  }

  return{strategy:'BURST-'+variant,voids:voids};
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

function segmentsCross(a,b,c,d){
  function side(p,q,r){
    return(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  }
  var abC=side(a,b,c),abD=side(a,b,d);
  var cdA=side(c,d,a),cdB=side(c,d,b);
  return((abC>0&&abD<0)||(abC<0&&abD>0))&&
        ((cdA>0&&cdB<0)||(cdA<0&&cdB>0));
}

function networkEdgeCrossings(edge,edges,layout){
  var a=layout[edge.a],b=layout[edge.b];
  var hits=0;
  for(var i=0;i<edges.length;i++){
    var e=edges[i];
    if(edge.a===e.a||edge.a===e.b||edge.b===e.a||edge.b===e.b)continue;
    if(segmentsCross(a,b,layout[e.a],layout[e.b]))hits++;
  }
  return hits;
}

function networkDegreeCap(node,s){
  var extra=Math.floor(s.complexity/34);
  if(node.tier==='hero')return 4+extra;
  if(node.tier==='medium')return 3+Math.min(2,extra);
  return 2+Math.min(1,extra);
}

function networkPhiFit(length,s){
  var quant=A.qphi(length,34,1);
  var error=Math.abs(length-quant)/Math.max(1,quant);
  return 1-A.clamp(error,0,1)*(s.phiStrength/100);
}

function buildNetworkEdges(layout,s){
  var crowd=crowdFactor(s);
  var searchCount=Math.max(4,Math.min(9,4+Math.floor(s.complexity/18)));
  var candidateMap={};
  var candidates=[];
  var degrees=new Array(layout.length).fill(0);
  var chosen=[];
  var chosenKeys={};
  var allowedCrossings=Math.round(A.lerp(0,2,overlapAllowance(s)));
  var target=Math.max(
    layout.length-1,
    Math.round(layout.length*A.lerp(1.04,1.68,s.complexity/100)*A.lerp(1,.8,crowd))
  );

  function edgeKey(a,b){
    return Math.min(a,b)+'-'+Math.max(a,b);
  }

  function candidateScore(a,b,rank){
    var na=layout[a],nb=layout[b];
    var dx=na.x-nb.x,dy=na.y-nb.y;
    var len=Math.sqrt(dx*dx+dy*dy);
    var diagonal=Math.hypot(A.W,A.H);
    var phiFit=networkPhiFit(len,s);
    var importance=0;
    if(na.tier==='hero'||nb.tier==='hero')importance+=1.35;
    if(na.tier==='medium'||nb.tier==='medium')importance+=.55;
    if(na.tier==='hero'&&nb.tier==='hero')importance+=1.4;
    var local=1-rank/Math.max(1,searchCount);
    var lengthBias=1-A.clamp(len/(diagonal*.58),0,1);
    return{
      a:a,b:b,len:len,
      score:phiFit*2.25+local*1.4+lengthBias*.85+importance
    };
  }

  function registerCandidate(a,b,rank){
    var key=edgeKey(a,b);
    var edge=candidateScore(a,b,rank);
    if(!candidateMap[key]||edge.score>candidateMap[key].score){
      candidateMap[key]=edge;
    }
  }

  for(var i=0;i<layout.length;i++){
    var nearest=nearestNeighbours(layout,i,searchCount);
    for(var n=0;n<nearest.length;n++)registerCandidate(i,nearest[n].index,n);
  }

  Object.keys(candidateMap).forEach(function(key){
    candidates.push(candidateMap[key]);
  });
  candidates.sort(function(a,b){return b.score-a.score});

  function addEdge(edge,primary,force){
    var key=edgeKey(edge.a,edge.b);
    if(chosenKeys[key])return false;

    var capA=networkDegreeCap(layout[edge.a],s);
    var capB=networkDegreeCap(layout[edge.b],s);
    if(!force&&(degrees[edge.a]>=capA||degrees[edge.b]>=capB))return false;

    var crossings=networkEdgeCrossings(edge,chosen,layout);
    if(!force&&crossings>allowedCrossings)return false;

    chosenKeys[key]=true;
    degrees[edge.a]++;
    degrees[edge.b]++;
    chosen.push({
      a:edge.a,b:edge.b,len:edge.len,
      primary:!!primary,
      crossings:crossings
    });
    return true;
  }

  var heroes=[];
  for(var h=0;h<layout.length;h++){
    if(layout[h].tier==='hero')heroes.push(h);
  }

  if(heroes.length>1){
    var connected=[heroes[0]];
    for(var hi=1;hi<heroes.length;hi++){
      var hero=heroes[hi],bestHero=null,bestDist=Infinity;
      for(var hc=0;hc<connected.length;hc++){
        var other=connected[hc];
        var hdx=layout[hero].x-layout[other].x;
        var hdy=layout[hero].y-layout[other].y;
        var hd=Math.sqrt(hdx*hdx+hdy*hdy);
        if(hd<bestDist){bestDist=hd;bestHero=other}
      }
      if(bestHero!==null){
        addEdge(candidateScore(hero,bestHero,0),true,true);
        connected.push(hero);
      }
    }
  }

  for(var m=0;m<heroes.length;m++){
    var heroIndex=heroes[m];
    var heroNear=nearestNeighbours(layout,heroIndex,Math.min(5,layout.length-1));
    var attached=0;
    for(var hn=0;hn<heroNear.length&&attached<2;hn++){
      var targetIndex=heroNear[hn].index;
      if(layout[targetIndex].tier==='hero')continue;
      if(addEdge(candidateScore(heroIndex,targetIndex,hn),true,false))attached++;
    }
  }

  for(var c=0;c<candidates.length&&chosen.length<target;c++){
    addEdge(candidates[c],false,false);
  }

  for(var orphan=0;orphan<layout.length;orphan++){
    if(degrees[orphan]>0)continue;
    var fallback=nearestNeighbours(layout,orphan,Math.min(8,layout.length-1));
    var best=null,bestCross=Infinity;
    for(var f=0;f<fallback.length;f++){
      var edge=candidateScore(orphan,fallback[f].index,f);
      var cross=networkEdgeCrossings(edge,chosen,layout);
      if(cross<bestCross){bestCross=cross;best=edge}
      if(cross===0)break;
    }
    if(best)addEdge(best,false,true);
  }

  return chosen;
}

function drawNetwork(ctx,s,r,pal){
  var result=chooseBestLayout(s);
  var layout=result.layout;
  var crowd=crowdFactor(s);
  var edges=buildNetworkEdges(layout,s);
  var primaryStyle=Object.assign({},s,{
    thickness:Math.max(1,s.thickness*A.lerp(1.12,.94,crowd)),
    opacity:Math.min(100,s.opacity*1.04),
    wobble:Math.max(8,s.wobble*.82)
  });
  var secondaryStyle=Object.assign({},s,{
    thickness:Math.max(1,s.thickness*A.lerp(.74,.58,crowd)),
    opacity:Math.max(18,s.opacity*A.lerp(.74,.56,crowd)),
    wobble:Math.max(6,s.wobble*.72)
  });

  for(var e=0;e<edges.length;e++){
    var edge=edges[e];
    var style=edge.primary?primaryStyle:secondaryStyle;
    A.drawLine(
      ctx,
      layout[edge.a],
      layout[edge.b],
      pal[(edge.a+edge.b+e)%pal.length],
      style,
      r
    );
  }

  for(var i=0;i<layout.length;i++){
    var node=layout[i];
    var chance=(s.shapeAmount/100)*A.lerp(.84,.56,crowd);
    if(node.tier==='hero')chance=Math.max(chance,.88);
    else if(node.tier==='medium')chance=Math.max(chance,.48);
    else chance*=.7;

    if(r.chance(A.clamp(chance,0,1))){
      drawPlannedElement(ctx,node,i,s,r,pal,result.strategy);
    }

    if(node.tier==='hero'&&s.circles&&r.chance(.46+s.complexity/250)){
      var ring=Math.max(12,node.size/A.PHI/A.PHI);
      A.ellipse(
        ctx,
        {x:node.x,y:node.y},
        ring,
        ring/A.PHI,
        node.rot+A.GOLD,
        pal[(i+2)%pal.length],
        secondaryStyle,
        r
      );
    }
  }

  return{
    layout:layout,
    strategy:'NETWORK-'+result.strategy,
    voids:result.voids,
    score:result.score
  };
}

function allocateScribbleSegments(total,anchors){
  var weights=[],sum=0,i;
  for(i=0;i<anchors;i++){
    var w=i===0?1.55:Math.pow(A.INV,i*.62);
    weights.push(w);
    sum+=w;
  }

  var counts=new Array(anchors).fill(0),used=0,fractions=[];
  for(i=0;i<anchors;i++){
    var raw=total*(weights[i]/sum);
    counts[i]=Math.floor(raw);
    used+=counts[i];
    fractions.push({i:i,f:raw-counts[i]});
  }

  fractions.sort(function(a,b){return b.f-a.f});
  for(i=0;i<total-used;i++)counts[fractions[i%fractions.length].i]++;
  return counts;
}

function drawScribble(ctx,s,r,pal){
  var variants=['RIBBON','CLUSTERS','KNOT','VOID','DUET'];
  var variant=variants[A.hash(s.seed+'|scribble-variant')%variants.length];
  var strategy=chooseStrategy(s);
  var crowd=crowdFactor(s);
  var segments=Math.max(12,Math.round(s.elements*A.lerp(1.8,1.16,crowd)));
  var anchorCount=Math.max(2,Math.min(7,2+Math.floor(s.complexity/28)+Math.round(crowd*1.5)));

  if(variant==='DUET')anchorCount=2;
  if(variant==='KNOT')anchorCount=Math.min(3,anchorCount);
  if(variant==='CLUSTERS')anchorCount=Math.max(4,anchorCount);

  var anchorR=A.makeR(s.seed+'|scribble-anchors|'+variant);
  var anchors=A.distributedPhiPoints(anchorCount,s,anchorR);
  var voids=(variant==='VOID'||s.negativeSpace>24)
    ?makeReservedVoids(s,variant==='VOID'?'VOID':strategy,A.makeR(s.seed+'|scribble-voids|'+variant))
    :[];
  var counts=allocateScribbleSegments(segments,anchorCount);
  var style=Object.assign({},s,{
    wobble:Math.max(44,s.wobble),
    curveBias:Math.max(58,s.curveBias),
    overdraw:Math.max(2,s.overdraw)
  });
  var ghostStyle=Object.assign({},style,{
    thickness:Math.max(1,s.thickness*.58),
    opacity:Math.max(15,s.opacity*.52),
    overdraw:Math.max(1,Math.round(s.overdraw*.55))
  });
  var markIndex=0;

  function prepareAnchor(index){
    var a=anchors[index];
    var next=anchors[(index+1)%anchors.length];

    if(variant==='RIBBON'){
      var diagonal=(A.hash(s.seed+'|scribble-ribbon')%2===0);
      var x=A.W*(.16+.68*(index/Math.max(1,anchors.length-1)));
      var y=diagonal
        ?A.H*(.2+.6*(index/Math.max(1,anchors.length-1)))
        :A.H*(.8-.6*(index/Math.max(1,anchors.length-1)));
      a.x=A.lerp(a.x,x,.62);
      a.y=A.lerp(a.y,y,.62);
    }else if(variant==='KNOT'){
      var target=phiTargets()[A.hash(s.seed+'|scribble-knot')%4];
      a.x=A.lerp(a.x,target.x,.48);
      a.y=A.lerp(a.y,target.y,.48);
    }

    a.x=A.clamp(a.x,30,A.W-30);
    a.y=A.clamp(a.y,30,A.H-30);
    a.flow=Math.atan2(next.y-a.y,next.x-a.x);
    a.radius=A.qphi(
      Math.max(68,a.territory*A.lerp(.36,.58,s.density/100)),
      34,
      s.phiStrength/100
    );
    return a;
  }

  for(var ai=0;ai<anchors.length;ai++)prepareAnchor(ai);

  for(var ai=0;ai<anchors.length;ai++){
    var anchor=anchors[ai];
    var count=counts[ai];
    if(count<=0)continue;

    var startAngle=anchor.flow+A.GOLD*(ai+1);
    var startRadius=anchor.radius*(variant==='KNOT'?.12:.2);
    var p={
      x:A.clamp(anchor.x+Math.cos(startAngle)*startRadius,24,A.W-24),
      y:A.clamp(anchor.y+Math.sin(startAngle)*startRadius,24,A.H-24)
    };
    var runLength=Math.max(3,Math.round(A.lerp(8,4,s.complexity/100)));
    var runPos=0;

    for(var local=0;local<count;local++){
      var progress=(local+.5)/Math.max(1,count);
      var flowMix=variant==='RIBBON'?.72:(variant==='CLUSTERS'?.28:.46);
      var goldenTurn=((local%2===0)?1:-1)*A.GOLD*A.lerp(.11,.31,s.complexity/100);
      var angle=A.lerp(startAngle,anchor.flow,flowMix)+goldenTurn;
      angle+=Math.sin((local+1)*A.INV+ai*A.GOLD)*A.lerp(.18,.48,s.wobble/100);
      angle+=r.range(-.16,.16);

      if(variant==='KNOT')angle+=Math.sin(progress*A.TAU*2)*.58;
      if(variant==='DUET'&&ai===1)angle+=Math.PI/A.PHI;

      var len=A.qphi(
        r.range(13,78)*A.lerp(1,.76,crowd)*A.lerp(.9,1.15,s.density/100),
        13,
        s.phiStrength/100
      );

      var q={
        x:p.x+Math.cos(angle)*len,
        y:p.y+Math.sin(angle)*len
      };

      var dx=q.x-anchor.x,dy=q.y-anchor.y;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>anchor.radius){
        var pull=A.clamp((dist-anchor.radius)/Math.max(1,anchor.radius),0,1);
        q.x=A.lerp(q.x,anchor.x,.34+.42*pull);
        q.y=A.lerp(q.y,anchor.y,.34+.42*pull);
      }

      var attempts=0;
      while(pointInVoid(q.x,q.y,voids)&&attempts<5){
        angle+=A.GOLD*(attempts%2===0?1:-1);
        q.x=p.x+Math.cos(angle)*len;
        q.y=p.y+Math.sin(angle)*len;
        attempts++;
      }

      if(pointInVoid(q.x,q.y,voids)){
        runPos=runLength;
        continue;
      }

      q.x=A.clamp(q.x,24,A.W-24);
      q.y=A.clamp(q.y,24,A.H-24);

      A.drawLine(ctx,p,q,pal[markIndex%pal.length],style,r);

      if(s.arcs&&r.chance((s.shapeAmount/100)*.075)){
        var loop=A.qphi(Math.max(9,len/A.PHI),9,s.phiStrength/100);
        A.arc(
          ctx,q,
          loop,
          angle+A.GOLD,
          A.TAU*A.INV,
          pal[(markIndex+2)%pal.length],
          ghostStyle,
          r
        );
      }

      p=q;
      markIndex++;
      runPos++;

      var deliberateBreak=runPos>=runLength;
      var stochasticBreak=r.chance(.035+s.negativeSpace/650);
      if(deliberateBreak||stochasticBreak){
        var resetAngle=startAngle+(local+1)*A.GOLD;
        var resetRadius=anchor.radius*r.range(.08,.42);
        p={
          x:A.clamp(anchor.x+Math.cos(resetAngle)*resetRadius,24,A.W-24),
          y:A.clamp(anchor.y+Math.sin(resetAngle)*resetRadius,24,A.H-24)
        };
        runLength=Math.max(3,Math.round(A.lerp(9,4,s.complexity/100)+r.range(-1,2)));
        runPos=0;
      }
    }

    if(ai<anchors.length-1&&variant==='RIBBON'&&s.lines&&r.chance(.58)){
      var next=anchors[ai+1];
      if(!pointInVoid(anchor.x,anchor.y,voids)&&!pointInVoid(next.x,next.y,voids)){
        A.drawLine(ctx,anchor,next,pal[(markIndex+ai)%pal.length],ghostStyle,r);
      }
    }

    if(s.circles&&r.chance((s.shapeAmount/100)*.12)){
      var halo=Math.max(10,anchor.radius/A.PHI/A.PHI/A.PHI);
      A.ellipse(
        ctx,
        {x:anchor.x,y:anchor.y},
        halo,
        halo/A.PHI,
        startAngle,
        pal[(markIndex+3)%pal.length],
        ghostStyle,
        r
      );
    }
  }

  return{strategy:'SCRIBBLE-'+variant,voids:voids};
}

function drawOrganic(ctx,s,r,pal){
  var strategy=chooseStrategy(s);
  var organic=Object.assign({},s,{
    curveBias:Math.max(76,s.curveBias),
    wobble:Math.max(42,s.wobble)
  });
  var voids=makeReservedVoids(s,strategy,A.makeR(s.seed+'|organic-voids'));
  var roots=1+Math.floor(s.elements/58);
  var rootPts=A.distributedPhiPoints(roots,organic,r);
  var queue=[];
  var maxSegments=Math.max(12,s.elements);
  var maxDepth=Math.max(3,Math.min(8,2+Math.round(s.recursion*.7)));
  var drawn=0;

  for(var ri=0;ri<roots;ri++){
    var rp=rootPts[ri];
    var toward=Math.atan2(A.H*.5-rp.y,A.W*.5-rp.x);
    queue.push({
      x:rp.x,y:rp.y,
      angle:toward+r.range(-.55,.55),
      len:A.qphi(r.range(150,300),34,s.phiStrength/100),
      depth:0,
      branch:ri
    });
  }

  while(queue.length&&drawn<maxSegments){
    var node=queue.shift();
    var angle=node.angle;
    var len=node.len;
    var ex=node.x+Math.cos(angle)*len;
    var ey=node.y+Math.sin(angle)*len;

    if(pointInVoid(ex,ey,voids)){
      angle+=A.GOLD*(r.chance(.5)?1:-1)*.55;
      ex=node.x+Math.cos(angle)*len;
      ey=node.y+Math.sin(angle)*len;
    }

    ex=A.clamp(ex,24,A.W-24);
    ey=A.clamp(ey,24,A.H-24);

    A.drawLine(ctx,{x:node.x,y:node.y},{x:ex,y:ey},pal[drawn%pal.length],organic,r);
    drawn++;

    if(r.chance(organic.shapeAmount/180)){
      var rad=Math.max(5,len/A.PHI/A.PHI/2);
      A.ellipse(ctx,{x:ex,y:ey},rad,rad/A.PHI,angle,pal[(drawn+1)%pal.length],organic,r);
    }

    if(node.depth>=maxDepth||drawn>=maxSegments)continue;

    var nextLen=len/A.PHI*r.range(.9,1.08);
    if(nextLen<12)continue;

    var branches=r.chance(.35+organic.complexity/180)?2:1;
    for(var b=0;b<branches;b++){
      var sign=branches===1?r.sign():(b===0?-1:1);
      var turn=A.GOLD*A.lerp(.26,.52,organic.complexity/100)*sign;
      queue.push({
        x:ex,y:ey,
        angle:angle+turn+r.range(-.12,.12),
        len:nextLen,
        depth:node.depth+1,
        branch:node.branch
      });
    }
  }

  return{strategy:strategy,voids:voids};
}

function drawGeometric(ctx,s,r,pal){
  var strategy=chooseStrategy(s);
  var voids=makeReservedVoids(s,strategy,A.makeR(s.seed+'|geometric-voids'));
  var count=Math.max(8,Math.min(72,Math.round(s.elements*.58)));
  var cells=A.goldenCells(count,46);
  cells.sort(function(a,b){return b.w*b.h-a.w*a.h});

  var geometric=Object.assign({},s,{
    curveBias:Math.min(8,s.curveBias),
    wobble:Math.min(12,s.wobble)
  });
  var globalRot=r.range(-.045,.045)*(s.rotation/100);

  for(var i=0;i<cells.length;i++){
    var cell=cells[i];
    var c={x:cell.x+cell.w/2,y:cell.y+cell.h/2};
    if(pointInVoid(c.x,c.y,voids))continue;

    var inset=Math.min(cell.w,cell.h)*A.lerp(.025,.1,s.negativeSpace/100);
    var w=Math.max(5,cell.w-inset*2);
    var h=Math.max(5,cell.h-inset*2);
    var rot=globalRot*(i%2===0?1:-1);
    var col=pal[i%pal.length];

    A.rect(ctx,c,w,h,rot,col,geometric,r);

    if(geometric.lines&&r.chance(.32+geometric.complexity/180)){
      var diag=i%2===0;
      var a={x:c.x+(diag?-w:w)/2,y:c.y-h/2};
      var b={x:c.x+(diag?w:-w)/2,y:c.y+h/2};
      A.drawLine(ctx,a,b,pal[(i+1)%pal.length],geometric,r);
    }

    if(geometric.circles&&r.chance(geometric.shapeAmount/145)){
      var rad=Math.min(w,h)*.31;
      A.ellipse(ctx,c,rad,rad/A.PHI,rot+A.GOLD*i,pal[(i+2)%pal.length],geometric,r);
    }

    if(r.chance(geometric.nesting/125)){
      A.rect(ctx,c,w/A.PHI,h/A.PHI,rot,pal[(i+3)%pal.length],geometric,r);
    }
  }

  return{strategy:strategy,voids:voids};
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
  var meta;

  if(s.mode==='field'){
    meta=drawField(ctx,s,r,pal);
  }else if(s.mode==='spiral'){
    meta=drawSpiral(ctx,s,r,pal);
  }else if(s.mode==='rects'){
    meta=drawRects(ctx,s,r,pal);
  }else if(s.mode==='burst'){
    meta=drawBurst(ctx,s,r,pal);
  }else if(s.mode==='network'){
    meta=drawNetwork(ctx,s,r,pal);
  }else if(s.mode==='scribble'){
    meta=drawScribble(ctx,s,r,pal);
  }else if(s.mode==='organic'){
    meta=drawOrganic(ctx,s,r,pal);
  }else if(s.mode==='geometric'){
    meta=drawGeometric(ctx,s,r,pal);
  }else{
    meta=drawField(ctx,s,r,pal);
  }

  if(showGeometry)A.geometryOverlay(ctx,s);

  A.lastRenderMeta={
    strategy:(meta&&meta.strategy)||chooseStrategy(s),
    voids:(meta&&meta.voids)||[]
  };
  return A.lastRenderMeta;
};

})(window.AlgoArt);