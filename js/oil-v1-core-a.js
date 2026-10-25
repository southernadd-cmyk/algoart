// Oil v1 source-owned geometry bundle 1/3: original tested modules, not modified.

// ---- oil-paint-v4e.js ----
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
function mix(a,b,t){
  if(A.oilPigmentActive?.tone)return A.oilPigmentActive.tone(a,b,t);
  return a.map(function(v,i){return Math.round(lerp(v,b[i],t))});
}
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
  // Stage C uses its own material-contact geometry, never a decorative
  // overlay. Not loaded or enabled by the published app.
  if(A.oilStageCExperimental===true && A.oilPaintV4ETest &&
     typeof A.oilPaintV4ETest.drawContactBrushV2==='function'){
    // A genuine 30-hair footprint is useful only if it can resolve at
    // output pixel size. Small contacts retain the proven fast V1 brush.
    var physicalWidth=width*(A.oilStageCScale||1);
    if(physicalWidth>=(A.oilStageDRefinement===true?22:20) || A.oilStageCForceDetail===true)
      return A.oilPaintV4ETest.drawContactBrushV2(
        pig,mask,points,width,rgb,profile,r,options);
    if(A.oilStageCStats)
      A.oilStageCStats.fallbackCalls=(A.oilStageCStats.fallbackCalls||0)+1;
  }
  // Stage B experiment: cache frame-local quantities across all bristle tufts.
  // Historical Oil v1 uses the untouched calculations unless explicitly
  // opted in by the performance test (not a UI/share-link parameter).
  var optFrames=A.oilBrushPerfExperimental===true,
      perf=A.oilBrushPerfStats||null,startMs=perf?performance.now():0,
      frames=buildBrushFrames(points,width);
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
  if(optFrames){
    for(var fi=0;fi<frames.length;fi++){
      var frame=frames[fi],normal=frame.angle+PI/2;
      frame.cachedPressure=pressureAt(frame.s,total,phase,profile);
      frame.cachedFraction=frame.s/total;
      frame.normalX=Math.cos(normal);
      frame.normalY=Math.sin(normal);
    }
  }
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
            pressure=optFrames?item.cachedPressure:
              pressureAt(item.s,total,phase,profile),
            charge=minmax(item.load,0,1.35),
            taper=Math.min(1,(k+1)/4,(strip.length-k)/4),
            lateralDrift=jitter*Math.sin(item.s*.047+phaseT)+
              jitter*.55*Math.sin(item.s*.103+phaseT*.42),
            normalWidth=bundleWidth*pressure*(.56+.44*taper)*
              (.60+.40*charge)*(.92+.13*Math.sin(item.s*.061+phaseT)),
            q=optFrames?null:shift(item,turn,side*width*pressure+lateralDrift);
        if(optFrames){
          var lateral=side*width*pressure+lateralDrift,
              qx=item.x+item.normalX*lateral,
              qy=item.y+item.normalY*lateral;
          left.push({x:qx+item.normalX*(-normalWidth*.51),
                     y:qy+item.normalY*(-normalWidth*.51)});
          right.push({x:qx+item.normalX*(normalWidth*.49),
                      y:qy+item.normalY*(normalWidth*.49)});
        }else{
          left.push(shift(q,turn,-normalWidth*.51));
          right.push(shift(q,turn,normalWidth*.49));
        }
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
      var p=frames[i],t=optFrames?p.cachedFraction:p.s/total,
          pressureHere=optFrames?p.cachedPressure:
            pressureAt(p.s,total,phase,profile);
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
      if(optFrames){
        strip.push({x:p.x,y:p.y,angle:p.angle,s:p.s,load:load,
          cachedPressure:pressureHere,normalX:p.normalX,normalY:p.normalY});
      }else{
        strip.push({x:p.x,y:p.y,angle:p.angle,s:p.s,load:load});
      }
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
  if(perf){
    perf.calls=(perf.calls||0)+1;
    perf.totalMs=(perf.totalMs||0)+performance.now()-startMs;
    perf.frames=(perf.frames||0)+frames.length;
    perf.tufts=(perf.tufts||0)+count;
    perf.contacts=(perf.contacts||0)+contacts;
    perf.runs=(perf.runs||0)+runs;
  }
  return {bristleRuns:runs,bristleContacts:contacts,
    contactFootprints:footprints,loadStart:+(loadStart/count).toFixed(3),
    loadEnd:+(loadEnd/count).toFixed(3),
    pressureMin:+pMin.toFixed(3),pressureMax:+pMax.toFixed(3)};
}

function sampleWetCrossings(pig,field,pts,width,scale,sw,sh){
  var crossings=[],last=null,n=Math.min(20,Math.max(8,Math.round(pts.length/3)));
  // Stage E experiment: replace many synchronous 1x1 canvas readbacks
  // with one bounded read of the candidate region. Pixels are sampled
  // at the EXACT same integer locations in the SAME order. The width
  // cap avoids copying huge mostly-empty bounding rectangles.
  var batch=A.oilStageEBatchWetSample===true,buffer=null,minX=sw,
      minY=sh,maxX=-1,maxY=-1,samples=null,regionWidth=0,
      profile=A.oilStageEProfile||null;
  if(batch){
    samples=[];
    for(var j=1;j<n;j++){
      var position=Math.floor((j/n)*(pts.length-1)),
          point=pts[position],px=minmax(Math.round(point.x*scale),0,sw-1),
          py=minmax(Math.round(point.y*scale),0,sh-1);
      if(field[py*sw+px]<.23)continue;
      samples.push({at:position,p:point,x:px,y:py});
      if(px<minX)minX=px;if(px>maxX)maxX=px;
      if(py<minY)minY=py;if(py>maxY)maxY=py;
    }
    if(!samples.length)return crossings;
    regionWidth=maxX-minX+1;
    var regionHeight=maxY-minY+1,area=regionWidth*regionHeight;
    if(area<=65536){
      buffer=pig.getImageData(minX,minY,regionWidth,regionHeight).data;
      if(profile){
        profile.wetBatchCalls=(profile.wetBatchCalls||0)+1;
        profile.wetBatchPixels=(profile.wetBatchPixels||0)+area;
      }
    }else if(profile)profile.wetBatchFallbacks=(profile.wetBatchFallbacks||0)+1;
  }
  for(var i=1;i<n;i++){
    var at=Math.floor((i/n)*(pts.length-1));
    var p=pts[at],cx=minmax(Math.round(p.x*scale),0,sw-1),
        cy=minmax(Math.round(p.y*scale),0,sh-1);
    if(field[cy*sw+cx]<.23)continue;
    if(last&&dist(last,p)<width*.64)continue;
    var pixel;
    if(buffer){
      var byteOffset=4*((cy-minY)*regionWidth+(cx-minX));
      pixel=buffer.subarray(byteOffset,byteOffset+4);
    }else{
      pixel=pig.getImageData(cx,cy,1,1).data;
      if(profile&&batch)
        profile.wetSinglePixelCalls=(profile.wetSinglePixelCalls||0)+1;
    }
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
        angle=tangent(before,after),colour=A.oilPigmentActive?.mix?
          A.oilPigmentActive.mix(rgb,crossing.colour,.48+.36*strength):
          mix(rgb,crossing.colour,.48+.36*strength),
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
      rgb=A.oilPigmentActive?A.oilPigmentActive.mapRGB(ch.rgb):ch.rgb,edge=width*.85;
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
  // Profiling and a logically equivalent tight mask scan are opt-in
  // experiments only. Standard published Oil v1 follows the old path.
  var stageE=A.oilStageEProfile||null,
      profileStart=stageE?performance.now():0;
  // Sample true crossings before new paint is deposited; transfer locally.
  var crossings=sampleWetCrossings(pig,field,pts,width,scale,sw,sh);
  if(stageE)stageE.wetSampleMs=(stageE.wetSampleMs||0)+performance.now()-profileStart;
  profileStart=stageE?performance.now():0;
  var b=drawContactBrushV4e(pig,mask,pts,width,rgb,profile,r,options);
  if(stageE)stageE.contactMs=(stageE.contactMs||0)+performance.now()-profileStart;
  profileStart=stageE?performance.now():0;
  var dragged=dragCrossingPigment(pig,mask,crossings,pts,width,rgb,r,options);
  if(stageE)stageE.wetDragMs=(stageE.wetDragMs||0)+performance.now()-profileStart;
  profileStart=stageE?performance.now():0;
  var readX0=x0,readY0=y0,readX1=x1,readY1=y1;
  // Experimental *read-only* bounds: preserve the original, wider
  // clearing rectangle, so stale height-mask pixels never leak into
  // subsequent brush contacts. Only shrink no-pickup, no-massing marks.
  // Exact-PNG CI gates whether the inner margins contain all relief.
  if(A.oilStageETightMaskExperimental===true &&
     A.oilStageDRefinement===true && A.oilStageCExperimental===true &&
     crossings.length===0 && !ch.mass){
    var insetEdge=width*.70;
    readX0=Math.max(x0,minmax(Math.floor((Math.min.apply(null,xs)-insetEdge)*scale)-3,0,sw-1));
    readY0=Math.max(y0,minmax(Math.floor((Math.min.apply(null,ys)-insetEdge)*scale)-3,0,sh-1));
    readX1=Math.min(x1,minmax(Math.ceil((Math.max.apply(null,xs)+insetEdge)*scale)+3,readX0+1,sw));
    readY1=Math.min(y1,minmax(Math.ceil((Math.max.apply(null,ys)+insetEdge)*scale)+3,readY0+1,sh));
  }
  var pixels=mask.getImageData(readX0,readY0,readX1-readX0,readY1-readY0).data,
      bw=readX1-readX0,bh=readY1-readY0,amount=.50+thickness*.62;
  if(stageE){
    stageE.maskReadMs=(stageE.maskReadMs||0)+performance.now()-profileStart;
    stageE.maskPixelsSaved=(stageE.maskPixelsSaved||0)+
      (x1-x0)*(y1-y0)-bw*bh;
  }
  profileStart=stageE?performance.now():0;
  if(A.oilStageEMaskScanExperimental===true){
    // Exactly the same pixels and row-major update order, with one
    // incremental byte index per sample (avoids repeated multiplications).
    // Preserve alpha threshold and Float32 field accumulation unchanged.
    for(var yy=0;yy<bh;yy++){
      var fieldIndex=(yy+readY0)*sw+readX0,
          endFieldIndex=fieldIndex+bw,
          alphaIndex=(yy*bw)*4+3;
      for(;fieldIndex<endFieldIndex;fieldIndex++,alphaIndex+=4){
        var ink=pixels[alphaIndex]/255;
        if(ink>.008)field[fieldIndex]=addPaintHeight(field[fieldIndex],ink,amount);
      }
    }
  }else{
    for(var yy=0;yy<bh;yy++){
      var row=(yy+readY0)*sw+readX0,trow=yy*bw;
      for(var xx=0;xx<bw;xx++){
        var ink=pixels[(trow+xx)*4+3]/255;
        if(ink>.008){var index2=row+xx;
          field[index2]=addPaintHeight(field[index2],ink,amount)}
      }
    }
  }
  if(stageE){
    stageE.maskScanMs=(stageE.maskScanMs||0)+performance.now()-profileStart;
    stageE.maskReadPixels=(stageE.maskReadPixels||0)+bw*bh;
    stageE.strokes=(stageE.strokes||0)+1;
    stageE.wetCrossings=(stageE.wetCrossings||0)+crossings.length;
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
function ground(ctx,w,h,seed,r,paper){
  // Actual primed oil canvas uses the selected Paper colour. Keep its tooth
  // and seeded brushwork unchanged; missing Paper retains legacy cream.
  ctx.fillStyle=paper||'#f5f0e6';ctx.fillRect(0,0,w,h);
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
// Stage E: exact alternative to repeated opticalRelief() calls.
// The calling adapter precomputes Math.log1p(height*.66) once per pixel.
// Float64 precision preserves the original numerical formula and allows
// bit-for-bit oil RGB output; keep release V1 on the original function.
function surfaceLightingCached(optical,w,h,x,y,relief){
  var p=y*w+x,centre=optical[p],
      lx=optical[p-1],rx=optical[p+1],
      ty=optical[p-w],by=optical[p+w],
      lx3=optical[p-3],rx3=optical[p+3],
      ty3=optical[p-w*3],by3=optical[p+w*3],
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
// Seven-row sliding cache version: only heights at y-3, y-1, y, y+1,
// and y+3 are required by the physical ridge-lighting formula.
// The caller updates the ring after each raster row. Output is exactly
// equivalent to surfaceLighting() and uses O(width), not O(width*height), RAM.
function surfaceLightingCachedRows(rows,x,y,relief){
  var centre=rows[y%7][x],
      lx=rows[y%7][x-1],rx=rows[y%7][x+1],
      ty=rows[(y-1)%7][x],by=rows[(y+1)%7][x],
      lx3=rows[y%7][x-3],rx3=rows[y%7][x+3],
      ty3=rows[(y-3)%7][x],by3=rows[(y+3)%7][x],
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
  // Experimental only: the V5 planner already captured these exact marker
  // paths. Reuse them rather than running the source generator a second time.
  // Oil V1 and every other material keep the original capture path by default.
  if(opts.reuseCompositionCapture===true &&
     opts.sourceCapture && Array.isArray(opts.sourceCapture.paths) &&
     opts.sourceCapture.meta){
    rec.paths=opts.sourceCapture.paths;
    sourceMeta=opts.sourceCapture.meta;
  }else{
    try{
      A.svgRecorder=rec;
      A.phiFramingEnabled=opts.phiFraming===true;
      sourceMeta=A.render(scratch,settings,Math.min(.22,scale),false);
    }finally{
      A.svgRecorder=oldRecorder;A.phiFramingEnabled=oldFit;
      A.lastRenderMeta=oldMeta;
    }
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
  ground(ctx,w,h,settings.seed,r,settings.paper);
  // Walkthrough-only snapshots of real source strokes. The renderer's paint
  // sequence and final output are unchanged; only the first strokes are copied.
  var earlyOilCapture=A.materialStageCapture;
  var earlyOilCount=0;
  if(earlyOilCapture)earlyOilCapture('oil-ground',pigment);
  phase.planMs=+(performance.now()-start-phase.captureMs).toFixed(2);
  var profiles={flat:0,filbert:0,dry:0,knife:0},dragMarks=0,painted=0,massArea=0,bristleRuns=0,pickupMarks=0,wetDragMarks=0,bristleContacts=0,paintPatches=0,contactFootprints=0,loadStart=0,loadEnd=0,pressureMin=2,pressureMax=0;
  var paintStart=performance.now();
  for(var i=0;i<chains.length;i++){
    var result=paintOne(ctx,mask,chains[i],r,i,opts,field,sw,sh,scale,settings.mode);
    if(result){
      if(earlyOilCapture&&earlyOilCount<12){
        earlyOilCount++;
        earlyOilCapture('oil-source-stroke-'+earlyOilCount,pigment);
      }
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
    // Keep the V8 composition metadata captured by the REAL source renderer.
    // Reveal, hit-testing and Describe use its guide/voids/strategy; this
    // changes no pigment pixels and does not alter historic material paths.
    sourceRenderMeta:sourceMeta,
    height:shaded,phases:phase,sourceMeta:sourceMeta&&sourceMeta.strategy};
  return A.lastOilPaintV4EStats;
};

A.oilPaintV4ETest={pressureAt:pressureAt,buildBrushFrames:buildBrushFrames,
  drawBrushLab:drawBrushLab,drawContactBrush:drawContactBrushV4e,
  sampleWetCrossings:sampleWetCrossings,dragCrossingPigment:dragCrossingPigment,
  surfaceLighting:surfaceLighting,surfaceLightingCached:surfaceLightingCached,
  surfaceLightingCachedRows:surfaceLightingCachedRows,
  drawWetCrossingLab:drawWetCrossingLab,
  addPaintHeight:addPaintHeight};
})(window.AlgoArt);


// ---- composition-interpret-v5.js ----
// ALGO/ART V5 experimental shared composition interpretation.
// Material-neutral: no pigment, pressure, cut-paper or brush rendering here.
// Faithful mode is handled by the existing, unchanged material renderers.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var VERSION='v5b-plan-2',PI=Math.PI;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function between(a,b,t){return{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)}}
function rgb(s){
  var m=String(s||'').match(/^#([0-9a-f]{6})$/i);
  if(m)return [0,2,4].map(function(k){return parseInt(m[1].slice(k,k+2),16)});
  m=String(s||'').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(m)return [+m[1],+m[2],+m[3]];
  m=String(s||'').match(/^hsl\(\s*([\d.]+)(?:deg)?(?:\s+|,\s*)([\d.]+)%(?:\s+|,\s*)([\d.]+)%/i);
  if(!m)return null;
  var h=(+m[1]%360+360)%360/60,l=+m[3]/100,sat=+m[2]/100,
      c=(1-Math.abs(2*l-1))*sat,x=c*(1-Math.abs(h%2-1)),o=l-c/2;
  return (h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:
    h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x]).map(function(v){
      return Math.round(clamp((v+o)*255,0,255))});
}
function parsePath(src){
  var tok=String(src.d||'').match(/[MLC]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)||[],
      pts=[],i=0,cmd='',prev=null;
  function read(){return +tok[i++]}
  while(i<tok.length&&pts.length<1200){
    if(/^[MLC]$/.test(tok[i])){cmd=tok[i++];continue}
    if((cmd==='M'||cmd==='L')&&i+1<tok.length){
      prev={x:read(),y:read()};pts.push(prev);cmd='L';
    }else if(cmd==='C'&&prev&&i+5<tok.length){
      var a={x:read(),y:read()},b={x:read(),y:read()},c={x:read(),y:read()},from=prev,
          count=Math.max(5,Math.min(12,Math.round(dist(from,c)/13)));
      for(var k=1;k<=count;k++){
        var t=k/count,u=1-t;pts.push({x:u*u*u*from.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*c.x,
          y:u*u*u*from.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*c.y});
      }
      prev=c;cmd='L';
    }else break;
  }
  if(src.transform){
    var mat=String(src.transform).match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi);
    if(mat&&mat.length===6){mat=mat.map(Number);
      pts=pts.map(function(p){return{x:mat[0]*p.x+mat[2]*p.y+mat[4],
        y:mat[1]*p.x+mat[3]*p.y+mat[5]}});
    }
  }
  return pts;
}
function inVoid(x,y,voids,radius){
  for(var i=0;i<voids.length;i++){
    var v=voids[i];if(!v||!Number.isFinite(+v.x)||!Number.isFinite(+v.y)||
      !Number.isFinite(+v.w)||!Number.isFinite(+v.h))continue;
    if(x>=v.x-radius&&x<=v.x+v.w+radius&&
      y>=v.y-radius&&y<=v.y+v.h+radius)return true;
  }
  return false;
}
function hash(s){return A.hash(s)>>>0}
function seeded(s){var state=hash(s);return function(){
  state=(state+0x6D2B79F5)>>>0;
  var t=state;t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}}
function extract(paths){
  var unique=new Set(),chains=[];
  for(var i=0;i<paths.length;i++){
    var colour=rgb(paths[i].stroke);if(!colour)continue;
    var points=parsePath(paths[i]);if(points.length<2)continue;
    var length=0;for(var j=1;j<points.length;j++)length+=dist(points[j-1],points[j]);
    if(length<9)continue;
    var first=points[0],last=points[points.length-1],
        key=[Math.round(first.x/5),Math.round(first.y/5),
          Math.round(last.x/5),Math.round(last.y/5),
          Math.round(length/15),colour.join(',')].join('|');
    if(unique.has(key))continue;unique.add(key);
    var mid=points[Math.floor(points.length/2)],
        theta=Math.atan2(last.y-first.y,last.x-first.x);
    chains.push({sourceIndex:i,pts:points,first:first,last:last,mid:mid,
      length:length,width:paths[i].width||3,rgb:colour,angle:theta});
  }
  return chains;
}
function captureSource(settings,opts){
  opts=opts||{};
  var priorRecorder=A.svgRecorder,priorMeta=A.lastRenderMeta,
      priorPhi=A.phiFramingEnabled,
      rec={precise:true,paths:[],paperMarks:[]},meta;
  try{
    A.svgRecorder=rec;A.phiFramingEnabled=opts.phiFraming===true;
    meta=A.render(document.createElement('canvas'),settings,.18,false);
  }finally{
    A.svgRecorder=priorRecorder;A.lastRenderMeta=priorMeta;
    A.phiFramingEnabled=priorPhi;
  }
  return {paths:rec.paths,meta:meta,chains:extract(rec.paths)};
}
function planFromSource(source,settings,opts){
  opts=opts||{};
  var w=settings.orientation==='portrait'?1000:1400,
      h=settings.orientation==='portrait'?1400:1000,
      seed=String(settings.seed||'no-seed')+'|'+VERSION+'|'+String(settings.mode||''),
      rand=seeded(seed),voids=source.meta&&Array.isArray(source.meta.voids)?
        source.meta.voids:[],
      chains=source.chains||extract(source.paths||[]),
      candidates=[],regions=[],maxRegions=opts.maxRegions||32;
  // Choose stable, source-attached candidate centroids. Long paths dominate,
  // but short accents are retained in an independent detail layer.
  for(var i=0;i<chains.length;i++){
    var c=chains[i],stride=Math.max(1,Math.floor(c.pts.length/3));
    for(var j=0;j<c.pts.length-1;j+=stride){
      var p=c.pts[j],q=c.pts[Math.min(j+stride,c.pts.length-1)],
          angle=Math.atan2(q.y-p.y,q.x-p.x);
      if(!Number.isFinite(angle)||dist(p,q)<3)continue;
      candidates.push({x:(p.x+q.x)*.5,y:(p.y+q.y)*.5,
        angle:angle,sourceIndex:c.sourceIndex,colour:c.rgb,
        pathLength:c.length,length:dist(p,q),score:Math.min(380,c.length)*(.55+.5*rand()),
        width:c.width});
      if(candidates.length>1500)break;
    }
    if(candidates.length>1500)break;
  }
  candidates.sort(function(a,b){return b.score-a.score||
    a.sourceIndex-b.sourceIndex});
  for(i=0;i<candidates.length&&regions.length<maxRegions;i++){
    var a=candidates[i];
    if(a.x<20||a.y<20||a.x>w-20||a.y>h-20)continue;
    var neighbours=[],weighted=0,colorSum=[0,0,0];
    for(j=0;j<candidates.length&&j<900;j++){
      var b=candidates[j],d=Math.hypot(b.x-a.x,b.y-a.y);
      if(d>95)continue;
      var delta=Math.abs(Math.cos(a.angle-b.angle)),
          chroma=Math.hypot(a.colour[0]-b.colour[0],
            a.colour[1]-b.colour[1],a.colour[2]-b.colour[2]);
      if(chroma>92||delta<.42)continue;
      neighbours.push({candidate:b,dist:d});
      var weight=1/(1+d*.03);
      weighted+=weight;
      for(var k=0;k<3;k++)colorSum[k]+=b.colour[k]*weight;
      if(neighbours.length>=12)break;
    }
    if(neighbours.length<2)continue;
    var spread=Math.min(97,20+neighbours.length*4.9),
        length=clamp(a.length*.85+neighbours.length*5.0,42,185),
        breadth=clamp(spread*.9,28,88),
        tooNear=regions.some(function(v){return Math.hypot(v.x-a.x,v.y-a.y)<
          Math.max(28,Math.min(v.width,breadth)*.82)});
    if(tooNear)continue;
    // Multiple capsule-support points must stay outside reserved voids;
    // never bridge disjoint focal islands with a convex-hull fill.
    var radius=breadth*.56,
        x1=a.x-Math.cos(a.angle)*length*.42,
        y1=a.y-Math.sin(a.angle)*length*.42,
        x2=a.x+Math.cos(a.angle)*length*.42,
        y2=a.y+Math.sin(a.angle)*length*.42;
    if(inVoid(a.x,a.y,voids,radius)||inVoid(x1,y1,voids,radius)||
      inVoid(x2,y2,voids,radius))continue;
    var contour=[],shapeRand=seeded(seed+'|outline|'+a.sourceIndex+'|'+i);
    // A material-neutral, source-local area footprint; curved tapered
    // boundary is a *composition* polygon, not oil bristles or tissue tears.
    for(var edge=0;edge<2;edge++){
      for(var tIndex=0;tIndex<=10;tIndex++){
        var t=edge===0?tIndex/10:(10-tIndex)/10,
            taper=Math.pow(Math.max(.07,Math.sin(PI*t)),.30),
            tangentDistance=(t-.5)*length,
            sideDistance=(edge===0?-1:1)*breadth*.52*taper*
              (.89+.16*shapeRand());
        contour.push({
          x:+(a.x+Math.cos(a.angle)*tangentDistance-
            Math.sin(a.angle)*sideDistance).toFixed(2),
          y:+(a.y+Math.sin(a.angle)*tangentDistance+
            Math.cos(a.angle)*sideDistance).toFixed(2)
        });
      }
    }
    regions.push({id:'R'+regions.length,pass:'mass',x:+a.x.toFixed(2),
      y:+a.y.toFixed(2),angle:+a.angle.toFixed(5),
      length:+length.toFixed(2),width:+breadth.toFixed(2),
      rgb:colorSum.map(function(v){return Math.round(v/weighted)}),
      sources:[...new Set(neighbours.map(function(n){return n.candidate.sourceIndex}))].slice(0,12),
      contour:contour,density:neighbours.length,seed:hash(seed+'|region|'+a.sourceIndex+'|'+j)});
  }
  // Separate medium and accent gestures. These represent the same
  // geometry but with less broad coverage; adapters decide their material.
  var gestures=regions.map(function(v,i){return{id:'G'+i,pass:'gesture',
    parent:v.id,x:v.x,y:v.y,angle:v.angle,length:v.length*.78,
    width:v.width*.26,rgb:v.rgb,sources:v.sources.slice(),
    seed:hash(seed+'|gesture|'+i)}});
  var accents=candidates.slice(0,Math.min(16,candidates.length)).filter(function(c){
    return !inVoid(c.x,c.y,voids,6)}).map(function(c,i){
    return{id:'A'+i,pass:'accent',x:c.x,y:c.y,angle:c.angle,
      length:clamp(c.length*.54,8,46),width:Math.max(2,c.width*.65),
      rgb:c.colour,sources:[c.sourceIndex],seed:hash(seed+'|accent|'+i)}});
  return {version:VERSION,seed:settings.seed,mode:settings.mode,
    orientation:settings.orientation,width:w,height:h,phiFraming:opts.phiFraming===true,
    sourcePaths:source.paths.length,eligibleChains:chains.length,
    protectedVoids:voids.map(function(v){return{x:v.x,y:v.y,w:v.w,h:v.h}}),
    regions:regions,gestures:gestures,accents:accents,
    interpretation:'areas'};
}
A.captureCompositionV5=captureSource;
A.planCompositionV5=function(settings,opts){
  var source=captureSource(settings,opts);return planFromSource(source,settings,opts);
};
A.planCompositionV5FromSource=planFromSource;
A.compositionV5Version=VERSION;
A.compositionV5Test={parsePath:parsePath,extract:extract,inVoid:inVoid,seeded:seeded};
})(window.AlgoArt);


// ---- v5-material-adapters.js ----
// ALGO/ART V5 experimental material adapters for ONE shared interpretation.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}
function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.
function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0;
  for(var i=0;i<plan.regions.length;i++){
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<plan.gestures.length;i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.
function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<plan.regions.length;i++){
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<plan.gestures.length;i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,graphiteGestures:lines};
}
A.renderInterpretedV5=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5b-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5b-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5Interpretation=stats;
  return stats;
};
})(window.AlgoArt);


// ---- composition-territories-v5c.js ----
// ALGO/ART V5c: material-neutral semantic territories.
// Interpret existing generator metadata rather than infer painted areas
// from stroke proximity alone. Adds no new source composition or material.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PHI=(1+Math.sqrt(5))/2,VERSION='v5c-territories-1';
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function inside(p,v,margin){
  margin=margin||0;
  return p.x>=v.x+margin&&p.x<=v.x+v.w-margin&&
    p.y>=v.y+margin&&p.y<=v.y+v.h-margin;
}
function overlaps(a,b){
  return a.x<b.x+b.w&&a.x+a.w>b.x&&
    a.y<b.y+b.h&&a.y+a.h>b.y;
}
function sq(a,b){var x=a.x-b.x,y=a.y-b.y;return x*x+y*y}
function rect(c,margin){
  return{x:c.x+margin,y:c.y+margin,
    w:Math.max(0,c.w-2*margin),h:Math.max(0,c.h-2*margin)};
}
function shapeFromRect(c,seed){
  // Composition geometry, not physically torn or bristled edges.
  // A small inset preserves clear distinct rectangular φ territories.
  var r=Math.min(c.w,c.h)*(.055+.025*((A.hash(seed)>>>0)/4294967295));
  return [
    {x:+(c.x+r).toFixed(2),y:+(c.y+r).toFixed(2)},
    {x:+(c.x+c.w-r).toFixed(2),y:+(c.y+r).toFixed(2)},
    {x:+(c.x+c.w-r).toFixed(2),y:+(c.y+c.h-r).toFixed(2)},
    {x:+(c.x+r).toFixed(2),y:+(c.y+c.h-r).toFixed(2)}
  ];
}
function sourceSupport(cell,chains){
  var hits=[],totalInside=0,cx=cell.x+cell.w*.5,
      cy=cell.y+cell.h*.5,
      inset=Math.min(cell.w,cell.h)*.045,
      interior=rect(cell,inset);
  for(var i=0;i<chains.length;i++){
    var c=chains[i],n=c.pts.length,
        insideCount=0,insideStrong=0,samples=0;
    for(var j=0;j<n;j+=Math.max(1,Math.floor(n/14))){
      samples++;
      var p=c.pts[j];
      if(inside(p,cell,-1.5)){
        insideCount++;
        if(inside(p,interior,0))insideStrong++;
      }
    }
    if(!insideCount)continue;
    // Long perimeter or global framing strokes are often present in many
    // cells. A mark mostly LOCAL to this cell should dominate its colour.
    var locality=insideCount/Math.max(samples,1),
        weight=Math.sqrt(Math.max(3,c.length))*insideCount*
          (.14+.86*locality*locality)*
          (1+.075*insideStrong);
    hits.push({id:c.sourceIndex,weight:weight,
      inner:insideStrong,rgb:c.rgb,locality:locality});
    totalInside+=insideStrong;
  }
  hits.sort(function(a,b){return b.weight-a.weight||a.id-b.id});
  // Average only hues genuinely belonging to the dominant pigment family,
  // never all unrelated nearby hues: the latter created brown/grey soup
  // in the first V5c Recursive Divisions colour planes.
  var colour=null;
  if(hits.length){
    var best=hits[0],sum=0,acc=[0,0,0];
    for(i=0;i<hits.length;i++){
      var h=hits[i],d=Math.hypot(
        best.rgb[0]-h.rgb[0],best.rgb[1]-h.rgb[1],best.rgb[2]-h.rgb[2]);
      if(d>62)continue;
      var weight=h.weight;
      sum+=weight;
      for(var k=0;k<3;k++)acc[k]+=h.rgb[k]*weight;
    }
    colour=acc.map(function(v){return Math.round(v/Math.max(sum,.0001))});
  }
  return {sources:hits.slice(0,12).map(function(v){return v.id}),
    rgb:colour,strokes:hits.length,inside:totalInside,
    weight:hits.reduce(function(a,v){return a+v.weight},0),
    centre:{x:cx,y:cy}};
}
function hasInteriorCut(cell,protectedVoids){
  for(var i=0;i<protectedVoids.length;i++){
    if(overlaps(cell,protectedVoids[i]))return true;
  }
  return false;
}
function addRectTerritories(plan,source,opts){
  var guide=source.meta&&source.meta.guide,
      cells=guide&&Array.isArray(guide.cells)?guide.cells:[],
      chains=source.chains||A.compositionV5Test.extract(source.paths||[]),
      w=plan.width,h=plan.height,covered=[],eligible=[];
  for(var i=0;i<cells.length;i++){
    var c=cells[i];
    if(!c||!['x','y','w','h'].every(function(k){return Number.isFinite(c[k])}))continue;
    if(c.w<21||c.h<21||c.x<0||c.y<0||
      c.x+c.w>w+1||c.y+c.h>h+1)continue;
    // The generator's explicit voids take priority over all candidate cells.
    if(hasInteriorCut(c,plan.protectedVoids))continue;
    var support=sourceSupport(c,chains);
    if(!support.rgb||!support.sources.length)continue;
    var id='T'+eligible.length,
        shape=shapeFromRect(c,String(plan.seed)+'|'+i),
        bounding=rect(c,Math.min(c.w,c.h)*.055);
    eligible.push({id:id,role:'framed',kind:'rect-cell',
      x:+(c.x+c.w*.5).toFixed(2),y:+(c.y+c.h*.5).toFixed(2),
      width:+c.w.toFixed(2),height:+c.h.toFixed(2),
      box:{x:c.x,y:c.y,w:c.w,h:c.h},
      area:+(c.w*c.h).toFixed(1),
      depth:c.depth||0,sourceIndices:support.sources,
      sources:support.sources.slice(),rgb:support.rgb,
      interiorEvidence:support.inside,inkSources:support.strokes,
      contour:shape,seed:A.hash(plan.seed+'|v5c-territory|'+i)>>>0,
      fillFraction:0});
  }
  // Do not confuse all bordered cells with filled areas. Select areas
  // that contain marks, while explicitly preserving many framed interiors.
  var ranked=eligible.slice().sort(function(a,b){
    var sa=(a.interiorEvidence>1?6:0)+
      Math.min(4,a.inkSources)+Math.sqrt(a.area)/75+
      ((a.seed%71)/71)*.38;
    var sb=(b.interiorEvidence>1?6:0)+
      Math.min(4,b.inkSources)+Math.sqrt(b.area)/75+
      ((b.seed%71)/71)*.38;
    return sb-sa||a.id.localeCompare(b.id);
  });
  var target=Math.min(opts.maxTerritories||12,
    Math.max(2,Math.floor(ranked.length*(guide.variant==='FRAMED'?.34:.52))));
  for(i=0;i<target&&i<ranked.length;i++){
    var territory=ranked[i];
    if(territory.interiorEvidence===0)continue;
    territory.role='painted';
    territory.fillFraction=.83;
  }
  plan.territories=eligible;
  plan.territoryStats={
    total:eligible.length,
    painted:eligible.filter(function(v){return v.role==='painted'}).length,
    framed:eligible.filter(function(v){return v.role==='framed'}).length,
    skippedReserved:cells.length-eligible.length
  };
}
function intersectsProtected(contour,voids){
  // A mass cannot silently span a protected void. Sample edges as well as
  // vertices; the renderer clips as a second and independent safety layer.
  if(!contour||contour.length<3)return false;
  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    // Prevent plans from placing paint into the explicit source void.
    for(var j=0;j<contour.length;j++){
      var a=contour[j],b=contour[(j+1)%contour.length];
      for(var k=0;k<=8;k++){
        var p={x:a.x+(b.x-a.x)*k/8,y:a.y+(b.y-a.y)*k/8};
        if(inside(p,v,0))return true;
      }
    }
    var cx=v.x+v.w*.5,cy=v.y+v.h*.5;
    // Circumvent a filled area wrapping all four corners of a void.
    if(pointInPolygon({x:cx,y:cy},contour))return true;
  }
  return false;
}
function pointInPolygon(p,poly){
  var insidePoly=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)insidePoly=!insidePoly;
  }
  return insidePoly;
}
function enrich(source,settings,opts){
  opts=opts||{};
  var plan=A.compositionV5BaseFromSource(source,settings,opts);
  plan.version=VERSION;
  plan.interpretation='semantic-territories';
  plan.territories=[];
  plan.territoryStats={total:0,painted:0,framed:0,skippedReserved:0};
  plan.sourceGuideKind=source.meta&&source.meta.guide&&source.meta.guide.type||'unknown';
  plan.regionKinds={mass:0,gesture:0,protected:plan.protectedVoids.length};
  // Guide-annotated rectangles are actual φ-subdivision cells, not assumed
  // closed arbitrary Marker curves. Other engines stay source-local.
  if(settings.mode==='rects'&&plan.sourceGuideKind==='rects')
    addRectTerritories(plan,source,opts);
  var filtered=[];
  for(var i=0;i<plan.regions.length;i++){
    var m=plan.regions[i];
    if(intersectsProtected(m.contour,plan.protectedVoids))continue;
    m.kind='directional-mass';
    m.role='gesture-field';
    filtered.push(m);
  }
  plan.regions=filtered;
  plan.regionKinds.mass=filtered.length;
  plan.regionKinds.gesture=plan.gestures.length;
  // In rectilinear mode the planned cells, not random nearby line clusters,
  // are responsible for broad colour blocking. The latter remain small
  // directional marks and can be disabled by a material adapter.
  for(i=0;i<plan.gestures.length;i++)
    plan.gestures[i].kind='directional-gesture';
  return plan;
}
if(!A.planCompositionV5FromSource||!A.captureCompositionV5)
  throw Error('Load shared V5 planner before V5c semantic territories');
A.compositionV5BaseFromSource=A.planCompositionV5FromSource;
A.planCompositionV5FromSource=enrich;
A.planCompositionV5=function(settings,opts){
  return enrich(A.captureCompositionV5(settings,opts),settings,opts);
};
A.compositionV5Version=VERSION;
A.compositionV5cTest={
  sourceSupport:sourceSupport,overlaps:overlaps,pointInPolygon:pointInPolygon,
  intersectsProtected:intersectsProtected
};
})(window.AlgoArt);


// ---- v5c-material-adapters.js ----
// ALGO/ART V5 experimental material adapters for ONE shared interpretation.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}
function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0;
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=oilTerritory(ctx,mask,cell,cell.rgb,
        cell.seed,painter);
    }
  }
  for(var i=0;i<plan.regions.length;i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<plan.gestures.length;i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}

function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0;
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=tissueTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<plan.regions.length;i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<plan.gestures.length;i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    graphiteGestures:lines};
}
A.renderInterpretedV5C=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5c-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5c-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5CInterpretation=stats;
  return stats;
};
})(window.AlgoArt);


// ---- composition-guides-v5d.js ----
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


// ---- v5d-material-adapters.js ----
// ALGO/ART V5 experimental material adapters for ONE shared interpretation.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}
function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0;
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<plan.regions.length;i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<plan.gestures.length;i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}

function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0;
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<plan.regions.length;i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<plan.gestures.length;i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    graphiteGestures:lines};
}
A.renderInterpretedV5D=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5d-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5d-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5DInterpretation=stats;
  return stats;
};
})(window.AlgoArt);


// ---- composition-colour-fields-v5e.js ----
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
  if(!points.length)return [];
  var raw=hull(points),bb=bounds(points),cx=bb.x+bb.w*.5,cy=bb.y+bb.h*.5,
      random=A.makeR(String(seed)),outline=[];
  if(raw.length<3||bb.w<20||bb.h<20){
    var angle=points.length===1?(seed%29)*Math.PI/29:
      Math.atan2(points[points.length-1].y-points[0].y,
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

function localPalette(source,centre,sourcePoints,first,reach){
  var chains=source.chains||A.compositionV5Test.extract(source.paths||[]),
      hits=[];
  for(var i=0;i<chains.length;i++){
    var c=chains[i],minimum=Infinity,stride=Math.max(1,Math.floor(c.pts.length/24));
    for(var j=0;j<c.pts.length;j+=stride){
      var p=c.pts[j];for(var k=0;k<sourcePoints.length;k++){
        minimum=Math.min(minimum,d(p,sourcePoints[k]));
      }
    }
    if(minimum<=reach)hits.push({distance:minimum,rgb:c.rgb,index:c.sourceIndex,
      weight:Math.sqrt(c.length)});
  }
  hits.sort(function(a,b){return a.distance-b.distance||
    b.weight-a.weight||a.index-b.index});
  var palette=[first];
  for(var i=0;i<hits.length&&palette.length<4;i++){
    var rgb=hits[i].rgb;
    if(palette.some(function(a){return Math.hypot(a[0]-rgb[0],
      a[1]-rgb[1],a[2]-rgb[2])<55}))continue;
    palette.push(rgb);
  }
  return palette;
}

function makeField(plan,src,guideId,points,margin,mode,groupIndex){
  var contour=broadContour(points,margin,hash(plan.seed+'|'+guideId),plan);
  if(contour.length<6)return null;
  var colour=A.compositionV5dTest.sourcePigment(points,src,
    Math.max(margin*1.4,90));
  if(!colour||!colour.sources.length)return null;
  var box=bounds(contour),cx=box.x+box.w/2,cy=box.y+box.h/2,
      surface=Math.round(box.w*box.h),
      colours=localPalette(src,{x:cx,y:cy},points,colour.rgb,margin*1.8);
  if(surface<9000)return null;
  return {id:'F'+plan.colourFields.length,kind:'source-colour-field',
    role:'painted',guideId:guideId,guideIndex:groupIndex,
    mode:mode,x:+cx.toFixed(2),y:+cy.toFixed(2),
    width:+box.w.toFixed(2),height:+box.h.toFixed(2),
    box:box,area:surface,contour:contour,sourcePoints:points.length,
    sources:colour.sources.slice(),sourceIndices:colour.sources.slice(),
    rgb:colour.rgb,palette:colours,
    seed:hash(plan.seed+'|v5e-field|'+guideId),
    fillFraction:.83};
}
function organicGroups(guide,plan){
  var groups=new Map(),segs=guide.segments||[];
  for(var i=0;i<segs.length;i++){
    var seg=segs[i];if(seg.depth>4)continue;
    var key=seg.branch,entry=groups.get(key)||{root:[],crown:[]};
    if(seg.depth<=1){
      entry.root.push({x:seg.x1,y:seg.y1},{x:seg.x2,y:seg.y2});
    }
    if(seg.depth>=1){
      entry.crown.push({x:seg.x1,y:seg.y1},{x:seg.x2,y:seg.y2});
    }
    groups.set(key,entry);
  }
  // More than one source-derived colour field per growth hierarchy:
  // split basal branches and canopy instead of a huge uniform shape.
  var out=[];
  for(const [branch,data] of groups){
    if(data.crown.length>=4)out.push({
      id:'growth-'+branch+'-canopy',points:data.crown,padding:70});
    if(data.root.length>=4)out.push({
      id:'growth-'+branch+'-base',points:data.root,padding:75});
  }
  return out;
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
        .sort(function(a,b){return b.size-a.size}),
      chosen=heroes.slice(0,2);
  if(!chosen.length)chosen=items.slice().sort(function(a,b){
    return b.size-a.size}).slice(0,1);
  // One hero does not imply only one colour field: nearby major supporting
  // objects can have their own physically painted areas.
  var extras=items.filter(function(v){return !chosen.includes(v)})
    .sort(function(a,b){return b.size-a.size});
  for(var k=0;k<extras.length&&chosen.length<4;k++){
    var candidate=extras[k],separated=chosen.every(function(h){
      return d(h,candidate)>Math.max(74,Math.min(h.size,candidate.size)*.55)});
    if(separated)chosen.push(candidate);
  }
  return chosen.map(function(anchor,index){
    var primary=index===0,
        radius=primary?Math.max(190,anchor.size*1.23):
          Math.max(115,anchor.size*.85),
        satellites=items.filter(function(v){
          return v!==anchor&&d(v,anchor)<radius})
          .sort(function(a,b){return d(a,anchor)-d(b,anchor)})
          .slice(0,primary?7:3),
        points=[anchor].concat(satellites).map(function(i){
          return{x:i.x,y:i.y}});
    return{id:'constructed-field-'+index,points:points,
      // Broad primary compositional colour plane + smaller supporting fields.
      // The primary field should cover spaces BETWEEN original objects.
      padding:primary?clamp(anchor.size*.55,85,150):
        clamp(anchor.size*.43,68,112)};
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
      return d(old,candidate)<Math.min(old.width,old.height)*.19});
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


// ---- v5e-material-adapters.js ----
// ALGO/ART V5 experimental material adapters for ONE shared interpretation.
// Existing Oil V4e and Tissue & Graphite V7 remain byte-identical by default.
// This module is not loaded by the live site, galleries, or social pipelines.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI,TAU=PI*2;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hex(c){return 'rgb('+c.map(function(v){return Math.round(clamp(v,0,255))}).join(',')+')'}
function blend(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rng(seed){return A.makeR(String(seed))}
function point(c,d){return {x:c.x+Math.cos(c.angle)*d,y:c.y+Math.sin(c.angle)*d}}
function shifted(p,angle,d){return{x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d}}
function clippedToVoids(ctx,plan){
  if(!plan.protectedVoids.length)return;
  var p=new Path2D();p.rect(0,0,plan.width,plan.height);
  for(var i=0;i<plan.protectedVoids.length;i++){
    var v=plan.protectedVoids[i];
    if([v.x,v.y,v.w,v.h].every(Number.isFinite))
      p.rect(v.x,v.y,v.w,v.h);
  }
  ctx.clip(p,'evenodd');
}
function massContour(region){
  var pts=region.contour||[],path=new Path2D();
  if(pts.length<3)return path;
  path.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)path.lineTo(pts[i].x,pts[i].y);
  path.closePath();return path;
}
function baseline(target,s,scale,material,opts){
  if(material==='oil'){
    return A.renderOilPaintV4E(target,s,scale,{
      phiFraming:opts.phiFraming===true,
      thickness:.90,drag:.72,bristles:.92,massing:.44,relief:.87,
      wetDrag:.72});
  }
  if(material==='tissue'){
    var fit=A.phiFramingEnabled,meta=A.lastRenderMeta;
    try{
      A.phiFramingEnabled=opts.phiFraming===true;
      return A.renderOil(target,s,scale,false,7);
    }finally{A.phiFramingEnabled=fit;A.lastRenderMeta=meta}
  }
  throw Error('Unsupported V5 prototype material: '+material);
}
// The oil adapter reuses actual V4e loaded bristle deposition, not marker
// polygon fill with an oil-looking Photoshop filter. Its dedicated layer
// receives colour and height from exactly the same brush footprints.

function oilTerritory(ctx,mask,cell,rgb,sourceSeed,painter){
  var shape=massContour(cell),r=rng(sourceSeed+'|v5c-oil'),
      margin=Math.min(cell.width,cell.height)*.13,
      start=cell.box.x+margin,end=cell.box.x+cell.box.w-margin,
      top=cell.box.y+margin,bottom=cell.box.y+cell.box.h-margin,
      dx=end-start,dy=bottom-top,count=Math.max(2,Math.min(6,
        Math.round(dy/Math.max(22,cell.height*.23)))),
      deposits=0;
  // The underlying block is driven by the actual φ-cell footprint.
  // Loaded bristles break up the surface; not just a texture on a polygon.
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  ctx.globalAlpha=.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  for(var i=0;i<count;i++){
    var y=top+(i+.5)*dy/count,
        reverse=i%2===1,
        jitter=r.range(-cell.height*.018,cell.height*.018),
        p1={x:reverse?end:start,y:y+jitter},
        p2={x:reverse?start:end,y:y+jitter},
        mid={x:(p1.x+p2.x)/2,y:y+r.range(-5,5)},
        width=Math.min(cell.height*.39,Math.max(12,dy/count*1.26));
    painter(ctx,mask,[p1,mid,p2],width,rgb,
      i%3===0?'flat':'filbert',r,{thickness:.95,drag:.4,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();return deposits;
}


function oilGuideTerritory(ctx,mask,cell,painter){
  var r=rng(cell.seed+'|v5d-oil-guide'),shape=massContour(cell),
      base=cell.rgb,axis=cell.axis||[],deposits=0,
      kind=cell.kind,halfWidth=clamp(
        kind==='constructed-focal-form'?Math.min(cell.width,cell.height)*.36:
        kind==='trajectory-ribbon'?Math.min(cell.width,cell.height)*.32:
        Math.min(cell.width,cell.height)*.42,12,48);
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // A restrained under-layer is *material-specific*; actual bristle
  // contact breaks up the top paint volume and controls its lighting.
  ctx.globalAlpha=kind==='constructed-focal-form'?.54:.56;
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  var strokes=[];
  if(axis.length>1){
    var stride=Math.max(1,Math.floor((axis.length-1)/6));
    for(var i=0;i<axis.length-1;i+=stride){
      var pts=axis.slice(i,Math.min(axis.length,i+stride+2));
      if(pts.length>1)strokes.push(pts);
    }
  }else{
    var len=Math.min(cell.width,cell.height)*.45,
        v={x:cell.x,y:cell.y},a=cell.angle||0;
    strokes.push([shifted(v,a,-len),v,shifted(v,a,len)]);
  }
  strokes.slice(0,9).forEach(function(pts,i){
    // Caution: all geometry comes from the actual source guide; no
    // background-fill polygons or invented complete spiral enclosure.
    var width=halfWidth*r.range(.82,1.17),
        colour=blend(base,i%3===0?[241,224,200]:[53,45,41],
          i%3===0?.055:.018);
    painter(ctx,mask,pts,width,colour,
      kind==='constructed-focal-form'?'flat':'filbert',
      r,{thickness:.87,drag:.56,bristles:.93});
    deposits++;
  });
  ctx.restore();mask.restore();return deposits;
}


function oilColourField(ctx,mask,field,painter){
  var shape=massContour(field),r=rng(field.seed+'|oil-colour-field-v2'),
      box=field.box,colour=field.rgb,palette=field.palette||[colour],
      // Real 2D pigment fields receive overlapping dabs in more than one
      // direction. Their coverage is no longer a neat comb of line strokes.
      count=clamp(Math.round(box.w*box.h/17500),7,22),painted=0;
  ctx.save();mask.save();
  ctx.clip(shape);mask.clip(shape);
  // Keep this first layer translucent: subsequent loaded-bristle deposits
  // build the opacity and preserve multiple original pigment families.
  ctx.globalAlpha=.48;ctx.fillStyle=hex(blend(colour,[245,230,209],.11));
  ctx.fill(shape);
  mask.globalAlpha=.21;mask.fillStyle='#fff';mask.fill(shape);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  for(var i=0;i<count;i++){
    var t=(i+.35)/count,px=box.x+box.w*(.16+.70*r.range(0,1)),
        py=box.y+box.h*(.12+.74*t),
        angle=r.range(-.70,.70)+(i%3===0?-.15:.15),
        length=clamp(box.w*r.range(.34,.76),95,330),
        width=clamp(box.h*r.range(.09,.22),40,130),
        hue=palette[i%palette.length],
        pigment=blend(hue,i%4===0?[247,234,213]:[58,45,36],
          i%4===0?.065:.025),
        dx=Math.cos(angle)*length*.5,dy=Math.sin(angle)*length*.5,
        pts=[{x:px-dx,y:py-dy},
          {x:px+r.range(-14,14),y:py+r.range(-11,11)},
          {x:px+dx,y:py+dy}];
    painter(ctx,mask,pts,width,pigment,
      i%5===0?'flat':'filbert',r,
      {thickness:.95,drag:.52,bristles:.93});
    painted++;
  }
  ctx.restore();mask.restore();
  return painted;
}

function oilAdapter(target,plan,scale){
  var w=target.width,h=target.height,
      canvas=document.createElement('canvas'),
      maskCanvas=document.createElement('canvas');
  canvas.width=maskCanvas.width=w;canvas.height=maskCanvas.height=h;
  var ctx=canvas.getContext('2d',{willReadFrequently:true}),
      mask=maskCanvas.getContext('2d',{willReadFrequently:true}),
      painter=A.oilPaintV4ETest&&A.oilPaintV4ETest.drawContactBrush;
  if(!painter)throw Error('V4e loaded brush unavailable');
  ctx.scale(scale,scale);mask.scale(scale,scale);
  ctx.save();mask.save();clippedToVoids(ctx,plan);clippedToVoids(mask,plan);
  var deposits=0,territoryDeposits=0,fieldStrokes=0;
  for(var fi=0;fi<(plan.colourFields||[]).length;fi++){
    fieldStrokes+=oilColourField(ctx,mask,plan.colourFields[fi],painter);
  }
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted'){
      territoryDeposits+=cell.kind==='rect-cell'?
        oilTerritory(ctx,mask,cell,cell.rgb,cell.seed,painter):
        oilGuideTerritory(ctx,mask,cell,painter);
    }
  }
  for(var i=0;i<plan.regions.length;i++){
    // Source-mark clusters remain directional material detail, not a second
    // overlapping mass layer that conceals actual subdivision territories.
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var a=plan.regions[i],r=rng(a.seed+'|oil-v5'),
        // Paint a broad, plan-derived loaded colour mass beneath the bristle
        // gestures. It is not a thickened Marker source line: this is the
        // optional V5 area translated by Oil's material adapter.
        area=massContour(a);
    ctx.globalAlpha=.73;
    ctx.fillStyle=hex(blend(a.rgb,[243,228,205],.075));
    ctx.fill(area);
    mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
    var profiles=['filbert','flat','knife'],
        profile=profiles[i%3],steps=2;
    for(var k=0;k<steps;k++){
      var offset=(k-.5)*a.width*.31,
          c=shifted({x:a.x,y:a.y},a.angle+PI/2,offset),
          len=a.length*(k===0?1.03:.65),
          x=shifted(c,a.angle,-len*.5),z=shifted(c,a.angle,len*.5);
      painter(ctx,mask,[x,shifted(c,a.angle,r.range(-3,3)),z],
        a.width*(k===0?1.35:.82),a.rgb,profile,r,
        {thickness:.94,drag:.35,bristles:.9});
      deposits++;
    }
  }
  for(i=0;i<plan.gestures.length;i++){
    a=plan.gestures[i];r=rng(a.seed+'|oil-v5');
    var start=shifted(a,a.angle,-a.length*.5),
        end=shifted(a,a.angle,a.length*.5);
    painter(ctx,mask,[start,{x:a.x,y:a.y},end],
      Math.max(9,a.width*1.3),blend(a.rgb,[245,225,196],.08),
      'filbert',r,{thickness:.72,drag:.6,bristles:.9});
    deposits++;
  }
  ctx.restore();mask.restore();
  // Contact-height pass matches the pigment layer, then locally shades its
  // actual ridges; no whole-image emboss, RGB haze or blurred screenshot.
  var frame=mask.getImageData(0,0,w,h).data,
      paint=ctx.getImageData(0,0,w,h),
      pixels=paint.data,field=new Float32Array(w*h),peak=0;
  for(i=0;i<field.length;i++){
    var aVal=frame[i*4+3]/255;
    if(aVal>.007){field[i]=aVal*1.42;peak=Math.max(peak,field[i]);}
  }
  var sample=0;
  for(var y=4;y<h-4;y++)for(var x=4;x<w-4;x++){
    var index=y*w+x; if(field[index]<.06)continue;
    var light=A.oilPaintV4ETest.surfaceLighting(field,w,h,x,y,.88),
        z=index*4;
    for(var c=0;c<3;c++)pixels[z+c]=clamp(Math.round(
      pixels[z+c]*light.shade+light.shine*(c===0?1:c===1?.87:.77)),0,255);
    sample++;
  }
  ctx.putImageData(paint,0,0);
  target.getContext('2d').drawImage(canvas,0,0);
  return {deposits:deposits,territoryDeposits:territoryDeposits,
    colourFields:(plan.colourFields||[]).length,fieldStrokes:fieldStrokes,
    raisedPixels:sample,peakHeight:+peak.toFixed(3)};
}
// A separate physical treatment of exactly the SAME plan: translucent
// torn tissue shapes accumulate subtractively; graphite emphasizes chosen
// source-derived edges instead of imitating an opaque oil-brush tip.

function tissueTerritory(ctx,cell){
  var n=cell.contour||[],r=rng(cell.seed+'|v5c-tissue'),
      count=2,ink=cell.rgb,painted=0;
  // Cut paper from the SAME semantic territory without altering its
  // mathematically derived focal/negative-space geometry. Torn contour
  // variation is specific to this adapter, not shared planner metadata.
  for(var layer=0;layer<count;layer++){
    var p=new Path2D(),scale=layer===0?1.03:.88,
        cx=cell.x,cy=cell.y;
    for(var side=0;side<n.length;side++){
      var a=n[side],b=n[(side+1)%n.length],divs=5;
      for(var k=0;k<divs;k++){
        var t=k/divs,px=a.x+(b.x-a.x)*t,
            py=a.y+(b.y-a.y)*t,
            rnd=layer===0?2.5:3.8,
            x=cx+(px-cx)*scale+r.range(-rnd,rnd),
            y=cy+(py-cy)*scale+r.range(-rnd,rnd);
        if(side===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.47:.33;
    ctx.fillStyle=hex(blend(ink,[245,240,230],layer===0?.08:.24));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.25;
    ctx.lineWidth=1.15;
    ctx.strokeStyle='rgba(245,239,228,.7)';ctx.stroke(p);
    painted++;
  }
  return painted;
}


function tissueGuideTerritory(ctx,cell){
  // No marker-like opaque solid ribbon. Two individually torn translucent
  // pieces share the compositional silhouette, not the same torn edge.
  var r=rng(cell.seed+'|v5d-tissue-guide'),border=cell.contour,
      colour=cell.rgb,pieces=0;
  for(var layer=0;layer<2;layer++){
    var scale=layer===0?1.015:.89,
        p=new Path2D(),verts=border.length;
    for(var i=0;i<verts;i++){
      var a=border[i],b=border[(i+1)%verts],steps=4;
      for(var k=0;k<steps;k++){
        var t=k/steps,fx=a.x+(b.x-a.x)*t,
            fy=a.y+(b.y-a.y)*t,
            fibre=layer===0?2.9:3.6,
            x=cell.x+(fx-cell.x)*scale+r.range(-fibre,fibre),
            y=cell.y+(fy-cell.y)*scale+r.range(-fibre,fibre);
        if(i===0&&k===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=layer===0?.37:.25;
    ctx.fillStyle=hex(blend(colour,[245,240,230],layer===0?.09:.20));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(250,246,233,.65)';
    ctx.globalAlpha=.48;ctx.lineWidth=.9;ctx.stroke(p);
    pieces++;
  }
  // Graphite follows only the real central branch / trajectory segment.
  var path=cell.axis||[];
  if(path.length>1){
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(var j=1;j<path.length;j++)ctx.lineTo(path[j].x,path[j].y);
    ctx.globalAlpha=.22;ctx.strokeStyle='#302b29';
    ctx.lineWidth=1.25;ctx.lineCap='round';ctx.stroke();
  }
  return pieces;
}


function tissueColourField(ctx,field){
  var contour=field.contour||[],r=rng(field.seed+'|tissue-colour-field-v2'),
      palette=field.palette||[field.rgb],pieces=0;
  // Paper uses its own broad shape and several distinct seeded source hues.
  // Actual material cuts vary, with translucent overlapping pigment.
  for(var layer=0;layer<4;layer++){
    var scale=[1.03,.94,.84,.67][layer],p=new Path2D();
    for(var i=0;i<contour.length;i++){
      var a=contour[i],b=contour[(i+1)%contour.length],n=3;
      for(var j=0;j<n;j++){
        var t=j/n,x=a.x+(b.x-a.x)*t,
            y=a.y+(b.y-a.y)*t,fringe=layer===0?3.5:5,
            dx=r.range(-fringe,fringe),dy=r.range(-fringe,fringe);
        x=field.x+(x-field.x)*scale+dx;
        y=field.y+(y-field.y)*scale+dy;
        if(i===0&&j===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
    }
    p.closePath();
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=[.29,.24,.20,.16][layer];
    ctx.fillStyle=hex(blend(palette[layer%palette.length],
      [245,240,230],layer*.085));
    ctx.fill(p);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.42;ctx.lineWidth=.85;
    ctx.strokeStyle='rgba(247,242,231,.48)';
    ctx.stroke(p);
    pieces++;
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  return pieces;
}

function tissueAdapter(target,plan,scale){
  var ctx=target.getContext('2d'),pieces=0,lines=0;
  ctx.save();ctx.scale(scale,scale);clippedToVoids(ctx,plan);
  var territoryPieces=0,fieldPieces=0;
  for(var fi=0;fi<(plan.colourFields||[]).length;fi++){
    fieldPieces+=tissueColourField(ctx,plan.colourFields[fi]);
  }
  for(var ti=0;ti<(plan.territories||[]).length;ti++){
    var cell=plan.territories[ti];
    if(cell.role==='painted')territoryPieces+=cell.kind==='rect-cell'?
      tissueTerritory(ctx,cell):tissueGuideTerritory(ctx,cell);
  }
  function irregularPiece(region,k){
    var r=rng(region.seed+'|tissue-v5b|'+k),p=new Path2D(),
        outline=region.contour||[];
    if(outline.length>=3){
      for(var index=0;index<outline.length;index++){
        var v=outline[index],shrink=k===0?1.08:.91,
            along=v.x-region.x,across=v.y-region.y,
            // Different physical cut from same planned shape; this edge
            // belongs to the paper adapter, never the shared planner.
            rag=r.range(-2.9,2.9);
        var x=region.x+along*shrink+rag,
            y=region.y+across*shrink+r.range(-2.9,2.9);
        if(index===0)p.moveTo(x,y);else p.lineTo(x,y);
      }
      p.closePath();return p;
    }
        n=16,side=region.angle+PI/2,
        length=region.length*(k===0?1.08:.83),
        breadth=region.width*(k===0?1.65:1.31),
        a=point(region,-length*.5),b=point(region,length*.5),
        left=[],right=[];
    for(var i=0;i<=n;i++){
      var t=i/n,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},
          taper=Math.pow(Math.max(.04,Math.sin(PI*t)),.28),
          tear=1+.085*Math.sin(t*TAU*3+r.range(-.8,.8));
      left.push(shifted(c,side,-breadth*.5*taper*tear));
      right.push(shifted(c,side,breadth*.5*taper*
        (1+.092*Math.sin(t*TAU*4+r.range(-.7,.7)))));
    }
    p.moveTo(left[0].x,left[0].y);
    for(i=1;i<left.length;i++)p.lineTo(left[i].x,left[i].y);
    for(i=right.length-1;i>=0;i--)p.lineTo(right[i].x,right[i].y);
    p.closePath();
    return p;
  }
  for(var i=0;i<plan.regions.length;i++){
    if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
    if(plan.guideStats&&(plan.guideStats.branches||
      plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
    var v=plan.regions[i],colour=v.rgb;
    for(var k=0;k<2;k++){
      var p=irregularPiece(v,k),t=rng(v.seed+'|shade|'+k),
          ratio=k===0?.10:.065;
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=k===0?.48:.35;
      ctx.fillStyle=hex(blend(colour,[245,240,230],ratio));ctx.fill(p);
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(245,239,227,.45)';
      ctx.globalAlpha=.31;ctx.lineWidth=1.5;ctx.stroke(p);
      pieces++;
    }
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<plan.gestures.length;i++){
    v=plan.gestures[i];ctx.beginPath();
    var a=point(v,-v.length*.52),b=point(v,v.length*.52);
    ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(v.x+3,v.y-4,b.x,b.y);
    ctx.strokeStyle='rgba(40,39,37,.42)';
    ctx.globalAlpha=.70;ctx.lineWidth=Math.max(.75,Math.min(2.2,v.width*.14));
    ctx.stroke();lines++;
  }
  ctx.restore();
  return {tornPieces:pieces,territoryPieces:territoryPieces,
    colourFields:(plan.colourFields||[]).length,fieldPieces:fieldPieces,
    graphiteGestures:lines};
}
A.renderInterpretedV5E=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var material=opts.material||'oil',
      interpretation=opts.interpretation||'faithful';
  if(interpretation!=='faithful'&&interpretation!=='areas')
    throw Error('Unknown composition interpretation');
  var start=performance.now(),sourceMeta=baseline(target,settings,scale,material,opts);
  if(interpretation==='faithful')return {
    version:'v5e-prototype',interpretation:interpretation,material:material,
    sourceSeed:settings.seed,plan:null,baseline:sourceMeta};
  if(!A.planCompositionV5)throw Error('Shared V5 planner not loaded');
  var plan=A.planCompositionV5(settings,{phiFraming:opts.phiFraming===true,
    maxRegions:opts.maxRegions||28});
  var work=material==='oil'?oilAdapter(target,plan,scale):
    tissueAdapter(target,plan,scale);
  var stats={version:'v5e-prototype',interpretation:'areas',
    material:material,sourceSeed:settings.seed,
    regions:plan.regions.length,gestures:plan.gestures.length,
    accents:plan.accents.length,
    territories:plan.territories.length,
    paintedTerritories:plan.territoryStats.painted,
    framedTerritories:plan.territoryStats.framed,
    guideStats:plan.guideStats,colourFields:plan.colourFields.length,
    fieldStats:plan.fieldStats,
    plan:plan,work:work,
    renderMs:+(performance.now()-start).toFixed(2)};
  A.lastV5EInterpretation=stats;
  return stats;
};
})(window.AlgoArt);

