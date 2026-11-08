// Brush frames and pressure from oil-v1-core-a.js, relief from oil-paint-v8.js.
// PROPORTION PIECE source 424b3b9ae295a2dd1490e6457e3d206dcb80ce46.
(function(A){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const minmax=clamp;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const tangent=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const V8={amount:.6};
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
A.oilPaintV4ETest={pressureAt,buildBrushFrames};
A.collabOilRelief=function(pig,mask,scale){lightSurfaceV8(pig,mask,{},scale)};
})(window.AlgoArt);
