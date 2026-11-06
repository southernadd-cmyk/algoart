// Oil V8 prototype: Oil V7 with two surface changes, each switchable.
//  masses: flat-filled masses are also covered by directional brushstrokes.
//  weave:  dry paint catches on an irregular canvas weave, not a dot lattice.
//  relief: paint height accumulates instead of saturating, stroke edges and
//          ends build up, and the lighting shows ridges, grooves and sheen.
// With both off it paints exactly what Oil V7 paints. oil-paint-v7.js and
// editor routing are untouched. New strokes use their own seeded RNG, so the
// V7 strokes keep their RNG sequence; RNG labels below keep their V7 names.
// Uses the project's existing source planner, V3 contact brush and V5 pigments.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const PI=Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hex=c=>'rgb('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+')';
const rng=s=>A.makeR(String(s));
const shifted=(p,a,d)=>({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d});
const blend=(a,b,t)=>A.oilPigmentActive.tone(a,b,t);
const sourceBrush=(()=>{const minmax=clamp,lerp=(a,b,t)=>a+(b-a)*t;
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
function sourceBrushProfile(ch,mode,r,setting){
  if(['flat','filbert','dry','knife'].includes(setting))return setting;
  if(mode==='rects'||mode==='geometric')return r.chance(.28)?'knife':'flat';
  if(mode==='organic'||mode==='spiral')return r.chance(.84)?'filbert':'flat';
  if(mode==='scribble'||mode==='burst')return r.chance(.35)?'dry':'filbert';
  if(mode==='network')return r.chance(.70)?'filbert':'dry';
  return r.chance(.56)?'filbert':'flat';
}

return {getChains,profile:sourceBrushProfile};})();
function massContour(area){
 const out=new Path2D(),pts=area.contour||[];
 if(pts.length){out.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))out.lineTo(p.x,p.y);out.closePath();}
 return out;
}
function physicalEdgePath(area,material){
  const poly=area.contour||[],out=new Path2D();
  if(poly.length<3)return massContour(area);
  const r=rng(area.seed+'|v5k|physical-edge|'+material),
      step=material==='tissue'?6.0:8.0,
      edgeDepth=material==='tissue'?7.1:13.3,
      center={x:area.x,y:area.y};
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],
      len=Math.hypot(b.x-a.x,b.y-a.y),
      n=Math.max(1,Math.ceil(len/step));
    for(let j=0;j<n;j++){
      const t=j/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,
        vx=center.x-x,vy=center.y-y,
        radius=Math.max(1,Math.hypot(vx,vy)),
        // Multiple physical edge frequencies: no pixel grid, Voronoi
        // masks, thick Gaussian blur, or evenly repeating sawtooth.
        wave=.52+.23*Math.sin(i*1.73+t*13.7)+
          .12*Math.sin(i*2.11+t*37.4)+r.range(-.13,.13),
        inset=Math.max(.55,edgeDepth*clamp(wave,.12,.95)),
        px=x+vx/radius*inset,py=y+vy/radius*inset;
      if(i===0&&j===0)out.moveTo(px,py);else out.lineTo(px,py);
    }
  }
  out.closePath();
  return out;
}

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
  ctx.globalAlpha=A.oilOpaquePaint===true?1:.77;ctx.fillStyle=hex(blend(rgb,[243,225,198],.08));ctx.fill(shape);
  mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(shape);
  deposits+=layDown(ctx,mask,cell.contour,rgb,sourceSeed,painter);
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
  ctx.globalAlpha=A.oilOpaquePaint===true?1:(kind==='constructed-focal-form'?.54:.56);
  ctx.fillStyle=hex(blend(base,[241,225,205],.08));
  ctx.fill(shape);
  mask.globalAlpha=.29;mask.fillStyle='#fff';mask.fill(shape);
  deposits+=layDown(ctx,mask,cell.contour,base,cell.seed,painter);
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


function oilColourField(ctx,mask,area,painter,plan,progress){
  const poly=physicalEdgePath(area,'oil'),r=rng(area.seed+'|v5j-source-bristle'),
    b=area.box,colours=area.paintPalette||area.palette||[area.rgb],
    base=area.paintRgb||area.rgb;
  let deposits=0;
  ctx.save();mask.save();ctx.clip(poly);mask.clip(poly);
  // Occupy the whole ORIGINAL source-field interior, but let loaded bristle
  // contacts carry the relief rather than regularly-spaced horizontal bands.
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=A.oilOpaquePaint===true?1:.70;
  ctx.fillStyle=hex(blend(base,[244,232,217],.085));ctx.fill(poly);
  mask.globalAlpha=.33;mask.fillStyle='#fff';mask.fill(poly);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  deposits+=layDown(ctx,mask,area.contour,base,area.seed,painter);
  ctx.globalAlpha=1;mask.globalAlpha=1;
  const guides=(plan.territories||[]).filter(t=>
    area.guideIds&&area.guideIds.includes(t.guideId));
  // Real paint checkpoints, taken during the source-field brush passes.
  // This is capture-only: it never changes brush order, pigment or randomness.
  const expected=guides.reduce((sum,g)=>sum+clamp(Math.floor((g.width+g.height)/36),5,11),0)+(guides.length>=2?9:0);
  let nextCheckpoint=1;
  const checkpointCount=12;
  const record=()=>{
    while(progress && nextCheckpoint<=checkpointCount && deposits>=Math.ceil(expected*nextCheckpoint/checkpointCount)){
      progress(nextCheckpoint,checkpointCount);nextCheckpoint++;
    }
  };
  // Gesture geometry comes from the actual branches, ordered trajectory
  // points, or rotated placed objects already present in V5d.
  guides.forEach(function(g,gi){
    const axis=(g.axis||[]),origin=axis.length?axis[Math.floor(axis.length/2)]:
      {x:g.x,y:g.y},ang=g.angle||0;
    const centres=axis.length>1?axis:[
      shifted(origin,ang,-Math.min(g.width,g.height)*.37),
      origin,shifted(origin,ang,Math.min(g.width,g.height)*.37)];
    const strokes=clamp(Math.floor((g.width+g.height)/36),5,11);
    for(let k=0;k<strokes;k++){
      const id=Math.floor((k+.35)*centres.length/strokes),
            here=centres[Math.min(centres.length-1,id)],
            prev=centres[Math.max(0,id-1)],
            next=centres[Math.min(centres.length-1,id+1)],
            direction=Math.atan2(next.y-prev.y,next.x-prev.x)||ang,
            normal=direction+PI/2,
            offset=r.range(-16,16)*(1+.16*gi),
            cx=here.x+Math.cos(normal)*offset,
            cy=here.y+Math.sin(normal)*offset,
            len=clamp(Math.min(b.w,b.h)*r.range(.21,.48),27,115),
            width=clamp(r.range(12,28),11,35),
            dx=Math.cos(direction)*len*.5,
            dy=Math.sin(direction)*len*.5,
            source=colours[(gi+k)%colours.length],
            mixed=blend(source,k%6===0?[242,219,190]:[53,47,43],k%6===0?.085:.029);
      painter(ctx,mask,[
       {x:cx-dx,y:cy-dy},
       {x:cx+r.range(-7,7),y:cy+r.range(-7,7)},
       {x:cx+dx,y:cy+dy}],
        width,mixed,k%4===0?'flat':'filbert',r,
        {thickness:r.range(.76,1.02),drag:r.range(.39,.82),
         bristles:r.range(.82,.99)});
      deposits++;record();
    }
  });
  // The bridge is itself the source-owned relationship between the two
  // guides, so place a few irregular shorter impasto touches along it.
  if(guides.length>=2){
    const a=guides[0],z=guides[1],
      angle=Math.atan2(z.y-a.y,z.x-a.x),normal=angle+PI/2;
    for(let k=0;k<9;k++){
      const t=(k+.5)/9,offset=r.range(-21,21),
        x=a.x+(z.x-a.x)*t+Math.cos(normal)*offset,
        y=a.y+(z.y-a.y)*t+Math.sin(normal)*offset,
        turn=angle+r.range(-.67,.67),
        len=r.range(25,66),dx=Math.cos(turn)*len*.5,
        dy=Math.sin(turn)*len*.5,
        source=colours[k%colours.length];
      painter(ctx,mask,[{x:x-dx,y:y-dy},
       {x:x+r.range(-6,6),y:y+r.range(-6,6)},
       {x:x+dx,y:y+dy}],
       r.range(15,34),blend(source,[242,227,207],k%4===0?.09:.025),
       k%3===0?'flat':'filbert',r,
       {thickness:r.range(.75,1.0),drag:r.range(.40,.83),
        bristles:r.range(.80,.99)});
      deposits++;record();
    }
  }
  if(progress && !expected)progress(checkpointCount,checkpointCount);
  ctx.restore();mask.restore();
  return deposits;
}

function approvedEdges(f,plan){
 const guides=new Map((plan.territories||[])
   .filter(g=>f.guideIds.includes(g.guideId))
   .map(g=>[g.guideId,g]));
 const legal=[];
 for(let i=0;i<f.guideIds.length;i++)
 for(let j=i+1;j<f.guideIds.length;j++){
   const a=guides.get(f.guideIds[i]),b=guides.get(f.guideIds[j]);
   if(!a||!b||!A.compositionV5oTest.linked(a,b,plan))continue;
   const d=Math.hypot(b.x-a.x,b.y-a.y);
   if(d>6)legal.push({a,b,d});
 }
 legal.sort((a,b)=>b.d-a.d||a.a.guideId.localeCompare(b.a.guideId));
 return legal.slice(0,4);
}

function overlayOil(ctx,mask,field,edges,rr,paint){
 const palette=field.paintPalette||field.palette||[field.rgb];
 if(typeof paint!=='function')throw Error('Oil V4e loaded contact brush unavailable');
 let strokes=0,pools=0;
 // Pigment and height are painted together by the actual V4e physical
 // brush, retaining directional bristle marks and skips.
 for(let i=0;i<edges.length;i++){
   const e=edges[i],d=e.d,tx=(e.b.x-e.a.x)/d,
     ty=(e.b.y-e.a.y)/d,nx=-ty,ny=tx,
     breadth=clamp(d*.28,18,82);
   for(let layer=0;layer<4;layer++){
     const off=(layer-1.5)*breadth*.24+rr.range(-9,9),
       a={x:e.a.x+nx*off,y:e.a.y+ny*off},
       b={x:e.b.x+nx*off,y:e.b.y+ny*off},
       middle={x:(a.x+b.x)/2+nx*rr.range(-12,12),
         y:(a.y+b.y)/2+ny*rr.range(-12,12)},
       c=blend(palette[(i+layer)%palette.length],
         layer%3===0?[246,224,196]:[61,51,46],layer%3===0?.06:.025);
     paint(ctx,mask,[a,middle,b],breadth*rr.range(.35,.57),
       c,layer%3===0?'flat':'filbert',rr,{
         thickness:rr.range(.66,.92),drag:rr.range(.42,.81),
         bristles:rr.range(.85,.99)});
     strokes++;
   }
 }
 return {strokes,pools};
}

// ---- Oil V8 additions ----
let V8={masses:false,relief:false,weave:false,amount:.6};
const V8_GAIN=.35; // height per deposit relative to V7, so stacks don't saturate
// Height accumulates additively ('lighter'), scaled by V8_GAIN, so paint
// stacked on paint keeps rising instead of flattening at full alpha.
function additiveHeight(ctx){
 ctx.globalCompositeOperation='lighter';
 return new Proxy(ctx,{
  get(t,k){if(k==='globalAlpha')return t.globalAlpha/V8_GAIN;const v=t[k];return typeof v==='function'?v.bind(t):v;},
  set(t,k,v){if(k==='globalAlpha')t.globalAlpha=clamp(v*V8_GAIN,0,1);
   else if(k==='globalCompositeOperation')t.globalCompositeOperation='lighter';else t[k]=v;return true;}
 });
}
function hash01(a,b){let n=(Math.imul(a|0,374761393)^Math.imul(b|0,668265263))|0;
 n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function smoothLine(points){
 let p=points.map(q=>({x:q.x,y:q.y}));
 for(let k=0;k<2&&p.length>2;k++){
  const out=[p[0]];
  for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];
   out.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});}
  out.push(p[p.length-1]);p=out;
 }
 return p;
}
// Paint pushed aside by the brush: low ridges just inside both sides of the
// stroke, rising towards the end, and a lip of paint where the brush lifts.
// Height only: colour is untouched.
function buildUp(mask,points,width,options){
 if(points.length<2||width<5)return;
 const p=smoothLine(points),n=p.length,thick=clamp(options?.thickness??.9,.4,1.1);
 let total=0;const s=[0];
 for(let i=1;i<n;i++){total+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);s.push(total);}
 if(total<width*.8)return;
 mask.save();mask.fillStyle='#fff';mask.strokeStyle='#fff';mask.lineCap='round';
 mask.lineWidth=Math.max(1.1,width*.07);
 for(const side of [-1,1]){
  for(let i=1;i<n;i++){
   const t=s[i]/total;if(t<.08||t>.9)continue;
   const a=p[i-1],b=p[i],d=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/d*side,ny=(b.x-a.x)/d*side,
    off=width*(.36+.06*hash01(i,side*7+Math.round(total))),
    wobble=.55+.45*hash01(i*3,side+Math.round(width));
   if(hash01(i*5+3,side*11+Math.round(width))<.35)continue; // broken, not a continuous rail
   mask.globalAlpha=(.10+.22*t)*thick*wobble;
   mask.beginPath();mask.moveTo(a.x+nx*off,a.y+ny*off);mask.lineTo(b.x+nx*off,b.y+ny*off);mask.stroke();
  }
 }
 // The lip: an elongated ridge across the stroke, just before the end.
 const e=p[n-1],f=p[Math.max(0,n-3)],ang=Math.atan2(e.y-f.y,e.x-f.x),
  back=Math.min(total*.08,width*.35);
 mask.globalAlpha=.38*thick;mask.beginPath();
 mask.ellipse(e.x-Math.cos(ang)*back,e.y-Math.sin(ang)*back,width*.11,width*.32,ang,0,Math.PI*2);mask.fill();
 mask.restore();
}
function principalAngle(pts){
 let mx=0,my=0;for(const q of pts){mx+=q.x;my+=q.y;}mx/=pts.length;my/=pts.length;
 let xx=0,yy=0,xy=0;for(const q of pts){const dx=q.x-mx,dy=q.y-my;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;}
 return .5*Math.atan2(2*xy,xx-yy);
}
// Where a horizontal line (in the rotated frame) crosses the polygon.
function rowIntervals(poly,v){
 const xs=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
  if((a.v<=v&&b.v>v)||(b.v<=v&&a.v>v))xs.push(a.u+(v-a.v)*(b.u-a.u)/(b.v-a.v));}
 xs.sort((x,y)=>x-y);const out=[];for(let i=0;i+1<xs.length;i+=2)out.push([xs[i],xs[i+1]]);
 return out;
}
// Cover a mass with overlapping directional strokes in its own colour,
// following its long axis, with slight changes of angle, length and tone.
// Uses its own RNG so the V7 strokes that follow keep their sequence.
function layDown(ctx,mask,contour,rgb,seed,painter){
 if(!V8.masses||!contour||contour.length<3)return 0;
 const r=rng(seed+'|oil-v8-laydown'),ang=principalAngle(contour),ca=Math.cos(ang),sa=Math.sin(ang);
 const poly=contour.map(q=>({u:q.x*ca+q.y*sa,v:-q.x*sa+q.y*ca}));
 let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
 for(const q of poly){u0=Math.min(u0,q.u);u1=Math.max(u1,q.u);v0=Math.min(v0,q.v);v1=Math.max(v1,q.v);}
 const across=v1-v0,along=u1-u0;if(across<8||along<8)return 0;
 const width=clamp(across*.16,13,38),spacing=width*.62,
  length=clamp(along*.34,width*2.2,170),budget=150;
 const toXY=(u,v)=>({x:u*ca-v*sa,y:u*sa+v*ca});
 let strokes=0;
 for(let v=v0+spacing*.5;v<v1&&strokes<budget;v+=spacing){
  for(const [a,b] of rowIntervals(poly,v)){
   let u=a-length*r.range(.05,.35);
   while(u<b&&strokes<budget){
    const len=length*r.range(.75,1.15),tilt=r.range(-.12,.12),vv=v+r.range(-spacing*.2,spacing*.2),
     start=Math.max(u,a-width*.4),end=Math.min(u+len,b+width*.4);
    if(end-start>width*.9){
     const mid=(start+end)/2,half=(end-start)/2,bow=r.range(-.06,.06)*half,
      dir=r.n()<.5?1:-1,
      p0=toXY(mid-half*dir,vv-Math.sin(tilt)*half*dir),
      p1=toXY(mid,vv+bow),
      p2=toXY(mid+half*dir,vv+Math.sin(tilt)*half*dir),
      tone=r.n(),colour=tone<.2?blend(rgb,[243,228,205],.05):tone>.85?blend(rgb,[52,45,40],.03):rgb;
     painter(ctx,mask,[p0,p1,p2],width*r.range(.85,1.15),colour,r.n()<.4?'flat':'filbert',r,
      {thickness:r.range(.82,1),drag:r.range(.35,.7),bristles:r.range(.86,.98)});
     strokes++;
    }
    u+=len*r.range(.62,.82);
   }
  }
 }
 return strokes;
}
function boxBlur(src,w,h,radius){
 if(radius<1)return Float32Array.from(src);
 const tmp=new Float32Array(src.length),out=new Float32Array(src.length),k=1/(2*radius+1);
 for(let y=0;y<h;y++){const o=y*w;let acc=0;
  for(let x=-radius;x<=radius;x++)acc+=src[o+clamp(x,0,w-1)];
  for(let x=0;x<w;x++){tmp[o+x]=acc*k;acc+=src[o+Math.min(w-1,x+radius+1)]-src[o+Math.max(0,x-radius)];}}
 for(let x=0;x<w;x++){let acc=0;
  for(let y=-radius;y<=radius;y++)acc+=tmp[clamp(y,0,h-1)*w+x];
  for(let y=0;y<h;y++){out[y*w+x]=acc*k;acc+=tmp[Math.min(h-1,y+radius+1)*w+x]-tmp[Math.max(0,y-radius)*w+x];}}
 return out;
}
// Lighting from a raking upper-left light: diffuse shading of ridges and
// grooves, a little darkening in hollows, and small sharp highlights on
// slopes facing the light. Flat paint is left at its own colour.
function lightSurfaceV8(pig,mask,stats,scale){
 const w=pig.canvas.width,h=pig.canvas.height,started=performance.now();
 const hd=mask.getImageData(0,0,w,h).data,image=pig.getImageData(0,0,w,h),px=image.data;
 const raw=new Float32Array(w*h);for(let i=0;i<raw.length;i++)raw[i]=hd[i*4+3]/255;
 // Band-pass the height: bristle grooves and ridges carry the light, while
 // the outline of a whole stroke only gets a soft slope. Lighting the full
 // height makes every stroke look like an extruded tube.
 const fine=boxBlur(raw,w,h,Math.max(1,Math.round(scale*.5))),
  mid=boxBlur(raw,w,h,Math.max(2,Math.round(3*scale))),
  coarse=boxBlur(raw,w,h,Math.max(3,Math.round(8*scale)));
 const surf=new Float32Array(raw.length);for(let i=0;i<surf.length;i++)surf[i]=(fine[i]-mid[i])+.22*mid[i];
 const amount=clamp(V8.amount,0,1),depth=(2+7*amount)*scale;
 let L=[-.45,-.55,.7];{const n=Math.hypot(...L);L=L.map(v=>v/n);}
 let H=[L[0],L[1],L[2]+1];{const n=Math.hypot(...H);H=H.map(v=>v/n);}
 const ambient=.45,flat=ambient+(1-ambient)*L[2],shiny=70,flatSpec=Math.pow(H[2],shiny);
 let active=0,highlights=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const p=y*w+x,b=raw[p];if(b<.03)continue;
  const dx=(surf[p+1]-surf[p-1])*.5*depth,dy=(surf[p+w]-surf[p-w])*.5*depth,
   inv=1/Math.hypot(dx,dy,1),nx=-dx*inv,ny=-dy*inv,nz=inv;
  const diff=Math.max(0,nx*L[0]+ny*L[1]+nz*L[2]),
   shade=clamp((ambient+(1-ambient)*diff)/flat,.62,1.25),
   hollow=1-clamp((coarse[p]-fine[p])*.9*amount,0,.14),
   spec=Math.max(0,Math.pow(Math.max(0,nx*H[0]+ny*H[1]+nz*H[2]),shiny)-flatSpec)*
     (50+110*amount)*Math.min(1,b*2.5),
   k=shade*hollow,i=p*4;
  px[i]=clamp(Math.round(px[i]*k+spec),0,255);
  px[i+1]=clamp(Math.round(px[i+1]*k+spec*.97),0,255);
  px[i+2]=clamp(Math.round(px[i+2]*k+spec*.9),0,255);
  active++;if(spec>12)highlights++;
 }
 pig.putImageData(image,0,0);
 Object.assign(stats,{reliefMs:performance.now()-started,raisedPixels:active,highlightPixels:highlights,
  lightingPasses:1,finalReadbacks:2,strokeReadbacks:0,lighting:'oil-v8'});
}
// ---- end Oil V8 additions ----

// Logical-space pigment history. It estimates paint carried across previous
// contacts, without synchronous canvas reads. It is not a fluid simulation.
function pigmentHistory(width,height,model,voids){
 const cell=14,cols=Math.ceil(width/cell),rows=Math.ceil(height/cell);
 const colours=new Float32Array(cols*rows*3),loads=new Float32Array(cols*rows);
 let pickups=0;
 const inside=p=>!voids.some(v=>p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h);
 function index(p){return clamp(Math.floor(p.y/cell),0,rows-1)*cols+clamp(Math.floor(p.x/cell),0,cols-1);}
 return {
  colour(points,rgb){
   let selected=-1,weight=0;
   for(let j=1;j<=5;j++){
    const p=points[Math.min(points.length-1,Math.floor(j*points.length/6))];
    if(!inside(p))continue;
    const k=index(p);
    if(loads[k]>weight){weight=loads[k];selected=k;}
   }
   if(selected<0||weight<.2)return rgb;
   pickups++;
   const k=selected*3;
   return model.mix(rgb,[colours[k],colours[k+1],colours[k+2]],Math.min(.10,weight*.08));
  },
  deposit(points,width,rgb){
   const radius=Math.min(5,Math.max(0,Math.floor(width/(cell*2))));
   let previous=-1;
   function stamp(p){
    if(!inside(p))return;
    const k=index(p);if(k===previous)return;previous=k;
    const x=k%cols,y=Math.floor(k/cols);
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
     if(dx*dx+dy*dy>radius*radius+1)continue;
     const xx=x+dx,yy=y+dy;
     if(xx<0||xx>=cols||yy<0||yy>=rows)continue;
     if(!inside({x:(xx+.5)*cell,y:(yy+.5)*cell}))continue;
     const n=yy*cols+xx,z=n*3,t=loads[n]>.01?.72:1;
     for(let c=0;c<3;c++)colours[z+c]+=t*(rgb[c]-colours[z+c]);
     loads[n]=Math.min(1,loads[n]+.34);
    }
   }
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(cell*.7)));
    for(let j=0;j<=steps;j++){const t=j/steps;stamp({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
   }
  },
  stats:()=>({pigmentPickups:pickups,historyBytes:colours.byteLength+loads.byteLength})
 };
}
function lightSurface(pig,mask,stats){
 const w=pig.canvas.width,h=pig.canvas.height;
 const started=performance.now(),height=mask.getImageData(0,0,w,h).data;
 const image=pig.getImageData(0,0,w,h),pixels=image.data;
 // Alpha is discrete: calculate each optical height once, not for every
 // neighbour of every shaded pixel. Seven rows keep auxiliary RAM bounded.
 const optical=Float64Array.from({length:256},(_,a)=>a/255>.007?Math.log1p((a/255*1.42)*.66):0);
 const rows=Array.from({length:7},()=>new Float64Array(w));
 const fill=y=>{const row=rows[y%7];for(let x=0;x<w;x++)row[x]=optical[height[(y*w+x)*4+3]];};
 for(let y=1;y<=Math.min(7,h-1);y++)fill(y);
 let active=0;
 for(let y=4;y<h-4;y++){
  for(let x=4;x<w-4;x++){
   const z=(y*w+x)*4;
   if(height[z+3]/255*1.42<.06)continue;
   const l=A.oilPaintV4ETest.surfaceLightingCachedRows(rows,x,y,.88);
   pixels[z]=clamp(Math.round(pixels[z]*l.shade+l.shine),0,255);
   pixels[z+1]=clamp(Math.round(pixels[z+1]*l.shade+l.shine*.87),0,255);
   pixels[z+2]=clamp(Math.round(pixels[z+2]*l.shade+l.shine*.77),0,255);
   active++;
  }
  if(y+4<h)fill(y+4);
 }
 pig.putImageData(image,0,0);
 Object.assign(stats,{reliefMs:performance.now()-started,raisedPixels:active,lightingPasses:1,
  finalReadbacks:2,strokeReadbacks:0,lightingCacheBytes:7*w*8+optical.byteLength});
}
// options.masses true: cover flat-filled masses with directional brushstrokes.
// options.relief true: accumulating height, edge/end build-up, V8 lighting.
// options.weave true:  dry paint and bare canvas show an irregular weave
//                      (js/oil-brush-v8.js) instead of V7's regular dot lattice.
// options.amount 0–1:  strength of the V8 relief lighting (default .6).
A.renderOilPaintV8=function(target,settings,scale=1,reveal=false,options={}){
 if(!A.captureCompositionV5||!A.oilPaintV4ETest?.drawContactBrushV8||!A.oilPigment)
  throw Error('Oil V8 requires the source planner, V3 contact brush and V5 pigments');
 if(!(Number.isFinite(scale)&&scale>0&&scale<=8))throw Error('Oil V8 scale must be >0 and <=8');
 const previousV8=V8,previousWeave=A.oilV8Weave;
 V8={masses:options.masses===true,relief:options.relief===true,weave:options.weave===true,amount:clamp(options.amount??.6,0,1)};
 A.oilV8Weave=V8.weave;
 const saved={},keys=['oilPigmentActive','oilStageDRefinement','oilStageCScale','oilStageCStats','oilOpaquePaint'];
 for(const k of keys)saved[k]={own:Object.prototype.hasOwnProperty.call(A,k),value:A[k]};
 const stats={sourceCaptures:1,brushCalls:0};
 const started=performance.now();
 let meta;
 try{
  meta=A.renderViaCPUCanvas(canvas=>{
   const model=A.oilPigment.createModel();
   A.oilPigmentActive=model;A.oilOpaquePaint=true;A.oilStageDRefinement=true;A.oilStageCScale=scale;A.oilStageCStats={};
   A.oilPaintV4ETest.resetV8ToothSlot('cpu');
   const opts={phiFraming:A.phiFramingEnabled===true,maxRegions:28};
   const capture=A.captureCompositionV5(settings,opts);
   const plan=A.planCompositionV5FromSource(capture,settings,opts);
   stats.planMs=performance.now()-started;
   const w=Math.round(plan.width*scale),h=Math.round(plan.height*scale);
   canvas.width=Math.max(1,w);canvas.height=Math.max(1,h);
   const pig=canvas.getContext('2d'),maskCanvas=document.createElement('canvas');
   maskCanvas.width=canvas.width;maskCanvas.height=canvas.height;
   const mask=V8.relief?additiveHeight(maskCanvas.getContext('2d')):maskCanvas.getContext('2d');
   pig.scale(scale,scale);mask.scale(scale,scale);
   pig.fillStyle=settings.paper||'#f5f0e6';pig.fillRect(0,0,plan.width,plan.height);
   // Restrained ground tooth stays visible in the paper reserves.
   pig.fillStyle='rgba(110,96,78,.022)';
   for(let x=0;x<plan.width;x+=5)pig.fillRect(x,0,.55,plan.height);
   for(let y=0;y<plan.height;y+=6)pig.fillRect(0,y,plan.width,.45);
   if(V8.weave){ // the same irregular weave the dry paint catches on, in place of the ruled grid
    pig.fillStyle=settings.paper||'#f5f0e6';pig.fillRect(0,0,plan.width,plan.height);
    pig.fillStyle=A.oilPaintV4ETest.weaveGroundV8(pig);pig.fillRect(0,0,plan.width,plan.height);
   }
   pig.save();mask.save();
   if(plan.protectedVoids.length){
    const clip=new Path2D();clip.rect(0,0,plan.width,plan.height);
    for(const v of plan.protectedVoids)clip.rect(v.x,v.y,v.w,v.h);
    pig.clip(clip,'evenodd');mask.clip(clip,'evenodd');
   }
   const history=pigmentHistory(plan.width,plan.height,model,plan.protectedVoids);
   const physical=A.oilPaintV4ETest.drawContactBrushV8;
   let transfer=true;
   const paint=(ctx,height,points,width,rgb,profile,r,options)=>{
    const colour=transfer?history.colour(points,rgb):rgb;
    const result=physical(ctx,height,points,width,colour,profile,r,options);
    if(transfer)history.deposit(points,width,colour);stats.brushCalls++;
    if(V8.relief)buildUp(height,points,width,options);
    return result;
   };
   const checkpoint=name=>{if(A.materialStageCapture)A.materialStageCapture(name,canvas);};
   checkpoint('oil-v7-ground');
   const chains=sourceBrush.getChains(capture.paths);
   stats.eligibleChains=chains.eligibleCount;stats.sourceChains=chains.length;stats.droppedChains=chains.droppedCount;
   const r=rng(settings.seed+'|oil-v7|'+settings.mode);
   const paintStart=performance.now();
   for(let i=0;i<chains.length;i++){
    const c=chains[i],width=clamp(6+c.width*1.8,9,58)*1.828*r.range(.90,1.08);
    const profile=sourceBrush.profile(c,settings.mode,r);
    paint(pig,mask,c.pts,width,model.mapRGB(c.rgb),profile,r,{thickness:.9,drag:.72,bristles:.92});
    if(i<12||((i+1)%Math.max(1,Math.ceil(chains.length/10))===0))checkpoint('oil-v7-source-'+(i+1));
   }
   transfer=false;
   stats.fieldStrokes=0;
   for(const area of plan.connectedFields){
    const field={...area,paintRgb:model.mapRGB(area.paintRgb||area.rgb),
     paintPalette:(area.paintPalette||area.palette||[area.rgb]).map(c=>model.mapRGB(c))};
    stats.fieldStrokes+=oilColourField(pig,mask,field,paint,plan);
    checkpoint('oil-v7-field-'+area.id);
   }
   stats.territoryStrokes=0;stats.paintedTerritories=0;stats.regionStrokes=0;
   if(!plan.connectedFields.length){
    for(const original of plan.territories||[]){
     if(original.role!=='painted')continue;
     const cell={...original,rgb:model.mapRGB(original.rgb)};
     stats.territoryStrokes+=cell.kind==='rect-cell'?
      oilTerritory(pig,mask,cell,cell.rgb,cell.seed,paint):oilGuideTerritory(pig,mask,cell,paint);
     stats.paintedTerritories++;
    }
    for(let i=0;i<plan.regions.length;i++){
     if(plan.sourceGuideKind==='rects'&&i%4!==0)continue;
     if(plan.guideStats&&(plan.guideStats.branches||plan.guideStats.ribbons||plan.guideStats.constructed)&&i%3!==0)continue;
     const a={...plan.regions[i],rgb:model.mapRGB(plan.regions[i].rgb)},rr=rng(a.seed+'|oil-v5'),area=massContour(a);
     pig.globalAlpha=1;pig.fillStyle=hex(blend(a.rgb,[243,228,205],.075));pig.fill(area);
     mask.globalAlpha=.46;mask.fillStyle='#fff';mask.fill(area);
     if(V8.masses){pig.save();mask.save();pig.clip(area);mask.clip(area);
      stats.laydownStrokes=(stats.laydownStrokes||0)+layDown(pig,mask,a.contour,a.rgb,a.seed,paint);pig.restore();mask.restore();}
     for(let k=0;k<2;k++){
      const offset=(k-.5)*a.width*.31,c=shifted(a,a.angle+PI/2,offset),len=a.length*(k===0?1.03:.65);
      paint(pig,mask,[shifted(c,a.angle,-len*.5),shifted(c,a.angle,rr.range(-3,3)),shifted(c,a.angle,len*.5)],
       a.width*(k===0?1.35:.82),a.rgb,['filbert','flat','knife'][i%3],rr,{thickness:.94,drag:.35,bristles:.9});
      stats.regionStrokes++;
     }
    }
    for(const a of plan.gestures){
     const rr=rng(a.seed+'|oil-v5'),rgb=model.mapRGB(a.rgb);
     paint(pig,mask,[shifted(a,a.angle,-a.length*.5),{x:a.x,y:a.y},shifted(a,a.angle,a.length*.5)],
      Math.max(9,a.width*1.3),blend(rgb,[245,225,196],.08),'filbert',rr,{thickness:.72,drag:.6,bristles:.9});
     stats.regionStrokes++;
    }
    checkpoint('oil-v7-territories-and-masses');
   }
   stats.connectionStrokes=0;
   for(const area of plan.connectedFields){
    if(area.kind!=='guide-chain-colour-mass')continue;
    const edges=approvedEdges(area,plan);if(!edges.length)continue;
    const field={...area,paintPalette:(area.paintPalette||area.palette||[area.rgb]).map(c=>model.mapRGB(c))};
    const boundary=massContour(field);
    pig.save();mask.save();pig.clip(boundary);mask.clip(boundary);
    const result=overlayOil(pig,mask,field,edges,rng(field.seed+'|v5q|oil'),paint);
    stats.connectionStrokes+=result.strokes;
    pig.restore();mask.restore();
   }
   pig.restore();mask.restore();pig.setTransform(1,0,0,1,0,0);
   stats.paintMs=performance.now()-paintStart;
   checkpoint('oil-v7-before-relief');
   if(V8.relief)lightSurfaceV8(pig,mask,stats,scale);else lightSurface(pig,mask,stats);
   checkpoint('oil-v7-after-relief');
   if(reveal){
    pig.save();pig.setTransform(scale,0,0,scale,0,0);
    A.W=plan.width;A.H=plan.height;A.geometryOverlay(pig,settings,capture.meta);pig.restore();
   }
   Object.assign(stats,history.stats());
   return {...capture.meta,version:'oil-paint-v8',material:'oil',options:{...V8},plan,work:stats,
    pigment:{model:model.name,...model.stats}};
  },target,'oil-paint-v8');
 }finally{
  for(const k of keys){if(saved[k].own)A[k]=saved[k].value;else delete A[k];}
  V8=previousV8;A.oilV8Weave=previousWeave;
 }
 stats.totalMs=performance.now()-started;
 A.lastRenderMeta={strategy:meta.strategy,guide:meta.guide,voids:meta.voids||[],
  ...(meta.phiSheetFrame?{phiSheetFrame:meta.phiSheetFrame}:{})};
 A.lastPhiSheetFrame=meta.phiSheetFrame||null;
 return meta;
};
})(window.AlgoArt);

