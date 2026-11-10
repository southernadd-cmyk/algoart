// PROPORTION PIECE Sculpture Lab V4.2.
// Explicit pigment topology: connected components, colour/ink/distance watershed,
// independent Poisson and medial-distance fields. No changes to gallery bakes.
import {pigmentField} from './material-surface.mjs';
const W=1.34,H=1.88,PHI=(1+Math.sqrt(5))/2,SQRT2=Math.sqrt(2);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const neighbours4=[[-1,0],[1,0],[0,-1],[0,1]];
export const V4_METHODS=Object.freeze(['poisson','medial','gesture','assembly']);
function components(label,w,h,minArea=2){
  const visited=new Uint8Array(w*h),stack=new Int32Array(w*h),out=[];
  for(let start=0;start<label.length;start++){
    const kind=label[start];if(kind<0||visited[start])continue;
    let top=1,minX=w,minY=h,maxX=0,maxY=0;
    stack[0]=start;visited[start]=1;
    const cells=[];
    while(top){
      const i=stack[--top],x=i%w,y=(i/w)|0;
      cells.push(i);minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      for(const [dx,dy] of neighbours4){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
        const j=yy*w+xx;
        if(!visited[j]&&label[j]===kind){visited[j]=1;stack[top++]=j;}
      }
    }
    if(cells.length>=minArea)out.push({cells,area:cells.length,kind,minX,minY,maxX,maxY});
  }
  return out.sort((a,b)=>b.area-a.area);
}
function smoothDensity(ink,w,h){
  const out=new Float32Array(ink.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let acc=0,sum=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
      const k=(3-Math.abs(dx))*(3-Math.abs(dy));
      acc+=ink[yy*w+xx]*k;sum+=k;
    }
    out[y*w+x]=acc/sum;
  }
  return out;
}
function paletteOf(pixels,mask,limit=9){
  const bins=new Map(),data=pixels.data;
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;
    const k=i*4,red=data[k],green=data[k+1],blue=data[k+2];
    const key=(red>>5)*64+(green>>5)*8+(blue>>5);
    const v=bins.get(key)||{n:0,r:0,g:0,b:0};
    v.n++;v.r+=red;v.g+=green;v.b+=blue;bins.set(key,v);
  }
  const pal=[];
  for(const v of [...bins.values()].sort((a,b)=>b.n-a.n)){
    const p=[v.r/v.n,v.g/v.n,v.b/v.n];
    if(pal.every(c=>Math.hypot(c[0]-p[0],c[1]-p[1],c[2]-p[2])>28)){
      pal.push(p);if(pal.length>=limit)break;
    }
  }
  return pal.length?pal:[[80,80,80]];
}
function nearestPalette(pixels,mask,pal){
  const labels=new Int16Array(mask.length).fill(-1),rgb=pixels.data;
  for(let i=0;i<labels.length;i++){
    if(!mask[i])continue;
    const k=i*4;let best=Infinity,which=0;
    for(let c=0;c<pal.length;c++){
      const p=pal[c];
      const d=(rgb[k]-p[0])**2+(rgb[k+1]-p[1])**2+(rgb[k+2]-p[2])**2;
      if(d<best){best=d;which=c;}
    }
    labels[i]=which;
  }
  return labels;
}
class Heap{
  constructor(){this.data=[];}
  push(cost,i,label){
    const a=this.data;let n=a.length;a.push({cost,i,label});
    while(n>0){const p=(n-1)>>1;if(a[p].cost<=cost)break;a[n]=a[p];n=p;}
    a[n]={cost,i,label};
  }
  pop(){
    const a=this.data,root=a[0],last=a.pop();
    if(!a.length)return root;
    let i=0;
    while(i*2+1<a.length){
      let j=i*2+1;if(j+1<a.length&&a[j+1].cost<a[j].cost)j++;
      if(a[j].cost>=last.cost)break;a[i]=a[j];i=j;
    }
    a[i]=last;return root;
  }
  get length(){return this.data.length;}
}
function watershed(base,w,h,labels,ink,smoothed,distance,pixels,maxSeeds){
  if(base.area<125)return [base];
  const inRegion=new Uint8Array(w*h);
  for(const i of base.cells)inRegion[i]=1;
  let avg=0,min=1,max=0;
  for(const i of base.cells){const v=smoothed[i];avg+=v;min=Math.min(min,v);max=Math.max(max,v);}
  avg/=base.area;
  const peakSeeds=[],colSeeds=[],local=new Int16Array(w*h).fill(-1);
  for(const i of base.cells)local[i]=labels[i];
  const paletteParts=components(local,w,h,Math.max(12,Math.floor(base.area*.018)))
    .filter(p=>p.area>=Math.max(15,base.area*.023));
  // Unlike V4.1, coloured watercolour and tissue washes are eligible too.
  for(const p of paletteParts.slice(0,8)){
    const sum=[0,0];let top=-1,priority=-1;
    for(const i of p.cells){
      const x=i%w,y=(i/w)|0;
      sum[0]+=x;sum[1]+=y;
      const v=smoothed[i]+distance[i]*.035;
      if(v>priority){priority=v;top=i;}
    }
    if(top>=0)colSeeds.push({i:top,weight:p.area});
  }
  const score=i=>smoothed[i]*.7+Math.min(12,distance[i])*.033;
  const contrast=max-min;
  for(const i of base.cells){
    const x=i%w,y=(i/w)|0,d=distance[i];
    if(d<1.35||smoothed[i]<Math.max(.09,avg*.56))continue;
    const v=score(i);
    let localMax=true;
    for(const [dx,dy] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,2],[-2,2],[2,-2]]){
      const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
      const j=yy*w+xx;
      if(inRegion[j]&&score(j)>v+.012){localMax=false;break;}
    }
    if(localMax)peakSeeds.push({i,weight:v*50+d});
  }
  peakSeeds.sort((a,b)=>b.weight-a.weight||a.i-b.i);
  colSeeds.sort((a,b)=>b.weight-a.weight||a.i-b.i);
  const chosen=[];
  const target=Math.min(maxSeeds,Math.max(2,Math.round(Math.sqrt(base.area)/11)));
  const minGap=Math.max(6,Math.min(17,Math.sqrt(base.area)/PHI/5));
  const add=(c,gap)=>{
    if(chosen.length>=target)return;
    const x=c.i%w,y=(c.i/w)|0;
    if(chosen.every(s=>Math.hypot(x-s.i%w,y-((s.i/w)|0))>=gap))chosen.push(c);
  };
  // Avoid inventing segmentation of uniform circles just because
  // a pigment mask softens towards paper at the contour.
  let perimeter=0,variation=0,interiorN=0,interiorMean=0;
  for(const i of base.cells){
    const x=i%w,y=(i/w)|0;
    for(const [dx,dy] of neighbours4){
      const xx=x+dx,yy=y+dy;
      if(xx<0||xx>=w||yy<0||yy>=h||!inRegion[yy*w+xx])perimeter++;
    }
    if(distance[i]>3){interiorN++;interiorMean+=smoothed[i];}
  }
  interiorMean/=Math.max(1,interiorN);
  for(const i of base.cells)if(distance[i]>3)
    variation+=(smoothed[i]-interiorMean)**2;
  const deviation=Math.sqrt(variation/Math.max(1,interiorN));
  const compactness=4*Math.PI*base.area/Math.max(1,perimeter**2);
  const signal=paletteParts.length>=2 || (deviation>.135 && compactness<.75) ||
    (compactness<.48 && contrast>.075);
  for(const c of colSeeds)if(signal)add(c,minGap);
  for(const c of peakSeeds)if(signal)add(c,minGap);
  if(chosen.length<2)return [base];
  const dist=new Float32Array(w*h);dist.fill(Infinity);
  const owner=new Int16Array(w*h).fill(-1),heap=new Heap(),rgb=pixels.data;
  chosen.forEach((s,n)=>{dist[s.i]=0;owner[s.i]=n;heap.push(0,s.i,n);});
  while(heap.length){
    const cur=heap.pop();
    if(cur.cost>dist[cur.i]+.0001||owner[cur.i]!==cur.label)continue;
    const x=cur.i%w,y=(cur.i/w)|0;
    for(const [dx,dy] of neighbours4){
      const xx=x+dx,yy=y+dy;
      if(xx<0||xx>=w||yy<0||yy>=h)continue;
      const j=yy*w+xx;
      if(!inRegion[j])continue;
      const u=cur.i*4,v=j*4;
      const colourJump=(Math.abs(rgb[u]-rgb[v])+Math.abs(rgb[u+1]-rgb[v+1])+
        Math.abs(rgb[u+2]-rgb[v+2]))/384;
      const gradient=Math.abs(smoothed[cur.i]-smoothed[j]);
      const cost=cur.cost+1+.6*colourJump+3*gradient;
      if(cost+.00001<dist[j]){
        dist[j]=cost;owner[j]=cur.label;heap.push(cost,j,cur.label);
      }
    }
  }
  const groups=chosen.map(()=>[]);
  for(const i of base.cells)groups[Math.max(0,owner[i])].push(i);
  const valid=groups.filter(c=>c.length>=Math.max(9,Math.floor(base.area*.009)));
  if(valid.length<2)return [base];
  // Reassign any small basin instead of silently dropping coloured pixels.
  const output=valid.map(c=>[...c]),assigned=new Int16Array(w*h).fill(-1);
  output.forEach((cells,n)=>{for(const i of cells)assigned[i]=n;});
  const q=new Int32Array(base.area),queueLabel=new Int16Array(base.area);
  let start=0,end=0;
  for(let n=0;n<output.length;n++)for(const i of output[n]){
    q[end]=i;queueLabel[end]=n;end++;
  }
  while(start<end){
    const i=q[start],n=queueLabel[start];start++;
    const x=i%w,y=(i/w)|0;
    for(const [dx,dy] of neighbours4){
      const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
      const j=yy*w+xx;if(!inRegion[j]||assigned[j]>=0)continue;
      assigned[j]=n;output[n].push(j);q[end]=j;queueLabel[end]=n;end++;
    }
  }
  return output.map(cells=>{
    let minX=w,maxX=0,minY=h,maxY=0;
    for(const i of cells){const x=i%w,y=(i/w)|0;minX=Math.min(x,minX);
      maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);}
    return{cells,area:cells.length,minX,maxX,minY,maxY};
  });
}
export function segmentPainting(pixels,{
 material='marker',paper='#f5f0e6',maxRegions=72
}={}){
  const field=pigmentField(pixels,{material,paper});
  const w=field.width,h=field.height,mask=field.occupancy;
  const solid=new Int16Array(w*h);
  for(let i=0;i<mask.length;i++)solid[i]=mask[i]?0:-1;
  const minBase=Math.max(2,Math.floor(field.cells/(Math.max(1,maxRegions)*PHI*16)));
  const base=components(solid,w,h,minBase);
  const palette=paletteOf(pixels,mask,9);
  const labels=nearestPalette(pixels,mask,palette);
  const smoothed=smoothDensity(field.ink,w,h);
  const pieces=[];
  for(const r of base){
    const split=watershed(r,w,h,labels,field.ink,smoothed,field.distance,pixels,
      Math.min(12,Math.max(3,Math.ceil(Math.sqrt(r.area)/8))));
    for(const p of split)pieces.push(p);
  }
  pieces.sort((a,b)=>b.area-a.area||a.minY-b.minY||a.minX-b.minX);
  const chosen=pieces.slice(0,maxRegions);
  const regions=chosen.map((r,i)=>prepareRegion(r,w,h,i,field.ink,pixels));
  const covered=regions.reduce((s,r)=>s+r.area,0);
  return{
    width:w,height:h,regions,pigmented:field.cells,covered,
    omittedCells:Math.max(0,field.cells-covered),omittedRegions:Math.max(0,pieces.length-maxRegions),
    pigmentInk:field.ink,sourceMask:mask,palette:palette.length,
    separateShapes:base.length,watershipRegions:pieces.length,
    material
  };
}
function prepareRegion(region,w,h,id,ink,pixels){
  const minX=Math.max(0,region.minX-1),minY=Math.max(0,region.minY-1);
  const rw=Math.min(w,region.maxX+2)-minX,rh=Math.min(h,region.maxY+2)-minY;
  const mask=new Uint8Array(rw*rh),ids=[],localInk=new Float32Array(rw*rh);
  let red=0,green=0,blue=0,opacity=0;
  for(const i of region.cells){
    const x=i%w-minX,y=((i/w)|0)-minY,j=y*rw+x,k=i*4;
    mask[j]=1;ids.push(j);localInk[j]=ink[i];opacity+=ink[i];
    red+=pixels.data[k];green+=pixels.data[k+1];blue+=pixels.data[k+2];
  }
  const area=region.area,color='#'+[red,green,blue].map(v=>
    Math.round(v/area).toString(16).padStart(2,'0')).join('');
  const tone=(.2126*red+.7152*green+.0722*blue)/(255*area);
  const distance=new Float32Array(mask.length);
  for(const j of ids)distance[j]=10000;
  const at=(x,y)=>x<0||y<0||x>=rw||y>=rh?0:distance[y*rw+x];
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){
    const i=y*rw+x;if(!mask[i])continue;
    distance[i]=Math.min(distance[i],1+at(x-1,y),1+at(x,y-1),
      SQRT2+at(x-1,y-1),SQRT2+at(x+1,y-1));
  }
  for(let y=rh-1;y>=0;y--)for(let x=rw-1;x>=0;x--){
    const i=y*rw+x;if(!mask[i])continue;
    distance[i]=Math.min(distance[i],1+at(x+1,y),1+at(x,y+1),
      SQRT2+at(x+1,y+1),SQRT2+at(x-1,y+1));
  }
  const potential=new Float32Array(mask.length),interior=[];
  for(const i of ids){
    const x=i%rw,y=(i/rw)|0;
    if(x>0&&x<rw-1&&y>0&&y<rh-1&&mask[i-1]&&mask[i+1]&&
      mask[i-rw]&&mask[i+rw])interior.push(i);
  }
  // Ordinary sequential Gauss-Seidel SOR (not red/black).
  // Solve at native pixel resolution; V4.2 refines only the output mesh.
  const omega=1.68;
  for(let pass=0;pass<380;pass++){
    let error=0;
    for(const i of interior){
      const value=(potential[i-1]+potential[i+1]+potential[i-rw]+potential[i+rw]+1)*.25;
      const delta=omega*(value-potential[i]);potential[i]+=delta;
      error=Math.max(error,Math.abs(delta));
    }
    if(pass>24&&error<.0007)break;
  }
  const radius=new Float32Array(mask.length);
  const queue=new Int32Array(mask.length);let head=0,tail=0;
  for(const i of ids){
    const x=i%rw,y=(i/rw)|0,d=distance[i];
    const left=x?distance[i-1]:0,right=x+1<rw?distance[i+1]:0;
    const up=y?distance[i-rw]:0,down=y+1<rh?distance[i+rw]:0;
    if((d>=left&&d>=right)||(d>=up&&d>=down)){
      radius[i]=d;queue[tail++]=i;
    }
  }
  if(!tail&&ids.length){const i=ids[0];radius[i]=distance[i];queue[tail++]=i;}
  while(head<tail){
    const i=queue[head++],x=i%rw,y=(i/rw)|0;
    for(const [dx,dy] of neighbours4){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=rw||yy>=rh)continue;
      const j=yy*rw+xx;
      if(mask[j]&&!radius[j]){radius[j]=radius[i];queue[tail++]=j;}
    }
  }
  let maxPotential=0,maxDistance=0;
  for(const i of ids){maxPotential=Math.max(maxPotential,potential[i]);
    maxDistance=Math.max(maxDistance,distance[i]);}
  return{
    id,width:w,height:h,minX,minY,rw,rh,mask,ids,potential,distance,radius,
    localInk,area,color,tone,meanInk:opacity/area,
    maxPotential,maxDistance,
    centerX:((region.minX+region.maxX+1)*.5/w-.5)*W,
    centerY:(.5-(region.minY+region.maxY+1)*.5/h)*H,
    aspect:Math.max((region.maxX-region.minX+1)*W/w,(region.maxY-region.minY+1)*H/h)/
      Math.max(.001,Math.min((region.maxX-region.minX+1)*W/w,(region.maxY-region.minY+1)*H/h))
  };
}
export function regionElevation(r,x,y,mode='poisson'){
  const xx=x-r.minX,yy=y-r.minY;
  if(xx<0||yy<0||xx>=r.rw||yy>=r.rh||!r.mask[yy*r.rw+xx])return 0;
  const j=yy*r.rw+xx,scale=(W/r.width+H/r.height)*.5;
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