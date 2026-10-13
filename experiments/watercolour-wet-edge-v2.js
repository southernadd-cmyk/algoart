// ALGO/ART isolated WATERCOLOUR V2 WET-EDGE EXPERIMENT.
// COPIED from stable Tissue & Graphite V6 material; this file never replaces it.
// Uses the same V8 geometry and seeded V6 ink kit, but different wash physics.
// No publication, production selector or historical-material changes.
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
// The first material revision is frozen for all historical share links.
// Revised material derives *every* coloured layer from recorded Marker inks.
var originalC=C;
function coloursForInk(kit){
  if(kit.revision>=4){
    var seeded={};
    Object.keys(originalC).forEach(function(group,groupIndex){
      seeded[group]=group==='umber'?originalC.umber:originalC[group].map(function(col,i){
        return A.seededV1Pigment(col,kit.inkRGB[(groupIndex+i)%kit.inkRGB.length]);
      });
    });
    return seeded;
  }
  return {
    cream:kit.cream,
    blue:kit.ink,
    // Keep the original dark graphite pigment. Pigment washes remain
    // seeded, while pencil structural strokes must not inherit their hue.
    umber:kit.revision>=3?originalC.umber:kit.deep,
    olive:kit.soft,
    ochre:kit.ink.length>1?kit.ink.slice(1).concat(kit.ink[0]):kit.ink
  };
}
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
// Take only the electronic edge off cyan and neon green, preserving the
// original seed-derived warm/red/violet hues and intentional vivid accents.
function pigmentInk(col){
  var nums=col[0]==='#'?[1,3,5].map(function(i){return parseInt(col.slice(i,i+2),16)})
    :(col.match(/[0-9]+/g)||[]).slice(0,3).map(Number);
  if(nums.length!==3||nums.some(function(n){return !Number.isFinite(n)}))return col;
  var r=nums[0],g=nums[1],b=nums[2],spread=Math.max(r,g,b)-Math.min(r,g,b);
  if(spread<72||r>g*.91)return col;
  if(g<r*1.13||(b<g*.42&&g<r*1.7))return col;
  return lerpHex(col,'#9b907f',b>g*.74?.12:.095);
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
// Material revisions 5 and 6 share the approved torn contours. Source V4
// pigment, geometry, coverage, graphite and RNG sequence remain unchanged.
// The serration displaces the EXISTING edge: it draws no additional strokes.
var tissueTornEdges=false;
// One independent, seeded ragged-edge wavelength and phase per wash.
var activeEdgeWave={frequency:.39,secondary:1.43,phase:0};
var tissueLightEnabled=false;
var lightTissueStats={pieces:0};
function tornTrace(ctx,edge,half,side){
  var step=7.5,depth=clamp(half*.068,1.2,3.3);
  for(var i=1;i<edge.length;i++){
    var a=edge[i-1],b=edge[i],dx=b.x-a.x,dy=b.y-a.y;
    var dist=Math.hypot(dx,dy);
    if(dist<.00001)continue;
    var normalX=-dy/dist,normalY=dx/dist;
    var divisions=Math.max(1,Math.ceil(dist/step));
    for(var j=1;j<=divisions;j++){
      var t=j/divisions,x=a.x+dx*t,y=a.y+dy*t;
      var wave=activeEdgeWave;
      var rough=.51*Math.sin(x*wave.frequency+y*(wave.frequency*1.53)+wave.phase)+
        .31*Math.sin(x*wave.secondary-y*(wave.secondary*.61)+wave.phase*1.37)+
        .18*Math.sin(x*3.11+y*2.77+i*.41+wave.phase);
      // Irregular but short local tears: no uniform sawtooth and no halos.
      var offset=side*depth*rough;
      ctx.lineTo(x+normalX*offset,y+normalY*offset);
    }
  }
}
function ribbon(ctx,pts,half,r){
  var left=[],right=[],n=pts.length,i;
  if(n<2)return false;
  // V5: a closed rectangle/circle repeats its start at the end. The old
  // open-strip treatment used two different end normals there, creating
  // an incorrectly filled triangular corner on very broad washes. Close
  // the two contour loops instead. V1–V4 remain byte-for-byte unchanged.
  var closed=tissueTornEdges&&n>=4&&dist(pts[0],pts[n-1])<18;
  var unique=closed?n-1:n;
  for(i=0;i<n;i++){
    var before=closed?pts[(i+unique-1)%unique]:pts[Math.max(0,i-1)];
    var after=closed?pts[(i+1)%unique]:pts[Math.min(n-1,i+1)];
    var normal=angle(before,after)+PI/2;
    var taper=closed?1:Math.min(1,.45+Math.min(i,n-i-1)*.47);
    var width=half*taper*(.88+.12*Math.sin(i*1.37)+r.range(-.095,.095));
    left.push(shift(pts[i],normal,width));
    right.push(shift(pts[i],normal,-width*r.range(.80,1.12)));
  }
  if(closed){
    // Consume the same RNG samples as the old ribbon: later layers retain
    // their seed-selected colours/positions, only this seam is repaired.
    left.pop();right.pop();n=unique;
  }
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  if(tissueTornEdges){
    // Trace both loops continuously; for open paths retain the exact V5
    // torn-edge treatment already approved.
    tornTrace(ctx,closed?left.concat(left[0]):left,half,1);
    if(closed){
      // Join adjacent inner/outer corners, never opposite corners.
      // Opposite-corner closure would introduce a diagonal false pigment plane.
      ctx.lineTo(right[0].x,right[0].y);
      tornTrace(ctx,[right[0]].concat(right.slice().reverse()),half,-1);
    }else{
      ctx.lineTo(right[n-1].x,right[n-1].y);
      tornTrace(ctx,right.slice().reverse(),half,-1);
    }
  }else{
    for(i=1;i<n;i++){
      var m=point(left[i-1],left[i],.5);
      ctx.quadraticCurveTo(m.x,m.y,left[i].x,left[i].y);
    }
    ctx.lineTo(right[n-1].x,right[n-1].y);
    for(i=n-2;i>=0;i--){
      m=point(right[i+1],right[i],.5);
      ctx.quadraticCurveTo(m.x,m.y,right[i].x,right[i].y);
    }
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
function paintRibbon(pig,height,pts,width,r,col,opacity,thickness,state){
  // Dry edges are sharp by default; damp and wet shapes carry only a
  // little/the full feather. Each wash gets its own torn-edge frequencies.
  var edgeState=state||'damp';
  activeEdgeWave={frequency:r.range(.20,.66),secondary:r.range(.92,2.19),
    phase:r.range(-Math.PI,Math.PI)};
  if(!ribbon(pig,pts,width*.5,r))return;
  pig.save();
  pig.globalCompositeOperation='multiply';
  pig.globalAlpha=opacity*(edgeState==='dry'?.51:edgeState==='damp'?.40:.30);
  pig.fillStyle=col;
  pig.fill();
  pig.save();
  pig.clip(); // wet rims never sit as artificial dark halos beyond the wash
  pig.strokeStyle=col;
  pig.lineJoin='round';
  // The displaced boundary itself supplies the softness. Blurring every
  // perimeter made the narrow marks look like vector strokes with a glow.
  var feather=edgeState==='wet'?clamp(width*.018,.3,1.25):
    edgeState==='damp'?clamp(width*.006,0,.45):0;
  if(feather>0){
    if('filter' in pig)pig.filter='blur('+feather+'px)';
    else{pig.shadowColor=col;pig.shadowBlur=feather;}
  }
  pig.lineWidth=edgeState==='dry'?clamp(width*.062,1.25,5.8):
    clamp(width*(edgeState==='wet'?.19:.11),2,23);
  pig.globalAlpha=opacity*(edgeState==='dry'?.63:edgeState==='damp'?.29:.24);
  pig.stroke();
  pig.filter='none';pig.shadowBlur=0;
  // Sparse irregular pooling. No second complete contour/parallel CAD line.
  if(edgeState!=='dry'){
    for(var i=1;i<pts.length-1;i++){
      if(!r.chance(edgeState==='wet'?.43:.20))continue;
      var before=pts[i-1],after=pts[i+1],tangent=angle(before,after);
      var sign=r.chance(.5)?1:-1;
      var wobble=.76+.42*r.n();
      var q=shift(pts[i],tangent+PI/2,sign*width*.44*wobble);
      pig.beginPath();
      pig.ellipse(q.x,q.y,clamp(width*r.range(.035,.115),1.8,11),
        clamp(width*r.range(.009,.035),.6,3.0),tangent,0,PI*2);
      pig.globalAlpha=opacity*r.range(.13,.31);
      pig.fillStyle=col;pig.fill();
    }
  }
  pig.restore();
  pig.restore();
}
// An actual filled, transparent pigment pool on a source vector path:
// a second tinted wash moves into the *same* clipped wet shape, instead
// of surrounding a thin outline with an evenly blurred halo.
function paintColourPool(ctx,pts,width,r,colourA,colourB,opacity){
  if(pts.length<2)return false;
  activeEdgeWave={frequency:r.range(.17,.65),secondary:r.range(.9,2.5),
    phase:r.range(-PI,PI)};
  if(!ribbon(ctx,pts,width*.5,r))return false;
  var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(var i=0;i<pts.length;i++){
    minX=Math.min(minX,pts[i].x);maxX=Math.max(maxX,pts[i].x);
    minY=Math.min(minY,pts[i].y);maxY=Math.max(maxY,pts[i].y);
  }
  var a=pts[0],b=pts[pts.length-1],ang=angle(a,b),middle=point(a,b,.5);
  var nx=Math.cos(ang+PI/2),ny=Math.sin(ang+PI/2);
  ctx.save();ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=opacity*.57;ctx.fillStyle=colourA;ctx.fill();
  ctx.clip();
  var shiftSide=r.chance(.5)?1:-1;
  var center=shift(middle,ang+PI/2,shiftSide*width*r.range(.02,.18));
  var radius=width*r.range(.53,.95);
  var blend=ctx.createRadialGradient(center.x,center.y,0,
    center.x,center.y,radius);
  blend.addColorStop(0,colourB);
  blend.addColorStop(.40,lerpHex(colourA,colourB,.62));
  blend.addColorStop(1,colourA);
  ctx.globalAlpha=opacity*.26;
  ctx.fillStyle=blend;
  ctx.fillRect(minX-width,minY-width,
    Math.max(1,maxX-minX+width*2),Math.max(1,maxY-minY+width*2));
  // Capillary pooling is deliberately lopsided and discontinuous.
  // Unlike an outer glow it stays inside the real wash and is strongest
  // on scattered wet banks where water has evaporated.
  ctx.globalAlpha=1;
  for(var k=0;k<Math.min(13,pts.length);k++){
    var j=r.int(0,pts.length-1),before=pts[Math.max(0,j-1)];
    var after=pts[Math.min(pts.length-1,j+1)],tangent=angle(before,after);
    var side=r.chance(.70)?shiftSide:-shiftSide;
    var local=shift(pts[j],tangent+PI/2,side*width*r.range(.27,.47));
    var rad=width*r.range(.07,.23);
    var deposit=ctx.createRadialGradient(local.x,local.y,0,local.x,local.y,rad);
    deposit.addColorStop(0,colourB);
    deposit.addColorStop(1,lerpHex(colourA,colourB,.15));
    ctx.globalAlpha=opacity*r.range(.08,.24);
    ctx.fillStyle=deposit;ctx.beginPath();ctx.arc(local.x,local.y,rad,0,PI*2);ctx.fill();
  }
  ctx.restore();return true;
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
function paintPlanes(pig,height,chains,voids,r,allowance){
  // Solid pigment planes grow off existing structure segments, giving the
  // viewer a painted field instead of many parallel geometric wireframes.
  var n=Math.min(chains.length,Math.ceil(31*allowance));
  for(var i=n-1;i>=0;i--){
    var pts=chains[i].pts;
    if(pts.length<2)continue;
    var j=r.int(1,pts.length-1),a=pts[j-1],b=pts[j],len=dist(a,b);
    if(len<18)continue;
    var middle=point(a,b,.5);
    if(insideVoid(middle,voids)&&r.chance(.9))continue;
    var normal=angle(a,b)+PI/2,side=r.chance(.5)?1:-1;
    var span=clamp(Math.sqrt(chains[i].length)*r.range(3.8,9.2),80,270);
    var pA=shift(a,normal,side*span*r.range(.35,.65));
    var pB=shift(b,normal,side*span*r.range(.68,1.2));
    var apex=shift(point(pA,pB,.5),normal,side*r.range(0,span*.3));
    var warm=r.chance(.21);
    var col=warm?r.pick(C.ochre):(r.chance(.55)?r.pick(C.cream):r.pick(C.blue));
    var mixcol=lerpHex(col,r.pick(C.cream),r.range(.06,.38));
    function shape(ctx){
      ctx.beginPath();ctx.moveTo(a.x,a.y);
      ctx.quadraticCurveTo(middle.x+normal*0,middle.y,b.x,b.y);
      ctx.quadraticCurveTo(pB.x,pB.y,apex.x,apex.y);
      ctx.quadraticCurveTo(pA.x,pA.y,a.x,a.y);ctx.closePath();
    }
    pig.save();shape(pig);pig.fillStyle=mixcol;
    pig.globalAlpha=r.range(.36,.77);pig.fill();pig.clip();
    // Broad, restrained scumbles inside the SAME painted plane.
    for(var k=0;k<r.int(3,7);k++){
      var c=point(a,b,r.range(.10,.9));
      var offset=shift(c,normal,side*r.range(span*.1,span*.88));
      var tangent=angle(a,b)+r.range(-.25,.25);
      var e=shift(offset,tangent,r.range(30,115));
      pathStroke(pig,[offset,e],r.range(6,25),
        lerpHex(col,r.pick(k%2?C.cream:C.umber),r.range(.1,.55)),
        r.range(.11,.32));
    }
    pig.restore();
    height.save();height.globalCompositeOperation='lighter';shape(height);
    height.fillStyle='rgb(38,38,38)';height.globalAlpha=r.range(.18,.48);
    height.fill();height.restore();
  }
}
// Pale translucent scraps along existing source chains. This is an additive
// material pass, not a global whitening/blur or a replacement composition.
// It runs between the existing colour masses and final V1 pencil details.
function addLightTissue(pig,height,w,h,chains,voids,seed,quality){
  var phi=1.61803398875,r=A.makeR(seed+'|light-tissue-v6'),candidates=[];
  var sw=pig.canvas.width,sh=pig.canvas.height,ratio=sw/w;
  var pixels=pig.getImageData(0,0,sw,sh).data;
  function luminance(pt){
    var x=clamp(Math.round(pt.x*ratio),0,sw-1),y=clamp(Math.round(pt.y*ratio),0,sh-1);
    var k=(y*sw+x)*4;
    return pixels[k]*.2126+pixels[k+1]*.7152+pixels[k+2]*.0722;
  }
  function section(pts,start,end){
    var result=[],travel=0;
    for(var j=1;j<pts.length;j++){
      var len=dist(pts[j-1],pts[j]);
      if(len>.001&&travel+len>start&&travel<end){
        var lo=clamp((start-travel)/len,0,1),hi=clamp((end-travel)/len,0,1);
        if(!result.length)result.push(point(pts[j-1],pts[j],lo));
        result.push(point(pts[j-1],pts[j],hi));
      }
      travel+=len;if(travel>=end)break;
    }
    return result;
  }
  for(var i=0;i<Math.min(chains.length,112);i++){
    var ch=chains[i];
    if(ch.length<70||ch.pts.length<2)continue;
    var length=0;
    for(var j=1;j<ch.pts.length;j++)length+=dist(ch.pts[j-1],ch.pts[j]);
    var span=clamp(Math.sqrt(ch.length)*r.range(4.8,7.4),90,230);
    span=Math.min(span,length*.82);
    for(var t=0;t<2;t++){
      var fraction=(t?1/phi:1/(phi*phi))+r.range(-.075,.075);
      var centre=clamp(length*fraction,span*.5,length-span*.5);
      var pts=section(ch.pts,centre-span*.5,centre+span*.5);
      if(pts.length<2)continue;
      var middle=pts[Math.floor(pts.length/2)],width=clamp(span/(phi*phi)*r.range(.7,1.15),27,76);
      if(insideVoid(middle,voids))continue;
      // Keep intended paper reserves and canvas corners unpainted.
      if(pts.some(function(pt){return pt.x<width||pt.y<width||pt.x>w-width||pt.y>h-width||insideVoid(pt,voids)}))continue;
      var dir=angle(pts[0],pts[pts.length-1]),normal=dir+PI/2;
      var sample=[middle,shift(middle,normal,width*.25),shift(middle,normal,-width*.25)];
      var darkness=sample.reduce(function(sum,pt){return sum+Math.max(0,241-luminance(pt))},0)/sample.length;
      if(darkness<15)continue;
      candidates.push({pts:pts,centre:middle,width:width,darkness:darkness,score:darkness+r.range(-6,6)});
    }
  }
  candidates.sort(function(a,b){return b.score-a.score});
  var selected=[],count=quality<.4?4:8;
  for(i=0;i<candidates.length&&selected.length<count;i++){
    var candidate=candidates[i];
    if(selected.some(function(other){return dist(candidate.centre,other.centre)<Math.max(115,(candidate.width+other.width)*phi)}))continue;
    selected.push(candidate);
  }
  for(i=0;i<selected.length;i++){
    var item=selected[i],pts=item.pts,width=item.width;
    // Same V5 torn-contour function; its path is shared by pigment and height.
    var outlineSeed=seed+'|light-tissue-outline|'+i;
    pig.save();ribbon(pig,pts,width*.5,A.makeR(outlineSeed));
    var pale=lerpHex(C.cream[i%C.cream.length],'#fffaf0',r.range(.78,.93));
    var opacity=clamp(.30+item.darkness*.002,.34,.56);
    pig.globalAlpha=opacity;pig.fillStyle=pale;pig.fill();pig.clip();
    // Fine fibres are inside the scrap, with no added edge halo or blur.
    for(j=0;j<22;j++){
      var k=r.int(1,pts.length-1),a=pts[k-1],b=pts[k],dir=angle(a,b);
      var q=shift(point(a,b,r.n()),dir+PI/2,r.range(-width*.43,width*.43));
      pathStroke(pig,[q,shift(q,dir,r.range(3,20))],r.range(.4,.9),
        j%3?'#fffdf5':lerpHex(pale,C.cream[i%C.cream.length],.18),r.range(.035,.10));
    }
    pig.restore();
    height.save();ribbon(height,pts,width*.5,A.makeR(outlineSeed));
    height.globalCompositeOperation='lighter';height.globalAlpha=.22;
    height.fillStyle='rgb(21,21,21)';height.fill();height.restore();
  }
  return {pieces:selected.length,candidates:candidates.length,pass:'pale tissue before unchanged pencil details'};
}

function deposit(pig,height,w,h,chains,voids,seed,quality,kit){
  var r=A.makeR(seed+'|wet-edge-watercolour-v2'),n=chains.length;
  var allowance=quality<.4?.65:1;
  var stats={dry:0,damp:0,wet:0,chromaticAccents:0,dryDeposits:[],
    broadWidthMax:0,heroWidthMax:0,filledPools:0,mixedPigmentPools:0};
  var broad=Math.min(n,Math.ceil(21*allowance));
  for(var i=broad-1;i>=0;i--){
    var ch=chains[i],pts=ch.pts;
    if(pts.length<2||r.chance(.17))continue; // leave genuine negative space
    var middle=pts[Math.floor(pts.length/2)];
    if(insideVoid(middle,voids)&&r.chance(.85))continue;
    // ~30% less breadth than V2e, and never a giant veil across the page.
    var width=clamp(49+Math.sqrt(ch.length)*r.range(2.0,3.85),50,127);
    stats.broadWidthMax=Math.max(stats.broadWidthMax,width);
    var wash=kit.ink.length&&r.chance(.29)?
      lerpHex(pigmentInk(r.pick(kit.ink)),r.pick(C.cream),r.range(.08,.20)):
      lerpHex(palette(i,r),r.pick(C.cream),r.range(.12,.37));
    var state=A.makeR(seed+'|water-state-broad-v2e|'+i).chance(.48)?'wet':'damp';
    // Retain overall sparse geometry but let a few existing strokes become
    // coloured *areas*. No new positions, objects or generator changes.
    var poolChoice=A.makeR(seed+'|v2g-pool|'+i);
    if(poolChoice.chance(.37)){
      var other=kit.ink.length>1?pigmentInk(poolChoice.pick(kit.ink)):
        pigmentInk(poolChoice.pick(C.ochre));
      var mixed=paintColourPool(pig,pts,width,r,wash,other,r.range(.47,.76));
      if(mixed){stats.filledPools++;stats.mixedPigmentPools++;}
    }else{
      paintRibbon(pig,null,pts,width,r,wash,r.range(.41,.70),0,state);
    }
    stats[state]++;
  }
  var hero=Math.min(n,Math.ceil(68*allowance));
  for(i=0;i<hero;i++){
    ch=chains[i];pts=ch.pts;
    if(pts.length<2)continue;
    if(insideVoid(pts[0],voids)&&r.chance(.8))continue;
    // Slimmer structural strokes stay readable beside the larger washes.
    width=clamp(Math.sqrt(ch.length)*r.range(.90,1.84),11,i<22?67:44);
    stats.heroWidthMax=Math.max(stats.heroWidthMax,width);
    if(i>=broad&&r.chance(.23))continue;
    // Most important structures dry crisply; the remaining washes retain
    // authentic damp/wet-in-wet edges instead of a universal blur.
    var stateR=A.makeR(seed+'|water-state-hero-v2e|'+i);
    var roll=stateR.n(),state=roll<.57?'dry':roll<.82?'damp':'wet';
    // Retain selected vivid ink even for damp/wet washes; the old material
    // palette blended all coloured groups toward desaturated tissue hues.
    var accent=i<43&&kit.ink.length&&stateR.chance(.55);
    var pigment=pigmentInk(accent?stateR.pick(kit.ink):palette(i,r));
    if(accent)stats.chromaticAccents++;
    var opacity=r.range(.55,.80);
    if(state==='dry'){
      // Drawing after water transport ensures these true dried edges and
      // saturated seeded-ink accents survive the wet diffusion phase.
      stats.dryDeposits.push({pts:pts,width:width,col:pigment,opacity:opacity,
        key:'hero-'+i});
    }else{
      var vividPool=A.makeR(seed+'|v2g-hero-pool|'+i);
      if(i<36&&vividPool.chance(.23)){
        var second=kit.ink.length>1?
          pigmentInk(vividPool.pick(kit.ink)):pigmentInk(vividPool.pick(C.ochre));
        if(paintColourPool(pig,pts,width,r,pigment,second,opacity)){
          stats.filledPools++;stats.mixedPigmentPools++;
        }
      }else paintRibbon(pig,null,pts,width,r,pigment,opacity,0,state);
    }
    stats[state]++;
  }
  var details=Math.min(n,Math.ceil(52*allowance));
  for(i=0;i<details;i++){
    ch=chains[i];pts=ch.pts;
    if(pts.length<3||r.chance(.48))continue;
    var j=r.int(1,pts.length-2);
    var p0=pts[j-1],p1=pts[j+1],mid=point(p0,p1,.5);
    if(insideVoid(mid,voids))continue;
    var normal=angle(p0,p1)+PI/2;
    var trace=linePath(shift(p0,normal,r.range(-7,7)),
      shift(p1,normal,r.range(-7,7)),dist(p0,p1)*.09,r);
    var detailState=A.makeR(seed+'|water-state-detail-v2e|'+i).chance(.65)?'dry':'damp';
    if(detailState==='dry'){
      stats.dryDeposits.push({pts:trace,width:r.range(4.5,12),
        col:palette(i,r),opacity:r.range(.35,.60),key:'detail-'+i});
    }else{
      paintRibbon(pig,null,trace,r.range(5,15),r,palette(i,r),r.range(.34,.57),0,'damp');
    }
    stats[detailState]++;
  }
  return stats;
}
function finishDryAccents(ctx,chains,seed,quality,kit,voids,stats){
  var rendered=0,pen=A.makeR(seed+'|v2e-fine-dry-ink'),count=Math.min(chains.length,quality<.4?17:34);
  ctx.save();
  ctx.globalCompositeOperation='multiply';
  for(var i=0;i<count;i++){
    var pts=chains[i].pts;
    if(pts.length<2||pen.chance(i<13?.39:.70))continue;
    var middle=pts[Math.floor(pts.length/2)];
    if(insideVoid(middle,voids))continue;
    var hue=kit.ink.length?pigmentInk(pen.pick(kit.ink)):'#625951';
    var width=clamp(chains[i].width*.17+pen.range(.3,1.15),.65,2.6);
    pathStroke(ctx,pts,width,hue,pen.range(.27,.52));
    rendered++;
  }
  ctx.restore();
  return rendered;
}

// Bring back the distinct pencil/graphite linework lost when dark umbers
// were converted to seed-tinted pigments. It follows existing vector chains,
// adds no new composition geometry, and never touches historical v1 output.
function graphiteOverlay(ctx,chains,seed,quality){
  var r=A.makeR(seed+'|graphite-linework-v2'),n=Math.min(chains.length,quality<.4?24:85);
  var drawn=0;
  ctx.save();
  ctx.globalCompositeOperation='multiply';
  for(var i=0;i<n;i++){
    var path=chains[i].pts;
    if(path.length<2||r.chance(i<15?.10:.36))continue;
    var graphite=r.pick(originalC.umber);
    var weight=Math.max(.65,Math.min(3.4,chains[i].width*.24+r.range(.1,1.05)));
    var alpha=r.range(.26,.63)*(i<18?1:.76);
    pathStroke(ctx,path,weight,graphite,alpha);drawn++;
    // The second, slightly wandering pass is dry pencil grain along the
    // same sampled marks, not an opaque outline around every colour field.
    if(i<24&&r.chance(.48)){
      var lean=r.range(-2.2,2.2),offset=path.map(function(pt,j){
        var a=path[Math.max(0,j-1)],b=path[Math.min(path.length-1,j+1)];
        return shift(pt,angle(a,b)+PI/2,lean);
      });
      pathStroke(ctx,offset,Math.max(.5,weight*.44),graphite,alpha*.40);
    }
  }
  ctx.restore();
  return drawn;
}
function hashNoise(x,y,seed){
  var k=(Math.imul(x,374761393)^Math.imul(y,668265263)^seed)|0;
  k=Math.imul(k^(k>>>13),1274126177);
  return ((k^(k>>>16))>>>0)/4294967295;
}
function shade(pig,height,out,w,h,seed,kit){
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
      // Historical Tissue v1 lighting remains byte-for-byte untouched.
      // The v2 paper already contains the exact chosen cream colour:
      // the old 1.09× diffuse boost + specular shine clipped cream to white.
      // Keep v2 paper neutral; apply restrained relief only to raised pigment.
      var raised=kit?clamp((center-13)/48,0,1):1;
      var light=kit?(1+raised*(.055*(diffuse-.78)+.045*bump*spec-.010*cavity))
        :(.90+.19*diffuse+.14*bump*spec-.027*cavity);
      var shine=kit?raised*2.2*bump*spec:(9+26*bump)*spec;
      if(kit&&kit.revision>=4){
        // V1 relief on pigment; bare paper keeps its default cream base.
        light=1+raised*((.90+.19*diffuse+.14*bump*spec-.027*cavity)-1);
        shine=raised*(9+26*bump)*spec;
      }
      px[k]=clamp(Math.round(px[k]*light+shine),0,255);
      px[k+1]=clamp(Math.round(px[k+1]*light+shine*.91),0,255);
      px[k+2]=clamp(Math.round(px[k+2]*light+shine*.77),0,255);
    }
  }
  out.putImageData(source,0,0);
}
// Deterministic, bilinear-smoothed texture drives capillary transport.
// A low-frequency flow field changes permeability across the water edge;
// it does not draw new composition geometry or modify the fixed paper.
function paperNoise(x,y,cell,seed){
  var u=x/cell,v=y/cell,ix=Math.floor(u),iy=Math.floor(v);
  var tx=u-ix,ty=v-iy;
  tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);
  var a=hashNoise(ix,iy,seed),b=hashNoise(ix+1,iy,seed);
  var c=hashNoise(ix,iy+1,seed),d=hashNoise(ix+1,iy+1,seed);
  return mix(mix(a,b,tx),mix(c,d,tx),ty);
}
// The paper is a continuous procedural field, NOT a tiled bitmap. A
// seed-chosen rotation prevents a visible axis grid; incommensurate scales
// and two domain-warped coordinates disrupt repeated noise landmarks.
function materialPaperField(x,y,ratio,seedValue){
  var theta=((seedValue>>>0)%65521)/65521*PI*2;
  var ca=Math.cos(theta),sa=Math.sin(theta);
  var u=x*ca-y*sa,v=x*sa+y*ca;
  var wa=(paperNoise(u*.81+v*.17,v*.92-u*.11,
    Math.max(12,89*ratio),seedValue^0x519327)-.5)*22*ratio;
  var wb=(paperNoise(u*.67-v*.22,v*.78+u*.24,
    Math.max(12,73*ratio),seedValue^0x627419)-.5)*23*ratio;
  var fx=u+wa,fy=v+wb;
  var broad=paperNoise(fx*.87+fy*.24,fy*.97-fx*.19,
    Math.max(8,59*ratio),seedValue^0x7151);
  var medium=paperNoise(fx*1.19-fy*.31,fy*1.08+fx*.16,
    Math.max(3,16.7*ratio),seedValue^0x9127);
  var grain=paperNoise(fx*1.47+fy*.33,fy*.93-fx*.21,
    Math.max(1.4,4.3*ratio),seedValue^0x3181);
  var granular=hashNoise(Math.floor(fx*1.43),Math.floor(fy*1.87),
    seedValue^0x4251);
  return {
    tooth:clamp(.17+.51*broad+.24*medium+.08*grain+
      .06*(granular-.5),.09,.96),
    fibre:clamp(.39+.35*medium+.26*grain,.1,.95),
    grain:granular,
    warpX:wa*.41+(grain-.5)*6*ratio,
    warpY:wb*.41+(medium-.5)*5*ratio
  };
}
// Published solely on the experimental branch for deterministic, non-tiling
// regression checks, not an editor API or a production material interface.
A.sampleWatercolourPaperTooth=function(seed,x,y){
  return materialPaperField(x,y,1,A.hash(seed+'|paper-flow-v2f')>>>0).tooth;
};
// Unlike a global blur, pigment moves only along water-loaded, paper-
// dependent capillaries. Optical density is transferred (and conserved by
// the symmetric 4-neighbour stencil) before settling into paper valleys.
function flowThroughPaper(ctx,w,h,seed,paper,ratio,chains){
  var frame=ctx.getImageData(0,0,w,h),px=frame.data;
  var total=w*h;
  var source=new Float32Array(total*3),next=new Float32Array(total*3);
  var tooth=new Float32Array(total),water=new Float32Array(total),fibres=new Float32Array(total),paperGrain=new Uint8Array(total);
  var seedValue=A.hash(seed+'|paper-flow-v2f')>>>0,pi=0;
  for(var y=0;y<h;y++)for(var x=0;x<w;x++,pi++){
    var j=pi*3,loaded=0;
    var surface=materialPaperField(x,y,ratio,seedValue);
    var sx=clamp(x+surface.warpX,0,w-1.0001);
    var sy=clamp(y+surface.warpY,0,h-1.0001);
    var x0=Math.floor(sx),y0=Math.floor(sy),tx=sx-x0,ty=sy-y0;
    var q00=(y0*w+x0)*4,q01=q00+4,q10=q00+w*4,q11=q10+4;
    for(var c=0;c<3;c++){
      var sample=mix(mix(px[q00+c],px[q01+c],tx),
        mix(px[q10+c],px[q11+c],tx),ty);
      var density=Math.max(0,Math.log((paper[c]+1)/(sample+1)));
      source[j+c]=density;if(density>loaded)loaded=density;
    }
    tooth[pi]=surface.tooth;
    water[pi]=clamp(loaded*3.1,0,1);
    fibres[pi]=surface.fibre;
    paperGrain[pi]=Math.round(surface.grain*255);
  }
  var steps=qualityForFlow(w,h); // resolution-adaptive, never dependent on clock time
  var passes=steps;
  for(var round=0;round<passes;round++){
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      pi=y*w+x;var k=pi*3,v=source[k],u=source[k+1],z=source[k+2];
      var here=tooth[pi],wet=water[pi];
      var sum0=0,sum1=0,sum2=0;
      var stride=round<2?2:1; // long wet capillaries followed by fine settling
      // Fibre direction favours east/west in some regions and north/south
      // in others; the same interface gets the same flux from both sides.
      for(var side=0;side<4;side++){
        var nx=x+(side===0?stride:side===1?-stride:0);
        var ny=y+(side===2?stride:side===3?-stride:0);
        if(nx<0||ny<0||nx>=w||ny>=h)continue;
        var q=ny*w+nx;
        // Interface mobility is symmetric: pigment is redistributed,
        // not created, when a pair of paper fibres exchange wash water.
        var stretch=(fibres[pi]+fibres[q])*.5;
        var anis=side<2?(.74+.48*stretch):(.74+.48*(1-stretch));
        var transport=(.067+.045*(here+tooth[q]))*anis*
          (.53+.47*Math.max(wet,water[q]));
        var other=q*3;
        sum0+=(source[other]-v)*transport;
        sum1+=(source[other+1]-u)*transport;
        sum2+=(source[other+2]-z)*transport;
      }
      next[k]=Math.max(0,v+sum0);
      next[k+1]=Math.max(0,u+sum1);
      next[k+2]=Math.max(0,z+sum2);
    }
    var swap=next;next=source;source=swap;
  }
  // Keep bloom centres on real painted geometry, and reject paper/voids.
  // A clear-water droplet pushes pigment outward into a ragged, low-contrast
  // cauliflower rim; there is no drawn circle/stroke or stock texture.
  var drops=[],rand=A.makeR(seed+'|water-blooms-v3');
  for(var cidx=0;cidx<Math.min(35,chains.length)&&drops.length<4;cidx++){
    var ch=chains[cidx],points=ch.pts;
    if(points.length<3||rand.chance(.71))continue;
    var pos=points[Math.floor(points.length*rand.range(.25,.75))];
    var cx=Math.round(pos.x*ratio),cy=Math.round(pos.y*ratio);
    if(cx<20||cy<20||cx>=w-20||cy>=h-20)continue;
    var index=(cy*w+cx)*3;
    var localDensity=Math.max(source[index],source[index+1],source[index+2]);
    // Backruns need a sufficiently damp, overlapping wash, not bare paper
    // or a single faint trace. Reject flat/pale candidates.
    var overlap=0;
    for(var oy=-5;oy<=5;oy+=5)for(var ox=-5;ox<=5;ox+=5){
      var nidx=((cy+oy)*w+cx+ox)*3;
      if(Math.max(source[nidx],source[nidx+1],source[nidx+2])>.072)overlap++;
    }
    if(localDensity<.14||overlap<7)continue;
    var radius=clamp(Math.sqrt(ch.length)*rand.range(.30,.65)*ratio,10,30);
    if(drops.some(function(d){return Math.hypot(cx-d.x,cy-d.y)<radius*2.7}))continue;
    drops.push({x:cx,y:cy,r:radius,phase:rand.range(0,Math.PI*2)});
  }
  for(y=0;y<h;y++)for(x=0;x<w;x++){
    pi=y*w+x;var p=pi*3,out=pi*4;
    var grit=(hashNoise(x,y,seedValue^0x4251)-.5);
    // Loaded/dark washes granulate more strongly than faint tints; lighter
    // washes remain smooth and unpainted paper stays exactly #f5f0e6.
    var concentration=clamp(Math.max(source[p],source[p+1],source[p+2])*3.8,0,1);
    var grainStrength=.18+.82*concentration;
    var scale=((tooth[pi]-.5)*.78+grit*.32)*grainStrength;
    var settle=clamp(1+scale,.62,1.46);
    var bloom=1;
    for(var d=0;d<drops.length;d++){
      var drop=drops[d],dx=x-drop.x,dy=y-drop.y;
      if(Math.abs(dx)>drop.r*1.3||Math.abs(dy)>drop.r*1.3)continue;
      var theta=Math.atan2(dy,dx);
      var ripple=.11*Math.sin(theta*5+drop.phase)+
        .07*Math.sin(theta*9-drop.phase*1.3);
      var radial=Math.hypot(dx,dy)/(drop.r*(1+ripple));
      // A soft low-concentration interior and a weak, irregular outer rim.
      bloom*=1-.27*Math.exp(-Math.pow(radial/.67,4))+
        .10*Math.exp(-Math.pow((radial-.98)/.21,2));
    }
    for(c=0;c<3;c++){
      // A gentle upper bound on optical density stops dark overlapping
      // glazes collapsing into electronic near-black. Glazes still stack.
      var amount=Math.min(.89,source[p+c]*settle*bloom);
      // Base cream stays nominally unchanged; its very subtle tooth
      // shading is continuous across blank and painted sheet, not a tile.
      var paperShade=(tooth[pi]-.5)*4.8+(paperGrain[pi]/255-.5)*2.4;
      px[out+c]=clamp(Math.round(paper[c]*Math.exp(-amount)+paperShade),0,255);
    }
    px[out+3]=255;
  }
  ctx.putImageData(frame,0,0);
  return {paperModel:'V2g non-tiled rotated tooth + visible fibre shading + capillary flow',
    diffusionPasses:passes,waterBlooms:drops.length};
}
function qualityForFlow(w,h){return w*h>1100000?3:5}
A.watercolourMaterialExperiment=function(ctx,w,h,chains,meta,seed,quality,kit){
  if(!kit||kit.revision!==6)
    throw new Error('Wet-edge experiment requires current V6 seeded tissue ink kit');
  C=coloursForInk(kit);
  tissueTornEdges=true; // reuse V6's approved repaired, ragged contours
  tissueLightEnabled=false;
  try{
    var ratio=quality<.30?.32:(quality<.65?.53:(quality<1.5?.78:1.18));
    var sw=Math.max(1,Math.round(w*ratio)),sh=Math.max(1,Math.round(h*ratio));
    var layer=document.createElement('canvas');
    layer.width=sw;layer.height=sh;
    var pctx=layer.getContext('2d');
    pctx.scale(ratio,ratio);
    pctx.fillStyle=kit.paper;
    pctx.fillRect(0,0,w,h);
    var washStats=deposit(pctx,null,w,h,chains,meta.voids||[],seed,quality,kit);
    pctx.setTransform(1,0,0,1,0,0);
    var paperStats=flowThroughPaper(pctx,sw,sh,seed,kit.paperRGB,ratio,chains);
    ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.drawImage(layer,0,0,w,h);
    for(var i=0;i<washStats.dryDeposits.length;i++){
      var mark=washStats.dryDeposits[i];
      paintRibbon(ctx,null,mark.pts,mark.width,
        A.makeR(seed+'|v2e-dry-outline|'+mark.key),mark.col,mark.opacity,0,'dry');
    }
    var dryDetail=finishDryAccents(ctx,chains,seed,quality,kit,meta.voids||[],washStats);
    ctx.restore();
    A.lastWatercolourExperimentStats={
      width:sw,height:sh,chains:chains.length,
      paper:kit.paper,inkColours:kit.ink.slice(),
      effect:'V2g asymmetric pigment pooling, mixed transparent colour washes and visible seeded paper tooth',
      washStates:{dry:washStats.dry,damp:washStats.damp,wet:washStats.wet},
      widthCaps:{broad:127,hero:67},washWidths:{broadMax:washStats.broadWidthMax,
        heroMax:washStats.heroWidthMax},
      chromaticAccents:washStats.chromaticAccents,dryDetails:dryDetail,
      filledPools:washStats.filledPools,mixedPigmentPools:washStats.mixedPigmentPools,
      paperFlow:paperStats,
      referenceMaterial:'Tissue & Graphite V6'
    };
  }finally{
    C=originalC;
    tissueTornEdges=false;
    tissueLightEnabled=false;
  }
};
})(window.AlgoArt);
