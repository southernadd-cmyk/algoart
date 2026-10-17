// Experimental ALGO/ART Action Painting V4.
// Geometry is produced by the existing marker renderer; no new composition engine.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function random(seed){var v=hash(seed)||1;return function(){v+=0x6D2B79F5;var t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
function between(r,a,b){return a+(b-a)*r()}
function pathPoints(d){var t=(d||'').match(/[MLC]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi)||[],p=[],i=0,cmd='',q=null;
function n(){return Number(t[i++])}
while(i<t.length&&p.length<400){if(/^[MLC]$/i.test(t[i])){cmd=t[i++].toUpperCase();continue}
if(cmd==='M'||cmd==='L'){if(i+1>=t.length)break;q={x:n(),y:n()};p.push(q);cmd='L'}
else if(cmd==='C'&&q){if(i+5>=t.length)break;var a={x:n(),y:n()},b={x:n(),y:n()},c={x:n(),y:n()},f=q;for(var z=1;z<=8;z++){var u=z/8,v=1-u;p.push({x:v*v*v*f.x+3*v*v*u*a.x+3*v*u*u*b.x+u*u*u*c.x,y:v*v*v*f.y+3*v*v*u*a.y+3*v*u*u*b.y+u*u*u*c.y})}q=c;cmd='L'}else break}
return p}
function dedupe(paths){var out=[],seen=new Set();for(var k=0;k<paths.length;k++){var pts=pathPoints(paths[k].d);if(pts.length<2)continue;var a=pts[0],b=pts[pts.length-1],key=[Math.round(a.x/12),Math.round(a.y/12),Math.round(b.x/12),Math.round(b.y/12)].join(':');if(seen.has(key))continue;seen.add(key);out.push({pts:pts,color:paths[k].stroke||'#252525'})}return out}
function scatter(ctx,r,x,y,amount,c,width){ctx.fillStyle=c;for(var i=0;i<amount;i++){var angle=r()*Math.PI*2,rad=Math.pow(r(),.7)*width,sz=Math.pow(r(),2.1)*between(r,.6,7);ctx.beginPath();ctx.ellipse(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad,sz,sz*between(r,.6,1.5),angle,0,Math.PI*2);ctx.fill()}}
function pool(ctx,r,p,heading,weight,color){
 // Smooth irregular paint footprint: cubic-like quadratic joins instead of polygon edges.
 var rx=weight*between(r,.9,2.7),ry=rx*between(r,.38,1.1);
 var n=14+Math.floor(r()*9),angle=heading+between(r,-.7,.7),points=[];
 // Low-frequency modulation keeps pools organic rather than spiky or faceted.
 var phase=r()*6.283185307,second=r()*6.283185307;
 for(var j=0;j<n;j++){var t=j*2*Math.PI/n,mod=1+.14*Math.sin(t*3+phase)+.08*Math.cos(t*5+second)+between(r,-.035,.035);
  points.push({x:Math.cos(t)*rx*mod,y:Math.sin(t)*ry*mod})}
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.beginPath();
 var prev=points[n-1],first=points[0];ctx.moveTo((prev.x+first.x)/2,(prev.y+first.y)/2);
 for(j=0;j<n;j++){var v=points[j],next=points[(j+1)%n];
  ctx.quadraticCurveTo(v.x,v.y,(v.x+next.x)/2,(v.y+next.y)/2)}
 ctx.closePath();ctx.globalAlpha=between(r,.5,.92);ctx.fillStyle=color;ctx.fill();
 if(r()<.22){ctx.beginPath();ctx.ellipse(rx*.72,ry*.2,rx*.3,ry*.26,angle*.1,0,Math.PI*2);ctx.fill()}
 ctx.restore();
}
function fling(ctx,r,from,to,color,weight,energy,w,h,via){
 var dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);if(len<5)return;
 var nx=-dy/len,ny=dx/len,sign=r()<.5?-1:1;
 // Multi-anchor curved skeins: loops have the same chance in dark and light passes.
 var mid=via||{x:(from.x+to.x)/2,y:(from.y+to.y)/2};
 var spread=between(r,.2,.7)*len*sign,fold=r()<.46;
 var p0={x:from.x-dx*between(r,.03,.16),y:from.y-dy*between(r,.03,.16)};
 var p1={x:mid.x-dx*.35+nx*spread,y:mid.y-dy*.35+ny*spread};
 var p2={x:mid.x+dx*(fold?-.34:.22)-nx*spread*.9,y:mid.y+dy*(fold?-.34:.22)-ny*spread*.9};
 var p3={x:to.x+dx*between(r,.05,.27),y:to.y+dy*between(r,.05,.27)};
 // Small perpendicular deflection breaks the remaining ruler-straight needles.
 // Preserve strong long skeins and underlying anchors; no random walk.
 var arch=between(r,.035,.11)*len*(r()<.5?-1:1);
 p1.x+=nx*arch;p1.y+=ny*arch;
 p2.x+=nx*arch*.75;p2.y+=ny*arch*.75;
 var pts=[],N=Math.min(105,Math.max(28,Math.ceil(len/8)));
 for(var k=0;k<=N;k++){var t=k/N,u=1-t;
   pts.push({x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,
             y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y})}
 ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
 // Continuous ribbons with local curvature-dependent slowing and paint deposits.
 for(var i=1;i<pts.length;i++){
   var p=pts[i],q=pts[i-1],before=pts[Math.max(0,i-2)],after=pts[Math.min(N,i+1)];
   var ax=q.x-before.x,ay=q.y-before.y,bx=after.x-p.x,by=after.y-p.y;
   var curvature=Math.min(1,Math.abs(Math.atan2(ax*by-ay*bx,ax*bx+ay*by))*3.8);
   var speed=Math.hypot(p.x-q.x,p.y-q.y);
   var thickness=weight*(.3+curvature*.85+Math.min(.55,2/Math.max(2,speed)))*(r()<.05?.6:1);
   if(r()<.025&&!curvature)continue;
   ctx.globalAlpha=between(r,.53,.92);ctx.lineWidth=Math.max(.5,thickness);
   ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.stroke();
   if(i>3&&i<N-3&&((curvature>.27&&r()<.13)||(speed<2.5&&r()<.15)))
     pool(ctx,r,p,Math.atan2(p.y-q.y,p.x-q.x),Math.max(1.2,thickness),color);
   if(r()<.09*energy)scatter(ctx,r,p.x,p.y,2+Math.floor(r()*5),color,between(r,5,24));
 }
 // Not every gesture pools, and no endpoint is privileged.
 if(r()<.24){var at=pts[2+Math.floor(r()*(N-4))];pool(ctx,r,at,between(r,-3.14,3.14),weight,color)}
 for(var j=0;j<Math.floor(energy*6);j++){var spot=pts[Math.floor(r()*pts.length)];
   scatter(ctx,r,spot.x,spot.y,2+Math.floor(r()*5),color,between(r,8,40))}
 ctx.restore();
}
function samplePaths(paths){var anchors=[];for(var i=0;i<paths.length;i++){var p=paths[i].pts;if(!p.length)continue;anchors.push(p[0],p[Math.floor(p.length/2)],p[p.length-1]);if(p.length>9)anchors.push(p[Math.floor(p.length*.618)])}return anchors}
// Action Painting needs a full working rack of pigments, even when a
// traditional named palette has only 3 anchor hues. Other materials continue
// using A.hues unchanged. Explicit Monochrome remains monochromatic.
function actionPaintPalette(s){
 var count=s.palette==='mono'?Math.max(1,s.colourCount):Math.max(8,s.colourCount);
 var base=A.hues(Object.assign({},s,{colourCount:count}),A.makeR(String(s.seed)+'|action-palette'));
 if(s.palette==='mono'||s.palette==='spectrum'||s.palette==='golden')return base;
 var cycle={primary:3,cmyk:4,warm:6,cold:7,neon:7,pastel:8,earth:8,marker:11}[s.palette]||count;
 return base.map(function(value,i){
  var round=Math.floor(i/cycle);
  if(!round)return value;
  var parts=/^hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)$/.exec(value);
  if(!parts)return value;
  var hue=(+parts[1]+[0,21,-24,42,-43,63][round%6])%360;
  var light=Math.max(26,Math.min(74,+parts[3]+(round%2?-7:8)));
  return 'hsl('+hue+' '+parts[2]+'% '+light+'%)';
 });
}
function paintLayerOrder(length,r){
 var indices=Array.from({length:length},function(_,i){return i});
 for(var i=indices.length-1;i>0;i--){var j=Math.floor(r()*(i+1)),tmp=indices[i];indices[i]=indices[j];indices[j]=tmp}
 return indices;
}
A.actionPaintingFromPaths=function(target,sourcePaths,s,scale,options){options=options||{};scale=scale||1;
var w=s.orientation==='portrait'?1000:1400,h=s.orientation==='portrait'?1400:1000,r=random(String(s.seed)+'|'+s.mode+'|action-v4|'+(options.variant||0)),paths=dedupe(sourcePaths),anchors=samplePaths(paths),palette=actionPaintPalette(s);
target.width=Math.round(w*scale);target.height=Math.round(h*scale);var ctx=target.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
ctx.fillStyle=s.paper||'#f5f0e6';ctx.fillRect(0,0,w,h);if(!anchors.length)return {pathCount:0,anchorCount:0};
var layers=options.layers||5,density=options.density||1;
var archetypes=['off-centre knot','double cluster','diagonal band','hooked crescent','edge-loaded','woven strip'];
var archetype=archetypes[hash(s.seed+'|mass')%archetypes.length];
var cx=anchors.reduce((sum,p)=>sum+p.x,0)/anchors.length,cy=anchors.reduce((sum,p)=>sum+p.y,0)/anchors.length;
var ordered=anchors.slice().sort((a,b)=>a.x-b.x),left=ordered[Math.floor(ordered.length*.25)],right=ordered[Math.floor(ordered.length*.75)];
function select(){
 var p=anchors[Math.floor(r()*anchors.length)],q={x:p.x,y:p.y};
 if(archetype==='off-centre knot'){q.x+=(p.x-cx)*.24+w*.12;q.y+=(p.y-cy)*.2-h*.11}
 if(archetype==='diagonal band'){q.x+=(p.y-cy)*.34;q.y+=(p.x-cx)*.18}
 if(archetype==='double cluster'){var c=r()<.5?left:right;q.x=c.x+(p.x-cx)*.55;q.y=c.y+(p.y-cy)*.55}
 if(archetype==='edge-loaded'){q.x+=(p.x-cx)*.25+(p.x<cx?-w*.09:w*.09)}
 if(archetype==='woven strip'){q.y=cy+(p.y-cy)*.32;q.x+=(p.y-cy)*.25}
 if(archetype==='hooked crescent'){var theta=Math.atan2(p.y-cy,p.x-cx)+.38,rad=Math.hypot(p.x-cx,p.y-cy);q.x=cx+Math.cos(theta)*rad;q.y=cy+Math.sin(theta)*rad}
 return q
}
// Coarse occupancy prevents late opaque paint collapsing into an unreadable centre.
var cellsX=21,cellsY=15,occupancy=new Uint16Array(cellsX*cellsY);
function cell(p){return Math.max(0,Math.min(cellsY-1,Math.floor(p.y/h*cellsY)))*cellsX+
 Math.max(0,Math.min(cellsX-1,Math.floor(p.x/w*cellsX)))}
var passes=layers*3,skipped=0,order=paintLayerOrder(palette.length,r);
for(var layer=0;layer<passes;layer++){
 if(layer&&layer%palette.length===0)order=paintLayerOrder(palette.length,r);
 var ix=order[layer%palette.length];
 var colour=palette[ix],count=Math.min(95,Math.floor((7+anchors.length*.065)*density));
 ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
 for(var i=0;i<count;i++){
  var a=select(),b=select(),via=select(),ca=cell(a),cb=cell(b),cm=cell(via);
  var crowded=Math.max(occupancy[ca],occupancy[cb],occupancy[cm]);
  if(crowded>20&&r()<Math.min(.82,(crowded-20)/36)){skipped++;continue}
  // New gestures may escape the φ mass; origin and intermediate anchors remain derived.
  if(r()<.19){var theta=r()*Math.PI*2;b={x:b.x+Math.cos(theta)*w*between(r,.10,.30),y:b.y+Math.sin(theta)*h*between(r,.10,.30)}}
  var weight=between(r,.8,layer%3===0?9:6),energy=between(r,.55,1.35);
  if(crowded>14)weight*=.55;
  fling(ctx,r,a,b,colour,weight,energy,w,h,via);
  occupancy[ca]++;occupancy[cb]++;occupancy[cm]++;
  if(i%5===0&&crowded<17){var at=select();ctx.globalAlpha=between(r,.3,.75);
   scatter(ctx,r,at.x,at.y,3+Math.floor(r()*9),colour,between(r,9,38));ctx.globalAlpha=1}
 }ctx.restore()}
return {pathCount:paths.length,anchorCount:anchors.length,layers:layers,archetype:archetype,skippedCrowded:skipped,palette:palette.slice()}}
A.renderActionPainting=function(target,s,scale,showGeometry,options){scale=scale||1;var prior=A.svgRecorder,rec={precise:true,paths:[],paperMarks:[]},scratch=document.createElement('canvas'),meta;
try{A.svgRecorder=rec;meta=A.render(scratch,s,Math.min(1,Math.max(.1,scale)),false)}finally{A.svgRecorder=prior}
var stats=A.actionPaintingFromPaths(target,rec.paths,s,scale,options);if(showGeometry)A.geometryOverlay(target.getContext('2d'),s,meta);A.lastRenderMeta=meta;A.lastActionPaintingStats=stats;return meta}
})(window.AlgoArt);
