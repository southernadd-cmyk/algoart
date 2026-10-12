// ALGO/ART OIL-4 experimental MATERIAL buffer renderer.
// Original implementation informed by the height/pigment separation in
// PigmentLab (https://github.com/wieslawsoltes/PigmentLab) and Wet Paint Flow
// (https://github.com/simonxxooxxoo/wet-paint-flow). No source code or assets
// are copied. Source compositions and V8 marker output remain untouched.
// Browser Canvas2D only; no trained models, GPU requirement, network or installs.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var PI=Math.PI;
var C={
  cream:['#f6eee1','#e8ded0','#f0e8db','#ddd5c4'],
  blue:['#657e7d','#829a98','#9eaead','#b3c0b6'],
  umber:['#544d43','#364b4a','#6a6854','#526461'],
  olive:['#6d7e67','#929788','#a6a895'],
  ochre:['#bc803f','#ce9a5b','#a9623e','#ddba80']
};
function clamp(x,a,b){return Math.min(b,Math.max(a,x))}
function mix(a,b,t){return a+(b-a)*t}
function lerpHex(a,b,t){
  function colour(v){
    if(v[0]==='#')return [1,3,5].map(function(k){return parseInt(v.slice(k,k+2),16)});
    var m=v.match(/[0-9]+/g);
    return m&&m.length>=3?m.slice(0,3).map(Number):[180,170,155];
  }
  var c=colour(a),d=colour(b);
  var cs=c.map(function(x,i){return Math.round(mix(x,d[i],t))});
  return 'rgb('+cs.join(',')+')';
}
function point(a,b,t){return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function angle(a,b){return Math.atan2(b.y-a.y,b.x-a.x)}
function shift(pt,dir,d){return{x:pt.x+Math.cos(dir)*d,y:pt.y+Math.sin(dir)*d}}
function palette(i,r){
  var group=i%9;
  if(group<3)return r.pick(C.blue);
  if(group<5)return r.pick(C.olive);
  if(group<7)return r.pick(C.cream);
  if(group===7)return r.pick(C.umber);
  return r.pick(C.ochre);
}
function ribbon(ctx,pts,half,r){
  var left=[],right=[],n=pts.length,i;
  if(n<2)return false;
  for(i=0;i<n;i++){
    var before=pts[Math.max(0,i-1)],after=pts[Math.min(n-1,i+1)];
    var normal=angle(before,after)+PI/2;
    var taper=Math.min(1,.45+Math.min(i,n-i-1)*.47);
    var width=half*taper*(.88+.12*Math.sin(i*1.37)+r.range(-.095,.095));
    // Independent irregularities along the two edges prevent flat cut-outs.
    left.push(shift(pts[i],normal,width));
    right.push(shift(pts[i],normal,-width*r.range(.80,1.12)));
  }
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  for(i=1;i<n;i++){
    var m=point(left[i-1],left[i],.5);
    ctx.quadraticCurveTo(m.x,m.y,left[i].x,left[i].y);
  }
  ctx.lineTo(right[n-1].x,right[n-1].y);
  for(i=n-2;i>=0;i--){
    m=point(right[i+1],right[i],.5);
    ctx.quadraticCurveTo(m.x,m.y,right[i].x,right[i].y);
  }
  ctx.closePath();return true;
}
function pathStroke(ctx,pts,width,col,alpha){
  if(pts.length<2)return;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=width;ctx.strokeStyle=col;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++){
    var m=point(pts[i-1],pts[i],.5);
    ctx.quadraticCurveTo(m.x,m.y,pts[i].x,pts[i].y);
  }
  ctx.stroke();ctx.restore();
}
function paintRibbon(pig,height,pts,width,r,col,opacity,thickness){
  if(!ribbon(pig,pts,width*.5,r))return;
  pig.save();pig.globalAlpha=opacity;pig.fillStyle=col;pig.fill();pig.clip();
  // Dry and wet streaks share the original tangent; the noise is material,
  // not another geometry generator. All stripes remain inside the paint mass.
  var count=Math.round(clamp(width/4,6,27)),i;
  for(i=0;i<count;i++){
    var offset=(i/(count-1)-.5)*width*.95,ps=[];
    for(var j=0;j<pts.length;j++){
      var before=pts[Math.max(0,j-1)],after=pts[Math.min(pts.length-1,j+1)];
      var normal=angle(before,after)+PI/2;
      ps.push(shift(pts[j],normal,offset+r.range(-width*.045,width*.045)));
    }
    var alternate=i%8===0?C.ochre:(i%3===0?C.cream:C.umber);
    var tint=lerpHex(col,r.pick(alternate),r.range(.035,.31));
    pathStroke(pig,ps,r.range(.7,3.7),tint,r.range(.09,.48));
  }
  pig.restore();
  // Grayscale height accumulates with lighter blending: real deposited paint
  // has thickness, separate from pigment colour. Bristle grooves are not
  // painted-on highlights; they change this heightmap itself.
  height.save();height.globalCompositeOperation='lighter';
  ribbon(height,pts,width*.5,r);
  height.globalAlpha=clamp(.28+thickness*.18,.2,.75);
  var layer=Math.round(clamp(18+thickness*34,16,96));
  height.fillStyle='rgb('+layer+','+layer+','+layer+')';height.fill();
  for(i=0;i<count;i++){
    if(r.chance(.23))continue;
    offset=(i/(count-1)-.5)*width*.83;ps=[];
    for(j=0;j<pts.length;j++){
      before=pts[Math.max(0,j-1)];after=pts[Math.min(pts.length-1,j+1)];
      normal=angle(before,after)+PI/2;
      ps.push(shift(pts[j],normal,offset+r.range(-width*.018,width*.018)));
    }
    pathStroke(height,ps,r.range(.65,2.9),
      r.chance(.12)?'rgb(34,34,34)':'rgb(12,12,12)',r.range(.28,.70));
  }
  height.restore();
}
function linePath(a,b,centre,r){
  // Third point gives the loaded brush a soft change of angle. The direction
  // is inherited from the skeleton's tangent, not a random global rotation.
  var q=point(a,b,.5),theta=angle(a,b)+PI/2;
  return [a,shift(q,theta,r.range(-centre,centre)),b];
}
function insideVoid(pt,voids){
  for(var i=0;i<voids.length;i++){
    var v=voids[i];
    if(pt.x>=v.x&&pt.x<=v.x+v.w&&pt.y>=v.y&&pt.y<=v.y+v.h)return true;
  }
  return false;
}
function deposit(pig,height,w,h,chains,voids,seed,quality){
  var r=A.makeR(seed+'|paint-dab-4'),n=chains.length;
  var allowance=quality<.4?.5:1;
  // Localised translucent glazes knit separate paths together without
  // replacing the original geometry with a noise texture.
  var broad=Math.min(n,Math.round(31*allowance));
  for(var i=broad-1;i>=0;i--){
    var ch=chains[i],pts=ch.pts;
    if(pts.length<2)continue;
    var mid=pts[Math.floor(pts.length/2)];
    if(insideVoid(mid,voids)&&r.chance(.82))continue;
    var width=clamp(60+Math.sqrt(ch.length)*r.range(2.8,5.7),65,175);
    var muted=lerpHex(palette(i,r),r.pick(C.cream),r.range(.32,.73));
    paintRibbon(pig,height,pts,width,r,muted,r.range(.21,.48),r.range(.25,.58));
  }
  // Main painterly ribbons at two scales. Rhythm and large-scale direction
  // use the same φ-composed source segments.
  var hero=Math.min(n,Math.ceil(72*allowance));
  for(i=0;i<hero;i++){
    ch=chains[i];pts=ch.pts;
    if(pts.length<2)continue;
    if(insideVoid(pts[0],voids)&&r.chance(.66))continue;
    width=clamp(Math.sqrt(ch.length)*r.range(1.4,3.1),14,i<22?96:61);
    if(i>=broad&&r.chance(.32))continue;
    var hue=palette(i,r);
    paintRibbon(pig,height,pts,width,r,hue,r.range(.45,.83),
      r.range(.58,1.5));
  }
  // Broken small strokes and half-covered edges build material variation.
  var detail=Math.min(n,Math.ceil(112*allowance));
  for(i=0;i<detail;i++){
    ch=chains[i];pts=ch.pts;
    var skip=quality<.4?2:1;
    for(var j=1;j<pts.length;j+=skip){
      if(r.chance(.67))continue;
      var a=pts[j-1],b=pts[j],d=dist(a,b);
      if(d<4)continue;
      if(insideVoid(point(a,b,.5),voids)&&r.chance(.85))continue;
      var normal=angle(a,b)+PI/2;
      var off=r.range(-14,14);
      var base=linePath(shift(a,normal,off),shift(b,normal,off),d*.10,r);
      var shade=r.chance(.35)?r.pick(C.umber):(r.chance(.45)?r.pick(C.ochre):r.pick(C.cream));
      paintRibbon(pig,height,base,r.range(4,19),r,shade,
        r.range(.45,.90),r.range(.30,1.4));
    }
  }
}
function hashNoise(x,y,seed){
  var k=(Math.imul(x,374761393)^Math.imul(y,668265263)^seed)|0;
  k=Math.imul(k^(k>>>13),1274126177);
  return ((k^(k>>>16))>>>0)/4294967295;
}
function shade(pig,height,out,w,h,seed){
  var source=pig.getImageData(0,0,w,h);
  var hg=height.getImageData(0,0,w,h).data;
  var px=source.data;
  var seedValue=A.hash(seed+'|microfacet|4');
  for(var y=1;y<h-1;y++){
    var row=y*w;
    for(var x=1;x<w-1;x++){
      var k=(row+x)*4;
      var center=hg[k];
      var dx=(hg[k+4]-hg[k-4])*.043;
      var dy=(hg[k+w*4]-hg[k-w*4])*.043;
      var fine=(hashNoise(x>>1,y>>1,seedValue)-.5)*.17;
      var nx=clamp(-dx+fine,-6,6),ny=clamp(-dy+fine,-6,6);
      var inv=1/Math.sqrt(nx*nx+ny*ny+1);
      var diffuse=clamp((nx*-.41+ny*-.54+1)*inv,0,1);
      // Off-centre light catches raised impasto; shadowed furrows keep depth.
      var spec=Math.pow(clamp((diffuse-.67)/.33,0,1),7);
      var cavity=clamp(Math.abs(dx)+Math.abs(dy),0,6);
      var bump=center/255;
      var light=.90+.19*diffuse+.14*bump*spec-.027*cavity;
      var shine=(9+26*bump)*spec;
      px[k]=clamp(Math.round(px[k]*light+shine),0,255);
      px[k+1]=clamp(Math.round(px[k+1]*light+shine*.91),0,255);
      px[k+2]=clamp(Math.round(px[k+2]*light+shine*.77),0,255);
    }
  }
  out.putImageData(source,0,0);
}
A.oilMaterial=function(ctx,w,h,chains,meta,seed,quality){
  // Work buffers are resolution-adaptive, but every pixel is re-rasterised
  // deterministically; no random browser texture or remote assets.
  var ratio=quality<.30?.32:(quality<.65?.53:(quality<1.5?.78:1.18));
  var sw=Math.max(1,Math.round(w*ratio)),sh=Math.max(1,Math.round(h*ratio));
  function layer(){var c=document.createElement('canvas');c.width=sw;c.height=sh;return c}
  var pc=layer(),hc=layer(),final=layer();
  var pctx=pc.getContext('2d'),hctx=hc.getContext('2d'),fctx=final.getContext('2d');
  pctx.scale(ratio,ratio);hctx.scale(ratio,ratio);
  if(A.oilSurface)A.oilSurface(pctx,w,h,chains,seed,quality);
  else{pctx.fillStyle='#f2ebdd';pctx.fillRect(0,0,w,h)}
  hctx.fillStyle='rgb(13,13,13)';hctx.fillRect(0,0,w,h);
  var voids=meta.voids||[];
  deposit(pctx,hctx,w,h,chains,voids,seed,quality);
  // Restore transforms before readback in case this is reused later.
  pctx.setTransform(1,0,0,1,0,0);hctx.setTransform(1,0,0,1,0,0);
  shade(pctx,hctx,fctx,sw,sh,seed);
  ctx.save();ctx.imageSmoothingEnabled=true;
  ctx.drawImage(final,0,0,w,h);ctx.restore();
  A.lastOilMaterialStats={width:sw,height:sh,chains:chains.length,buffer:'pigment+height',version:4};
};
})(window.AlgoArt);
