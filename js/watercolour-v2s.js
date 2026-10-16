// Watercolour V2S: versioned source-hue watercolour, preserves V2R historical links.
// By default NEW paintings use their exact Marker φ placement. Historical V2S
// links without a fit parameter retain the original published fitted image.
// No geometry changes to Marker or Tissue; SVG paths remain untouched.
// Pigment-flow algorithm derives from V2R; credits retained below.
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
// Draft-only material controls, not a live editor setting. One rim and one
// irregular capillary falloff, with no concentric cosmetic stroke passes.
A.watercolourV2kOptions={edgeDarkening:.72,interiorMottle:.24,paleEdgePooling:.75,
  edgeBandRadius:8};
// Isolated V2R dry-mark experiment. Toggle off to reproduce V2P exactly.
A.watercolourV2rOptions=A.watercolourV2rOptions||{dryMedia:true};
A.watercolourV2sOptions={fidelity:true,fitToSheet:true};
function sourcePigment(ch){
  if(!A.watercolourV2sOptions.fidelity||!ch||!ch.sourceInk)return null;
  var ink=String(ch.sourceInk).trim(),rgb=null;
  // The Marker engine serializes chromatic inks as CSS hsl(...)!
  // Share the same deterministic HSL->sRGB model as the V6 tissueKit;
  // do not silently drop source hue by accepting only #hex/rgb.
  var m=ink.match(/^hsl\(\s*([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if(m){
    var h=((+m[1]%360)+360)%360/60,sat=+m[2]/100,light=+m[3]/100;
    var chroma=(1-Math.abs(2*light-1))*sat;
    var x=chroma*(1-Math.abs(h%2-1)),base=light-chroma/2;
    var t=h<1?[chroma,x,0]:h<2?[x,chroma,0]:h<3?[0,chroma,x]:
      h<4?[0,x,chroma]:h<5?[x,0,chroma]:[chroma,0,x];
    rgb=t.map(function(v){return Math.round(clamp((v+base)*255,0,255))});
  }else if((m=ink.match(/^#([0-9a-f]{6})$/i))){
    rgb=[0,2,4].map(function(i){return parseInt(m[1].slice(i,i+2),16)});
  }else if((m=ink.match(/^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/i))){
    rgb=[+m[1],+m[2],+m[3]];
  }
  if(!rgb)return null;
  // Monochrome source inks already map correctly in V2R. Replacing the
  // engineered grey wash with raw dark Marker greys makes the φ frames
  // unnecessarily heavy. Only override where a real source hue exists.
  if(Math.max.apply(null,rgb)-Math.min.apply(null,rgb)<18)return null;
  return pigmentInk('rgb('+rgb.join(',')+')');
}
function paintSourceOpenLines(ctx,chains,presentation,seed,w,h){
  // All drawn geometry comes from the original recorded SVG paths.
  // V2R simplified them to 250 chains, then often rendered only the first
  // 68 washes and 34 accents. Recover selected medium/fine paths only;
  // never fabricate new marks or repurpose the source composition RNG.
  if(!A.watercolourV2sOptions.fidelity)return {candidates:0,rendered:0,coloured:0};
  var original=A.watercolourV2sAllChains||[];
  var candidateCount=0,painted=0,coloured=0,rejected=0;
  var st=presentation.stats||{},p=st.before||{},q=st.after||{};
  var factor=st.factor||1;
  var cx=((p.minX||0)+(p.maxX||0))*w*.5;
  var cy=((p.minY||0)+(p.maxY||0))*h*.5;
  var tx=((q.minX||0)+(q.maxX||0))*w*.5;
  var ty=((q.minY||0)+(q.maxY||0))*h*.5;
  var limit=118;
  ctx.save();
  for(var i=23;i<original.length&&painted<limit;i++){
    var ch=original[i],ink=sourcePigment(ch);
    if(!ink||ch.pts.length<2||ch.length<11)continue;
    // Only recover genuinely open strokes. Repainting closed loops as
    // thin outlines hardens watercolour rings and violates the original
    // intent of this source-gesture recovery pass.
    var firstPoint=ch.pts[0],lastPoint=ch.pts[ch.pts.length-1];
    if(dist(firstPoint,lastPoint)<Math.min(36,Math.max(7,ch.length*.15)))
      continue;
    var spread=pigmentSpread(ink);
    // Do not duplicate all structural masses as uniform fine outlines.
    // Prefer coloured/source-distinct interior and peripheral gestures,
    // including paths beyond the V2R first-250 simplification limit.
    var probability=i<90?.55:i<250?.35:.21;
    if(spread>48)probability+=.28;
    var choice=(A.hash(seed+'|v2s-retained-line|'+ch.sourceIndex)>>>0)/4294967296;
    candidateCount++;
    if(choice>probability){rejected++;continue;}
    var pts=ch.pts.map(function(pt){
      return {x:tx+(pt.x-cx)*factor,y:ty+(pt.y-cy)*factor};
    });
    var width=clamp(ch.width*.24*factor,.85,3.2);
    var alpha=clamp(.36+spread*.0012,.40,.60);
    // Deliberately reserve continuity for source strokes that were absent
    // in V2R; paper tooth and width changes remain V2R dry brush.
    if(paintContinuousDryBrush(ctx,pts,width,ink,alpha)){
      painted++;if(spread>35)coloured++;
    }
  }
  ctx.restore();
  return {candidates:candidateCount,rendered:painted,coloured:coloured,
    rejected:rejected,available:original.length};
}
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
// Material-specific pigment gamut: retain each seed's hues and relative
// brightness but limit electronic RGB chroma (especially violet/green).
// The generator and archived Marker/Tissue palettes are never modified.
function pigmentInk(col){
  var nums=col[0]==='#'?[1,3,5].map(function(i){return parseInt(col.slice(i,i+2),16)})
    :(col.match(/[0-9]+/g)||[]).slice(0,3).map(Number);
  if(nums.length!==3||nums.some(function(n){return !Number.isFinite(n)}))return col;
  var low=Math.min.apply(null,nums),high=Math.max.apply(null,nums);
  var spread=high-low;
  if(spread<=111)return col;
  var neutral=nums[0]*.2126+nums[1]*.7152+nums[2]*.0722;
  var factor=111/spread;
  var result=nums.map(function(v){return clamp(Math.round(neutral+(v-neutral)*factor),0,255)});
  // Subdue isolated synthetic-looking cyan/mint while leaving the seed's
  // chromatic relationships intact. Near-monochrome inks are unaffected.
  if(nums[0]<nums[1]*.88&&
    (nums[2]>nums[0]*1.11||nums[1]>nums[2]*1.18)){
    var earth=[136,129,116],strength=.16;
    result=result.map(function(v,i){return Math.round(mix(v,earth[i],strength))});
  }
  return 'rgb('+result.join(',')+')';
}
function pigmentSpread(col){
  var numbers=col[0]==='#'?[1,3,5].map(function(i){return parseInt(col.slice(i,i+2),16)})
    :(col.match(/[0-9]+/g)||[]).slice(0,3).map(Number);
  return Math.max.apply(null,numbers)-Math.min.apply(null,numbers);
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
// V2N: raster coverage of the actual damp/wet ribbons, independent of pigment and dry ink.
var activeWashMaskCtx=null,activeSoftMaskCtx=null,activePigmentLayerCtx=null;
var activeSoftForShape=false,activeEdgeDry=false,activeDryMediaPhase=false;
var dryMediaStats={continuousDryStrokes:0,continuousSamples:0,
  dryBrushHoles:0,dryBrushRejected:0,dryShardCount:0,
  dryShardHoles:0,dryShardRejected:0};
var activeEdgePaperSeed=0,activeEdgeRatio=1;
var activeEdgeTextureStats={samples:0,drySamples:0,wickSamples:0,
  maxDryDisplacement:0,maxWetDisplacement:0};
function selectSoftEdge(seed,group,index,state){
  return state!=='dry'&&((A.hash(seed+'|v2o-soft-edge|'+group+'|'+index)>>>0)/4294967296)<.28;
}
function pigmentLuma(col){
  var v=col[0]==='#'?[1,3,5].map(function(i){return parseInt(col.slice(i,i+2),16)}):
    (col.match(/[0-9]+/g)||[]).slice(0,3).map(Number);
  return v.length===3?v[0]*.2126+v[1]*.7152+v[2]*.0722:0;
}

var lightTissueStats={pieces:0};
// V2P: displaced contour follows the SAME non-tiled paper field as the wash.
// Replace regularly oscillating V2O wavelets: there are no short parallel
// pen strokes or tick marks, only one irregular, continuous painted boundary.
function tornTrace(ctx,edge,half,side,mirror){
  var ratio=activeEdgeRatio,seed=activeEdgePaperSeed;
  var depth=clamp(half*.068,1.2,3.3);
  // Dry edges must remain crisp, while wet and soft-wet edges may wick.
  var reach=activeEdgeDry?1.25:activeSoftForShape?1.55:2.30;
  for(var i=1;i<edge.length;i++){
    var a=edge[i-1],b=edge[i],dx=b.x-a.x,dy=b.y-a.y;
    var length=Math.hypot(dx,dy);
    if(length<.00001)continue;
    var nx=-dy/length,ny=dx/length,travel=0;
    while(travel<length){
      // Continuous paper granularity controls sampling spacing (2.7-5.1px)
      // without a repetitive comb or jumps in the contour's end position.
      var prior=Math.min(1,travel/length);
      var sx=(a.x+dx*prior)*ratio,sy=(a.y+dy*prior)*ratio;
      var spacing=3.9+2.4*(paperNoise(sx*.91+sy*.13,
        sy*.96-sx*.17,Math.max(3,12*ratio),seed^0x29271)-.5);
      travel=Math.min(length,travel+spacing);
      var t=travel/length,x=a.x+dx*t,y=a.y+dy*t,wx=x*ratio,wy=y*ratio;
      var paper=materialPaperField(wx,wy,ratio,seed);
      // Broad formation plus finer fibre displacement creates correlated,
      // branching-looking bleed with variable length, never isolated hairs.
      var longWave=paperNoise(wx*.84+wy*.18,wy*.91-wx*.14,
        Math.max(5,24*ratio),seed^0x62873);
      var medium=paperNoise(wx*1.07-wy*.24,wy*.97+wx*.11,
        Math.max(2.6,10*ratio),seed^0x41795);
      var fine=paperNoise(wx*1.29+wy*.12,wy*1.23-wx*.25,
        Math.max(1.3,4.7*ratio),seed^0x90351);
      var absorption=clamp(.57*medium+.30*fine+.13*(1-paper.tooth),0,1);
      // Sparse capillary projections are shaped into the existing contour,
      // not drawn as repeated perpendicular strokes.
      var wick=clamp((absorption-.65)*3.1,0,1);
      var shape=(longWave-.5)*1.35+(medium-.5)*1.2+
        (fine-.5)*.30+(paper.fibre-.5)*.22+
        (activeEdgeDry?0:wick*.22);
      var offset=clamp(shape*depth*.78,-reach,reach);
      if(activeSoftForShape)offset*=.78;
      activeEdgeTextureStats.samples++;
      if(activeEdgeDry){
        activeEdgeTextureStats.drySamples++;
        activeEdgeTextureStats.maxDryDisplacement=Math.max(
          activeEdgeTextureStats.maxDryDisplacement,Math.abs(offset));
      }else{
        if(wick>.20)activeEdgeTextureStats.wickSamples++;
        activeEdgeTextureStats.maxWetDisplacement=Math.max(
          activeEdgeTextureStats.maxWetDisplacement,Math.abs(offset));
      }
      ctx.lineTo(x+nx*offset*side,y+ny*offset*side);
      if(mirror)mirror.lineTo(x+nx*offset*side,y+ny*offset*side);
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
  var mirror=null;
  if(activeWashMaskCtx&&ctx===activePigmentLayerCtx){
    var m1=activeWashMaskCtx,m2=activeSoftMaskCtx;
    mirror={
      beginPath:function(){m1.beginPath();m2.beginPath();},
      moveTo:function(x,y){m1.moveTo(x,y);m2.moveTo(x,y);},
      lineTo:function(x,y){m1.lineTo(x,y);m2.lineTo(x,y);},
      quadraticCurveTo:function(x,y,u,v){
        m1.quadraticCurveTo(x,y,u,v);m2.quadraticCurveTo(x,y,u,v);
      },
      closePath:function(){m1.closePath();m2.closePath();}
    };
  }
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  if(mirror){mirror.beginPath();mirror.moveTo(left[0].x,left[0].y);}
  if(tissueTornEdges){
    // Trace both loops continuously; for open paths retain the exact V5
    // torn-edge treatment already approved.
    tornTrace(ctx,closed?left.concat(left[0]):left,half,1,mirror);
    if(closed){
      // Join adjacent inner/outer corners, never opposite corners.
      // Opposite-corner closure would introduce a diagonal false pigment plane.
      ctx.lineTo(right[0].x,right[0].y);
      if(mirror)mirror.lineTo(right[0].x,right[0].y);
      tornTrace(ctx,[right[0]].concat(right.slice().reverse()),half,-1,mirror);
    }else{
      ctx.lineTo(right[n-1].x,right[n-1].y);
      if(mirror)mirror.lineTo(right[n-1].x,right[n-1].y);
      tornTrace(ctx,right.slice().reverse(),half,-1,mirror);
    }
  }else{
    for(i=1;i<n;i++){
      var m=point(left[i-1],left[i],.5);
      ctx.quadraticCurveTo(m.x,m.y,left[i].x,left[i].y);
      if(mirror)mirror.quadraticCurveTo(m.x,m.y,left[i].x,left[i].y);
    }
    ctx.lineTo(right[n-1].x,right[n-1].y);
    if(mirror)mirror.lineTo(right[n-1].x,right[n-1].y);
    for(i=n-2;i>=0;i--){
      m=point(right[i+1],right[i],.5);
      ctx.quadraticCurveTo(m.x,m.y,right[i].x,right[i].y);
      if(mirror)mirror.quadraticCurveTo(m.x,m.y,right[i].x,right[i].y);
    }
  }
  ctx.closePath();if(mirror)mirror.closePath();return true;
}
// Record only genuine damp/wet *area* paths. Tiny ink strokes and deferred
// dry accents have no coverage here, even where their pigment is dark.
function registerWetWash(wetness,soft){
  if(!activeWashMaskCtx)return;
  activeWashMaskCtx.save();
  activeWashMaskCtx.globalCompositeOperation='source-over';
  activeWashMaskCtx.globalAlpha=clamp(wetness,0,1);
  activeWashMaskCtx.fillStyle='#ffffff';
  activeWashMaskCtx.fill();
  activeWashMaskCtx.restore();
  if(soft&&activeSoftMaskCtx){
    activeSoftMaskCtx.save();
    activeSoftMaskCtx.globalCompositeOperation='source-over';
    activeSoftMaskCtx.globalAlpha=clamp(wetness,0,1);
    activeSoftMaskCtx.fillStyle='#ffffff';
    activeSoftMaskCtx.fill();
    activeSoftMaskCtx.restore();
  }
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
// Watercolour-only edge transport on existing *thin* paths, inspired by the
// separation of dab opacity, pickup and smudge in Krita/MyPaint. Never blur the
// entire line: let small, seeded, one-sided capillary deposits escape it.
// Source path, core geometry, colour, orientation and canvas remain unchanged.
var activeMicroBleedCount=0;
function thinLineMicroBleed(ctx,pts,width,colour,opacity,r,wetness){
  if(pts.length<2||wetness<=0||width>23)return 0;
  var strokes=0,side=r.chance(.5)?1:-1;
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=colour;
  for(var j=1;j<pts.length;j++){
    var a=pts[j-1],b=pts[j],length=dist(a,b);
    if(length<.5)continue;
    var count=Math.min(9,Math.max(1,Math.ceil(length/18)));
    for(var k=0;k<count;k++){
      // One in roughly 2–4 sections wicks into paper; neighbouring bands
      // share a side bias but vary in radius and wetness.
      if(!r.chance(wetness>.7?.41:.27))continue;
      if(r.chance(.19))side=-side;
      var t=(k+r.range(.18,.83))/count;
      var p=point(a,b,t),normal=angle(a,b)+PI/2;
       // Avoid overlapping puddles where thin source paths meet.
       if(Math.min(dist(p,a),dist(p,b))<Math.max(2.3,width*1.15))continue;
      var spill=clamp(.42+width*.047,.46,1.50)*wetness;
      var edge=shift(p,normal,side*(width*.48+spill*r.range(.45,1.25)));
      var grain=r.range(.38,.93)*wetness;
      var rx=clamp(spill*r.range(.63,1.30),.34,1.85);
      var ry=clamp(Math.min(length/count,6)*r.range(.27,.60),.42,3.1);
      ctx.save();ctx.translate(edge.x,edge.y);ctx.rotate(angle(a,b));
      ctx.beginPath();ctx.ellipse(0,0,ry,rx,0,0,PI*2);
      ctx.globalAlpha=opacity*grain*.24;ctx.fill();ctx.restore();
      // Darker drying bank on a minority of deposits, adjacent to the core.
      if(r.chance(.40)){
        var rim=shift(p,normal,side*(width*.46+spill*.2));
        ctx.beginPath();ctx.ellipse(rim.x,rim.y,clamp(spill*.36,.25,.77),
          clamp(ry*.63,.4,2.2),angle(a,b),0,PI*2);
        ctx.globalAlpha=opacity*wetness*r.range(.16,.29);ctx.fill();
      }
      strokes++;
    }
  }
  ctx.restore();
  activeMicroBleedCount+=strokes;
  return strokes;
}
// V2R: one continuous dry-brush footprint, not a run of square-ended
// segments. Polygon fill + even-odd paper-grain apertures preserve the
// already-dried washes beneath without painting cream over them.
function paintContinuousDryBrush(ctx,pts,width,colour,opacity){
  var path=[],travel=0,length=0;
  for(var j=1;j<pts.length;j++)length+=dist(pts[j-1],pts[j]);
  if(length<.09)return false;
  for(j=1;j<pts.length;j++){
    var a=pts[j-1],b=pts[j],span=dist(a,b);
    if(span<.05)continue;
    var divisions=Math.max(1,Math.ceil(span/2.6)),normal=angle(a,b)+PI/2;
    for(var k=0;k<=divisions;k++){
      if(j>1&&k===0)continue;
      var t=k/divisions,p=point(a,b,t),progress=clamp((travel+t*span)/length,0,1);
      var paper=materialPaperField(p.x*activeEdgeRatio,p.y*activeEdgeRatio,
        activeEdgeRatio,activeEdgePaperSeed);
      var pressure=.62+.38*Math.pow(Math.max(0,Math.sin(PI*progress)),.48);
      var localWidth=width*pressure*(.71+.18*paper.tooth);
      // Gentle continuous drift; paper fibres affect the brush footprint.
      var sideDrift=(paper.fibre-.5)*.27;
      var left=shift(p,normal,sideDrift+localWidth*.5);
      var right=shift(p,normal,sideDrift-localWidth*.5);
      path.push({left:left,right:right,p:p,angle:angle(a,b),tooth:paper.tooth,
        localWidth:localWidth});
    }
    travel+=span;
  }
  if(path.length<2)return false;
  ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=opacity*.76;ctx.fillStyle=colour;ctx.beginPath();
  ctx.moveTo(path[0].left.x,path[0].left.y);
  for(j=1;j<path.length;j++)ctx.lineTo(path[j].left.x,path[j].left.y);
  for(j=path.length-1;j>=0;j--)ctx.lineTo(path[j].right.x,path[j].right.y);
  ctx.closePath();
  // Irregular elongated grain apertures: pigment drags along the fibre.
  // Test every aperture against the unmodified brush path. Even-odd
  // holes outside a silhouette would otherwise paint unwanted specks.
  var apertures=[];
  for(j=3;j<path.length-3;j++){
    var sample=path[j],x=sample.p.x,y=sample.p.y;
    var noise=hashNoise(Math.round(x*1.73),Math.round(y*1.49),
      activeEdgePaperSeed^0x63e41);
    if(sample.tooth>.65||noise<.68)continue;
    var major=.70+noise*1.65,minor=Math.min(sample.localWidth*.26,.46);
    if(minor<.10)continue;
    var tx=Math.cos(sample.angle)*major,ty=Math.sin(sample.angle)*major;
    var nx=-Math.sin(sample.angle)*minor,ny=Math.cos(sample.angle)*minor;
    if(!ctx.isPointInPath(x+tx,y+ty)||
       !ctx.isPointInPath(x-tx,y-ty)||
       !ctx.isPointInPath(x+nx,y+ny)||
       !ctx.isPointInPath(x-nx,y-ny)){
      dryMediaStats.dryBrushRejected++;continue;
    }
    apertures.push({x:x,y:y,major:major,minor:minor,theta:sample.angle});
  }
  for(j=0;j<apertures.length;j++){
    var hole=apertures[j],tx=Math.cos(hole.theta)*hole.major,
      ty=Math.sin(hole.theta)*hole.major;
    ctx.moveTo(hole.x+tx,hole.y+ty);
    ctx.ellipse(hole.x,hole.y,hole.major,hole.minor,hole.theta,0,PI*2);
    dryMediaStats.dryBrushHoles++;
  }
  ctx.fill('evenodd');ctx.restore();
  dryMediaStats.continuousDryStrokes++;
  dryMediaStats.continuousSamples+=path.length;
  return true;
}
// V2R: a few small transparent voids inside crisp dry filled shapes, sourced
// from the same paper tooth field. Canvas evenodd paths keep underlying
// coloured glazes visible; no bitmap noise or detached dots are overpainted.
function addDryShardGrain(ctx,pts,width){
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(var j=0;j<pts.length;j++){
    minX=Math.min(minX,pts[j].x);maxX=Math.max(maxX,pts[j].x);
    minY=Math.min(minY,pts[j].y);maxY=Math.max(maxY,pts[j].y);
  }
  var reach=width*.52+1.5,step=6.1,added=0,apertures=[];
  for(var y=Math.floor((minY-reach)/step)*step;y<maxY+reach;y+=step){
    for(var x=Math.floor((minX-reach)/step)*step;x<maxX+reach;x+=step){
      var p=materialPaperField(x*activeEdgeRatio,y*activeEdgeRatio,
        activeEdgeRatio,activeEdgePaperSeed);
      if(p.tooth>.57)continue;
      var jitter=hashNoise(Math.round(x*1.23),Math.round(y*.93),
        activeEdgePaperSeed^0x5783);
      if(jitter<.57)continue;
      var dx=(hashNoise(Math.round(x),Math.round(y),
        activeEdgePaperSeed^0x38971)-.5)*2.4;
      var dy=(hashNoise(Math.round(y),Math.round(x),
        activeEdgePaperSeed^0x17831)-.5)*2.4;
      var radius=(.24+.76*(.57-p.tooth))*(.53+.73*jitter);
      var cx=x+dx,cy=y+dy,ry=clamp(radius*(.55+.4*p.fibre),.13,1.1);
      // Use only apertures wholly inside the original polygon contour.
      if(!ctx.isPointInPath(cx-radius,cy)||
         !ctx.isPointInPath(cx+radius,cy)||
         !ctx.isPointInPath(cx,cy-ry)||
         !ctx.isPointInPath(cx,cy+ry)){
        dryMediaStats.dryShardRejected++;continue;
      }
      apertures.push({x:cx,y:cy,rx:radius,ry:ry,theta:p.fibre*PI});
    }
  }
  for(var ap=0;ap<apertures.length;ap++){
    var item=apertures[ap];
    ctx.moveTo(item.x+item.rx*Math.cos(item.theta),
      item.y+item.rx*Math.sin(item.theta));
    ctx.ellipse(item.x,item.y,item.rx,item.ry,item.theta,0,PI*2);
    added++;
  }
  dryMediaStats.dryShardCount++;
  dryMediaStats.dryShardHoles+=added;
}
// Watercolour is a material, not a neat geometric stroke followed by a glow.
// Route every ACTIVE fine mark through this seeded stroke renderer. Even dry
// paint wicks very slightly into paper. Only a minority of tiny segments pool;
// neighbouring segments do not share an identical opacity or a perfect rim.
var activeThinStrokeCount=0,activeDryThinStrokeCount=0;
function paintThinWatercolourStroke(ctx,pts,width,colour,opacity,r,wetness){
  if(!pts||pts.length<2)return false;
  var wet=clamp(wetness,.18,1),fine=clamp(width,.45,12.5);
  if(activeDryMediaPhase&&A.watercolourV2rOptions.dryMedia){
    var painted=paintContinuousDryBrush(ctx,pts,fine,colour,opacity);
    if(painted){activeThinStrokeCount++;activeDryThinStrokeCount++;}
    return painted;
  }
  // A readable center with deliberately nonuniform pigment uptake.
  thinLineMicroBleed(ctx,pts,fine,colour,opacity,
    A.makeR('wick|'+r.range(0,1000000)+'|'+pts.length),wet);
  ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.strokeStyle=colour;ctx.lineCap='butt';ctx.lineJoin='round';
  var drew=false;
  for(var j=1;j<pts.length;j++){
    var a=pts[j-1],b=pts[j],len=dist(a,b);
    if(len<.07)continue;
    var pieces=Math.min(90,Math.max(1,Math.ceil(len/5.5)));
    var tangent=angle(a,b),normal=tangent+PI/2;
    var drift=r.range(-.18,.18);
    for(var k=0;k<pieces;k++){
      var t0=k/pieces,t1=(k+1)/pieces;
      var p0=point(a,b,t0),p1=point(a,b,t1);
      var tooth=r.range(.52,1.0);
      var shade=r.range(.58,1);
      if(r.chance(.12))shade*=.32; // local skips: not continuous vector ink
      drift=clamp(drift+r.range(-.11,.11),-.34,.34);
      var offset=drift*wet;
      p0=shift(p0,normal,offset);
      p1=shift(p1,normal,offset+r.range(-.09,.09)*wet);
      // Every micro-section is a deposited stroke, not a rounded dab.
       ctx.lineCap='butt';
       ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);
      // A natural taper at either end replaces uniform-width vector ink.
      var along=(j+(k+.5)/pieces)/(pts.length-1);
      var taper=.56+.44*Math.pow(Math.max(0,Math.sin(PI*along)),.62);
      ctx.lineWidth=fine*tooth*taper;
      ctx.globalAlpha=opacity*shade*(wet>.75?.86:1);
      ctx.stroke();drew=true;
    }
  }
  ctx.restore();
  if(drew){activeThinStrokeCount++;if(wet<=.32)activeDryThinStrokeCount++;}
  return drew;
}
function paintRibbon(pig,height,pts,width,r,col,opacity,thickness,state,softEdge){
  // Dry edges are sharp by default; damp and wet shapes carry only a
  // little/the full feather. Each wash gets its own torn-edge frequencies.
  var edgeState=state||'damp';
  if(width<=12.5){
    paintThinWatercolourStroke(pig,pts,width,col,opacity,r,
      edgeState==='dry'?.23:edgeState==='damp'?.60:1);
    return;
  }
  activeEdgeWave={frequency:r.range(.20,.66),secondary:r.range(.92,2.19),
    phase:r.range(-Math.PI,Math.PI)};
  activeSoftForShape=!!softEdge;
  activeEdgeDry=edgeState==='dry';
  var madeRibbon=ribbon(pig,pts,width*.5,r);
  activeSoftForShape=false;activeEdgeDry=false;
  if(!madeRibbon)return;
  if(edgeState!=='dry')
    registerWetWash(edgeState==='wet'?.90:.56,!!softEdge);
  pig.save();
  // Dried pigment is deposited onto the existing sheet rather than
  // infinitely multiplied into black as separate dark glazes stack.
  // Damp/wet layers still glaze subtractively and mix before paper flow.
  pig.globalCompositeOperation=edgeState==='dry'?'source-over':'multiply';
  pig.globalAlpha=opacity*(edgeState==='dry'?.45:edgeState==='damp'?.40:.30);
  pig.fillStyle=col;
  var texturedDry=edgeState==='dry'&&activeDryMediaPhase&&
    A.watercolourV2rOptions.dryMedia;
  if(texturedDry)addDryShardGrain(pig,pts,width);
  if(texturedDry)pig.fill('evenodd');else pig.fill();
  // V2L: no vector polygon stroke along the inner wash contour. A single
  // density-gradient pigment bank is laid down later in paper space, after
  // capillary transport. This also reaches transparent/pale washes.
  pig.save();
  pig.clip();
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
  // This narrow wet/damp edge treatment is separate from the fill. It
  // moves a little pigment laterally, not a symmetric canvas shadow.
  if(width<=30)
    thinLineMicroBleed(pig,pts,width,col,opacity,r,
      edgeState==='dry'?.23:edgeState==='damp'?.60:1);
}
// An actual filled, transparent pigment pool on a source vector path:
// a second tinted wash moves into the *same* clipped wet shape, instead
// of surrounding a thin outline with an evenly blurred halo.
function paintColourPool(ctx,pts,width,r,colourA,colourB,opacity,softEdge){
  if(pts.length<2)return false;
  if(width<=12.5){
    paintThinWatercolourStroke(ctx,pts,width,
      lerpHex(colourA,colourB,.35),opacity,r,.88);
    return true;
  }
  activeEdgeWave={frequency:r.range(.17,.65),secondary:r.range(.9,2.5),
    phase:r.range(-PI,PI)};
  activeSoftForShape=!!softEdge;activeEdgeDry=false;
  var madePool=ribbon(ctx,pts,width*.5,r);
  activeSoftForShape=false;
  if(!madePool)return false;
  registerWetWash(.84,!!softEdge);
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
  // V2L: avoid a second perfectly aligned polygon outline. Pigment banks
  // form from concentration gradients across the real paper-flow raster.
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
    broadWidthMax:0,heroWidthMax:0,filledPools:0,mixedPigmentPools:0,
    softWashCount:0,areaWashCount:0,paleFormBoosts:0};
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
    var broadSource=sourcePigment(ch);
    if(broadSource)wash=lerpHex(broadSource,kit.paper,.24);
    var state=A.makeR(seed+'|water-state-broad-v2e|'+i).chance(.48)?'wet':'damp';
    // Sparse modes must contain at least one genuine soft-edge wash.
    // The remaining washes use independent ~28% seeded choices.
    var isSoft=stats.areaWashCount===0||selectSoftEdge(seed,'broad',i,state);
    stats.areaWashCount++;
    if(isSoft)stats.softWashCount++;
    // Retain overall sparse geometry but let a few existing strokes become
    // coloured *areas*. No new positions, objects or generator changes.
    var poolChoice=A.makeR(seed+'|v2g-pool|'+i);
    if(poolChoice.chance(.37)){
      var other=kit.ink.length>1?pigmentInk(poolChoice.pick(kit.ink)):
        pigmentInk(poolChoice.pick(C.ochre));
      if(broadSource)other=lerpHex(broadSource,kit.paper,.41);
      var mixed=paintColourPool(pig,pts,width,r,wash,other,r.range(.47,.76),isSoft);
      if(mixed){stats.filledPools++;stats.mixedPigmentPools++;}
    }else{
      paintRibbon(pig,null,pts,width,r,wash,r.range(.41,.70),0,state,isSoft);
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
    var heroSource=sourcePigment(ch);
    if(heroSource)pigment=heroSource;
    if(accent)stats.chromaticAccents++;
    var opacity=r.range(.55,.80);
    if(state!=='dry'&&i<22&&pigmentLuma(pigment)>159){
      // Preserve the visual hierarchy of selected pale, φ-placed hero forms.
      // Only strengthen the original pigment, never draw an extra outline.
      opacity=Math.min(.84,Math.max(.68,opacity*1.10));
      stats.paleFormBoosts++;
    }
    var isSoftHero=selectSoftEdge(seed,'hero',i,state);
    if(state!=='dry'&&width>12.5){
      stats.areaWashCount++;
      if(isSoftHero)stats.softWashCount++;
    }
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
        if(heroSource)second=lerpHex(heroSource,kit.paper,.37);
        if(paintColourPool(pig,pts,width,r,pigment,second,opacity,isSoftHero)){
          stats.filledPools++;stats.mixedPigmentPools++;
        }
      }else paintRibbon(pig,null,pts,width,r,pigment,opacity,0,state,isSoftHero);
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
        col:(function(base){return sourcePigment(ch)||base})(palette(i,r)),
        opacity:r.range(.35,.60),key:'detail-'+i});
    }else{
      var traceWidth=r.range(5,15),traceSoft=selectSoftEdge(seed,'detail',i,'damp');
      if(traceWidth>12.5){stats.areaWashCount++;if(traceSoft)stats.softWashCount++;}
      paintRibbon(pig,null,trace,traceWidth,r,
        (function(base){return sourcePigment(ch)||base})(palette(i,r)),
        r.range(.34,.57),0,'damp',traceSoft);
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
    hue=sourcePigment(chains[i])||hue;
    var width=clamp(chains[i].width*.17+pen.range(.3,1.15),.65,2.6);
    var inkOpacity=pen.range(.27,.52);
    // When the ink crosses an existing wash, reduce contrast and let it
    // wick more. Sampling the rendered sheet is stable for the same seed.
    var sx=clamp(Math.round(middle.x),0,ctx.canvas.width-1);
    var sy=clamp(Math.round(middle.y),0,ctx.canvas.height-1);
    var inkUnder=ctx.getImageData(sx,sy,1,1).data;
    var darkness=(kit.paperRGB[0]-inkUnder[0]+
      kit.paperRGB[1]-inkUnder[1]+kit.paperRGB[2]-inkUnder[2])/3;
    var crossing=clamp(darkness/46,0,1);
    var wetness=clamp(pen.range(.22,.76)+crossing*.22,.18,1);
    inkOpacity*=1-.22*crossing;
    paintThinWatercolourStroke(ctx,pts,width,hue,inkOpacity,
      A.makeR(seed+'|v2i-all-ink|'+i),wetness);
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
// Pure memoization only: sin/cos formerly recalculated for every pigment
// pixel (hundreds of thousands to millions). Reuse the exact same floating-
// point results for identical seeds; no change in noise sampling or quality.
var paperRotationSeed=null,paperRotationCos=1,paperRotationSin=0;
// Precompute only resolution-dependent cell widths; retain the original
// division and interpolation order for exact output pixels.
var paperFieldCells=null;
function materialPaperField(x,y,ratio,seedValue){
  // Benchmark switch is test-only; default always caches.
  var ca,sa;
  if(A.watercolourV2sOptions.paperRotationCache===false){
    var theta=((seedValue>>>0)%65521)/65521*PI*2;
    ca=Math.cos(theta);sa=Math.sin(theta);
  }else{
    if(seedValue!==paperRotationSeed){
      var theta=((seedValue>>>0)%65521)/65521*PI*2;
      paperRotationCos=Math.cos(theta);paperRotationSin=Math.sin(theta);
      paperRotationSeed=seedValue;
    }
    ca=paperRotationCos;sa=paperRotationSin;
  }
  var u=x*ca-y*sa,v=x*sa+y*ca;
  var wa=(paperNoise(u*.81+v*.17,v*.92-u*.11,
    paperFieldCells?paperFieldCells[0]:Math.max(12,89*ratio),seedValue^0x519327)-.5)*22*ratio;
  var wb=(paperNoise(u*.67-v*.22,v*.78+u*.24,
    paperFieldCells?paperFieldCells[1]:Math.max(12,73*ratio),seedValue^0x627419)-.5)*23*ratio;
  var fx=u+wa,fy=v+wb;
  var broad=paperNoise(fx*.87+fy*.24,fy*.97-fx*.19,
    paperFieldCells?paperFieldCells[2]:Math.max(8,59*ratio),seedValue^0x7151);
  var medium=paperNoise(fx*1.19-fy*.31,fy*1.08+fx*.16,
    paperFieldCells?paperFieldCells[3]:Math.max(3,16.7*ratio),seedValue^0x9127);
  var grain=paperNoise(fx*1.47+fy*.33,fy*.93-fx*.21,
    paperFieldCells?paperFieldCells[4]:Math.max(1.4,4.3*ratio),seedValue^0x3181);
  var granular=hashNoise(Math.floor(fx*1.43),Math.floor(fy*1.87),
    seedValue^0x4251);
  return {
    tooth:clamp(.17+.51*broad+.24*medium+.08*grain+
      .06*(granular-.5),.09,.96),
    fibre:clamp(.39+.35*medium+.26*grain,.1,.95),
    grain:granular,
    formation:clamp(broad*.76+medium*.24,0,1),
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
function flowThroughPaper(ctx,w,h,seed,paper,ratio,chains,wetMaskCtx,softMaskCtx){
  var profile=A.watercolourProfileEnabled?{pixels:w*h,stages:{}}:null;
  var profileStart=profile?performance.now():0;
  var frame=ctx.getImageData(0,0,w,h),px=frame.data;
  var wetPixels=wetMaskCtx.getImageData(0,0,w,h).data;
  var softPixels=softMaskCtx.getImageData(0,0,w,h).data;
  var total=w*h;
  var wetCoverage=new Float32Array(total),softCoverage=new Float32Array(total);
  var source=new Float32Array(total*3),next=new Float32Array(total*3);
  var tooth=new Float32Array(total),water=new Float32Array(total),fibres=new Float32Array(total),formation=new Float32Array(total),paperGrain=new Uint8Array(total);
  var seedValue=A.hash(seed+'|paper-flow-v2f')>>>0,pi=0;
  // Scoped only to the synchronous paper-flow pixel traversal.
  if(A.watercolourPaperCellsExperimental)paperFieldCells=[
    Math.max(12,89*ratio),Math.max(12,73*ratio),Math.max(8,59*ratio),
    Math.max(3,16.7*ratio),Math.max(1.4,4.3*ratio)];
  var fieldCallMs=0,fieldCallCount=0;
  for(var y=0;y<h;y++)for(var x=0;x<w;x++,pi++){
    var j=pi*3,loaded=0;
    var sampleField=profile&&((pi&255)===0),fieldStart=sampleField?performance.now():0;
    var surface=materialPaperField(x,y,ratio,seedValue);
    if(sampleField){fieldCallMs+=performance.now()-fieldStart;fieldCallCount++;}
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
    wetCoverage[pi]=wetPixels[pi*4+3]/255;
    softCoverage[pi]=softPixels[pi*4+3]/255;
    water[pi]=clamp(loaded*3.1,0,1);
    fibres[pi]=surface.fibre;
    formation[pi]=surface.formation;
    paperGrain[pi]=Math.round(surface.grain*255);
  }
  paperFieldCells=null;
  if(profile){profile.stages.paperPreparationMs=performance.now()-profileStart;profile.stages.materialPaperFieldSampleMs=fieldCallMs;profile.stages.materialPaperFieldSamples=fieldCallCount;profile.stages.materialPaperFieldEstimatedMs=fieldCallMs*total/Math.max(1,fieldCallCount);profileStart=performance.now();}
  var steps=qualityForFlow(w,h); // resolution-adaptive, never dependent on clock time
  var passes=steps;
  // The paper, fibre and water fields are constant during diffusion.
  // Cache symmetric interface mobility separately for the two stencil
  // strides. Float64 retains the original JS arithmetic precision.
  function interfaceMobility(stride){
    var weights=new Float64Array(total*4);
    for(var yy=0;yy<h;yy++)for(var xx=0;xx<w;xx++){
      var cell=yy*w+xx,here=tooth[cell],wet=water[cell];
      for(var side=0;side<4;side++){
        var nx=xx+(side===0?stride:side===1?-stride:0);
        var ny=yy+(side===2?stride:side===3?-stride:0);
        if(nx<0||ny<0||nx>=w||ny>=h)continue;
        var q=ny*w+nx;
        var stretch=(fibres[cell]+fibres[q])*.5;
        var anis=side<2?(.74+.48*stretch):(.74+.48*(1-stretch));
        weights[cell*4+side]=(.067+.045*(here+tooth[q]))*anis*
          (.53+.47*Math.max(wet,water[q]));
      }
    }
    return weights;
  }
  var wideMobility=interfaceMobility(2),fineMobility=interfaceMobility(1);
  for(var round=0;round<passes;round++){
    var stride=round<2?2:1;
    var mobility=round<2?wideMobility:fineMobility;
    for(y=0;y<h;y++)for(x=0;x<w;x++){
      pi=y*w+x;var k=pi*3,v=source[k],u=source[k+1],z=source[k+2];
      var sum0=0,sum1=0,sum2=0;
      for(var side=0;side<4;side++){
        var nx=x+(side===0?stride:side===1?-stride:0);
        var ny=y+(side===2?stride:side===3?-stride:0);
        if(nx<0||ny<0||nx>=w||ny>=h)continue;
        var other=(ny*w+nx)*3,transport=mobility[pi*4+side];
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
  // V2O: wet-in-wet shapes get a short conservative *local* diffusion around
  // their true alpha-mask boundaries. Other washes and dry fine strokes keep
  // V2N's structure. This moves pigment; it does not blur the final bitmap.
  if(profile){profile.stages.bulkDiffusionMs=performance.now()-profileStart;profileStart=performance.now();}
  var softZone=new Float32Array(total),softMaskPixels=0,softBoundaryPixels=0;
  for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){
    pi=y*w+x;
    var inside=softCoverage[pi]>.12;
    if(inside)softMaskPixels++;
    if(inside!== (softCoverage[pi-1]>.12)||
       inside!== (softCoverage[pi+1]>.12)||
       inside!== (softCoverage[pi-w]>.12)||
       inside!== (softCoverage[pi+w]>.12)){
      softZone[pi]=1;softBoundaryPixels++;
    }
  }
  var cardinal=[-1,1,-w,w],softFluxPixels=0;
  for(var expansion=0;expansion<3;expansion++){
    var expanded=softZone.slice();
    for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){
      pi=y*w+x;var nextWeight=softZone[pi]-.23;
      if(nextWeight<=0)continue;
      for(var edge=0;edge<4;edge++){
        var adj=pi+cardinal[edge];
        if(nextWeight>expanded[adj])expanded[adj]=nextWeight;
      }
    }
    softZone=expanded;
  }
  var softBefore=source.slice();
  for(var softPass=0;softPass<3;softPass++){
    next.set(source);
    for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){
      pi=y*w+x;
      if(softZone[pi]<.1)continue;
      var p=pi*3,flow0=0,flow1=0,flow2=0;
      for(var side=0;side<4;side++){
        var q=pi+cardinal[side],strength=Math.min(softZone[pi],softZone[q]);
        if(strength<.1)continue;
        var mobility=.105*strength*(.65+.35*(tooth[pi]+tooth[q])*.5);
        var from=q*3;
        flow0+=(source[from]-source[p])*mobility;
        flow1+=(source[from+1]-source[p+1])*mobility;
        flow2+=(source[from+2]-source[p+2])*mobility;
      }
      next[p]=Math.max(0,source[p]+flow0);
      next[p+1]=Math.max(0,source[p+1]+flow1);
      next[p+2]=Math.max(0,source[p+2]+flow2);
      softFluxPixels++;
    }
    var softSwap=source;source=next;next=softSwap;
  }
  var softMassBefore=0,softMassAfter=0;
  for(var softIndex=0;softIndex<source.length;softIndex++){
    softMassBefore+=softBefore[softIndex];
    softMassAfter+=source[softIndex];
  }
  var softConservationError=Math.abs(softMassBefore-softMassAfter)/
    Math.max(1,softMassBefore);
  // Keep bloom centres on real painted geometry, and reject paper/voids.
  // A clear-water droplet pushes pigment outward into a ragged, low-contrast
  // cauliflower rim; there is no drawn circle/stroke or stock texture.
  if(profile){profile.stages.softEdgeFlowMs=performance.now()-profileStart;profileStart=performance.now();}
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
  // V2N: the boundary comes from captured wet-wash shapes, NOT the final
  // pigment composite. Dry fine marks cannot manufacture drying rims.
  // The chamfer distance field is calculated in the same paper-space pixels.
  var bandRadius=clamp(A.watercolourV2kOptions.edgeBandRadius,3,12);
  var distanceLimit=bandRadius+2,edgeDistance=new Float32Array(total);
  for(var i=0;i<total;i++){
    var o=i*3,mask=Math.max(source[o],source[o+1],source[o+2]);
    edgeDistance[i]=wetCoverage[i]>.09&&mask>.008?distanceLimit:0;
  }
  for(y=0;y<h;y++)for(x=0;x<w;x++){
    pi=y*w+x;if(!edgeDistance[pi])continue;
    var near=edgeDistance[pi];
    if(x>0)near=Math.min(near,edgeDistance[pi-1]+1);
    if(y>0)near=Math.min(near,edgeDistance[pi-w]+1);
    if(x>0&&y>0)near=Math.min(near,edgeDistance[pi-w-1]+1.414);
    if(x+1<w&&y>0)near=Math.min(near,edgeDistance[pi-w+1]+1.414);
    edgeDistance[pi]=near;
  }
  for(y=h-1;y>=0;y--)for(x=w-1;x>=0;x--){
    pi=y*w+x;if(!edgeDistance[pi])continue;
    var near=edgeDistance[pi];
    if(x+1<w)near=Math.min(near,edgeDistance[pi+1]+1);
    if(y+1<h)near=Math.min(near,edgeDistance[pi+w]+1);
    if(x+1<w&&y+1<h)near=Math.min(near,edgeDistance[pi+w+1]+1.414);
    if(x>0&&y+1<h)near=Math.min(near,edgeDistance[pi+w-1]+1.414);
    edgeDistance[pi]=near;
  }
  // V2N: conserve optical pigment while moving some density from the
  // wash interior toward its drying front. No additive contour stroke.
  // Locally variable 3-10px banks with coherent gaps follow fibre/formation.
  if(profile){profile.stages.edgeDistanceMs=performance.now()-profileStart;profileStart=performance.now();}
  var beforeBank=source.slice(),movedMass=0,transferPixels=0;
  var neighbourSteps=[-1,1,-w,w],redistributionPasses=5;
  for(var round=0;round<redistributionPasses;round++){
    next.set(source);
    for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){
      pi=y*w+x;
      var depth=edgeDistance[pi],wetness=wetCoverage[pi];
      if(wetness<.12||depth<1.5||depth>bandRadius+2||
        softZone[pi]>.38)continue;
      var localWidth=clamp(bandRadius*(.55+.78*formation[pi]+
        (tooth[pi]-.5)*.33),3,10);
      var peak=clamp(localWidth*(.31+.16*fibres[pi]),1.3,4.8);
      if(depth<=peak||depth>localWidth+1.2)continue;
      var broadFlow=paperNoise(x,y,Math.max(11,66*ratio),seedValue^0x49c1);
      var smallFlow=paperNoise(x+13,y-17,Math.max(5,24*ratio),seedValue^0x8591);
      var availability=clamp((broadFlow*.7+smallFlow*.3-.32)*2.7,0,1);
      if(availability<.09)continue;
      var best=pi,nearest=depth;
      for(var side=0;side<4;side++){
        var q=pi+neighbourSteps[side],nd=edgeDistance[q];
        if(nd>0&&nd<nearest-.08){best=q;nearest=nd;}
      }
      if(best===pi||nearest<peak-.9)continue;
      var fraction=(.09+.105*wetness)*availability*
        clamp((localWidth+1.2-depth)/localWidth,.12,1);
      var from=pi*3,to=best*3;
      for(var colour=0;colour<3;colour++){
        var shifted=source[from+colour]*fraction;
        next[from+colour]-=shifted;next[to+colour]+=shifted;
        movedMass+=shifted;
      }
      transferPixels++;
    }
    var bankSwap=source;source=next;next=bankSwap;
  }
  if(profile){profile.stages.edgeRedistributionMs=performance.now()-profileStart;profileStart=performance.now();}
  var edgeBankPixels=0,paleEdgeBankPixels=0,donorPixels=0,bandPeak=0;
  var massBefore=0,massAfter=0,wetMaskPixels=0;
  for(var index=0;index<total;index++){
    var offset=index*3,gain=0,loss=0;
    if(wetCoverage[index]>.09)wetMaskPixels++;
    for(var channel=0;channel<3;channel++){
      massBefore+=beforeBank[offset+channel];
      massAfter+=source[offset+channel];
      var change=source[offset+channel]-beforeBank[offset+channel];
      if(change>0)gain+=change;else loss-=change;
    }
    if(gain>.003){
      edgeBankPixels++;
      if(Math.max(beforeBank[offset],beforeBank[offset+1],beforeBank[offset+2])<.17)
        paleEdgeBankPixels++;
    }
    if(loss>.003)donorPixels++;
    if(gain>bandPeak)bandPeak=gain;
  }
  var conservationError=Math.abs(massAfter-massBefore)/Math.max(1,massBefore);
  if(profile){profile.stages.edgeAccountingMs=performance.now()-profileStart;profileStart=performance.now();}
  for(y=0;y<h;y++)for(x=0;x<w;x++){
    pi=y*w+x;var p=pi*3,out=pi*4;
    var grit=(hashNoise(x,y,seedValue^0x4251)-.5);
    var concentration=clamp(Math.max(source[p],source[p+1],source[p+2])*3.8,0,1);
    var grainStrength=.18+.82*concentration;
    var scale=((tooth[pi]-.5)*.78+grit*.32)*grainStrength;
    var earth=clamp((source[p+2]-source[p])*3.3,0,1);
    var mottle=(formation[pi]-.5)*
      clamp(A.watercolourV2kOptions.interiorMottle,0,.6)*
      concentration*(.75+.7*earth);
    var settle=clamp(1+scale+mottle,.58,1.48);
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
  if(profile){profile.stages.finalColourMs=performance.now()-profileStart;A.lastWatercolourFlowProfile=profile;}
  return {paperModel:'V2O selected soft wet-in-wet washes and conserved V2N pigment banks + capillary flow',
    diffusionPasses:passes,waterBlooms:drops.length,edgeBankPixels:edgeBankPixels,
    paleEdgeBankPixels:paleEdgeBankPixels,edgeBandPeak:+bandPeak.toFixed(4),
    edgeBandRadius:bandRadius,wetMaskPixels:wetMaskPixels,donorPixels:donorPixels,
    transferPixels:transferPixels,relocatedMass:+movedMass.toFixed(2),
    conservationError:+conservationError.toFixed(8),variableBandRange:[3,10],
    softMaskPixels:softMaskPixels,softBoundaryPixels:softBoundaryPixels,
    softFluxPixels:softFluxPixels,
    softConservationError:+softConservationError.toFixed(8)};
}
function qualityForFlow(w,h){return w*h>1100000?3:5}
// Optional presentation-space adjustment; legacy V2S artwork retains it by default.
// The original V8 generator is still called with the exact source seed and
// settings; no paths are added/deleted and their internal relative positions
// and rotations survive a uniform similarity transform.
function fitMaterialComposition(chains,voids,seed,w,h){
  var mode=seed.split('|').slice(-2)[0];
  // A newly created V2S artwork opts OUT via fit=0. Legacy share links
  // without this parameter keep the previous fitted composition exactly.
  // Do not touch source φ geometry when fitting is disabled.
  if(A.watercolourV2sOptions.fitToSheet===false)
    return {chains:chains,voids:voids,stats:{mode:mode,kind:'source-exact',
      factor:1,before:null,after:null}};
  var bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(var i=0;i<chains.length;i++)for(var j=0;j<chains[i].pts.length;j++){
    var p=chains[i].pts[j];
    bounds.minX=Math.min(bounds.minX,p.x);
    bounds.minY=Math.min(bounds.minY,p.y);
    bounds.maxX=Math.max(bounds.maxX,p.x);
    bounds.maxY=Math.max(bounds.maxY,p.y);
  }
  if(!isFinite(bounds.minX))
    return {chains:chains,voids:voids,stats:{mode:mode,kind:'none',factor:1,before:null,after:null}};
  var bw=bounds.maxX-bounds.minX,bh=bounds.maxY-bounds.minY;
  var fraction=Math.max(bw/w,bh/h),factor=1,kind='none';
  if((mode==='field'||mode==='network'||mode==='scribble')&&fraction<.57){
    factor=clamp(.71/Math.max(.01,fraction),1,1.84);
    kind='compact-source-reframe';
  }else if(mode==='rects'&&
    (bounds.minX<90||bounds.maxX>w-90||bounds.minY<90||bounds.maxY>h-90)){
    factor=.88;kind='frame-inset';
  }
  var cx=(bounds.minX+bounds.maxX)*.5,cy=(bounds.minY+bounds.maxY)*.5;
  // Ensure washes have room to pool at the frame edge. Never crop the paths.
  var safe=kind==='frame-inset'?82:40;
  if(factor>1){
    factor=Math.min(factor,(w-2*safe)/Math.max(1,bw),(h-2*safe)/Math.max(1,bh));
  }
  if(Math.abs(factor-1)<.012)factor=1;
  var targetX=kind==='frame-inset'?w*.5:clamp(cx,safe+bw*factor*.5,w-safe-bw*factor*.5);
  var targetY=kind==='frame-inset'?h*.5:clamp(cy,safe+bh*factor*.5,h-safe-bh*factor*.5);
  if(kind==='none'||factor===1) {
    return {chains:chains,voids:voids,stats:{mode:mode,kind:'none',factor:1,
      before:{width:bw/w,height:bh/h,minX:bounds.minX/w,minY:bounds.minY/h,
        maxX:bounds.maxX/w,maxY:bounds.maxY/h},
      after:{width:bw/w,height:bh/h,minX:bounds.minX/w,minY:bounds.minY/h,
        maxX:bounds.maxX/w,maxY:bounds.maxY/h}}};
  }
  function transform(p){return{x:targetX+(p.x-cx)*factor,y:targetY+(p.y-cy)*factor}}
  var moved=chains.map(function(chain){
    var transformed={pts:chain.pts.map(transform),length:chain.length*factor,
      width:chain.width*factor};
    // V2S-only source hue lineage must survive Field / Rects framing.
    // Without this the paint pass loses original HSL colours in relocated
    // layouts even though the supplementary raw strokes retain them.
    if(A.watercolourV2sActive){
      transformed.sourceInk=chain.sourceInk;
      transformed.sourceIndex=chain.sourceIndex;
    }
    return transformed;
  });
  var movedVoids=voids.map(function(v){
    var q=transform({x:v.x,y:v.y});
    return{x:q.x,y:q.y,w:v.w*factor,h:v.h*factor};
  });
  return {chains:moved,voids:movedVoids,
    stats:{mode:mode,kind:kind,factor:factor,
      before:{width:bw/w,height:bh/h,minX:bounds.minX/w,minY:bounds.minY/h,
        maxX:bounds.maxX/w,maxY:bounds.maxY/h},
      after:{width:bw*factor/w,height:bh*factor/h,
        minX:(targetX-bw*factor*.5)/w,minY:(targetY-bh*factor*.5)/h,
        maxX:(targetX+bw*factor*.5)/w,maxY:(targetY+bh*factor*.5)/h}}};
}
A.watercolourV2sMaterial=function(ctx,w,h,chains,meta,seed,quality,kit){
  if(!kit||kit.revision!==6)
    throw new Error('Wet-edge experiment requires current V6 seeded tissue ink kit');
  C=coloursForInk(kit);
  Object.keys(C).forEach(function(group){
    C[group]=C[group].map(pigmentInk);
  });
  tissueTornEdges=true; // reuse V6's approved repaired, ragged contours
  tissueLightEnabled=false;
  try{
    var presentation=fitMaterialComposition(chains,meta.voids||[],seed,w,h);
    chains=presentation.chains;
    var presentationVoids=presentation.voids;
    var ratio=quality<.30?.32:(quality<.65?.53:(quality<1.5?.78:1.18));
    var sw=Math.max(1,Math.round(w*ratio)),sh=Math.max(1,Math.round(h*ratio));
    var layer=document.createElement('canvas');
    layer.width=sw;layer.height=sh;
    var pctx=layer.getContext('2d');
    pctx.scale(ratio,ratio);
    pctx.fillStyle=kit.paper;
    pctx.fillRect(0,0,w,h);
    activeMicroBleedCount=0;
    activeThinStrokeCount=0;activeDryThinStrokeCount=0;
    dryMediaStats={continuousDryStrokes:0,continuousSamples:0,
      dryBrushHoles:0,dryBrushRejected:0,dryShardCount:0,
  dryShardHoles:0,dryShardRejected:0};
    activeEdgeRatio=ratio;activeEdgePaperSeed=A.hash(seed+'|paper-flow-v2f')>>>0;
    activeEdgeTextureStats={samples:0,drySamples:0,wickSamples:0,
      maxDryDisplacement:0,maxWetDisplacement:0};
    var wetCanvas=document.createElement('canvas');
    wetCanvas.width=sw;wetCanvas.height=sh;
    var wetCtx=wetCanvas.getContext('2d');
    wetCtx.scale(ratio,ratio);
    var softCanvas=document.createElement('canvas');
    softCanvas.width=sw;softCanvas.height=sh;
    var softCtx=softCanvas.getContext('2d');
    softCtx.scale(ratio,ratio);
    activeWashMaskCtx=wetCtx;activeSoftMaskCtx=softCtx;
    activePigmentLayerCtx=pctx;
    var renderProfile=A.watercolourProfileEnabled?{stages:{}}:null;
    var stageStart=renderProfile?performance.now():0;
    var washStats=deposit(pctx,null,w,h,chains,presentationVoids,seed,quality,kit);
    if(renderProfile){renderProfile.stages.washConstructionMs=performance.now()-stageStart;stageStart=performance.now();}
    var washMicroBleeds=activeMicroBleedCount;
    activeWashMaskCtx=null;activeSoftMaskCtx=null;activePigmentLayerCtx=null;
    pctx.setTransform(1,0,0,1,0,0);
    wetCtx.setTransform(1,0,0,1,0,0);
    softCtx.setTransform(1,0,0,1,0,0);
    var paperStats=flowThroughPaper(pctx,sw,sh,seed,kit.paperRGB,ratio,
      chains,wetCtx,softCtx);
    if(renderProfile){renderProfile.stages.paperFlowMs=performance.now()-stageStart;renderProfile.flow=A.lastWatercolourFlowProfile;stageStart=performance.now();}
    ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.drawImage(layer,0,0,w,h);
    activeDryMediaPhase=true;
    for(var i=0;i<washStats.dryDeposits.length;i++){
      var mark=washStats.dryDeposits[i];
      paintRibbon(ctx,null,mark.pts,mark.width,
        A.makeR(seed+'|v2e-dry-outline|'+mark.key),mark.col,mark.opacity,0,'dry');
    }
    var dryDetail=finishDryAccents(ctx,chains,seed,quality,kit,presentationVoids,washStats);
    var preservedLines=paintSourceOpenLines(ctx,chains,presentation,seed,w,h);
    activeDryMediaPhase=false;
    var microBleedTotal=activeMicroBleedCount;
    var thinStrokeTotal=activeThinStrokeCount,dryThinTotal=activeDryThinStrokeCount;
    ctx.restore();
    if(renderProfile){renderProfile.stages.dryMarksAndCompositingMs=performance.now()-stageStart;A.lastWatercolourDetailedProfile=renderProfile;}
    A.lastWatercolourExperimentStats={
      width:sw,height:sh,chains:chains.length,
      paper:kit.paper,inkColours:kit.ink.slice().map(pigmentInk),
      pigmentSpreadMax:Math.max.apply(null,kit.ink.map(function(v){return pigmentSpread(pigmentInk(v))})),
      compositionPresentation:presentation.stats,
      fitToSheet:A.watercolourV2sOptions.fitToSheet!==false,
      v2sFidelity:!!A.watercolourV2sOptions.fidelity,
      preservedLines:preservedLines,
      sourceHueMatches:chains.filter(function(ch){return !!sourcePigment(ch)}).length,
      effect:A.watercolourV2sOptions.fidelity?'V2S preserves source hues and recovers actual open gestures':
        A.watercolourV2rOptions.dryMedia?
        'V2R continuous fibre-drag dry marks and transparent shard granulation':
        'V2P reference dry-mark renderer',
      edgeDarkening:A.watercolourV2kOptions.edgeDarkening,
      interiorMottle:A.watercolourV2kOptions.interiorMottle,
      paleEdgePooling:A.watercolourV2kOptions.paleEdgePooling,
      edgeBandRadius:A.watercolourV2kOptions.edgeBandRadius,
      washStates:{dry:washStats.dry,damp:washStats.damp,wet:washStats.wet},
      widthCaps:{broad:127,hero:67},washWidths:{broadMax:washStats.broadWidthMax,
        heroMax:washStats.heroWidthMax},
      chromaticAccents:washStats.chromaticAccents,dryDetails:dryDetail,
      filledPools:washStats.filledPools,mixedPigmentPools:washStats.mixedPigmentPools,
      softWashCount:washStats.softWashCount,areaWashCount:washStats.areaWashCount,
      paleFormBoosts:washStats.paleFormBoosts,
      edgeTexture:activeEdgeTextureStats,
      microBleedCount:microBleedTotal,microBleedWashCount:washMicroBleeds,
      watercolorThinStrokeCount:thinStrokeTotal,dryThinStrokeCount:dryThinTotal,
      dryMediaEnabled:!!A.watercolourV2rOptions.dryMedia,
      dryMedia:dryMediaStats,
      paperFlow:paperStats,
      referenceMaterial:'Tissue & Graphite V6'
    };
  }finally{
    activeWashMaskCtx=null;activeSoftMaskCtx=null;activePigmentLayerCtx=null;
    activeSoftForShape=false;activeEdgeDry=false;activeDryMediaPhase=false;
    activeEdgeRatio=1;activeEdgePaperSeed=0;
    C=originalC;
    tissueTornEdges=false;
    tissueLightEnabled=false;
  }
};
// Public material routing uses the existing V6 tissue-derived colour kit and
// exact V8/V9 source geometry. It swaps the renderer synchronously and always
// restores the original function, including when Canvas rendering throws.
A.renderWatercolourV2S=function(target,settings,scale,reveal){
  var original=A.oilMaterial;
  if(typeof A.renderOil!=='function')throw new Error('Watercolour requires oil-render.js');
  try{
    A.oilMaterial=A.watercolourV2sMaterial;
    A.watercolourV2sActive=true;
    A.watercolourV2sAllChains=null;
    return A.renderOil(target,settings,scale,reveal,6);
  }finally{
    A.watercolourV2sActive=false;
    A.watercolourV2sAllChains=null;
    A.oilMaterial=original;
  }
};
})(window.AlgoArt);
