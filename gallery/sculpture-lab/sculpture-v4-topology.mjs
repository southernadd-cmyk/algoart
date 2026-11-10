// PROPORTION PIECE Sculpture Lab V4.
// Independent, source-derived planar pigment regions + two physically based inflation fields.
// Does not change the production gallery or any archived art.
import {pigmentField} from './material-surface.mjs';
const W=1.34,H=1.88;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const SQRT2=Math.sqrt(2);
const neighbours4=[[-1,0],[1,0],[0,-1],[0,1]];
export const V4_METHODS=Object.freeze(['poisson','medial','gesture','assembly']);
function components(label,w,h,minimum){
  const visited=new Uint8Array(w*h),out=[];
  const stack=new Int32Array(w*h);
  for(let start=0;start<label.length;start++){
    const kind=label[start];
    if(kind<0||visited[start])continue;
    let tail=1,n=0, minX=w,minY=h,maxX=0,maxY=0;
    stack[0]=start;visited[start]=1;
    const cells=[];
    while(tail){
      const p=stack[--tail],x=p%w,y=(p/w)|0;
      cells.push(p);n++;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      for(const [dx,dy] of neighbours4){
        const xx=x+dx,yy=y+dy;
        if(xx<0||xx>=w||yy<0||yy>=h)continue;
        const ni=yy*w+xx;
        if(!visited[ni]&&label[ni]===kind){visited[ni]=1;stack[tail++]=ni;}
      }
    }
    if(n>=minimum)out.push({cells,area:n,kind,minX,minY,maxX,maxY});
  }
  return out.sort((a,b)=>b.area-a.area);
}
function paletteOf(pixels,ink,max=7){
  const bins=new Map(),data=pixels.data;
  for(let i=0;i<ink.length;i++){
    if(!ink[i])continue;
    const k=i*4,r=data[k],g=data[k+1],b=data[k+2];
    const key=(r>>5)*64+(g>>5)*8+(b>>5);
    const v=bins.get(key)||{n:0,r:0,g:0,b:0};
    v.n++;v.r+=r;v.g+=g;v.b+=b;bins.set(key,v);
  }
  const ranked=[...bins.values()].sort((a,b)=>b.n-a.n);
  const pal=[];
  for(const v of ranked){
    const p=[v.r/v.n,v.g/v.n,v.b/v.n];
    if(pal.every(c=>Math.hypot(c[0]-p[0],c[1]-p[1],c[2]-p[2])>49)){
      pal.push(p);if(pal.length===max)break;
    }
  }
  return pal.length?pal:[[80,80,80]];
}
function labelColors(pixels,ink,palette){
  const data=pixels.data,label=new Int16Array(ink.length).fill(-1);
  for(let i=0;i<ink.length;i++){
    if(!ink[i])continue;
    const k=i*4;
    let best=Infinity,selected=0;
    for(let j=0;j<palette.length;j++){
      const p=palette[j],dr=data[k]-p[0],dg=data[k+1]-p[1],db=data[k+2]-p[2];
      const dist=dr*dr+dg*dg+db*db;
      if(dist<best){best=dist;selected=j;}
    }
    label[i]=selected;
  }
  return label;
}
export function segmentPainting(pixels,{material='marker',paper='#f5f0e6',maxRegions=32}={}){
  const field=pigmentField(pixels,{material,paper}),w=field.width,h=field.height;
  const mask=field.occupancy,solid=new Int16Array(w*h);
  for(let i=0;i<mask.length;i++)solid[i]=mask[i]?0:-1;
  const base=components(solid,w,h,6);
  // Colour segmentation only divides a LARGE coherent region when colour
  // subdivisions still cover most of the actual original pigment.
  const palette=paletteOf(pixels,mask,material==='action'?8:6);
  const labelled=labelColors(pixels,mask,palette);
  const out=[],data=pixels.data;
  for(const r of base){
    let pieces=[r];
    if(r.area>=220 && palette.length>1 && ['oil','action','marker'].includes(material)){
      const localLabels=new Int16Array(w*h).fill(-1);
      for(const i of r.cells)localLabels[i]=labelled[i];
      const split=components(localLabels,w,h,10).filter(x=>x.area>=Math.max(10,r.area*.012));
      const coverage=split.reduce((a,x)=>a+x.area,0)/r.area;
      if(split.length>=2&&coverage>.68)pieces=split;
    }
    for(const p of pieces){
      let red=0,green=0,blue=0;
      for(const i of p.cells){const j=i*4;red+=data[j];green+=data[j+1];blue+=data[j+2];}
      out.push({...p,color:'#'+[red,green,blue].map(v=>Math.round(v/p.area).toString(16).padStart(2,'0')).join('')});
    }
  }
  out.sort((a,b)=>b.area-a.area);
  const regions=out.slice(0,maxRegions).map((r,i)=>prepareRegion(r,w,h,i));
  return {
    width:w,height:h,regions,pigmented:field.cells,
    covered:regions.reduce((a,r)=>a+r.area,0),
    palette:palette.length,
    separateShapes:base.length
  };
}
function prepareRegion(region,w,h,id){
  const minX=Math.max(0,region.minX-1),minY=Math.max(0,region.minY-1);
  const rw=Math.min(w,region.maxX+2)-minX;
  const rh=Math.min(h,region.maxY+2)-minY;
  const mask=new Uint8Array(rw*rh),ids=[];
  for(const i of region.cells){
    const x=i%w-minX,y=((i/w)|0)-minY,j=y*rw+x;
    mask[j]=1;ids.push(j);
  }
  const distance=new Float32Array(mask.length);
  for(const j of ids)distance[j]=10000;
  // Two chamfer passes approximate the Euclidean distance to real blank
  // space. Holes remain blank and are therefore preserved.
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){
    const i=y*rw+x;if(!mask[i])continue;
    const at=(xx,yy)=>xx<0||yy<0||xx>=rw||yy>=rh?0:distance[yy*rw+xx];
    distance[i]=Math.min(distance[i],1+at(x-1,y),1+at(x,y-1),
      SQRT2+at(x-1,y-1),SQRT2+at(x+1,y-1));
  }
  for(let y=rh-1;y>=0;y--)for(let x=rw-1;x>=0;x--){
    const i=y*rw+x;if(!mask[i])continue;
    const at=(xx,yy)=>xx<0||yy<0||xx>=rw||yy>=rh?0:distance[yy*rw+xx];
    distance[i]=Math.min(distance[i],1+at(x+1,y),1+at(x,y+1),
      SQRT2+at(x+1,y+1),SQRT2+at(x-1,y+1));
  }
  // Poisson: Δu=-1, u=0 on every internal/external contour. Red-black
  // Gauss-Seidel SOR is deterministic and converges quickly at archive size.
  const potential=new Float32Array(mask.length),interior=[];
  for(const j of ids){
    const x=j%rw,y=(j/rw)|0;
    if(x>0&&x+1<rw&&y>0&&y+1<rh&&
       mask[j-1]&&mask[j+1]&&mask[j-rw]&&mask[j+rw])interior.push(j);
  }
  const omega=1.75;
  for(let pass=0;pass<260;pass++){
    let error=0;
    for(const i of interior){
      const next=(potential[i-1]+potential[i+1]+
        potential[i-rw]+potential[i+rw]+1)*.25;
      const step=omega*(next-potential[i]);
      potential[i]+=step;error=Math.max(error,Math.abs(step));
    }
    if(pass>22&&error<.001)break;
  }
  // An approximate discrete medial-axis ridge: local distance maxima
  // transverse to the shape. Its radius gets propagated to nearby pixels.
  const radius=new Float32Array(mask.length);
  const queue=new Int32Array(mask.length);
  let head=0,tail=0;
  for(const i of ids){
    const x=i%rw,y=(i/rw)|0,d=distance[i];
    const left=x?distance[i-1]:0,right=x+1<rw?distance[i+1]:0;
    const up=y?distance[i-rw]:0,down=y+1<rh?distance[i+rw]:0;
    if((d>=left&&d>=right)||(d>=up&&d>=down)){
      radius[i]=d;queue[tail++]=i;
    }
  }
  if(!tail){
    const i=ids.reduce((best,q)=>distance[q]>distance[best]?q:best,ids[0]);
    radius[i]=distance[i];queue[tail++]=i;
  }
  while(head<tail){
    const i=queue[head++],x=i%rw,y=(i/rw)|0;
    for(const [dx,dy] of neighbours4){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=rw||yy>=rh)continue;
      const j=yy*rw+xx;
      if(mask[j]&&!radius[j]){radius[j]=radius[i];queue[tail++]=j;}
    }
  }
  let maxPotential=0,maxDistance=0;
  for(const i of ids){maxPotential=Math.max(maxPotential,potential[i]);maxDistance=Math.max(maxDistance,distance[i]);}
  return {id,width:w,height:h,minX,minY,maxX:region.maxX,maxY:region.maxY,
    rw,rh,mask,ids,potential,distance,radius,
    maxPotential,maxDistance,area:region.area,color:region.color,
    centerX:(region.minX+region.maxX+1)*.5/w*W-W*.5,
    centerY:H*.5-(region.minY+region.maxY+1)*.5/h*H,
    aspect:Math.max((region.maxX-region.minX+1)*W/w,
      (region.maxY-region.minY+1)*H/h)/
      Math.max(.001,Math.min((region.maxX-region.minX+1)*W/w,(region.maxY-region.minY+1)*H/h))
  };
}
export function regionElevation(r,x,y,mode='poisson'){
  const j=(y-r.minY)*r.rw+(x-r.minX);
  if(x<r.minX||y<r.minY||x>=r.minX+r.rw||
     y>=r.minY+r.rh||!r.mask[j])return 0;
  const scale=(W/r.width+H/r.height)*.5;
  if(mode==='medial'){
    const d=r.distance[j],R=Math.max(d,r.radius[j]);
    return scale*Math.sqrt(Math.max(0,d*(2*R-d)));
  }
  return 2*scale*Math.sqrt(Math.max(0,r.potential[j]));
}
export function sourceShapeProfile(topology){
  return topology.regions.map(r=>({
    id:r.id,area:r.area,aspect:r.aspect,maxHeight:2*((W/r.width+H/r.height)*.5)*
      Math.sqrt(r.maxPotential),peakRadius:r.maxDistance,color:r.color,
    centre:[r.centerX,r.centerY]
  }));
}
