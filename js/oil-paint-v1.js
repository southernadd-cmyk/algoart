// ALGO/ART experimental OIL PAINT V1. Real Canvas2D material translation.
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
  var chains=[],seen=new Set();
  for(var i=0;i<paths.length;i++){
    var src=paths[i],rgb=sourceRGB(src.stroke),pts=parsePath(src);
    if(!rgb||pts.length<2)continue;
    var len=0;for(var j=1;j<pts.length;j++)len+=dist(pts[j-1],pts[j]);
    if(len<6)continue;
    var first=pts[0],last=pts[pts.length-1];
    var id=[Math.round(first.x/6),Math.round(first.y/6),Math.round(last.x/6),
      Math.round(last.y/6),Math.round(len/16),rgb.join(':')].join('|');
    if(seen.has(id))continue;seen.add(id);
    chains.push({pts:sample(pts,9),rgb:rgb,width:src.width||4,length:len,sourceIndex:i});
  }
  // Emphasise longer paths, but preserve short strokes needed by Field,
  // Radiant and Automatic Marks. Painterly hierarchy follows geometry.
  var long=chains.filter(function(c){return c.length>70}).sort(function(a,b){return b.length-a.length});
  var short=chains.filter(function(c){return c.length<=70});
  var chosen=long.slice(0,115).concat(short.slice(0,145));
  chosen.sort(function(a,b){return a.sourceIndex-b.sourceIndex});
  return chosen;
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
function ribbon(ctx,pts,width,seed,load){
  // Continuous loaded-brush contour. The noise is correlated to path
  // distance; no stack of square stamps and no new topological marks.
  var left=[],right=[],travel=0;
  for(var i=0;i<pts.length;i++){
    var prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)];
    if(i)travel+=dist(pts[i-1],pts[i]);
    var direction=tangent(prev,next)+PI/2;
    var endTaper=Math.min(1,.63+i*.25,(pts.length-i-1)*.25+.63);
    var wave=.94+.095*Math.sin(travel*.033+seed*.00003)+
      .055*Math.sin(travel*.089-seed*.00007);
    var body=width*.5*endTaper*wave*load;
    left.push(shift(pts[i],direction,body));
    right.push(shift(pts[i],direction,-body*(.92+.06*Math.sin(travel*.061))));
  }
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  for(i=1;i<left.length;i++)ctx.lineTo(left[i].x,left[i].y);
  for(i=right.length-1;i>=0;i--)ctx.lineTo(right[i].x,right[i].y);
  ctx.closePath();
}
function paintOne(pig,ht,ch,r,index,options){
  var pts=ch.pts;if(pts.length<2)return 0;
  var thickness=minmax(options.thickness??.76,0,1);
  var drag=minmax(options.drag??.49,0,1);
  var bristles=minmax(options.bristles??.84,0,1);
  var nominal=minmax(5+ch.width*1.6,8,52);
  var width=nominal*(.82+thickness*.72)*r.range(.9,1.1);
  var rgb=ch.rgb,shade=mix(rgb,[34,30,29],.15),light=mix(rgb,[250,244,234],.31);
  var isThin=width<14,load=r.range(.76,1.13);
  // Low-contrast directional underpaint aligns with source tangent.
  if(ch.length>60&&index%5===0){
    curvedStroke(pig,pts,width*(1.55+drag*.36),
      css(mix(rgb,[245,240,230],.42)),r.range(.10,.21));
  }
  pig.save();ribbon(pig,pts,width,r.int(0,0x7fffffff),load);
  pig.fillStyle=css(rgb);pig.globalAlpha=.93;pig.fill();pig.clip();
  // Bristle filaments run *along* each brush direction. Fine pigment
  // variations are sampled from the original Marker colour, not a new kit.
  var strips=Math.max(3,Math.min(21,Math.round(width/(3.1-bristles))));
  for(var j=0;j<strips;j++){
    var offset=((j+.5)/strips-.5)*width*.9;
    if(r.chance(.12+drag*.27))continue;
    var sub=[],at=r.range(.04,.22),stop=r.range(.79,.98);
    var start=Math.floor(at*(pts.length-1)),end=Math.ceil(stop*(pts.length-1));
    for(var k=start;k<=end;k++){
      var a=pts[Math.max(0,k-1)],b=pts[Math.min(pts.length-1,k+1)];
      var theta=tangent(a,b)+PI/2;
      sub.push(shift(pts[k],theta,offset+r.range(-.28,.28)));
    }
    curvedStroke(pig,sub,r.range(.35,1.85),
      css(j%3===0?shade:j%4===0?light:mix(rgb,light,.15)),
      r.range(.12,.55)*bristles);
  }
  // Dry-brush exposure as short, discontinuous, longitudinal highlights.
  if(!isThin&&drag>.2){
    for(j=0;j<Math.min(13,Math.ceil(ch.length/65));j++){
      var ix=r.int(0,pts.length-2),a=pts[ix],b=pts[Math.min(pts.length-1,ix+1)];
      var d=tangent(a,b),perp=d+PI/2;
      var p=shift(a,perp,r.range(-width*.39,width*.39));
      if(r.chance(drag*.87)){
        curvedStroke(pig,[p,shift(p,d,r.range(5,26))],r.range(.55,2.4),
          css(light),r.range(.28,.65));
      }
    }
  }
  pig.restore();
  // Independent alpha-based height buffer with pronounced loaded ridges,
  // preserving pigment colour below any later opaque overpainting.
  ht.save();ht.globalCompositeOperation='source-over';
  ribbon(ht,pts,width,r.int(0,0x7fffffff),load);
  ht.fillStyle='#ffffff';ht.globalAlpha=.26+thickness*.45;ht.fill();ht.clip();
  for(j=0;j<strips;j++){
    if(r.chance(.23))continue;
    offset=((j+.5)/strips-.5)*width*.83;
    sub=[];
    for(k=0;k<pts.length;k++){
      a=pts[Math.max(0,k-1)];b=pts[Math.min(pts.length-1,k+1)];
      theta=tangent(a,b)+PI/2;
      sub.push(shift(pts[k],theta,offset));
    }
    curvedStroke(ht,sub,r.range(.55,2.6),'#ffffff',r.range(.15,.44));
  }
  ht.restore();
  return 1;
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
function finish(pig,ht,w,h,seed,scale){
  // Per-pixel relief from the accumulated paint heightmap; normal from
  // local gradients, with restrained off-axis highlights (no chrome sheen).
  var pixels=pig.getImageData(0,0,w,h),hmap=ht.getImageData(0,0,w,h).data;
  var out=pixels.data,hs=A.hash(seed+'|oil-impasto-v1-height')>>>0;
  for(var y=1;y<h-1;y++){
    for(var x=1;x<w-1;x++){
      var i=(y*w+x)*4,hc=hmap[i+3]/255;
      if(hc<.045)continue;
      var dx=(hmap[i+7]-hmap[i-1])/255;
      var dy=(hmap[i+4*w+3]-hmap[i-4*w+3])/255;
      var tooth=(hash(x>>1,y>>1,hs)-.5)*(.65-hc*.3);
      var shade=minmax(1+(-dx*.16-dy*.21)*hc+.045*hc*hc+tooth*.022,.78,1.20);
      var shine=Math.pow(minmax(.56+(-dx*.36-dy*.4),0,1),9)*hc*5.5;
      out[i]=minmax(Math.round(out[i]*shade+shine),0,255);
      out[i+1]=minmax(Math.round(out[i+1]*shade+shine*.85),0,255);
      out[i+2]=minmax(Math.round(out[i+2]*shade+shine*.7),0,255);
    }
  }
  pig.putImageData(pixels,0,0);
}
A.renderOilPaintV1=function(target,settings,scale,opts){
  opts=opts||{};scale=scale||1;
  var w=settings.orientation==='portrait'?1000:1400,h=settings.orientation==='portrait'?1400:1000;
  var prior=A.svgRecorder,metaPrior=A.lastRenderMeta,priorFit=A.phiFramingEnabled;
  var rec={precise:true,paths:[],paperMarks:[]},scratch=document.createElement('canvas'),meta;
  try{
    A.svgRecorder=rec;
    A.phiFramingEnabled=opts.phiFraming===true;
    meta=A.render(scratch,settings,Math.min(.22,scale),false);
  }finally{
    A.svgRecorder=prior;
    A.phiFramingEnabled=priorFit;
  }
  var chains=getChains(rec.paths);
  // Compute all material effects at output pixels; exact same seed and
  // framing always produce the same pixels regardless of image history.
  var sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
  target.width=sw;target.height=sh;
  var pig=document.createElement('canvas'),height=document.createElement('canvas');
  pig.width=height.width=sw;pig.height=height.height=sh;
  var ctx=pig.getContext('2d',{willReadFrequently:true}),hc=height.getContext('2d',{willReadFrequently:true});
  ctx.scale(scale,scale);hc.scale(scale,scale);
  var r=A.makeR(settings.seed+'|oil-paint-v1|'+settings.mode+'|'+settings.orientation+'|'+(opts.phiFraming?'phi':'plain'));
  ground(ctx,w,h,settings.seed,r);
  var placed=0;
  // Render source paths in their recorded stacking order. Later strokes
  // are opaque and conceal earlier paint; no multiply-watercolour blending.
  for(var i=0;i<chains.length;i++){
    placed+=paintOne(ctx,hc,chains[i],r,i,opts);
  }
  ctx.setTransform(1,0,0,1,0,0);hc.setTransform(1,0,0,1,0,0);
  finish(ctx,hc,sw,sh,settings.seed,scale);
  var dest=target.getContext('2d');
  dest.clearRect(0,0,sw,sh);dest.drawImage(pig,0,0);
  A.lastOilPaintV1Stats={material:'oil-paint-v1',paths:rec.paths.length,
    paintedPaths:placed,width:sw,height:sh,seed:settings.seed,mode:settings.mode,
    phiFraming:opts.phiFraming===true,sourceColours:[...new Set(chains.map(function(c){return css(c.rgb)}))].slice(0,12)};
  A.lastRenderMeta=metaPrior;return A.lastOilPaintV1Stats;
};
})(window.AlgoArt);
