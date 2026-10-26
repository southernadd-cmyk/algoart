// Experimental, deterministic V3 wall-paint deposition. No production imports.
export const V3_MATERIAL_REVISION='material-study-01';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function hash(seed,x,y,channel=0){
 let n=2166136261;
 for(const ch of String(seed)+'|'+Math.floor(x)+'|'+Math.floor(y)+'|'+channel)n=Math.imul(n^ch.charCodeAt(0),16777619);
 n=Math.imul(n^(n>>>16),2246822507);n=Math.imul(n^(n>>>13),3266489909);
 return ((n^(n>>>16))>>>0)/4294967296;
}
export function wallSample(surface,x,y,seed='wall'){
 const grain=hash(seed,Math.floor(x*.65),Math.floor(y*.65),1);
 const fine=hash(seed,Math.floor(x*2.3),Math.floor(y*2.3),2);
 if(surface==='brick'){
  const brickH=42,brickW=115,course=Math.floor(y/brickH);
  const bx=((x+(course%2)*brickW/2)%brickW+brickW)%brickW;
  const by=((y%brickH)+brickH)%brickH;
  const edge=Math.min(bx,brickW-bx,by,brickH-by);
  const mortar=clamp((5-edge)/3,0,1);
  return {height:(1-mortar)*(.45+.25*grain),absorption:clamp(.65+.21*grain+.12*mortar,0,1),roughness:clamp(.35+.4*fine+.2*mortar,0,1),mortar};
 }
 const rough=surface==='rough-plaster'?.38:.12;
 return {height:.35+grain*rough,absorption:.32+grain*.2,roughness:rough*(.45+fine*.55),mortar:0};
}
export function strokeProfile(t,seed,strokeIndex=0){
 const motion=Math.sin(Math.PI*clamp(t,0,1));
 const drift=Math.sin(t*13+hash(seed,strokeIndex,0)*6.28)*.08;
 const speed=clamp(.18+.66*Math.abs(Math.sin(t*8.3+strokeIndex*.7)),0,1);
 return {pressure:clamp(.22+.65*Math.pow(motion,.45)+drift,.05,1),speed,angle:-.6+Math.sin(t*4+strokeIndex)*.25};
}
function deposit(buf,w,h,x,y,r,alpha,seed,mode,surface){
 const left=Math.max(0,Math.floor(x-r*2.3)),right=Math.min(w-1,Math.ceil(x+r*2.3));
 const top=Math.max(0,Math.floor(y-r*2.3)),bottom=Math.min(h-1,Math.ceil(y+r*2.3));
 for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){
  const dx=px+.5-x,dy=py+.5-y,d=Math.hypot(dx,dy);
  const wall=wallSample(surface,px,py,seed+'|surface'),noise=hash(seed,px,py,3);
  let coverage=0;
  if(mode==='marker'){
   const edge=r*(.86+.2*noise);
   if(d>edge)continue;
   // Dry cavities follow wall relief and pen direction, rather than uniform alpha noise.
   const dry=wall.roughness*(.12+.6*(1-alpha))*(noise>.64?1:.3);
   coverage=alpha*(1-dry)*clamp((edge-d)*1.3,0,1);
  }else{
   const core=Math.exp(-2.1*(d/r)**2);
   const fleck=d>r*.72&&noise>.91?Math.exp(-.8*(d/r)**2)*.3:0;
   coverage=(core+fleck)*alpha*(1-.26*wall.roughness)*(1-.38*wall.mortar);
  }
  const k=py*w+px;
  buf[k]=1-(1-buf[k])*(1-clamp(coverage,0,.94));
 }
}
export function paintStrokes(ctx,paths,{mode='marker',surface='painted-plaster',seed='v3',ink='#242628',width=9,scale=1}={}){
 if(!['marker','spray'].includes(mode))throw Error('Unknown tool');
 const w=ctx.canvas.width,h=ctx.canvas.height,coverage=new Float32Array(w*h);
 const measure=document.createElementNS('http://www.w3.org/2000/svg','path');
 paths.forEach((stroke,index)=>{
  if(!stroke.d||stroke.kind==='fill')return;
  measure.setAttribute('d',stroke.d);
  const length=measure.getTotalLength();
  if(!Number.isFinite(length)||length<.1)return;
  const count=Math.min(900,Math.ceil(length*scale/1.6));
  for(let n=0;n<=count;n++){
   const t=n/count,p=measure.getPointAtLength(length*t);
   const profile=strokeProfile(t,seed,index);
   const radius=(mode==='spray'?width*1.3:width*.48)*scale*
    (mode==='spray'?(1.1+.18*Math.sin(t*12+index)):(.65+.55*profile.pressure));
   const strength=mode==='spray'?.075+.13*(1-profile.speed):.22+.35*profile.pressure;
   deposit(coverage,w,h,p.x*scale,p.y*scale,radius,strength,seed,mode,surface);
  }
 });
 const out=ctx.createImageData(w,h);const hex=ink.replace('#','');
 const rgb=hex.length===6?[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)):[35,35,35];
 for(let i=0;i<coverage.length;i++){
  out.data[i*4]=rgb[0];out.data[i*4+1]=rgb[1];out.data[i*4+2]=rgb[2];
  out.data[i*4+3]=Math.round(clamp(coverage[i],0,1)*255);
 }
 ctx.putImageData(out,0,0);
 return {revision:V3_MATERIAL_REVISION,pixels:coverage.length,strokes:paths.length};
}
