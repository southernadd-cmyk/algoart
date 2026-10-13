// Experimental Tissue hybrid revision 5. Never called for historic revisions.
// Original V4 pigment field remains intact; all interventions are canvas overlays.
// Feature switches are review-only: A.tissueHybridFlags={tooth,multiply,hatching}.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PAPER=[245,240,230];
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function rgb(hex){
  var m=String(hex).match(/^#([0-9a-f]{6})$/i);
  return m?[0,2,4].map(function(k){return parseInt(m[1].slice(k,k+2),16)}):[176,140,109];
}
function css(c){return 'rgb('+c.map(function(n){return Math.round(n)}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return v*(1-t)+b[i]*t})}
function path(ctx,points){
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for(var i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
}
function strokePiece(ctx,points,width,color,alpha,operation){
  if(points.length<2)return;
  ctx.save();
  ctx.globalCompositeOperation=operation||'source-over';
  ctx.globalAlpha=alpha;ctx.strokeStyle=color;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=width;
  path(ctx,points);ctx.stroke();ctx.restore();
}
function pointsLength(points){
  var total=0;
  for(var i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
  return total;
}
function resample(points,step){
  // Long, connected linework; never made from evenly-spaced short dashes.
  var out=[points[0]],distance=0;
  for(var i=1;i<points.length;i++){
    var p=points[i],q=points[i-1],d=Math.hypot(p.x-q.x,p.y-q.y);
    if(d<.0001)continue;
    var x=step-distance;
    while(x<d){
      out.push({x:q.x+(p.x-q.x)*x/d,y:q.y+(p.y-q.y)*x/d});
      x+=step;
    }
    distance=d-(x-step);
  }
  out.push(points[points.length-1]);
  return out;
}
function shiftStroke(points,shift){
  return points.map(function(p,i){
    var before=points[Math.max(0,i-1)],after=points[Math.min(i+1,points.length-1)];
    var angle=Math.atan2(after.y-before.y,after.x-before.x)+Math.PI/2;
    return{x:p.x+Math.cos(angle)*shift,y:p.y+Math.sin(angle)*shift};
  });
}
function cappedMultiply(ctx,points,width,color,grid,hits,limit){
  var covered={},bins=[],step=Math.max(16,grid*.5),sampled=resample(points,step);
  sampled.forEach(function(p){
    var x=Math.floor(p.x/grid),y=Math.floor(p.y/grid),key=x+','+y;
    if(!covered[key]){covered[key]=true;bins.push(key)}
  });
  if(!bins.length||bins.some(function(key){return (hits[key]||0)>=limit}))return false;
  // Tiny multiply component only; source-over is always retained.
  strokePiece(ctx,points,width,color,.09,'multiply');
  bins.forEach(function(key){hits[key]=(hits[key]||0)+1});
  return true;
}
function toothGraphite(ctx,w,h,chains,seed,tooth,hatching){
  var pencil=document.createElement('canvas');pencil.width=w;pencil.height=h;
  var p=pencil.getContext('2d'),r=A.makeR(seed+'|hybrid-pencil-v5');
  var count=0,hatches=0;
  var n=Math.min(chains.length,56);
  for(var i=0;i<n;i++){
    var ch=chains[i],pts=ch.pts;
    if(pts.length<2||pointsLength(pts)<28||r.chance(i<16?.10:.34))continue;
    var weight=clamp(ch.width*.20+r.range(.25,.90),.75,2.2);
    strokePiece(p,pts,weight,'#514b45',r.range(.17,.32)*(i<19?1:.72));
    count++;
    // One in four selected shapes can carry *long* irregular tonal lines.
    // No mesh, no cross-hatch, no systematic repeated short dashes.
    if(hatching&&i<24&&i%4===2&&pointsLength(pts)>85){
      var a=resample(pts,Math.max(9,pointsLength(pts)/24));
      var from=Math.floor(a.length*r.range(.06,.12));
      var to=Math.max(from+2,Math.floor(a.length*r.range(.76,.94)));
      var long=a.slice(from,to);
      for(var j=0;j<r.int(2,4);j++){
        var offset=(j-1.2)*r.range(5,9)+r.range(-1.3,1.3);
        strokePiece(p,shiftStroke(long,offset),r.range(.48,.9),'#4b4540',r.range(.10,.21));
        hatches++;
      }
    }
  }
  if(tooth){
    // Modulate only deposited graphite alpha, at pixel level. The geometry
    // and full length of each stroke remain crisp and continuous.
    var img=p.getImageData(0,0,w,h),px=img.data,hash=A.hash(seed+'|pencil-tooth-v5')>>>0;
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){
      var idx=(y*w+x)*4;
      if(px[idx+3]===0)continue;
      var n=Math.imul(x>>1,374761393)^Math.imul(y>>1,668265263)^hash;
      n=Math.imul(n^(n>>>13),1274126177);
      var grain=((n^(n>>>16))>>>0)/4294967295;
      px[idx+3]=Math.round(px[idx+3]*(.78+grain*.22));
    }
    p.putImageData(img,0,0);
  }
  ctx.save();ctx.drawImage(pencil,0,0);ctx.restore();
  return{graphitePaths:count,hatchLines:hatches};
}
A.tissueHybridOverlay=function(ctx,w,h,chains,seed,kit){
  var toggles=A.tissueHybridFlags||{};
  var tooth=toggles.tooth!==false,multiply=toggles.multiply!==false,hatching=toggles.hatching!==false;
  var r=A.makeR(seed+'|hybrid-tissue-v5'),hits={},multiplyCount=0,tissueCount=0,vellumCount=0,accentCount=0;
  var inks=(kit&&kit.inkRGB&&kit.inkRGB.length?kit.inkRGB:[[176,115,105],[217,166,83]]);
  var count=Math.min(36,chains.length);
  // V4 is the underpainting. Add restrained bright tissue pieces rather
  // than replacing its crisp geometry with a blurred texture.
  for(var i=count-1;i>=0;i--){
    var ch=chains[i],pts=ch.pts;
    if(pts.length<2||i%3===1||pointsLength(pts)<35)continue;
    var width=clamp(Math.sqrt(ch.length)*r.range(1.10,2.05),17,i<15?76:52);
    var original=inks[(i+Math.floor(i/4))%inks.length];
    var pale=blend(original,PAPER,r.range(.64,.78)); // ~80-90% light tissue.
    var col=css(pale);
    if(i<18&&i%4===0){
      // Bleed is separate from the sharp tissue edge.
      ctx.save();ctx.filter='blur(8px)';
      strokePiece(ctx,pts,width*1.12,col,.12);
      ctx.restore();
    }
    strokePiece(ctx,pts,width,col,.20);tissueCount++;
    if(multiply&&cappedMultiply(ctx,pts,width,css(blend(original,PAPER,.48)),56,hits,3))
      multiplyCount++;
    if(i%6===2||i%9===0){
      // Explicit light material: restores the figure-ground sparkle.
      var reserve=blend(PAPER,[255,252,244],.73);
      strokePiece(ctx,pts,width*r.range(.60,.88),css(reserve),r.range(.36,.52));
      vellumCount++;
    }
  }
  var graphite=toothGraphite(ctx,w,h,chains,seed,tooth,hatching);
  // Saturated highlights are deposited LAST and never multiplied or blurred.
  // Make them short, distinct chips instead of saturating whole ribbon stacks.
  for(var k=0;k<Math.min(23,chains.length);k++){
    if(k%4!==0&&k%7!==3)continue;
    var pathPoints=chains[k].pts;
    if(pathPoints.length<2||pointsLength(pathPoints)<38)continue;
    var samples=resample(pathPoints,14);
    var from=Math.floor(samples.length*r.range(.08,.42));
    var length=Math.max(2,Math.floor(samples.length*r.range(.18,.36)));
    var chip=samples.slice(from,from+length+1);
    if(chip.length<2)continue;
    var raw=inks[(k+1)%inks.length];
    strokePiece(ctx,chip,r.range(12,27),css(raw),r.range(.61,.85),'source-over');
    accentCount++;
  }
  var stats={tooth,multiply,hatching,tissueCount,multiplyCount,vellumCount,accentCount,
    graphitePaths:graphite.graphitePaths,hatchLines:graphite.hatchLines};
  A.lastTissueHybridStats=stats;
  return stats;
};
})(window.AlgoArt);
