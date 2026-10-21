// Real paint-region tracing from the final archived material image.
// Pixel segmentation is used only where the SVG doesn't encode the
// material-specific washes, deposits, pools or splatters.
// The resulting polygons follow ACTUAL visible pigment pixels.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function paperRgb(hex){
  const h=String(hex||'#f5f0e6').match(/^#([0-9a-f]{6})$/i)?.[1];
  return h?[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]:[245,240,230];
}
export function pigmentGrid(imageData,material='marker',paper='#f5f0e6'){
  const {width:w,height:h,data}=imageData;
  const rgb=paperRgb(paper);
  const thresholds={marker:33,tissue:17,watercolour:19,oil:22,action:22};
  const threshold=thresholds[material]||24;
  const mask=new Uint8Array(w*h);
  const groups=Array.from({length:6},()=>new Uint8Array(w*h));
  let inkCount=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,o=i*4,a=data[o+3];
    if(a<48)continue;
    const r=data[o],g=data[o+1],b=data[o+2];
    const diff=Math.max(Math.abs(r-rgb[0]),Math.abs(g-rgb[1]),Math.abs(b-rgb[2]));
    if(diff<threshold)continue;
    // Marked-pixel threshold tolerates subtle wash values without allowing
    // white JPEG grain to create thousands of floating 3D flecks.
    mask[i]=1;inkCount++;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),range=mx-mn;
    const lum=(r+g+b)/3;
    let category;
    if(range<23){category=lum<110?0:1;}
    else if(r>=g&&r>=b){category=2;}
    else if(g>=r&&g>=b){category=3;}
    else if(b>=r&&b>=g){category=4;}
    else category=5;
    groups[category][i]=1;
  }
  return {mask,groups,width:w,height:h,coverage:inkCount/(w*h)};
}
function filled(mask,w,h,x,y) {
  return x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x]===1;
}
function simplify(points,tolerance){
  if(points.length<=4)return points;
  const minDist=tolerance*tolerance;
  const out=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const last=out[out.length-1],p=points[i];
    if((p.x-last.x)**2+(p.y-last.y)**2>=minDist)out.push(p);
  }
  out.push(points[points.length-1]);
  // Remove corners nearly collinear with their neighbors.
  for(let i=out.length-2;i>0;i--){
    const a=out[i-1],b=out[i],c=out[i+1];
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(Math.abs(cross)<tolerance*.43)out.splice(i,1);
  }
  return out;
}
export function tracePigmentRegions(grid,material='watercolour',quality='desktop'){
  const {mask,groups,width:w,height:h}=grid;
  const limit=({desktop:34,mobile:17,vr:22}[quality]||34);
  // Primary silhouette plus separate pigment-colour regions. Do not invent
  // rectangles or generated shards when the original image has no such shape.
  const inputs=grid.coverage>.76?[...groups]:[mask,...groups];
  const regions=[];
  for(let batch=0;batch<inputs.length;batch++){
    const bitmap=inputs[batch];
    const seen=new Uint8Array(w*h);
    for(let i=0;i<bitmap.length;i++){
      if(bitmap[i]!==1||seen[i])continue;
      const queue=[i],pixels=[],seenBase=i,xx=i%w,yy=Math.floor(i/w);
      seen[i]=1;
      for(let k=0;k<queue.length;k++){
        const v=queue[k],x=v%w,y=(v-x)/w;
        pixels.push(v);
        for(const n of [x>0?v-1:-1,x<w-1?v+1:-1,y>0?v-w:-1,y<h-1?v+w:-1]){
          if(n>=0&&bitmap[n]===1&&!seen[n]){seen[n]=1;queue.push(n);}
        }
      }
      if(pixels.length<Math.max(7,Math.round(w*h*.00022)))continue;
      if(pixels.length>w*h*.78)continue;
      // Extract actual boundary edges of this connected pigment component.
      const pixelSet=new Set(pixels);
      const outgoing=new Map();
      const edge=(ax,ay,bx,by)=>{
        const key=ax+','+ay,arr=outgoing.get(key)||[];
        arr.push({x:bx,y:by});outgoing.set(key,arr);
      };
      for(const v of pixels){
        const x=v%w,y=(v-x)/w;
        if(!pixelSet.has(v-w))edge(x,y,x+1,y);
        if(!pixelSet.has(v+1)||x===w-1)edge(x+1,y,x+1,y+1);
        if(!pixelSet.has(v+w))edge(x+1,y+1,x,y+1);
        if(!pixelSet.has(v-1)||x===0)edge(x,y+1,x,y);
      }
      let best=[];
      for(const [start,arr] of outgoing){
        while(arr.length){
          const [sx,sy]=start.split(',').map(Number),points=[{x:sx,y:sy}];
          let current={x:sx,y:sy},steps=0;
          while(steps++<w*h*4){
            const key=current.x+','+current.y,nextList=outgoing.get(key);
            if(!nextList?.length)break;
            const next=nextList.pop();
            points.push(next);current=next;
            if(next.x===sx&&next.y===sy)break;
          }
          if(points.length>best.length)best=points;
        }
      }
      if(best.length<5)continue;
      const simplified=simplify(best,material==='action'?1.15:1.7);
      // Bound polygon complexity to preserve mobile and VR performance.
      let points=simplified;
      if(points.length>145){
        const step=Math.ceil(points.length/145);
        points=points.filter((_,n)=>n%step===0);
      }
      if(points.length<4)continue;
      regions.push({points,area:pixels.length,batch,coverage:pixels.length/(w*h),
        centroid:{x:xx/w,y:yy/h}});
    }
  }
  const ranks=regions.sort((a,b)=>b.area-a.area||a.batch-b.batch).slice(0,limit);
  return ranks.map(region=>({
    ...region,
    points:region.points.map(p=>({x:p.x/w,y:p.y/h}))
  }));
}
