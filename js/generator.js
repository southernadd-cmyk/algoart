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
  var crowd=crowdFactor(s);
  var hubCount=1+Math.floor(crowd*2.8);
  var hubs=hubCount===1
    ?[{x:A.W/2,y:A.H/2,territory:Math.min(A.W,A.H)*.7}]
    :A.distributedPhiPoints(hubCount,s,r);
  var strategy=chooseStrategy(s);

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
        size:makeBaseSize(s,tier,r,c.territory,strategy),
        rot:a,territory:c.territory
      },i,s,r,pal,strategy);
    }
  }

  return{strategy:strategy,voids:[]};
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
  var result=chooseBestLayout(s);
  var layout=result.layout;
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
      drawPlannedElement(ctx,layout[i],i,s,r,pal,result.strategy);
    }
  }

  return result;
}

function drawScribble(ctx,s,r,pal){
  var crowd=crowdFactor(s);
  var segments=Math.round(s.elements*A.lerp(2,1.3,crowd));
  var anchors=A.distributedPhiPoints(Math.max(2,Math.ceil(segments/14)),s,r);
  var anchorIndex=0;
  var p=anchors[0];
  var strategy=chooseStrategy(s);

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

  return{strategy:strategy,voids:[]};
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