// ALGO/ART experimental OIL PAINT V3. Real Canvas2D material translation.
// V3c experimental branch: organic bristle contact tips, continuous tooth and
// source-local impasto patches. Not the production material.
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
  if(setting==='flat'||setting==='filbert')return setting;
  if(mode==='rects'||mode==='geometric')return r.chance(.82)?'flat':'filbert';
  if(mode==='organic'||mode==='spiral'||mode==='network')
    return r.chance(.85)?'filbert':'flat';
  return r.chance(.48)?'flat':'filbert';
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
function paintOne(pig,mask,ch,r,index,options,field,sw,sh,scale,mode){
  var pts=ch.pts;if(pts.length<2)return 0;
  var thickness=minmax(options.thickness??.90,0,1),
      drag=minmax(options.drag??.72,0,1),
      bristles=minmax(options.bristles??.92,0,1),
      profile=profileFor(ch,mode,r,options.profile);
  var nominal=minmax(6+ch.width*1.8,9,58),
      width=nominal*(1.02+thickness*1.08)*r.range(.90,1.08),
      load=r.range(.80,1.25),
      body=strokeBody(pts,width,r.int(0,0x7fffffff),load,profile),
      rgb=ch.rgb,bnd=body.bounds;
  // Pick up pigment at an existing crossing, not from the pristine ground.
  // Preserve the source hue by limiting local transfer to 9–20%.
  var pickups=[],pickupCount=0;
  for(var scan=0;scan<3;scan++){
    var check=pts[Math.floor((.19+scan*.30)*(pts.length-1))];
    var cx=minmax(Math.round(check.x*scale),0,sw-1),
        cy=minmax(Math.round(check.y*scale),0,sh-1);
    if(field[cy*sw+cx]>.20){
      pickups.push(Array.from(pig.getImageData(cx,cy,1,1).data).slice(0,3));
    }
  }
  var x0=minmax(Math.floor((bnd.minX-width*.70)*scale)-4,0,sw-1),
      y0=minmax(Math.floor((bnd.minY-width*.70)*scale)-4,0,sh-1),
      x1=minmax(Math.ceil((bnd.maxX+width*.70)*scale)+4,x0+1,sw),
      y1=minmax(Math.ceil((bnd.maxY+width*.70)*scale)+4,y0+1,sh);
  // Empty a local, bounded relief mask; no readback of the full canvas.
  mask.save();mask.setTransform(1,0,0,1,0,0);
  mask.clearRect(x0,y0,x1-x0,y1-y0);mask.restore();
  // Interlocking palette-controlled local paint masses. These go down
  // before the bounded bristle pass, and are included in the height readback.
  var patchCount=ch.mass?Math.min(8,Math.max(2,
    Math.round(ch.length/(width*1.15)))):ch.length>110?
    Math.min(3,Math.floor(ch.length/110)):0;
  var patchDeposits=0;
  if(patchCount){
    pig.save();mask.save();
    for(var patch=0;patch<patchCount;patch++){
      var at=r.int(0,pts.length-2),
          anchor=between(pts[at],pts[at+1],r.range(.12,.88)),
          theta=tangent(pts[at],pts[at+1]),
          origin=shift(anchor,theta+PI/2,r.range(-.20,.20)*width),
          length=width*(ch.mass?r.range(.92,1.79):r.range(.62,1.15)),
          breadth=width*(ch.mass?r.range(.82,1.40):r.range(.45,.72)),
          blend=mix(rgb,r.chance(.5)?[246,224,189]:[78,55,41],
            r.range(.025,.12));
      depositPaintPatch(pig,mask,origin,theta+r.range(-.16,.16),
        length,breadth,blend,r.range(.70,.95),r.range(.38,.78),r);
      patchDeposits++;
    }
    pig.restore();mask.restore();
  }
  pig.save();mask.save();
  pig.clip(body.path);mask.clip(body.path);
  // Low-contact underpaint gives bristles a continuous colour relationship,
  // without hiding the fragmented footprint underneath an opaque ribbon.
  pig.globalAlpha=.16+thickness*.13;
  pig.fillStyle=css(mix(rgb,[245,240,230],.12));pig.fill(body.path);
  mask.globalAlpha=.075+thickness*.065;
  mask.fillStyle='#ffffff';mask.fill(body.path);
  // A brush tip has independently connected hairs. Each hair moves along
  // the actual source tangent with pressure-driven splay and decreasing load.
  var n=Math.max(8,Math.min(24,Math.round(width/(5.1-bristles*.7))));
  var runs=0,broken=0,charged=0,bankBase=(.60+thickness*.38)*load;
  for(var hair=0;hair<n;hair++){
    if(r.chance(.045+drag*.04))continue;
    var lateral=((hair+r.range(.08,.94))/n-.5)*width*.94,
        pitch=r.range(.11,.25),phase=r.range(0,TAU),
        shear=r.range(-.10,.10),fuzz=r.range(.2,1.3),
        hairWidth=width/n*r.range(.89,1.70),
        charge=r.range(.85,1.13),
        hairColor=mix(rgb,hair%4===0?[57,42,38]:[249,240,225],
          hair%4===0?r.range(.06,.20):r.range(.025,.12)),
        path=[],visits=0,pigmentSample=null;
    if(pickups.length&&r.chance(.27)){
      pigmentSample=pickups[r.int(0,pickups.length-1)];
      hairColor=mix(hairColor,pigmentSample,r.range(.09,.20));
      pickupCount++;
    }
    // Runs are connected while hairs remain in contact. When a hair lifts,
    // the underlying bristle path is genuinely absent from both buffers.
    function flush(){
      if(path.length>=2){
        var a=minmax(.63+charge*.26,0,1),
            h=minmax(bankBase*(.32+charge*.44),.1,1);
        if(depositBristle(pig,mask,path,hairWidth,hairColor,a,h))runs++;
      }
      path=[];
    }
    for(var p=0;p<pts.length;p++){
      var before=pts[Math.max(0,p-1)],after=pts[Math.min(pts.length-1,p+1)],
          angle=tangent(before,after),progress=p/(pts.length-1),
          pressure=minmax(.72+.19*Math.sin(p*pitch+phase)+
            .12*Math.sin(progress*TAU*1.8+phase*.6),.28,1.03),
          splay=1+(pressure-.6)*.26,
          waviness=Math.sin(p*.38+phase)*fuzz+
            Math.sin(p*.13+hair*.8)*fuzz*.44,
          offset=lateral*splay+waviness,
          displacement=width*shear*(progress-.5)*.52,
          point=shift(shift(pts[p],angle+PI/2,offset),
            angle,displacement);
      charge*=.987-r.range(0,.005);
      // Tiny irregular reloading pulses do not reset all hairs together.
      if(p>0&&p%19===0&&r.chance(.31))charge=Math.min(1.08,charge+.21);
      var contact=r.range(0,1)>.055+drag*.045+(1-charge)*.13 &&
        pressure>.34 && (p<pts.length-1||r.chance(.76));
      if(!contact){
        if(path.length)broken++;
        flush();continue;
      }
      path.push(point);visits++;
    }
    flush();
    charged+=visits;
  }
  // Small broad dragged passages/knife edges break parallel combing.
  // They obey the same source stroke mask and feed the same height field.
  var flicks=Math.min(ch.mass?7:4,Math.max(1,Math.floor(ch.length/55)));
  for(var f=0;f<flicks;f++){
    var startIndex=r.int(0,pts.length-2),a=pts[startIndex],
        b=pts[Math.min(pts.length-1,startIndex+r.int(1,3))],
        ang=tangent(a,b),normal=ang+PI/2,
        offset=r.range(-.32,.32)*width,
        start=shift(a,normal,offset),
        end=shift(b,normal,offset+r.range(-.07,.07)*width),
        flickColour=mix(rgb,r.chance(.55)?[247,235,217]:[54,43,41],
          r.range(.06,.20));
    if(depositBristle(pig,mask,[start,end],
      width*r.range(.07,.20),flickColour,r.range(.48,.85),
      bankBase*r.range(.40,.75)))runs++;
  }
  pig.restore();mask.restore();
  // One local alpha readback per source mark. Height is added to the
  // existing paint load independently of colour/opacity compositing.
  var src=mask.getImageData(x0,y0,x1-x0,y1-y0).data,
      rw=x1-x0,rh=y1-y0,bodyLoad=(.54+thickness*.59)*load;
  for(var yy=0;yy<rh;yy++){
    var row=(yy+y0)*sw+x0,subrow=yy*rw;
    for(var xx=0;xx<rw;xx++){
      var ink=src[(subrow+xx)*4+3]/255;
      if(ink>.008){
        var at=row+xx;
        field[at]=addPaintHeight(field[at],ink,bodyLoad);
      }
    }
  }
  return {profile:profile,dragMarks:broken,bristleRuns:runs,
    pickupMarks:pickupCount,bristleContacts:charged,paintPatches:patchDeposits};
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
function finish(pig,field,w,h,seed,options){
  var pixels=pig.getImageData(0,0,w,h),out=pixels.data,
      hs=A.hash(seed+'|oil-impasto-v3-height')>>>0,
      relief=minmax(options.relief??.87,0,1),
      peak=0,active=0,capped=0,dist=[];
  // One finishing pass. Height gradients use neighbours inside field.
  // Colour exposure/opacity are already resolved by source-over strokes.
  for(var y=1;y<h-1;y++)for(var x=1;x<w-1;x++){
    var p=y*w+x,i=p*4,ht=field[p];
    if(ht<.035)continue;
    active++;if(ht>peak)peak=ht;
    if(ht>=17.999)capped++;
    if((x+y*13)%17===0)dist.push(ht);
    var mapped=opticalRelief(ht);
    var dx=(opticalRelief((field[p+1]+field[p+1-w]+field[p+1+w])/3)-
          opticalRelief((field[p-1]+field[p-1-w]+field[p-1+w])/3))*.5,
        dy=(opticalRelief((field[p+w]+field[p-1+w]+field[p+1+w])/3)-
          opticalRelief((field[p-w]+field[p-1-w]+field[p+1-w])/3))*.5;
    var tooth=(smoothTooth(x,y,hs)-.5)*(.23-.08*Math.min(mapped,1.8));
    var slope=-dx*.58-dy*.66;
    // Krita-inspired separate lightness/height shading; don't change
    // the material hue or apply whitening to the whole painted surface.
    var shade=minmax(1+slope*(.31+.29*relief)+.016*mapped+tooth*.06,.66,1.31);
    var shine=Math.pow(minmax(.47+slope*1.02,0,1),5)*
      Math.min(mapped,2.5)*(8+19*relief);
    out[i]=minmax(Math.round(out[i]*shade+shine),0,255);
    out[i+1]=minmax(Math.round(out[i+1]*shade+shine*.86),0,255);
    out[i+2]=minmax(Math.round(out[i+2]*shade+shine*.72),0,255);
  }
  pig.putImageData(pixels,0,0);
  dist.sort(function(a,b){return a-b});
  return {heightPeak:+peak.toFixed(3),heightP95:dist.length?
    +dist[Math.floor(dist.length*.95)].toFixed(3):0,
    heightActivePixels:active,heightAtCap:capped,
    heightAtCapFraction:active?+(capped/active).toFixed(5):0,
    heightBytes:field.byteLength};
}

A.renderOilPaintV3=function(target,settings,scale,opts){
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
  var r=A.makeR(settings.seed+'|oil-paint-v3|'+settings.mode+'|'+
    settings.orientation+'|'+(opts.phiFraming?'phi':'plain'));
  ground(ctx,w,h,settings.seed,r);
  phase.planMs=+(performance.now()-start-phase.captureMs).toFixed(2);
  var profiles={flat:0,filbert:0},dragMarks=0,painted=0,massArea=0,bristleRuns=0,pickupMarks=0,bristleContacts=0,paintPatches=0;
  var paintStart=performance.now();
  for(var i=0;i<chains.length;i++){
    var result=paintOne(ctx,mask,chains[i],r,i,opts,field,sw,sh,scale,settings.mode);
    if(result){
      painted++;profiles[result.profile]++;dragMarks+=result.dragMarks;
      bristleRuns+=result.bristleRuns;pickupMarks+=result.pickupMarks;
      bristleContacts+=result.bristleContacts;paintPatches+=result.paintPatches;
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
  A.lastOilPaintV3Stats={material:'oil-paint-v3',seed:settings.seed,
    mode:settings.mode,phiFraming:opts.phiFraming===true,
    width:sw,height:sh,sourcePaths:rec.paths.length,
    eligiblePaths:chains.eligibleCount,paintedPaths:painted,
    droppedPaths:chains.droppedCount,massGroups:massGroups,
    massAreaRatio:+Math.min(.3,massArea).toFixed(4),profiles:profiles,dragMarks:dragMarks,
    revision:'3c-organic-tips-and-masses',brushTip:'smooth oval bristle terminals',
    squarePixelTooth:false,paintPatches:paintPatches,
    bristleRuns:bristleRuns,pickupMarks:pickupMarks,
    bristleContacts:bristleContacts,
    borrowedTechniques:['independent bristle-tip contact and exhaustion','local pigment pickup',
      'separate paint-height lightness map','non-saturating height response'],
    sourceColours:[...new Set(chains.map(function(c){return css(c.rgb)}))].slice(0,32),
    height:shaded,phases:phase,sourceMeta:sourceMeta&&sourceMeta.strategy};
  return A.lastOilPaintV3Stats;
};

})(window.AlgoArt);
