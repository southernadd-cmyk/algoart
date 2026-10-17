// Experimental ALGO/ART Action Painting V2.
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
function fling(ctx,r,from,to,color,weight,energy,w,h){
var dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);if(len<5)return;
var nx=-dy/len,ny=dx/len,dir=between(r,-1,1),lateral=dir*between(r,.16,.58)*len*energy;
var overshoot=between(r,.1,.38)*len;
var p0={x:from.x-dx/len*overshoot*.25,y:from.y-dy/len*overshoot*.25};
var p1={x:from.x+dx*.22+nx*lateral,y:from.y+dy*.22+ny*lateral};
var p2={x:to.x-dx*.16-nx*lateral*.55,y:to.y-dy*.16-ny*lateral*.55};
var p3={x:to.x+dx/len*overshoot,y:to.y+dy/len*overshoot};
var pts=[],samples=Math.min(80,Math.max(18,Math.ceil(len/12)));
for(var i=0;i<=samples;i++){var t=i/samples,u=1-t;pts.push({x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y})}
ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
for(i=1;i<pts.length;i++){
 var a=pts[Math.max(0,i-1)],b=pts[i],prev=pts[Math.max(0,i-2)],next=pts[Math.min(pts.length-1,i+1)];
 var ax=a.x-prev.x,ay=a.y-prev.y,bx=next.x-b.x,by=next.y-b.y;
 var angle=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
 var bend=Math.min(1,Math.abs(angle)*2.7);
 var width=weight*(.34+1.75*bend)*(i<3||i>pts.length-4?1.23:1);
 if(r()<.035*(1-bend))continue;
 ctx.globalAlpha=between(r,.65,.96);ctx.lineWidth=Math.max(.45,width);
 ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 if(bend>.3&&r()<.38){ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(b.x,b.y,Math.max(1,width*between(r,.5,1.3)),0,Math.PI*2);ctx.fill()}
 if(r()<.12*energy)scatter(ctx,r,b.x,b.y,2+Math.floor(r()*6),color,between(r,6,30)*energy);
}
ctx.globalAlpha=.88;
for(var j=0;j<Math.floor(energy*8);j++){var spot=pts[Math.floor(r()*pts.length)];scatter(ctx,r,spot.x,spot.y,2+Math.floor(r()*8),color,between(r,6,45)*energy)}
ctx.restore();
}
var KITS=[
['#14161b','#f0d3a3','#b12d24','#e8bd35','#33678c','#ece8de'],
['#121f23','#1854a0','#ee4635','#f1c94b','#f4f2e9','#639984'],
['#342f2c','#c9443c','#d6a34a','#274a57','#eee7d5','#8c6b7b'],
['#161619','#e9e2d6','#db4025','#f0c33a','#487aa2','#718c56']
];
function samplePaths(paths){var anchors=[];for(var i=0;i<paths.length;i++){var p=paths[i].pts;if(!p.length)continue;anchors.push(p[0],p[Math.floor(p.length/2)],p[p.length-1]);if(p.length>9)anchors.push(p[Math.floor(p.length*.618)])}return anchors}
A.actionPaintingFromPaths=function(target,sourcePaths,s,scale,options){options=options||{};scale=scale||1;
var w=s.orientation==='portrait'?1000:1400,h=s.orientation==='portrait'?1400:1000,r=random(String(s.seed)+'|'+s.mode+'|action-v2|'+(options.variant||0)),paths=dedupe(sourcePaths),anchors=samplePaths(paths),palette=KITS[((options.palette||0)%KITS.length+KITS.length)%KITS.length];
target.width=Math.round(w*scale);target.height=Math.round(h*scale);var ctx=target.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
ctx.fillStyle=s.paper||'#f5f0e6';ctx.fillRect(0,0,w,h);if(!anchors.length)return {pathCount:0,anchorCount:0};
var layers=options.layers||5,density=options.density||1;
// Weave the same palette throughout the painting: dark, colours, light, then dark accents.
var passes=layers*3;
for(var layer=0;layer<passes;layer++){var ix=layer%3===0?0:layer%3===2?palette.length-1:1+Math.floor(r()*Math.max(1,palette.length-2));
if(layer>passes-3)ix=layer%2===0?0:palette.length-2;
var colour=palette[ix],count=Math.min(95,Math.floor((7+anchors.length*.065)*density));
ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
for(var i=0;i<count;i++){var a=anchors[Math.floor(r()*anchors.length)],b=anchors[Math.floor(r()*anchors.length)];
if(Math.hypot(a.x-b.x,a.y-b.y)<w*.07)b=anchors[Math.floor(r()*anchors.length)];
// A few wandering gestures break the mass edge without replacing its geometric origin.
if(r()<.14){var theta=r()*Math.PI*2; b={x:b.x+Math.cos(theta)*w*between(r,.10,.32),y:b.y+Math.sin(theta)*h*between(r,.10,.32)}}
var weight=between(r,1,layer%3===0?11:6),energy=between(r,.5,1.25);
fling(ctx,r,a,b,colour,weight,energy,w,h);
if(i%4===0){var at=anchors[Math.floor(r()*anchors.length)];ctx.globalAlpha=between(r,.5,.95);scatter(ctx,r,at.x,at.y,3+Math.floor(r()*12),colour,between(r,9,48));ctx.globalAlpha=1}
}ctx.restore()}
return {pathCount:paths.length,anchorCount:anchors.length,layers:layers,palette:palette.slice()}}
A.renderActionPainting=function(target,s,scale,showGeometry,options){scale=scale||1;var prior=A.svgRecorder,rec={precise:true,paths:[],paperMarks:[]},scratch=document.createElement('canvas'),meta;
try{A.svgRecorder=rec;meta=A.render(scratch,s,Math.min(1,Math.max(.1,scale)),false)}finally{A.svgRecorder=prior}
var stats=A.actionPaintingFromPaths(target,rec.paths,s,scale,options);if(showGeometry)A.geometryOverlay(target.getContext('2d'),s,meta);A.lastRenderMeta=meta;A.lastActionPaintingStats=stats;return meta}
})(window.AlgoArt);
