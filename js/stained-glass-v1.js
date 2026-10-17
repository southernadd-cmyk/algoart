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

// Preserve the original engine's strokes as structural lead, rather than
// allowing a generic Voronoi field to erase the system's identity.
function drawSourceLead(ctx,paths,w,h,options){
  const maxPaths=options.maxStructurePaths||220;
  const eligible=paths.filter(p=>p&&p.d&&/[MLC]/i.test(p.d));
  // Keep a deterministic spread across the drawing sequence: later layers
  // can be just as important as early focal marks.
  const step=Math.max(1,Math.ceil(eligible.length/maxPaths));
  let drawn=0;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(let i=0;i<eligible.length;i+=step){
    const p=eligible[i];
    let path;try{path=new Path2D(p.d)}catch(_){continue}
    ctx.save();
    // Some engine drawings use a portrait orientation transform in SVG.
    if(p.transform&&p.transform.startsWith('matrix(')){
      const vals=p.transform.slice(7,-1).split(/[ ,]+/).map(Number);
      if(vals.length===6&&vals.every(Number.isFinite))ctx.transform(...vals);
    }
    // Narrow but visible lead follows source strokes; prioritise engine
    // geometry over the generic cell boundaries underneath.
    const width=Math.max(3.2,Math.min(9,(Number(p.width)||2)*.55+2.3));
    ctx.strokeStyle='rgba(14,16,15,.94)';ctx.lineWidth=width+2.4;ctx.stroke(path);
    ctx.strokeStyle='rgba(190,185,158,.65)';ctx.lineWidth=Math.max(.8,width*.23);
    ctx.translate(-1,-1);ctx.stroke(path);
    ctx.restore();drawn++;
  }
  ctx.restore();
  return drawn;
}

// Build physical pane regions from the actual engine marks. The reduced
// resolution topology mask is flood-filled, so lead forms the TRUE boundary
// between independently coloured glass regions (not a Voronoi overlay).
function geometryPanes(paths,w,h,seed,options){
  const divisor=3,gw=Math.ceil(w/divisor),gh=Math.ceil(h/divisor);
  const mask=document.createElement('canvas');mask.width=gw;mask.height=gh;
  const m=mask.getContext('2d',{willReadFrequently:true});
  m.scale(1/divisor,1/divisor);m.fillStyle='#fff';m.fillRect(0,0,w,h);
  m.strokeStyle='#000';m.lineJoin='round';m.lineCap='round';
  const lead=options.leadWidth||8;
  // Real marker geometry creates the principal pane edges.
  const eligible=paths.filter(p=>p?.d&&/[MLC]/i.test(p.d));
  const limit=options.maxStructurePaths||68,step=Math.max(1,Math.ceil(eligible.length/limit));
  let strokes=0;
  const ends=[];
  for(let i=0;i<eligible.length;i+=step){
    const p=eligible[i];
    let path;try{path=new Path2D(p.d)}catch(_){continue}
    m.save();
    if(p.transform?.startsWith('matrix(')){
      const v=p.transform.slice(7,-1).split(/[ ,]+/).map(Number);
      if(v.length===6&&v.every(Number.isFinite))m.transform(...v);
    }
    m.lineWidth=Math.max(7,Math.min(17,(Number(p.width)||3)*.42+lead));
    m.stroke(path);m.restore();strokes++;
    const tokens=p.d.match(/[MLC]|[-+]?(?:\\d*\\.?\\d+)(?:[eE][-+]?\\d+)?/gi)||[];
    let points=[],idx=0;
    while(idx<tokens.length){
      const cmd=tokens[idx++];
      if(cmd==='M'||cmd==='L')points.push({x:+tokens[idx++],y:+tokens[idx++]});
      else if(cmd==='C'){idx+=4;points.push({x:+tokens[idx++],y:+tokens[idx++]})}
      else break;
    }
    if(points.length>1&&distance(points[0],points[points.length-1])>12)
      ends.push(points[0],points[points.length-1]);
  }
  // Open source strokes do not independently create closed glass panes.
  // Extend their ends to their closest frame edges, generating closures
  // from actual geometry rather than unrelated polygons.
  const rand=rng(seed+'|closures');
  m.lineWidth=Math.max(6,lead*.9);
  for(let i=0;i<Math.min(ends.length,36);i++){
    const p=ends[i];
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w||p.y>h)continue;
    let q=null,best=Infinity;
    for(const edge of [{x:0,y:p.y},{x:w,y:p.y},{x:p.x,y:0},{x:p.x,y:h}]){
      const d=distance(p,edge);
      if(d<best){best=d;q=edge}
    }
    if(best>Math.min(w,h)*.15)continue;
    m.beginPath();m.moveTo(p.x,p.y);m.lineTo(q.x,q.y);m.stroke();
  }
  // Black sheet frame supplies the outer boundary for every enclosed face.
  m.lineWidth=Math.max(8,lead);m.strokeRect(0,0,w,h);
  const pixels=m.getImageData(0,0,gw,gh).data;
  const labels=new Int32Array(gw*gh),queue=new Int32Array(gw*gh),areas=[0];
  // Flood fill white regions, with dark anti-alias pixels acting as boundaries.
  let regions=0;
  for(let y=1;y<gh-1;y++)for(let x=1;x<gw-1;x++){
    const start=y*gw+x;if(labels[start]!==0)continue;
    if(pixels[start*4]<126){labels[start]=-1;continue}
    const id=++regions;let head=0,tail=1;queue[0]=start;labels[start]=id;
    while(head<tail){
      const at=queue[head++],xx=at%gw,yy=(at/gw)|0;
      for(const n of [at-1,at+1,at-gw,at+gw]){
        if(n<0||n>=labels.length||labels[n]!==0)continue;
        if(Math.abs(n%gw-xx)+Math.abs(((n/gw)|0)-yy)!==1)continue;
        if(pixels[n*4]<126){labels[n]=-1;continue}
        labels[n]=id;queue[tail++]=n;
      }
    }
    areas[id]=tail;
  }
  return {mask,labels,areas,regions,strokes,gw,gh,divisor};
}
// Hybrid topology: source-engine barriers remain absolute. Only larger
// enclosed regions receive a small number of secondary glass seams.
// This prevents both V1's homogeneous Voronoi pattern and V3's excessive
// unsplit source-paint regions; secondary sites can never cross source lead.
function balancePaneTopology(topology,sourcePaths,w,h,seed,options){
 const {gw,gh,labels,areas,divisor}=topology;
 const target=Math.max(topology.regions+Math.min(42,Math.ceil(topology.regions*.35)),Math.min(125,options.pieces||72));
 const eligible=Array.from({length:topology.regions},(_,i)=>i+1)
  .filter(id=>areas[id]>72).sort((a,b)=>areas[b]-areas[a]);
 const sitesByRegion=new Map();
 // Place at most one extra subdivision site at a time, weighted toward
 // largest source-defined faces. Clamp to avoid fracturing recognizable motifs.
 const capacity=new Map();
 for(const id of eligible)capacity.set(id,Math.min(6,Math.floor(areas[id]/1000)+1));
 let budget=Math.max(0,target-topology.regions);
 const sampled=sampleSource(sourcePaths,w,h,seed+'|hybrid',Math.max(target*2,80));
 const points=sampled.map(p=>({x:p.x/divisor,y:p.y/divisor}));
 for(let id of eligible){
  if(!budget)break;
  const n=Math.min(capacity.get(id),budget+1);
  if(n<2)continue;
  const candidates=[];
  for(const p of points){
   const x=Math.floor(p.x),y=Math.floor(p.y);
   if(x>=0&&y>=0&&x<gw&&y<gh&&labels[y*gw+x]===id)candidates.push(p);
  }
  // Supplement from the actual face bounds instead of placing a global grid.
  let chosen=candidates.slice(0,1);
  if(!chosen.length){
   for(let k=0;k<labels.length;k++)if(labels[k]===id){chosen=[{x:k%gw,y:(k/gw)|0}];break}
  }
  for(let k=1;k<n;k++){
   let best=null,score=-1;
   for(const p of candidates){
    const d=Math.min(...chosen.map(q=>(p.x-q.x)**2+(p.y-q.y)**2));
    if(d>score){score=d;best=p}
   }
   if(!best||score<180)break;
   chosen.push(best);
  }
  // A deterministic scan provides secondary sites if source samples are sparse.
  if(chosen.length<2){
   for(let k=0;k<labels.length;k+=Math.max(1,Math.floor(labels.length/1700))){
    if(labels[k]!==id)continue;
    const p={x:k%gw,y:(k/gw)|0};
    if(chosen.every(q=>distance(p,q)>24))chosen.push(p);
    if(chosen.length>=n)break;
   }
  }
  if(chosen.length>1){sitesByRegion.set(id,chosen);budget-=chosen.length-1}
 }
 const hybrid=new Int32Array(labels.length),offset=new Map();let counter=0;
 for(let id=1;id<=topology.regions;id++){
  const sites=sitesByRegion.get(id);offset.set(id,counter+1);
  counter+=sites?sites.length:1;
 }
 for(let k=0;k<labels.length;k++){
  const id=labels[k];if(id<=0){hybrid[k]=id;continue}
  const sites=sitesByRegion.get(id);
  if(!sites){hybrid[k]=offset.get(id);continue}
  const x=k%gw,y=(k/gw)|0;let index=0,min=Infinity;
  for(let i=0;i<sites.length;i++){const p=sites[i],d=(x-p.x)**2+(y-p.y)**2;
   if(d<min){min=d;index=i}}
  hybrid[k]=offset.get(id)+index;
 }
 // Exactly one seam layer, using both source boundaries and interior divisions.
 const lead=new Uint8Array(labels.length);
 for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
  const i=y*gw+x,id=hybrid[i];
  if(id<1){lead[i]=1;continue}
  if(x+1<gw&&hybrid[i+1]!==id)lead[i]=1;
  if(y+1<gh&&hybrid[i+gw]!==id)lead[i]=1;
 }
 return {...topology,labels:hybrid,regions:counter,hybridLead:lead,
   secondaryPanes:counter-topology.regions,engineRegions:topology.regions};
}
function renderGeometryGlass(ctx,source,topology,w,h,seed,options){
  const {labels,areas,gw,gh,divisor}=topology;
  const rand=rng(seed+'|pane-colours'),src=source.getContext('2d',{willReadFrequently:true});
  const sourcePixels=src.getImageData(0,0,w,h).data;
  // Sample colour at a representative pixel from each actual bounded region.
  const palette=Array.from({length:topology.regions+1},(_,i)=>{
    const fallback=['#315c8d','#b9554d','#b79a4b','#52766a','#765785'];
    return fallback[Math.floor(rand()*fallback.length)];
  });
  const samplePixel=new Array(topology.regions+1);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const id=labels[y*gw+x];
    if(id>0&&!samplePixel[id]&&(topology.hybridLead||areas[id]>2))samplePixel[id]={x,y};
  }
  for(let id=1;id<samplePixel.length;id++)if(samplePixel[id]){
    const p=samplePixel[id],px=Math.min(w-1,p.x*divisor),py=Math.min(h-1,p.y*divisor);
    const pixel=sourcePixels.subarray((py*w+px)*4,(py*w+px)*4+4);
    palette[id]='rgb('+[0,1,2].map(i=>Math.min(255,Math.round(pixel[i]*(.66+rand()*.25)+rand()*28))).join(',')+')';
  }
  const low=document.createElement('canvas');low.width=gw;low.height=gh;
  const c=low.getContext('2d'),img=c.createImageData(gw,gh);
  const rgb=palette.map(color=>{
    const el=document.createElement('canvas').getContext('2d');el.fillStyle=color;
    const hex=el.fillStyle.match(/^#([0-9a-f]{6})$/i);if(hex)return [0,2,4].map(i=>parseInt(hex[1].slice(i,i+2),16));
    const v=el.fillStyle.match(/[0-9]+/g)?.map(Number)||[70,110,140];return v;
  });
  for(let k=0;k<labels.length;k++){
    const id=labels[k],j=k*4;
    if(id<1||topology.hybridLead?.[k]){img.data[j]=19;img.data[j+1]=21;img.data[j+2]=20;}
    else {const v=rgb[id],grain=((k*1103515245+seedHash(seed))>>>25)%13-6;
      img.data[j]=Math.max(0,Math.min(255,v[0]+grain));img.data[j+1]=Math.max(0,Math.min(255,v[1]+grain));img.data[j+2]=Math.max(0,Math.min(255,v[2]+grain));}
    img.data[j+3]=255;
  }
  c.putImageData(img,0,0);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(low,0,0,w,h);
  // The exact same geometry mask produces the dark lead, raised highlights
  // and distinct coloured panes; no misleading overlaid Voronoi grid.
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.12;
  const glow=ctx.createLinearGradient(0,0,w,h);glow.addColorStop(0,'#faf5bb');glow.addColorStop(1,'#131839');
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.restore();
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
    if(options.enginePanes!==false){
      output.width=Math.round(w*scale);output.height=Math.round(h*scale);
      const ctx=output.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
      const baseTopology=geometryPanes(collector.paths,w,h,settings.seed,options);
      const topology=options.enginePanes==='hybrid'?balancePaneTopology(baseTopology,collector.paths,w,h,settings.seed,options):baseTopology;
      renderGeometryGlass(ctx,source,topology,w,h,settings.seed+'|'+settings.mode,options);
      ctx.setTransform(1,0,0,1,0,0);
      return {version:options.enginePanes==='hybrid'?'stained-glass-v5':'stained-glass-v3',mode:settings.mode,seed:settings.seed,
        pieces:topology.regions,engineRegions:topology.engineRegions||topology.regions,secondaryPanes:topology.secondaryPanes||0,structuralPaths:topology.strokes,seams:'engine-defined',
        sourcePaths:collector.paths.length,width:output.width,height:output.height};
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
      ctx.strokeStyle='rgba(23,25,22,.78)';ctx.lineWidth=(options.leadWidth||8)*.66;ctx.stroke();
      ctx.strokeStyle='rgba(196,198,180,.38)';ctx.lineWidth=1.45;
      ctx.translate(-1.2,-1.2);ctx.stroke();ctx.translate(1.2,1.2);
    }
    const structuralPaths=options.engineLead===false?0:drawSourceLead(ctx,collector.paths,w,h,options);
    ctx.setTransform(1,0,0,1,0,0);
    return {structuralPaths,version:'stained-glass-v2',mode:settings.mode,seed:settings.seed,
      pieces:cells.length,seams:edges.length,sourcePaths:collector.paths.length,
      compositionStrategy:meta?.strategy,width:output.width,height:output.height};
  }
};
})(window.AlgoArt);
