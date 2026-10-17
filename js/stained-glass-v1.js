// ALGO/ART Stained Glass V1 — isolated experiment, not production material.
// Converts precise SOURCE marker paths into Voronoi glass pieces, then applies
// deterministic per-pane colour, edge darkening and a shared lead network.
// No external library and no source-renderer modifications.
(function(A){
'use strict';
const PHI=(1+Math.sqrt(5))/2;
function seedHash(value){let h=2166136261;for(const ch of String(value)){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0}
function rng(seed){let state=seedHash(seed)||1;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function interpolate(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function sampleSource(paths,w,h,seed,limit){
  const rand=rng(seed+'|sites'),samples=[],margin=19;
  for(const path of paths){
    const nums=String(path.d||'').match(/[MLCmlc]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)||[];
    let cursor=null,index=0;
    while(index<nums.length){
      const op=nums[index++];
      if(op==='M'||op==='L'||op==='m'||op==='l'){
        const x=+nums[index++],y=+nums[index++];
        if(!Number.isFinite(x)||!Number.isFinite(y))continue;
        const pt={x,y};
        if(cursor&&op.toUpperCase()==='L'){
          const len=distance(cursor,pt),steps=Math.min(30,Math.floor(len/38));
          for(let k=1;k<=steps;k++)samples.push(interpolate(cursor,pt,k/(steps+1)));
        }
        samples.push(pt);cursor=pt;
      }else if(op==='C'||op==='c'){
        const x1=+nums[index++],y1=+nums[index++],x2=+nums[index++],y2=+nums[index++],x3=+nums[index++],y3=+nums[index++];
        if(!cursor)continue;
        const p0=cursor;
        for(let k=1;k<=10;k++){
          const t=k/10,u=1-t;
          samples.push({x:u*u*u*p0.x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,
            y:u*u*u*p0.y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3});
        }
        cursor={x:x3,y:y3};
      }else break;
    }
  }
  const selected=[],spacing=Math.sqrt(w*h/limit)*.60;
  const shuffled=samples.map((p,i)=>({p,k:rand(),i})).sort((a,b)=>a.k-b.k);
  for(const {p} of shuffled){
    if(selected.length>=limit)break;
    if(p.x<margin||p.y<margin||p.x>w-margin||p.y>h-margin)continue;
    if(selected.every(q=>distance(p,q)>spacing))selected.push({x:p.x,y:p.y});
  }
  // Deliberate sparse site distribution in empty regions; otherwise this
  // would only enclose marks and leave giant empty panes at the edge.
  const columns=Math.ceil(Math.sqrt(limit*w/h)),rows=Math.ceil(limit/columns);
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    if(selected.length>=limit)break;
    const p={x:(i+.5+(rand()-.5)*.45)*w/columns,y:(j+.5+(rand()-.5)*.45)*h/rows};
    if(selected.every(q=>distance(p,q)>spacing*.73))selected.push(p);
  }
  return selected;
}
// Half-plane clipping. Every cell is the intersection of the sheet and the
// half-planes nearer to its own site than all other sites.
function clip(poly,a,b,c){
  const result=[];
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p.x+b*p.y-c,dq=a*q.x+b*q.y-c;
    if(dp<=0)result.push(p);
    if((dp<0&&dq>0)||(dp>0&&dq<0)){
      const t=dp/(dp-dq);result.push(interpolate(p,q,t));
    }
  }
  return result;
}
function makeCells(sites,w,h){
  return sites.map((p,i)=>{
    let poly=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
    for(let j=0;j<sites.length&&poly.length;j++){
      if(i===j)continue;
      const q=sites[j],a=2*(q.x-p.x),b=2*(q.y-p.y),c=q.x*q.x+q.y*q.y-p.x*p.x-p.y*p.y;
      poly=clip(poly,a,b,c);
    }
    return poly;
  });
}
function trace(ctx,poly){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
function buildEdges(cells){
  const edges=new Map();
  for(const poly of cells)for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length];
    if(distance(p,q)<.2)continue;
    const key=[p,q].map(z=>Math.round(z.x*100)/100+','+Math.round(z.y*100)/100).sort().join('|');
    if(!edges.has(key))edges.set(key,[p,q]);
  }
  return [...edges.values()];
}
function colour(sourceCtx,x,y,random){
  const rgba=sourceCtx.getImageData(Math.max(0,Math.floor(x)),Math.max(0,Math.floor(y)),1,1).data;
  const boost=.56+random()*.42;
  const colour=['r','g','b'].map((_,i)=>Math.min(255,Math.round(rgba[i]*boost+28+random()*17)));
  return 'rgb('+colour.join(',')+')';
}
A.stainedGlassV1={
  generate:function(output,settings,options={}){
    const scale=options.scale||1,w=settings.orientation==='portrait'?1000:1400,h=settings.orientation==='portrait'?1400:1000;
    const source=document.createElement('canvas'),collector={precise:true,paths:[],paperMarks:[]};
    const previous=A.svgRecorder,priorMeta=A.lastRenderMeta,priorFrame=A.lastPhiSheetFrame,priorW=A.W,priorH=A.H;
    let meta;
    try{
      A.svgRecorder=collector;
      meta=A.render(source,settings,1,false);
    }finally{
      A.svgRecorder=previous;A.lastRenderMeta=priorMeta;A.lastPhiSheetFrame=priorFrame;A.W=priorW;A.H=priorH;
    }
    const count=Math.max(20,Math.min(130,options.pieces||72));
    const sites=sampleSource(collector.paths,w,h,settings.seed+'|'+settings.mode,count);
    const cells=makeCells(sites,w,h),edges=buildEdges(cells),ctx=output.getContext('2d');
    output.width=Math.round(w*scale);output.height=Math.round(h*scale);
    ctx.setTransform(scale,0,0,scale,0,0);
    const rand=rng(settings.seed+'|STAINED-GLASS-V1|'+settings.mode);
    ctx.fillStyle='#151311';ctx.fillRect(0,0,w,h);
    const sourceCtx=source.getContext('2d',{willReadFrequently:true});
    cells.forEach((poly,i)=>{
      if(poly.length<3)return;
      const site=sites[i],base=colour(sourceCtx,site.x,site.y,rand);
      ctx.save();trace(ctx,poly);ctx.clip();
      ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
      const radius=Math.max(60,Math.sqrt(w*h/count)*2.5);
      const glow=ctx.createRadialGradient(site.x-radius*.4,site.y-radius*.4,0,site.x,site.y,radius);
      glow.addColorStop(0,'rgba(255,255,226,.36)');glow.addColorStop(.7,'rgba(255,255,255,0)');glow.addColorStop(1,'rgba(18,12,28,.42)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      // Sparse deterministic streaks/bubbles; no unseeded noise.
      ctx.globalAlpha=.09;ctx.strokeStyle='#fff9e2';
      const bb=poly.reduce((v,p)=>({minX:Math.min(v.minX,p.x),maxX:Math.max(v.maxX,p.x),
        minY:Math.min(v.minY,p.y),maxY:Math.max(v.maxY,p.y)}),
        {minX:w,minY:h,maxX:0,maxY:0});
      for(let k=0;k<10;k++){
        const x=bb.minX+rand()*(bb.maxX-bb.minX),y=bb.minY+rand()*(bb.maxY-bb.minY);
        ctx.lineWidth=.5+rand()*1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+6,y+10,x-6,y+24,x+5,y+36);ctx.stroke();
      }
      ctx.restore();
    });
    // Shared seams are each drawn exactly once to avoid doubled lead widths.
    ctx.lineJoin='round';ctx.lineCap='round';
    for(const [p,q] of edges){
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);
      ctx.strokeStyle='#171916';ctx.lineWidth=options.leadWidth||8;ctx.stroke();
      ctx.strokeStyle='rgba(196,198,180,.38)';ctx.lineWidth=1.45;
      ctx.translate(-1.2,-1.2);ctx.stroke();ctx.translate(1.2,1.2);
    }
    ctx.setTransform(1,0,0,1,0,0);
    return {version:'stained-glass-v1',mode:settings.mode,seed:settings.seed,
      pieces:cells.length,seams:edges.length,sourcePaths:collector.paths.length,
      compositionStrategy:meta?.strategy,width:output.width,height:output.height};
  }
};
})(window.AlgoArt);
