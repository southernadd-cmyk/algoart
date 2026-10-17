// Experimental ALGO/ART Action Painting V1.
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
function fling(ctx,r,from,to,color,weight,energy){var dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);if(len<5)return;var nx=-dy/len,ny=dx/len;var lateral=between(r,-1,1)*Math.min(150,len*.23)*energy;
var mid={x:(from.x+to.x)/2+nx*lateral,y:(from.y+to.y)/2+ny*lateral},jitter=Math.min(36,weight*1.8);ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
ctx.globalAlpha=between(r,.65,.94);ctx.lineWidth=weight;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.quadraticCurveTo(mid.x,mid.y,to.x,to.y);ctx.stroke();
ctx.globalAlpha=between(r,.25,.48);ctx.lineWidth=Math.max(.5,weight*.3);ctx.beginPath();ctx.moveTo(from.x+nx*jitter*.45,from.y+ny*jitter*.45);ctx.quadraticCurveTo(mid.x+nx*jitter,mid.y+ny*jitter,to.x+nx*jitter*.25,to.y+ny*jitter*.25);ctx.stroke();
ctx.globalAlpha=.88;var drops=2+Math.floor(energy*7);for(var j=0;j<drops;j++){var t=between(r,.08,.96),u=1-t,x=u*u*from.x+2*u*t*mid.x+t*t*to.x,y=u*u*from.y+2*u*t*mid.y+t*t*to.y;
if(r()<.65){var droplen=between(r,4,36)*energy+weight;ctx.lineWidth=Math.max(.7,weight*between(r,.12,.44));ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+between(r,-6,6),y+droplen*.55,x+between(r,-10,10),y+droplen);ctx.stroke();ctx.beginPath();ctx.arc(x,y+droplen,ctx.lineWidth*.68,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
if(r()<.58)scatter(ctx,r,x,y,2+Math.floor(r()*5),color,between(r,6,27)*energy)}
ctx.globalAlpha=1}
var KITS=[
['#14161b','#f0d3a3','#b12d24','#e8bd35','#33678c','#ece8de'],
['#121f23','#1854a0','#ee4635','#f1c94b','#f4f2e9','#639984'],
['#342f2c','#c9443c','#d6a34a','#274a57','#eee7d5','#8c6b7b'],
['#161619','#e9e2d6','#db4025','#f0c33a','#487aa2','#718c56']
];
function samplePaths(paths){var anchors=[];for(var i=0;i<paths.length;i++){var p=paths[i].pts;if(!p.length)continue;anchors.push(p[0],p[Math.floor(p.length/2)],p[p.length-1]);if(p.length>9)anchors.push(p[Math.floor(p.length*.618)])}return anchors}
A.actionPaintingFromPaths=function(target,sourcePaths,s,scale,options){options=options||{};scale=scale||1;
var w=s.orientation==='portrait'?1000:1400,h=s.orientation==='portrait'?1400:1000,r=random(String(s.seed)+'|'+s.mode+'|action-v1|'+(options.variant||0)),paths=dedupe(sourcePaths),anchors=samplePaths(paths),palette=KITS[((options.palette||0)%KITS.length+KITS.length)%KITS.length];
target.width=Math.round(w*scale);target.height=Math.round(h*scale);var ctx=target.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
ctx.fillStyle=s.paper||'#f5f0e6';ctx.fillRect(0,0,w,h);if(!anchors.length)return {pathCount:0,anchorCount:0};
var layers=options.layers||5,density=options.density||1;
for(var layer=0;layer<layers;layer++){var colour=palette[layer%palette.length],count=Math.min(175,Math.floor((15+anchors.length*.16)*density));
ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
for(var i=0;i<count;i++){var a=anchors[Math.floor(r()*anchors.length)],b=anchors[Math.floor(r()*anchors.length)];
if(Math.hypot(a.x-b.x,a.y-b.y)<w*.07){b=anchors[Math.floor(r()*anchors.length)]}
var weight=between(r,1,layer%3===0?13:6.5),energy=between(r,.48,1.28);
fling(ctx,r,a,b,colour,weight,energy);
if(i%3===0){var at=anchors[Math.floor(r()*anchors.length)];ctx.globalAlpha=between(r,.5,.95);scatter(ctx,r,at.x,at.y,3+Math.floor(r()*16),colour,between(r,9,52));ctx.globalAlpha=1}
}ctx.restore()}
return {pathCount:paths.length,anchorCount:anchors.length,layers:layers,palette:palette.slice()}}
A.renderActionPainting=function(target,s,scale,showGeometry,options){scale=scale||1;var prior=A.svgRecorder,rec={precise:true,paths:[],paperMarks:[]},scratch=document.createElement('canvas'),meta;
try{A.svgRecorder=rec;meta=A.render(scratch,s,Math.min(1,Math.max(.1,scale)),false)}finally{A.svgRecorder=prior}
var stats=A.actionPaintingFromPaths(target,rec.paths,s,scale,options);if(showGeometry)A.geometryOverlay(target.getContext('2d'),s,meta);A.lastRenderMeta=meta;A.lastActionPaintingStats=stats;return meta}
})(window.AlgoArt);
