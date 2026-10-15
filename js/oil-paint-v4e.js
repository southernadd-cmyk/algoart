// ALGO/ART experimental OIL PAINT V4e: directional wet pigment transport and actual surface lighting.
// V4 branch: coherent pressure and subpixel brush deposits.
// V3c remains a frozen comparison.
// Separate from the historical oil-* files that now implement Tissue & Graphite.
// No model inference, external asset, image filter or change to source generator.
// All marks, direction, colour and hierarchy come from recorded Marker paths.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function minmax(x,a,b){return Math.max(a,Math.min(b,x))}
function lerp(a,b,t){return a+(b-a)*t}
function mix(a,b,t){return a.map(function(v,i){return Math.round(lerp(v,b[i],t))})}
function css(c){return 'rgb('+c.map(function(v){return minmax(Math.round(v),0,255)}).join(',')+')'}
function hexRGB(h){
  var m=String(h).match(/^#([\da-f]{6})$/i);
  return m?[0,2,4].map(function(i){return parseInt(m[1].slice(i,i+2),16)}):null;
}
function sourceRGB(str){
  var rgb=hexRGB(str);if(rgb)return rgb;
  var m=String(str||'').match(/^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/i);
  if(m)return [+m[1],+m[2],+m[3]];
  m=String(str||'').match(/^hsl\(\s*([\d.]+)(?:deg)?(?:\s+|,\s*)([\d.]+)%(?:\s+|,\s*)([\d.]+)%/i);
  if(!m)return null;
  var h=((+m[1]%360)+360)%360/60,s=+m[2]/100,l=+m[3]/100;
  var chroma=(1-Math.abs(2*l-1))*s,x=chroma*(1-Math.abs(h%2-1)),offset=l-chroma/2;
  var t=h<1?[chroma,x,0]:h<2?[x,chroma,0]:h<3?[0,chroma,x]:
    h<4?[0,x,chroma]:h<5?[x,0,chroma]:[chroma,0,x];
  return t.map(function(v){return Math.round((v+offset)*255)});
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function between(a,b,t){return{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}
function tangent(a,b){return Math.atan2(b.y-a.y,b.x-a.x)}
function shift(p,angle,amount){return{x:p.x+Math.cos(angle)*amount,y:p.y+Math.sin(angle)*amount}}
function hash(x,y,s){
  var n=(Math.imul(x,374761393)^Math.imul(y,668265263)^s)|0;
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}

/* Smooth, continuous canvas tooth. Earlier (x>>1,y>>1) hash produced
 * conspicuous square cells in close-up: no raster-aligned block noise. */
function smoothTooth(x,y,seed){
  var gx=x/5.5,gy=y/5.5,ix=Math.floor(gx),iy=Math.floor(gy),
      fx=gx-ix,fy=gy-iy;
  fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  return lerp(lerp(hash(ix,iy,seed),hash(ix+1,iy,seed),fx),
    lerp(hash(ix,iy+1,seed),hash(ix+1,iy+1,seed),fx),fy);
}

function parsePath(src){
  var t=String(src.d||'').match(/[MLC]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)||[];
  var pts=[],i=0,cmd='',prev=null;
  function next(){return +t[i++]}
  while(i<t.length&&pts.length<950){
    if(/^[MLC]$/.test(t[i])){cmd=t[i++];continue}
    if(cmd==='M'||cmd==='L'){
      if(i+1>=t.length)break;prev={x:next(),y:next()};pts.push(prev);cmd='L';
    }else if(cmd==='C'&&prev){
      if(i+5>=t.length)break;
      var a={x:next(),y:next()},b={x:next(),y:next()},c={x:next(),y:next()},from=prev;
      var n=Math.max(6,Math.min(16,Math.ceil(dist(from,c)/15)));
      for(var j=1;j<=n;j++){
        var u=j/n,v=1-u;
        pts.push({x:v*v*v*from.x+3*v*v*u*a.x+3*v*u*u*b.x+u*u*u*c.x,
          y:v*v*v*from.y+3*v*v*u*a.y+3*v*u*u*b.y+u*u*u*c.y});
      }
      prev=c;cmd='L';
    }else break;
  }
  if(src.transform){
    var m=String(src.transform).match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi);
    if(m&&m.length===6){m=m.map(Number);
      pts=pts.map(function(p){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}});
    }
  }
  return pts;
}
function sample(points,step){
  if(points.length<2)return[];
  var result=[points[0]],carry=0;
  for(var i=1;i<points.length&&result.length<1500;i++){
    var a=points[i-1],b=points[i],d=dist(a,b);
    if(d<.05)continue;
    var walked=step-carry;
    while(walked<d&&result.length<1499){result.push(between(a,b,walked/d));walked+=step}
    carry=d-(walked-step);
    if(carry>=step)carry%=step;
  }
  if(dist(result[result.length-1],points[points.length-1])>1)result.push(points[points.length-1]);
  return result;
}
function getChains(paths){
  var chains=[],seen=new Set(),sourceCount=paths.length;
  for(var i=0;i<paths.length;i++){
    var src=paths[i],rgb=sourceRGB(src.stroke),pts=parsePath(src);
    if(!rgb||pts.length<2)continue;
    var len=0;for(var j=1;j<pts.length;j++)len+=dist(pts[j-1],pts[j]);
    if(len<6)continue;
    var first=pts[0],last=pts[pts.length-1];
    var id=[Math.round(first.x/4),Math.round(first.y/4),Math.round(last.x/4),
      Math.round(last.y/4),Math.round(len/12),rgb.join(':')].join('|');
    if(seen.has(id))continue;seen.add(id);
    chains.push({pts:sample(pts,7),rgb:rgb,width:src.width||4,
      length:len,sourceIndex:i,first:first,last:last});
  }
  // Dense V1 lost strokes after hard 115-long/145-short limits.
  // Retain source draw order after ranking by visible length/weight.
  // The bounded cap is for predictable browser memory/runtime, not a
  // silent compositional rewrite. Expose the retained/dropped counts.
  var limit=540;
  if(chains.length>limit){
    var ranked=chains.map(function(c){
      return {c:c,score:Math.sqrt(c.length)*(2+Math.min(c.width,15))+
        (c.length<75?25:0)};
    }).sort(function(a,b){return b.score-a.score||a.c.sourceIndex-b.c.sourceIndex});
    chains=ranked.slice(0,limit).map(function(x){return x.c});
    chains.sort(function(a,b){return a.sourceIndex-b.sourceIndex});
  }
  chains.sourceCount=sourceCount;
  chains.eligibleCount=seen.size;
  chains.droppedCount=seen.size-chains.length;
  return chains;
}
function profileFor(ch,mode,r,setting){
  if(['flat','filbert','dry','knife'].includes(setting))return setting;
  if(mode==='rects'||mode==='geometric')return r.chance(.28)?'knife':'flat';
  if(mode==='organic'||mode==='spiral')return r.chance(.84)?'filbert':'flat';
  if(mode==='scribble'||mode==='burst')return r.chance(.35)?'dry':'filbert';
  if(mode==='network')return r.chance(.70)?'filbert':'dry';
  return r.chance(.56)?'filbert':'flat';
}
function localMasses(chains,amount){
  // Closely aligned neighbours receive a shared painted underlayer.
  // Never fill group convex hulls, gaps, or protected negative space.
  var mass=0;
  for(var i=0;i<chains.length;i++){
    var a=chains[i];a.mass=false;
    if(a.length<20)continue;
    var da=tangent(a.first,a.last);
    for(var j=Math.max(0,i-25);j<i;j++){
      var b=chains[j];if(b.length<20)continue;
      var db=tangent(b.first,b.last);
      if(Math.abs(Math.sin(da-db))>.32)continue;
      var proximity=Math.min(dist(a.first,b.first),dist(a.first,b.last),
        dist(a.last,b.first),dist(a.last,b.last));
      if(proximity>Math.max(a.width,b.width)*2.1+11)continue;
      var colourDist=Math.hypot(a.rgb[0]-b.rgb[0],
        a.rgb[1]-b.rgb[1],a.rgb[2]-b.rgb[2]);
      if(colourDist>96)continue;
      if(((Math.imul(a.sourceIndex+3,15427)^Math.imul(b.sourceIndex+7,7993))>>>0)%1000/1000<amount){
        a.mass=true;b.mass=true;mass++;break;
      }
    }
  }
  return mass;
}
function curvedStroke(ctx,pts,width,col,alpha){
  if(pts.length<2)return;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=col;ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length-1;i++){
    var m=between(pts[i],pts[i+1],.5);
    ctx.quadraticCurveTo(pts[i].x,pts[i].y,m.x,m.y);
  }
  ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);ctx.stroke();ctx.restore();
}
function strokeBody(pts,width,seed,load,profile){
  // One continuous curved contour used by BOTH pigment and height.
  var left=[],right=[],travel=0,filbert=profile==='filbert';
  for(var i=0;i<pts.length;i++){
    var before=pts[Math.max(0,i-1)],after=pts[Math.min(pts.length-1,i+1)];
    if(i)travel+=dist(pts[i-1],pts[i]);
    var normal=tangent(before,after)+PI/2;
    var u=pts.length>1?i/(pts.length-1):0;
    var taper=filbert?(.42+.58*Math.min(1,u*9,(1-u)*9)):
      (.83+.17*Math.min(1,u*13,(1-u)*13));
    var correlated=.92+.11*Math.sin(travel*.027+seed*.000031)+
      .065*Math.sin(travel*.073-seed*.000071);
    var edgeWidth=width*.5*load*correlated*taper;
    left.push(shift(pts[i],normal,edgeWidth));
    right.push(shift(pts[i],normal,-edgeWidth*(.95+.035*Math.sin(travel*.041))));
  }
  var path=new Path2D();path.moveTo(left[0].x,left[0].y);
  for(i=1;i<left.length;i++)path.lineTo(left[i].x,left[i].y);
  if(filbert&&left.length>1){
    var e=pts[pts.length-1],last=tangent(pts[pts.length-2],e);
    var tip=shift(e,last,width*.17*load);
    path.quadraticCurveTo(tip.x,tip.y,right[right.length-1].x,right[right.length-1].y);
  }
  for(i=right.length-1;i>=0;i--)path.lineTo(right[i].x,right[i].y);
  if(filbert&&left.length>1){
    var first=pts[0],dir=tangent(pts[0],pts[1]);
    var nose=shift(first,dir,-width*.17*load);
    path.quadraticCurveTo(nose.x,nose.y,left[0].x,left[0].y);
  }
  path.closePath();
  var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  left.concat(right).forEach(function(p){
    minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
    minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  });
  return {path:path,bounds:{minX:minX-width*.24,maxX:maxX+width*.24,
    minY:minY-width*.24,maxY:maxY+width*.24}};
}
// V2 frequently lost all relief variation at its 4-unit cap.
// V3 carries a wider surface height and applies optical compression
// only during final lightness-map shading.
function addPaintHeight(previous,ink,loaded){
  return Math.min(18,previous+ink*loaded);
}
function opticalRelief(value){return Math.log1p(Math.max(0,value)*.66)}
A.oilPaintV3Test={addPaintHeight:addPaintHeight,opticalRelief:opticalRelief,smoothTooth:smoothTooth};
// One deposited bristle contact is drawn into pigment AND relief support.
// Unlike V3's decorative inner bands, there is no fully opaque ribbon.
function depositBristle(pig,mask,points,width,pigment,alpha,load){
  if(points.length<2)return false;
  var path=new Path2D(),i;
  path.moveTo(points[0].x,points[0].y);
  for(i=1;i<points.length-1;i++){
    var mid=between(points[i],points[i+1],.5);
    path.quadraticCurveTo(points[i].x,points[i].y,mid.x,mid.y);
  }
  path.lineTo(points[points.length-1].x,points[points.length-1].y);
  pig.lineCap=mask.lineCap='round';
  pig.lineJoin=mask.lineJoin='round';
  pig.globalAlpha=minmax(alpha,0,1);
  pig.lineWidth=width;pig.strokeStyle=css(pigment);pig.stroke(path);
  mask.globalAlpha=minmax(load,0,1);
  mask.lineWidth=width;mask.strokeStyle='#ffffff';mask.stroke(path);
  // Stamp a final smooth oval bristle tip at fractional coordinates; unlike
  // a pixel brush, contact never snaps to a square tile.
  if(points.length>=3&&width>1.4){
    var tip=points[points.length-1],previous=points[points.length-2],
        angle=tangent(previous,tip),major=width*.68,minor=width*.46;
    pig.beginPath();pig.ellipse(tip.x,tip.y,major,minor,angle,0,TAU);
    pig.fillStyle=css(pigment);pig.fill();
    mask.beginPath();mask.ellipse(tip.x,tip.y,major,minor,angle,0,TAU);
    mask.fillStyle='#ffffff';mask.fill();
  }
  return true;
}
// Opaque impasto colour is deposited in rounded, hand-shaped local patches,
// never as a convex hull spanning unrelated golden-ratio negative space.
function depositPaintPatch(pig,mask,center,angle,length,width,color,opacity,height,r){
  var halfL=length*.5,halfW=width*.5,normal=angle+PI/2;
  function pos(lateral,longitudinal){
    return shift(shift(center,angle,longitudinal),normal,lateral);
  }
  var tipA=pos(r.range(-.14,.10)*halfW,-halfL),
      upper1=pos(-halfW*r.range(.58,.86),-halfL*.85),
      upper2=pos(-halfW*r.range(.83,1.08),halfL*.46),
      tipB=pos(r.range(-.10,.15)*halfW,halfL),
      lower1=pos(halfW*r.range(.74,.98),halfL*.65),
      lower2=pos(halfW*r.range(.58,.92),-halfL*.42);
  var path=new Path2D();path.moveTo(tipA.x,tipA.y);
  path.bezierCurveTo(upper1.x,upper1.y,upper2.x,upper2.y,tipB.x,tipB.y);
  path.bezierCurveTo(lower1.x,lower1.y,lower2.x,lower2.y,tipA.x,tipA.y);
  path.closePath();
  pig.globalAlpha=opacity;pig.fillStyle=css(color);pig.fill(path);
  mask.globalAlpha=height;mask.fillStyle='#ffffff';mask.fill(path);
}
// V4 brush primitive. No independent per-sample random contact toggles.
// Smooth arc-length contact, coherent pressure and physically deposited height.
function buildBrushFrames(points,width){
  if(points.length<2)return [];
  var frames=[],walked=0,step=minmax(width*.085,2.1,4.0);
  for(var i=0;i<points.length-1;i++){
    var a=points[Math.max(0,i-1)],b=points[i],
        c=points[i+1],d=points[Math.min(points.length-1,i+2)];
    var seg=dist(b,c),n=Math.max(1,Math.ceil(seg/step));
    for(var j=0;j<n;j++){
      var t=j/n,t2=t*t,t3=t2*t;
      var p={
        x:.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t2+(-a.x+3*b.x-3*c.x+d.x)*t3),
        y:.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t2+(-a.y+3*b.y-3*c.y+d.y)*t3)};
      if(frames.length)walked+=dist(frames[frames.length-1],p);
      frames.push({x:p.x,y:p.y,s:walked});
    }
  }
  var last=points[points.length-1];
  if(frames.length)walked+=dist(frames[frames.length-1],last);
  frames.push({x:last.x,y:last.y,s:walked});
  for(i=0;i<frames.length;i++){
    var from=frames[Math.max(0,i-1)],to=frames[Math.min(frames.length-1,i+1)];
    frames[i].angle=tangent(from,to);
  }
  return frames;
}
function pressureAt(s,total,phase,profile){
  var t=minmax(total>0?s/total:0,0,1);
  // C1-continuous eased onset/lift over a finite travel distance; even short
  // strokes must not step suddenly through rectangular pressure levels.
  function ease(q){q=minmax(q,0,1);return q*q*(3-2*q)}
  var start=ease(t*(profile==='knife'?8:5)),
      end=ease((1-t)*(profile==='dry'?4:5)),
      ramp=Math.min(start,end);
  var base=profile==='filbert'?.28:profile==='dry'?.38:
    profile==='knife'?.70:.55;
  var taper=base+(1-base)*ramp;
  var modulation=.83+.11*Math.sin(s*.023+phase)+
    .065*Math.sin(s*.055-phase*.41);
  return minmax(taper*modulation,.10,1.04);
}
function markPath(pts){
  var p=new Path2D();if(!pts.length)return p;
  p.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length-1;i++){
    var mid=between(pts[i],pts[i+1],.5);
    p.quadraticCurveTo(pts[i].x,pts[i].y,mid.x,mid.y);
  }
  if(pts.length>1)p.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);
  return p;
}
function fillMatched(pig,mask,shape,color,alpha,height){
  pig.globalAlpha=minmax(alpha,0,1);
  pig.fillStyle=css(color);pig.fill(shape);
  mask.globalAlpha=minmax(height,0,1);
  mask.fillStyle='#fff';mask.fill(shape);
}
function strokeMatched(pig,mask,path,width,color,alpha,height){
  pig.lineWidth=mask.lineWidth=width;
  pig.lineCap=mask.lineCap='round';
  pig.lineJoin=mask.lineJoin='round';
  pig.globalAlpha=minmax(alpha,0,1);
  pig.strokeStyle=css(color);pig.stroke(path);
  mask.globalAlpha=minmax(height,0,1);
  mask.strokeStyle='#fff';mask.stroke(path);
}
// A painter's contact patch, not an opaque vector body with decorative grooves.
// Each tuft is a connected, pressure-driven paint footprint. Its *actual*
// deposited geometry is used both for colour and for the relief mask.
function drawContactBrushV4e(pig,mask,points,width,rgb,profile,r,options){
  var frames=buildBrushFrames(points,width);
  if(frames.length<2)return {
    bristleRuns:0,bristleContacts:0,contactFootprints:0,loadStart:0,
    loadEnd:0,pressureMin:0,pressureMax:0};
  var total=Math.max(frames[frames.length-1].s,.001),phase=r.range(0,TAU),
      thickness=minmax(options.thickness??.90,0,1),
      dryness=minmax(options.drag??.72,0,1),
      count=profile==='dry'?19:profile==='knife'?6:
        profile==='flat'?11:14,
      contacts=0,runs=0,footprints=0,
      pMin=2,pMax=0,loadStart=0,loadEnd=0,
      maxPaint=profile==='dry'?.78:profile==='knife'?1.18:1.10;
  // Adjacent hairs belong to uneven clusters: widths and lateral positions
  // are chosen once per tuft, not snapped to a grid or a raster cell.
  for(var tuft=0;tuft<count;tuft++){
    var lane=(tuft+.5)/count-.5,
        side=lane*.91+r.range(-.038,.038),
        core=Math.abs(lane)<.21,
        bundleWidth=width*(profile==='knife'?r.range(.25,.38):
          profile==='dry'?r.range(.067,.12):
          profile==='flat'?r.range(.145,.255):r.range(.155,.265))*(core?1.19:1),
        phaseT=r.range(0,TAU),jitter=r.range(.005,.027)*width,
        initial=r.range(.93,1.31)*maxPaint,
        colour=mix(rgb,r.chance(.30)?[64,46,37]:[252,237,215],
          r.range(.017,.11)),
        startFraction=core?r.range(0,.028):
          profile==='knife'?r.range(0,.06):
          profile==='dry'?r.range(0,.18):r.range(0,.11),
        stopFraction=core?r.range(.94,1):
          profile==='dry'?r.range(.72,1):r.range(.82,1),
        strip=[];
    // Outer hairs are finer, often exhaust first and visibly separate.
    var outer=Math.abs(lane)*2,outerWeight=1-.33*Math.pow(outer,1.8);
    bundleWidth*=outerWeight;
    function finishStrip(){
      if(strip.length<3){strip=[];return}
      var left=[],right=[],avgLoad=0,avgS=0;
      for(var k=0;k<strip.length;k++){
        var item=strip[k],turn=item.angle+PI/2,
            // Independent, smoothly varying splay / changing contact width.
            pressure=pressureAt(item.s,total,phase,profile),
            charge=minmax(item.load,0,1.35),
            taper=Math.min(1,(k+1)/4,(strip.length-k)/4),
            lateralDrift=jitter*Math.sin(item.s*.047+phaseT)+
              jitter*.55*Math.sin(item.s*.103+phaseT*.42),
            normalWidth=bundleWidth*pressure*(.56+.44*taper)*
              (.60+.40*charge)*(.92+.13*Math.sin(item.s*.061+phaseT)),
            q=shift(item,turn,side*width*pressure+lateralDrift);
        left.push(shift(q,turn,-normalWidth*.51));
        right.push(shift(q,turn,normalWidth*.49));
        avgLoad+=item.load;avgS+=item.s;
      }
      avgLoad/=strip.length;avgS/=strip.length;
      var path=new Path2D();
      path.moveTo(left[0].x,left[0].y);
      for(var z=1;z<left.length-1;z++){
        var mid=between(left[z],left[z+1],.5);
        path.quadraticCurveTo(left[z].x,left[z].y,mid.x,mid.y);
      }
      path.lineTo(left[left.length-1].x,left[left.length-1].y);
      // The trailing end forms a tear or rounded bristle tip, not a square cap.
      var tip=shift(strip[strip.length-1],strip[strip.length-1].angle,
        bundleWidth*r.range(.05,.25));
      path.quadraticCurveTo(tip.x,tip.y,
        right[right.length-1].x,right[right.length-1].y);
      for(z=right.length-2;z>0;z--){
        mid=between(right[z],right[z-1],.5);
        path.quadraticCurveTo(right[z].x,right[z].y,mid.x,mid.y);
      }
      path.lineTo(right[0].x,right[0].y);
      path.closePath();
      // Colour and height are deposited from the identical irregular outline.
      // The reservoir limits both pigment opacity and deposited thickness.
      var coverage=minmax(.59+.46*avgLoad,.26,.995),
          relief=minmax((.12+.69*Math.pow(avgLoad,1.2))*(.56+.44*thickness),.06,.98);
      fillMatched(pig,mask,path,colour,coverage,relief);
      runs++;footprints++;
      strip=[];
    }
    for(var i=0;i<frames.length;i++){
      var p=frames[i],t=p.s/total,
          pressureHere=pressureAt(p.s,total,phase,profile);
      pMin=Math.min(pMin,pressureHere);
      pMax=Math.max(pMax,pressureHere);
      // Loading is monotone on average but correlated pressure pockets
      // redistribute pigment. Unlike V4b, this actually varies paint volume.
      var load=initial*(1-.54*t)+
        .13*Math.sin(p.s*.026+phaseT)*pressureHere+
        .09*Math.sin(p.s*.074+phaseT*.67);
      load=minmax(load,.08,1.45);
      if(i===0)loadStart+=load;
      if(i===frames.length-1)loadEnd+=load;
      var coherent=Math.sin(p.s*(profile==='dry'?.09:.047)+phaseT)+
        .34*Math.sin(p.s*.027+phaseT*.73);
      var threshold=profile==='dry'?(-.26+dryness*.17):
        profile==='filbert'?-1.0:profile==='flat'?-1.15:-1.22;
      var active=t>=startFraction && t<=stopFraction &&
        coherent>threshold && load>(profile==='dry'?.26:.14);
      if(!active){finishStrip();continue}
      // Subpixel path samples are interpolated geometrically between source
      // points; intact runs don't leave random single-pixel gaps.
      strip.push({x:p.x,y:p.y,angle:p.angle,s:p.s,load:load});
      contacts++;
    }
    finishStrip();
  }
  // Load thickens visibly at the heel, selected turns and the toe. Unlike
  // V4b, these are deposited atop real bristle footprints, with no overall
  // hard-edged filled silhouette and no clipping back to a vector polygon.
  var bulges=profile==='dry'?1:profile==='knife'?4:3;
  for(var n=0;n<bulges;n++){
    var at=n===0?.12:n===bulges-1?.86:r.range(.30,.70),
        j=Math.floor(at*(frames.length-1)),f=frames[j],
        lateral=r.range(-.18,.18)*width,
        location=shift(f,f.angle+PI/2,lateral),
        mass=(1-.55*at)*(profile==='knife'?1.2:1),
        colour2=mix(rgb,r.chance(.58)?[248,228,201]:[67,48,39],
          r.range(.035,.12));
    depositPaintPatch(pig,mask,location,f.angle+r.range(-.16,.16),
      width*r.range(.38,.89),width*r.range(.29,.60)*mass,
      colour2,r.range(.60,.86),r.range(.33,.73)*mass,r);
    footprints++;
  }
  return {bristleRuns:runs,bristleContacts:contacts,
    contactFootprints:footprints,loadStart:+(loadStart/count).toFixed(3),
    loadEnd:+(loadEnd/count).toFixed(3),
    pressureMin:+pMin.toFixed(3),pressureMax:+pMax.toFixed(3)};
}

function sampleWetCrossings(pig,field,pts,width,scale,sw,sh){
  var crossings=[],last=null,n=Math.min(20,Math.max(8,Math.round(pts.length/3)));
  for(var i=1;i<n;i++){
    var at=Math.floor((i/n)*(pts.length-1));
    var p=pts[at],cx=minmax(Math.round(p.x*scale),0,sw-1),
        cy=minmax(Math.round(p.y*scale),0,sh-1);
    if(field[cy*sw+cx]<.23)continue;
    if(last&&dist(last,p)<width*.64)continue;
    var pixel=pig.getImageData(cx,cy,1,1).data;
    if(pixel[3]<140)continue;
    crossings.push({at:at,colour:[pixel[0],pixel[1],pixel[2]]});
    last=p;
    if(crossings.length>=4)break;
  }
  return crossings;
}
function dragCrossingPigment(pig,mask,crossings,pts,width,rgb,r,options){
  var strength=minmax(options.wetDrag??.72,0,1);
  if(!strength||!crossings.length)return 0;
  var drawn=0;
  for(var i=0;i<crossings.length;i++){
    var crossing=crossings[i],at=crossing.at,p=pts[at],
        before=pts[Math.max(0,at-1)],after=pts[Math.min(pts.length-1,at+1)],
        angle=tangent(before,after),colour=mix(rgb,crossing.colour,.48+.36*strength),
        length=width*(.72+1.20*strength),band=width*(.14+.17*strength),
        ahead=shift(p,angle,length*.49);
    for(var j=0;j<3;j++){
      var centre=shift(ahead,angle+PI/2,(j-1)*band*r.range(.38,.85));
      depositPaintPatch(pig,mask,centre,angle+r.range(-.06,.06),
        length*r.range(.72,1.04),band*r.range(.62,1.12),colour,
        strength*r.range(.46,.75),strength*r.range(.24,.47),r);
      drawn++;
    }
  }
  return drawn;
}

function paintOne(pig,mask,ch,r,index,options,field,sw,sh,scale,mode){
  var pts=ch.pts;if(pts.length<2)return 0;
  var profile=profileFor(ch,mode,r,options.profile),
      thickness=minmax(options.thickness??.90,0,1),
      nominal=minmax(6+ch.width*1.8,9,58),
      width=nominal*(1+thickness*.92)*r.range(.90,1.08),
      rgb=ch.rgb,edge=width*.85;
  var xs=pts.map(function(p){return p.x}),
      ys=pts.map(function(p){return p.y});
  var x0=minmax(Math.floor((Math.min.apply(null,xs)-edge)*scale)-3,0,sw-1),
      y0=minmax(Math.floor((Math.min.apply(null,ys)-edge)*scale)-3,0,sh-1),
      x1=minmax(Math.ceil((Math.max.apply(null,xs)+edge)*scale)+3,x0+1,sw),
      y1=minmax(Math.ceil((Math.max.apply(null,ys)+edge)*scale)+3,y0+1,sh);
  mask.save();mask.setTransform(1,0,0,1,0,0);
  mask.clearRect(x0,y0,x1-x0,y1-y0);mask.restore();
  // Region massing remains a local V3c option: V5 will design the shared planner.
  var patchCount=ch.mass?Math.min(6,Math.max(2,Math.round(ch.length/(width*1.5)))):0;
  var patches=0;
  if(patchCount){
    pig.save();mask.save();
    for(var k=0;k<patchCount;k++){
      var at=r.int(0,pts.length-2),
          anchor=between(pts[at],pts[at+1],r.range(.1,.9)),
          angle=tangent(pts[at],pts[at+1]),pos=shift(anchor,angle+PI/2,
          r.range(-.16,.16)*width);
      depositPaintPatch(pig,mask,pos,angle+r.range(-.13,.13),
        width*r.range(.8,1.5),width*r.range(.72,1.15),
        mix(rgb,[241,220,190],r.range(.01,.08)),r.range(.72,.91),
        r.range(.38,.65),r);patches++;
    }
    pig.restore();mask.restore();
  }
  // Sample true crossings before new paint is deposited; transfer locally.
  var crossings=sampleWetCrossings(pig,field,pts,width,scale,sw,sh);
  var b=drawContactBrushV4e(pig,mask,pts,width,rgb,profile,r,options);
  var dragged=dragCrossingPigment(pig,mask,crossings,pts,width,rgb,r,options);
  var pixels=mask.getImageData(x0,y0,x1-x0,y1-y0).data,
      bw=x1-x0,bh=y1-y0,amount=.50+thickness*.62;
  for(var yy=0;yy<bh;yy++){
    var row=(yy+y0)*sw+x0,trow=yy*bw;
    for(var xx=0;xx<bw;xx++){
      var ink=pixels[(trow+xx)*4+3]/255;
      if(ink>.008){var index2=row+xx;
        field[index2]=addPaintHeight(field[index2],ink,amount)}
    }
  }
  return {profile:profile,bristleRuns:b.bristleRuns,
    bristleContacts:b.bristleContacts,contactFootprints:b.contactFootprints,
    loadStart:b.loadStart,loadEnd:b.loadEnd,dragMarks:0,
    pickupMarks:crossings.length,wetDragMarks:dragged,paintPatches:patches,
    pressureMin:b.pressureMin,pressureMax:b.pressureMax};
}
// Expose actual brush strokes to the lab, not an unrelated fake preview.

function drawWetCrossingLab(target,opts){
  opts=opts||{};
  var width=930,height=410,targetSeed=opts.seed||'OIL-V4E-CROSS',
      cases=[],drawings=[];
  target.width=width;target.height=height;
  var finalCtx=target.getContext('2d');
  for(var caseIndex=0;caseIndex<2;caseIndex++){
    var w=450,h=370,pig=document.createElement('canvas'),
        mcanvas=document.createElement('canvas');
    pig.width=mcanvas.width=w;pig.height=mcanvas.height=h;
    var ctx=pig.getContext('2d',{willReadFrequently:true}),
        mask=mcanvas.getContext('2d',{willReadFrequently:true}),
        field=new Float32Array(w*h),
        base={thickness:.90,drag:.48,bristles:.92,massing:0,
          profile:'filbert',wetDrag:caseIndex===0?0:1},
        r1=A.makeR(targetSeed+'|first'),r2=A.makeR(targetSeed+'|second');
    ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,w,h);
    var horizontal=Array.from({length:37},function(_,i){
      var t=i/36;return{x:54+t*338,y:176+14*Math.sin(t*TAU*.65)}});
    var diagonal=Array.from({length:41},function(_,i){
      var t=i/40;return{x:221+16*Math.sin(t*PI),y:42+t*285}});
    var first=paintOne(ctx,mask,{pts:horizontal,width:8, length:340,mass:false,
      rgb:[185,56,40]},r1,0,base,field,w,h,1,'organic');
    var second=paintOne(ctx,mask,{pts:diagonal,width:8,length:290,mass:false,
      rgb:[35,77,165]},r2,1,base,field,w,h,1,'organic');
    ctx.setTransform(1,0,0,1,0,0);
    var hstats=finish(ctx,field,w,h,targetSeed,base);
    finalCtx.drawImage(pig,caseIndex*465,26);
    finalCtx.font='bold 15px sans-serif';finalCtx.fillStyle='#45382e';
    finalCtx.fillText(caseIndex===0?'NO TRANSFER · CONTROL':'LOCAL WET TRANSFER',
      caseIndex*465+12,18);
    drawings.push(ctx.getImageData(0,0,w,h).data);
    cases.push({wetDrag:base.wetDrag,first:first,second:second,
      shade:hstats.meanSpecular});
  }
  var diff=0,pixelsChanged=0;
  for(var i=0;i<drawings[0].length;i+=4){
    var change=Math.abs(drawings[0][i]-drawings[1][i])+
      Math.abs(drawings[0][i+1]-drawings[1][i+1])+
      Math.abs(drawings[0][i+2]-drawings[1][i+2]);
    diff+=change;
    if(change>12)pixelsChanged++;
  }
  return {material:'oil-v4e-wet-crossing-lab',cases:cases,
    colourDifference:diff,pixelsChanged:pixelsChanged,
    width:target.width,height:target.height};
}

function drawBrushLab(target,opts){
  opts=opts||{};
  var w=1200,h=870,r=A.makeR((opts.seed||'OIL-V4-LAB-001')+'|oil-brush-lab'),
      scale=opts.scale||1;
  target.width=Math.round(w*scale);target.height=Math.round(h*scale);
  var pig=document.createElement('canvas'),mask=document.createElement('canvas');
  pig.width=mask.width=target.width;pig.height=mask.height=target.height;
  var ctx=pig.getContext('2d',{willReadFrequently:true}),
      m=mask.getContext('2d',{willReadFrequently:true}),
      field=new Float32Array(pig.width*pig.height),stats=[];
  ctx.scale(scale,scale);m.scale(scale,scale);
  ground(ctx,w,h,'OIL-V4-LAB',r);
  var profiles=['filbert','flat','dry','knife'],
      colors=[[156,56,39],[37,92,115],[142,108,52],[82,113,75]];
  function seg(a,b,n){return Array.from({length:n+1},(_,i)=>between(a,b,i/n))}
  for(var row=0;row<4;row++)for(var col=0;col<4;col++){
    var x=col*300,y=row*210+40,pts=[];
    if(col===0)pts=seg({x:x+34,y:y+83},{x:x+262,y:y+83},22);
    if(col===1){
      pts=Array.from({length:37},(_,i)=>{
        var t=i/36;return{x:x+25+t*250,
          y:y+82+43*Math.sin(t*TAU*1.25)}});
    }
    if(col===2)pts=seg({x:x+77,y:y+81},{x:x+189,y:y+65},17);
    if(col===3)pts=seg({x:x+30,y:y+35},{x:x+254,y:y+130},29);
    var color=colors[row],width=col===2?49:col===1?33:43;
    var xlo=Math.max(0,Math.floor((x+4)*scale)),
        ylo=Math.max(0,Math.floor((y-42)*scale)),
        xhi=Math.min(mask.width,Math.ceil((x+293)*scale)),
        yhi=Math.min(mask.height,Math.ceil((y+165)*scale));
    m.save();m.setTransform(1,0,0,1,0,0);
    m.clearRect(xlo,ylo,xhi-xlo,yhi-ylo);m.restore();
    ctx.save();m.save();
    var info=drawContactBrushV4e(ctx,m,pts,width,color,profiles[row],r,
      {thickness:.9,drag:col===2?.85:.40});
    ctx.restore();m.restore();
    var a=m.getImageData(xlo,ylo,xhi-xlo,yhi-ylo).data;
    for(var iy=0;iy<yhi-ylo;iy++)for(var ix=0;ix<xhi-xlo;ix++){
      var ink=a[(iy*(xhi-xlo)+ix)*4+3]/255;
      if(ink>.008){var p=(iy+ylo)*mask.width+ix+xlo;
        field[p]=addPaintHeight(field[p],ink,.91)}
    }
    stats.push({profile:profiles[row],caseIndex:col,
      bristleRuns:info.bristleRuns,pressureMin:info.pressureMin,
      pressureMax:info.pressureMax});
  }
  ctx.setTransform(1,0,0,1,0,0);
  var surface=finish(ctx,field,pig.width,pig.height,
    'OIL-V4-LAB',{relief:.84});
  var out=target.getContext('2d');out.drawImage(pig,0,0);
  out.save();out.scale(scale,scale);
  out.fillStyle='#3d3631';out.font='bold 17px sans-serif';
  for(var j=0;j<4;j++)out.fillText(profiles[j].toUpperCase(),14,35+j*210);
  out.font='12px sans-serif';var labels=['STRAIGHT','SWEEP','SHORT / LIFT','DIAGONAL'];
  for(j=0;j<4;j++)out.fillText(labels[j],j*300+13,858);
  out.restore();
  return {material:'oil-paint-v4-brush-lab',width:target.width,height:target.height,
    studies:stats.length, profiles:profiles, stats:stats,height:surface};
}
function ground(ctx,w,h,seed,r){
  // Primed canvas, not watercolour paper. Tooth is faint and deterministic.
  ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,w,h);
  ctx.save();
  for(var i=0;i<Math.ceil(w/5);i++){
    var x=i*5+r.range(-.4,.4);
    ctx.fillStyle='rgba(119,104,89,.017)';ctx.fillRect(x,0,.55,h);
  }
  for(i=0;i<Math.ceil(h/6);i++){
    var y=i*6+r.range(-.4,.4);
    ctx.fillStyle='rgba(108,98,88,.018)';ctx.fillRect(0,y,w,.55);
  }
  ctx.restore();
}
function surfaceLighting(field,w,h,x,y,relief){
  var p=y*w+x,centre=opticalRelief(field[p]),
      lx=opticalRelief(field[p-1]),rx=opticalRelief(field[p+1]),
      ty=opticalRelief(field[p-w]),by=opticalRelief(field[p+w]),
      lx3=opticalRelief(field[p-3]),rx3=opticalRelief(field[p+3]),
      ty3=opticalRelief(field[p-w*3]),by3=opticalRelief(field[p+w*3]),
      dx=(rx-lx)*.35+(rx3-lx3)*.05,
      dy=(by-ty)*.35+(by3-ty3)*.05,
      nx=-dx*(.74+.38*relief),ny=-dy*(.74+.38*relief),nz=1,
      length=1/Math.hypot(nx,ny,nz);
  nx*=length;ny*=length;nz*=length;
  var diffuse=nx*(-.43)+ny*(-.52)+nz*.74,
      shade=minmax(1+(diffuse-.74)*(.37+.32*relief),.72,1.23),
      ridge=Math.hypot(dx,dy),
      spec=Math.pow(minmax(nx*(-.24)+ny*(-.30)+nz*.92,0,1),18)*
        minmax(ridge,0,1.4)*centre*(4+12*relief);
  return {shade:shade,shine:minmax(spec,0,27)};
}
function finish(pig,field,w,h,seed,options){
  var pixels=pig.getImageData(0,0,w,h),out=pixels.data,
      relief=minmax(options.relief??.87,0,1),
      peak=0,active=0,capped=0,dist=[],shininess=0;
  for(var y=3;y<h-3;y++)for(var x=3;x<w-3;x++){
    var p=y*w+x,i=p*4,ht=field[p];
    if(ht<.035)continue;
    active++;if(ht>peak)peak=ht;
    if(ht>=17.999)capped++;
    if((x+y*13)%17===0)dist.push(ht);
    var light=surfaceLighting(field,w,h,x,y,relief);
    shininess+=light.shine;
    out[i]=minmax(Math.round(out[i]*light.shade+light.shine),0,255);
    out[i+1]=minmax(Math.round(out[i+1]*light.shade+light.shine*.88),0,255);
    out[i+2]=minmax(Math.round(out[i+2]*light.shade+light.shine*.78),0,255);
  }
  pig.putImageData(pixels,0,0);
  dist.sort(function(a,b){return a-b});
  return {heightPeak:+peak.toFixed(3),heightP95:dist.length?
    +dist[Math.floor(dist.length*.95)].toFixed(3):0,
    heightActivePixels:active,heightAtCap:capped,
    heightAtCapFraction:active?+(capped/active).toFixed(5):0,
    heightBytes:field.byteLength,meanSpecular:active?
      +(shininess/active).toFixed(4):0};
}

A.renderOilPaintV4E=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var w=settings.orientation==='portrait'?1000:1400,
      h=settings.orientation==='portrait'?1400:1000,
      rec={precise:true,paths:[],paperMarks:[]},
      oldRecorder=A.svgRecorder,oldMeta=A.lastRenderMeta,
      oldFit=A.phiFramingEnabled,scratch=document.createElement('canvas'),
      sourceMeta,phase={};
  var start=performance.now();
  try{
    A.svgRecorder=rec;
    A.phiFramingEnabled=opts.phiFraming===true;
    sourceMeta=A.render(scratch,settings,Math.min(.22,scale),false);
  }finally{
    A.svgRecorder=oldRecorder;A.phiFramingEnabled=oldFit;
    A.lastRenderMeta=oldMeta;
  }
  phase.captureMs=+(performance.now()-start).toFixed(2);
  var chains=getChains(rec.paths),
      massGroups=localMasses(chains,minmax(opts.massing??.44,0,1));
  var sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
  target.width=sw;target.height=sh;
  var pigment=document.createElement('canvas'),
      stencil=document.createElement('canvas');
  pigment.width=stencil.width=sw;pigment.height=stencil.height=sh;
  var ctx=pigment.getContext('2d',{willReadFrequently:true}),
      mask=stencil.getContext('2d',{willReadFrequently:true}),
      field=new Float32Array(sw*sh);
  ctx.scale(scale,scale);mask.scale(scale,scale);
  var r=A.makeR(settings.seed+'|oil-paint-v4e|'+settings.mode+'|'+
    settings.orientation+'|'+(opts.phiFraming?'phi':'plain'));
  ground(ctx,w,h,settings.seed,r);
  phase.planMs=+(performance.now()-start-phase.captureMs).toFixed(2);
  var profiles={flat:0,filbert:0,dry:0,knife:0},dragMarks=0,painted=0,massArea=0,bristleRuns=0,pickupMarks=0,wetDragMarks=0,bristleContacts=0,paintPatches=0,contactFootprints=0,loadStart=0,loadEnd=0,pressureMin=2,pressureMax=0;
  var paintStart=performance.now();
  for(var i=0;i<chains.length;i++){
    var result=paintOne(ctx,mask,chains[i],r,i,opts,field,sw,sh,scale,settings.mode);
    if(result){
      painted++;profiles[result.profile]++;dragMarks+=result.dragMarks;
      bristleRuns+=result.bristleRuns;pickupMarks+=result.pickupMarks;
      wetDragMarks+=result.wetDragMarks;
      bristleContacts+=result.bristleContacts;paintPatches+=result.paintPatches;
      contactFootprints+=result.contactFootprints;
      loadStart+=result.loadStart;loadEnd+=result.loadEnd;
      pressureMin=Math.min(pressureMin,result.pressureMin);
      pressureMax=Math.max(pressureMax,result.pressureMax);
      if(chains[i].mass)
        massArea+=chains[i].length*(chains[i].width*1.7+6)*1.35/(w*h);
    }
  }
  phase.paintMs=+(performance.now()-paintStart).toFixed(2);
  ctx.setTransform(1,0,0,1,0,0);
  var shaded=finish(ctx,field,sw,sh,settings.seed,opts);
  phase.reliefMs=+(performance.now()-paintStart-phase.paintMs).toFixed(2);
  var dest=target.getContext('2d');
  dest.clearRect(0,0,sw,sh);dest.drawImage(pigment,0,0);
  phase.totalMs=+(performance.now()-start).toFixed(2);
  A.lastOilPaintV4EStats={material:'oil-paint-v4e',seed:settings.seed,
    mode:settings.mode,phiFraming:opts.phiFraming===true,
    width:sw,height:sh,sourcePaths:rec.paths.length,
    eligiblePaths:chains.eligibleCount,paintedPaths:painted,
    droppedPaths:chains.droppedCount,massGroups:massGroups,
    massAreaRatio:+Math.min(.3,massArea).toFixed(4),profiles:profiles,dragMarks:dragMarks,
    revision:'4e-wet-transfer-and-normal-light',brushTip:'loaded irregular tufts, directional wet pigment pickup and surface-normal relief',
    squarePixelTooth:false,pressureRange:[+pressureMin.toFixed(3),+pressureMax.toFixed(3)],
    paintPatches:paintPatches,
    bristleRuns:bristleRuns,pickupMarks:pickupMarks,wetDragMarks:wetDragMarks,
    bristleContacts:bristleContacts,contactFootprints:contactFootprints,
    paintLoadStart:painted?+(loadStart/painted).toFixed(3):0,
    paintLoadEnd:painted?+(loadEnd/painted).toFixed(3):0,
    borrowedTechniques:['continuous pressure, arc-length contact and filbert/flat/dry/knife tips','local pigment pickup',
      'separate paint-height lightness map','non-saturating height response'],
    sourceColours:[...new Set(chains.map(function(c){return css(c.rgb)}))].slice(0,32),
    height:shaded,phases:phase,sourceMeta:sourceMeta&&sourceMeta.strategy};
  return A.lastOilPaintV4EStats;
};

A.oilPaintV4ETest={pressureAt:pressureAt,buildBrushFrames:buildBrushFrames,
  drawBrushLab:drawBrushLab,drawContactBrush:drawContactBrushV4e,
  sampleWetCrossings:sampleWetCrossings,dragCrossingPigment:dragCrossingPigment,
  surfaceLighting:surfaceLighting,drawWetCrossingLab:drawWetCrossingLab,
  addPaintHeight:addPaintHeight};
})(window.AlgoArt);
