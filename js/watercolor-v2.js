// ALGO/ART Watercolor v2 — deterministic wet washes over immutable V8 geometry.
// The original ?watercolor=1 material lives unchanged in oil-material.js.
// Pure Canvas2D; no downloaded assets, models, global RNG, or oil height map.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,PHI=1.61803398875;
var INKS=['#657e7d','#829a98','#9eaead','#778b82','#929788','#a6a895',
  '#b97349','#bc803f','#ce9a5b','#544d43','#364b4a','#6a6854'];
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function point(a,b,t){return{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}
function move(p,ang,dist){return{x:p.x+Math.cos(ang)*dist,y:p.y+Math.sin(ang)*dist}}
function direction(a,b){return Math.atan2(b.y-a.y,b.x-a.x)}
function rgba(hex,alpha){
  return 'rgba('+parseInt(hex.slice(1,3),16)+','+
    parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16)+','+alpha+')';
}
function hash(x,y,s){
  var n=(Math.imul(x,374761393)^Math.imul(y,668265263)^s)|0;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}
function noise(x,y,cell,seed){
  var gx=x/cell,gy=y/cell,ix=Math.floor(gx),iy=Math.floor(gy);
  var u=gx-ix,v=gy-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
  return lerp(lerp(hash(ix,iy,seed),hash(ix+1,iy,seed),u),
    lerp(hash(ix,iy+1,seed),hash(ix+1,iy+1,seed),u),v)*2-1;
}
function paper(ctx,w,h,seed,quality){
  // Pigment texture is not an evenly distributed per-pixel dither.
  // Long- and short-scale variations are correlated in the paper itself.
  var ratio=quality<.4?4:quality<.9?3:2;
  var pw=Math.ceil(w/ratio),ph=Math.ceil(h/ratio),canvas=document.createElement('canvas');
  canvas.width=pw;canvas.height=ph;
  var pc=canvas.getContext('2d'),id=pc.createImageData(pw,ph),data=id.data;
  for(var y=0;y<ph;y++)for(var x=0;x<pw;x++){
    var sx=x*ratio,sy=y*ratio;
    var long=noise(sx,sy,57,seed^159),short=noise(sx,sy,11,seed^917);
    var fibre=noise(sx+sy*.13,sy,4,seed^371);
    var variation=long*4.4+short*2.1+fibre*1.6;
    var i=(y*pw+x)*4;
    data[i]=clamp(242+variation,0,255);
    data[i+1]=clamp(235+variation,0,255);
    data[i+2]=clamp(223+variation,0,255);
    data[i+3]=255;
  }
  pc.putImageData(id,0,0);
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(canvas,0,0,w,h);ctx.restore();
}
function centroid(poly){
  var x=0,y=0;
  for(var i=0;i<poly.length;i++){x+=poly[i].x;y+=poly[i].y}
  return{x:x/poly.length,y:y/poly.length};
}
function deformEdge(a,b,depth,amplitude,r,out){
  if(depth<=0){out.push(b);return}
  var mid=point(a,b,r.range(.43,.57));
  var normal=direction(a,b)+PI/2;
  mid=move(mid,normal,r.range(-amplitude,amplitude));
  deformEdge(a,mid,depth-1,amplitude*.52,r,out);
  deformEdge(mid,b,depth-1,amplitude*.52,r,out);
}
function ragged(poly,r,amplitude){
  // Shared, continuous subdivided boundary: no block-shaped blurred stamps.
  var points=[poly[0]];
  for(var i=0;i<poly.length;i++){
    var a=poly[i],b=poly[(i+1)%poly.length];
    var length=Math.hypot(b.x-a.x,b.y-a.y);
    var depth=length>90?3:length>28?2:1;
    deformEdge(a,b,depth,Math.min(amplitude,length*.095),r,points);
  }
  points.pop();return points;
}
function outline(ctx,poly){
  ctx.beginPath();ctx.moveTo(poly[0].x,poly[0].y);
  for(var i=1;i<poly.length;i++)ctx.lineTo(poly[i].x,poly[i].y);
  ctx.closePath();
}
function bounds(poly){
  var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(var i=0;i<poly.length;i++){
    x0=Math.min(x0,poly[i].x);y0=Math.min(y0,poly[i].y);
    x1=Math.max(x1,poly[i].x);y1=Math.max(y1,poly[i].y);
  }
  return{x0:x0,y0:y0,x1:x1,y1:y1};
}
function wash(ctx,poly,ink,r,strength,quality,kind){
  if(poly.length<3)return;
  var centre=centroid(poly),rect=bounds(poly);
  var span=Math.max(rect.x1-rect.x0,rect.y1-rect.y0);
  if(span<13)return;
  var jitter=clamp(span*.016,1.3,9),edge=ragged(poly,r,jitter);
  ctx.save();
  // Directional uneven pigment, retaining pale interior rather than a flat fill.
  var theta=r.range(-PI,PI),dx=Math.cos(theta)*span*.5,dy=Math.sin(theta)*span*.5;
  var gradient=ctx.createLinearGradient(centre.x-dx,centre.y-dy,centre.x+dx,centre.y+dy);
  gradient.addColorStop(0,rgba(ink,kind==='graded'?.74:.90));
  gradient.addColorStop(.40,rgba(ink,kind==='graded'?.24:.62));
  gradient.addColorStop(.70,rgba(ink,kind==='graded'?.40:.52));
  gradient.addColorStop(1,rgba(ink,.80));
  outline(ctx,edge);ctx.globalAlpha=strength;ctx.fillStyle=gradient;ctx.fill();
  // Fine additional glazes follow *almost* the same boundary, not independent stamps.
  var glazeCount=quality<.4?2:3;
  for(var layer=0;layer<glazeCount;layer++){
    var shifted=edge.map(function(p){
      return{x:p.x+(p.x-centre.x)*r.range(-.008,.010)+r.range(-1.25,1.25),
        y:p.y+(p.y-centre.y)*r.range(-.008,.010)+r.range(-1.25,1.25)};
    });
    outline(ctx,shifted);ctx.globalAlpha=strength*r.range(.055,.12);
    ctx.fillStyle=ink;ctx.fill();
  }
  // Drying concentrates pigment on irregular boundaries; only portions pool.
  // Clip the strokes *inside* the wash so they never become marker outlines.
  outline(ctx,edge);ctx.clip();
  ctx.strokeStyle=ink;ctx.lineCap='round';ctx.lineJoin='round';
  for(var k=0;k<edge.length;k++){
    if(!r.chance(kind==='bloom'?.64:.37))continue;
    var next=edge[(k+1)%edge.length];
    ctx.beginPath();ctx.moveTo(edge[k].x,edge[k].y);ctx.lineTo(next.x,next.y);
    ctx.globalAlpha=strength*r.range(.34,.94);
    ctx.lineWidth=r.range(kind==='bloom'?2.3:1.1,kind==='bloom'?6:3.3);
    ctx.stroke();
  }
  // Sparse coherent deposits near a few localised pigment accumulation points.
  // Not a canvas-wide pixel stipple or uniformly repeated noise pattern.
  if(quality>=.4&&kind!=='flat'){
    var clusters=clamp(Math.round(span/105),2,7);
    for(var j=0;j<clusters;j++){
      var base=edge[r.int(0,edge.length-1)];
      for(var n=0;n<r.int(5,12);n++){
        var p=move(base,r.range(0,PI*2),r.range(2,19));
        ctx.beginPath();ctx.moveTo(p.x,p.y);
        ctx.lineTo(p.x+r.range(-3,3),p.y+r.range(-3,3));
        ctx.globalAlpha=strength*r.range(.05,.14);
        ctx.lineWidth=r.range(.4,1.35);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
function ribbon(pts,width,r){
  if(pts.length<2)return [];
  var left=[],right=[];
  for(var i=0;i<pts.length;i++){
    var a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    var normal=direction(a,b)+PI/2;
    var taper=clamp(.54+Math.min(i,pts.length-1-i)*.22,.54,1);
    var size=width*taper*(.83+r.range(-.10,.12));
    left.push(move(pts[i],normal,size));
    right.push(move(pts[i],normal+PI,size*r.range(.78,1.06)));
  }
  return left.concat(right.reverse());
}
function plane(pts,span,r){
  var j=r.int(1,pts.length-1),a=pts[j-1],b=pts[j];
  var normal=direction(a,b)+PI/2,side=r.chance(.5)?1:-1;
  var peak=move(point(a,b,.5),normal,side*span*r.range(.85,1.3));
  return [a,b,move(b,normal,side*span*r.range(.52,.91)),peak,
    move(a,normal,side*span*r.range(.48,.95))];
}
function bloom(anchor,radius,r){
  var sides=r.int(9,14),out=[],angle=r.range(-PI,PI);
  for(var i=0;i<sides;i++){
    var theta=angle+i*2*PI/sides;
    var d=radius*r.range(.69,1.15);
    out.push({x:anchor.x+Math.cos(theta)*d,y:anchor.y+Math.sin(theta)*d*r.range(.66,1.1)});
  }
  return out;
}
function inVoid(p,voids){
  return voids.some(function(v){return p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h});
}
function structure(ctx,chains,r,quality){
  // A few clean shards and discontinuous skeleton segments preserve the
  // hard/soft tension without turning pooled edges into rigid outlines.
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  var count=Math.min(chains.length,quality<.4?12:24);
  for(var i=0;i<count;i++){
    var pts=chains[i].pts;
    if(pts.length<2||r.chance(.34))continue;
    ctx.strokeStyle=r.pick(['#364b4a','#544d43','#ad683c','#6d7e67']);
    ctx.globalAlpha=r.range(.20,.55);ctx.lineWidth=r.range(.65,2.3);
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
    for(var j=1;j<pts.length;j++){
      if(r.chance(.11)){ctx.stroke();ctx.beginPath();ctx.moveTo(pts[j].x,pts[j].y)}
      else ctx.lineTo(pts[j].x,pts[j].y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
A.watercolorV2=function(ctx,w,h,chains,meta,seed,quality){
  var r=A.makeR(seed+'|watercolor-wet-washes-v2'),paperSeed=A.hash(seed+'|wc-paper-v2');
  paper(ctx,w,h,paperSeed,quality);
  var voids=meta&&meta.voids||[],max=Math.min(chains.length,quality<.4?24:46);
  var painted=0,blooms=0;
  // Large low-pigment washes first, then mid-size forms and occasional blooms.
  for(var i=max-1;i>=0;i--){
    var ch=chains[i],pts=ch.pts;
    if(pts.length<2)continue;
    var anchor=pts[Math.floor(pts.length/2)];
    if(inVoid(anchor,voids)&&r.chance(.84))continue;
    var width=clamp(Math.sqrt(ch.length)*r.range(2.2,5.1),26,i<14?125:75);
    var ink=INKS[i%INKS.length];
    if(i%9===7)ink=r.pick(['#bc803f','#b97349','#ce9a5b']);
    var kind=i%5===0?'graded':i%7===0?'flat':'pooled';
    var form=i%4===0?plane(pts,width*PHI,r):ribbon(pts,width*.5,r);
    wash(ctx,form,ink,r,r.range(.16,.36),quality,kind);
    painted++;
    if(i<19&&r.chance(.27)){
      var p=pts[r.int(0,pts.length-1)];
      wash(ctx,bloom(p,r.range(38,115),r),ink,r,r.range(.065,.15),quality,'bloom');
      blooms++;
    }
  }
  structure(ctx,chains,r,quality);
  A.lastWatercolorV2Stats={version:2,washes:painted,blooms:blooms,paper:'correlated-grain',heightMap:false};
};
})(window.AlgoArt);
