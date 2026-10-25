// Paint a single contour around the writer's actual inflated letter mask.
// Geometry stays in the tag engine; this module only deposits colour.
const caches=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function hashSeed(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function noise(x,y,seed){let n=Math.imul(x+374761393,668265263)^Math.imul(y+1274126177,2246822519)^seed;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function field(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const a=noise(ix,iy,seed)*(1-fx)+noise(ix+1,iy,seed)*fx;
 const b=noise(ix,iy+1,seed)*(1-fx)+noise(ix+1,iy+1,seed)*fx;
 return a*(1-fy)+b*fy;
}
// Distance to the mask boundary in pixels, from both sides. A chamfer field
// avoids stroking an outer edge and a second inset highlight over it.
export function boundaryDistance(mask,width,height){
 if(width<1||height<1||mask.length!==width*height)throw new RangeError('Invalid letter mask.');
 const d=new Float32Array(mask.length);d.fill(width+height);
 const inside=i=>mask[i]>=128;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,v=inside(i);
  if((x>0&&v!==inside(i-1))||(x+1<width&&v!==inside(i+1))||(y>0&&v!==inside(i-width))||(y+1<height&&v!==inside(i+width)))d[i]=.5;
 }
 const diag=Math.SQRT2;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;let n=d[i];
  if(x)n=Math.min(n,d[i-1]+1);
  if(y){n=Math.min(n,d[i-width]+1);if(x)n=Math.min(n,d[i-width-1]+diag);if(x+1<width)n=Math.min(n,d[i-width+1]+diag);}
  d[i]=n;
 }
 for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
  const i=y*width+x;let n=d[i];
  if(x+1<width)n=Math.min(n,d[i+1]+1);
  if(y+1<height){n=Math.min(n,d[i+width]+1);if(x)n=Math.min(n,d[i+width-1]+diag);if(x+1<width)n=Math.min(n,d[i+width+1]+diag);}
  d[i]=n;
 }
 // Reapply signs after both sweeps; do not let signs enter relaxation.
 for(let i=0;i<d.length;i++)d[i]=(inside(i)?-1:1)*Math.abs(d[i]);
 return d;
}
const rgb=hex=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw new TypeError('Paint needs a six-digit hex colour.');return[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));};
export function rasterThrowup({mask,width,height,scale=2,outline=6.5,seed='',ink='#242a28',fill='#d8d4c6',hollow=false,finish='spray'}){
 const distance=boundaryDistance(mask,width,height),out=new Uint8ClampedArray(mask.length*4),dark=rgb(ink),light=rgb(fill),salt=hashSeed(seed),spray=finish==='spray';
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,wx=x/scale,wy=y/scale,coarse=field(wx/7,wy/7,salt),grain=noise(x,y,salt^0x9e3779b9);
  const wobble=spray?(coarse-.5)*1.3:0,sd=distance[i]/scale+wobble;
  const radius=outline*.5*(spray?.82+coarse*.36:1),feather=spray?.65:.12,edge=Math.abs(sd);
  const contour=1-smooth(radius-feather,radius+feather,edge);
  const interior=hollow?0:1-smooth(-radius-.4,-radius+.4,sd);
  let alpha=Math.max(contour,interior)*(spray?.88+.12*coarse:.98)*(.94+.06*grain);
  if(spray){
   const gap=edge-radius;
   if(gap>0&&gap<2.6&&(hollow||sd>0)){
    const haze=.065*Math.exp(-gap*gap/1.1),speck=grain>.975+gap*.007?(.10+.12*coarse)*(1-gap/2.6):0;
    alpha=Math.max(alpha,haze,speck);
   }
   if(grain<.007)alpha*=.3;
  }
  const tint=interior*(1-contour),deposit=(coarse-.5)*(spray?5:1);
  for(let k=0;k<3;k++)out[i*4+k]=dark[k]*(1-tint)+light[k]*tint+deposit;
  out[i*4+3]=Math.round(clamp(alpha,0,1)*255);
 }
 return out;
}
function strokePath(g,stroke,fraction=1){
 if(fraction<=0)return;
 const ps=stroke.points,end=(ps.length-1)*fraction,last=Math.floor(end);
 g.beginPath();g.moveTo(ps[0].x,ps[0].y);
 for(let i=1;i<=last;i++)g.lineTo(ps[i].x,ps[i].y);
 if(last<ps.length-1){const t=end-last;g.lineTo(ps[last].x+(ps[last+1].x-ps[last].x)*t,ps[last].y+(ps[last+1].y-ps[last].y)*t);}
 g.stroke();
}
function prepareLetter(tag,style,strokes,finish,colours){
 const points=strokes.flatMap(s=>s.points),outline=style.outline*tag.paintWidth/2;
 const counterLimit=strokes.find(s=>s.nozzleLimit>0)?.nozzleLimit;
 const bar=Math.min(style.bar*tag.paintWidth/2,counterLimit?counterLimit*1.3:Infinity);
 const pad=bar/2+outline+6,scale=2;
 const x=Math.min(...points.map(p=>p.x))-pad,y=Math.min(...points.map(p=>p.y))-pad;
 const width=Math.ceil((Math.max(...points.map(p=>p.x))-x+pad)*scale),height=Math.ceil((Math.max(...points.map(p=>p.y))-y+pad)*scale);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const g=canvas.getContext('2d',{willReadFrequently:true});
 g.setTransform(scale,0,0,scale,-x*scale,-y*scale);g.strokeStyle='#fff';g.lineCap=g.lineJoin='round';g.lineWidth=bar;
 for(const stroke of strokes)strokePath(g,stroke);
 const image=g.getImageData(0,0,width,height),mask=new Uint8Array(width*height);
 for(let i=0;i<mask.length;i++)mask[i]=image.data[i*4+3];
 image.data.set(rasterThrowup({mask,width,height,scale,outline,seed:tag.seed+'|throwup|'+strokes[0].letterIndex,ink:style.hollow?tag.ink:colours.outline,fill:colours.fill,hollow:!!style.hollow,finish}));
 g.setTransform(1,0,0,1,0,0);g.putImageData(image,0,0);
 return {canvas,x,y,width:width/scale,height:height/scale,bar,outline,scale};
}
export function drawThrowup(ctx,tag,style,{progress,fractionAt,finish,colours}){
 let cache=caches.get(tag);
 if(!cache){cache=new Map();caches.set(tag,cache);}
 let letters=cache.get(finish);
 if(!letters){
  const groups=new Map();
  tag.strokes.forEach((stroke,index)=>{const key=stroke.letterIndex;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({stroke,index});});
  letters=[...groups.values()].map(entries=>({entries,paint:prepareLetter(tag,style,entries.map(e=>e.stroke),finish,colours),reveal:null}));
  cache.set(finish,letters);
 }
 ctx.save();ctx.globalAlpha=tag.opacity;
 for(const letter of letters){
  const fractions=letter.entries.map(e=>fractionAt(tag,e.index,progress));
  if(fractions.every(f=>f<=0))continue;
  const p=letter.paint;
  if(fractions.every(f=>f>=1)){ctx.drawImage(p.canvas,p.x,p.y,p.width,p.height);continue;}
  if(!letter.reveal){letter.reveal=document.createElement('canvas');letter.reveal.width=p.canvas.width;letter.reveal.height=p.canvas.height;letter.mask=document.createElement('canvas');letter.mask.width=p.canvas.width;letter.mask.height=p.canvas.height;}
  const c=letter.reveal,g=c.getContext('2d');
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.drawImage(p.canvas,0,0);
  g.globalCompositeOperation='destination-in';
  // One union mask keeps intersecting movements from erasing one another.
  const mask=letter.mask,m=mask.getContext('2d');m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,mask.width,mask.height);
  m.setTransform(p.scale,0,0,p.scale,-p.x*p.scale,-p.y*p.scale);m.lineCap=m.lineJoin='round';m.lineWidth=p.bar+p.outline*2+7;
  letter.entries.forEach((e,i)=>strokePath(m,e.stroke,fractions[i]));g.drawImage(mask,0,0);g.globalCompositeOperation='source-over';
  ctx.drawImage(c,p.x,p.y,p.width,p.height);
 }
 ctx.restore();
}
