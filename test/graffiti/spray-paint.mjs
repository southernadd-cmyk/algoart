// Seeded aerosol deposits along the writing path. The cone has a dense centre,
// a granular soft edge and isolated droplets; no blur filter or image download.
import {tagDuration} from './writing-motion.mjs?v=word-flow-v4';
const CONE=1.55,HALO=1.8;
function random(seed){
 let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}
 return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
const plans=new WeakMap(),stampBanks=new Map();
export function buildSprayPlan(tag){
 if(plans.has(tag))return plans.get(tag);
 const dabs=[];let used=0;
 for(let k=0;k<tag.strokes.length;k++){
  const stroke=tag.strokes[k],points=stroke.points,movement=tag.motion?.strokes[k],r=random(tag.seed+'|aerosol|'+k);
  const baseRadius=tag.weight*stroke.weight*.64*stroke.pressure;
  const add=(x,y,t,at,corner,travel,speed=.8)=>{
   const flow=.9+.1*Math.sin(t*8+stroke.phase),taper=.8+.2*Math.min(1,t*12,(1-t)*12);
   const radius=baseRadius*flow*taper*(1+((tag.sprayFlare||1)-1)*Math.sin(Math.PI*t)**4);
   const droplets=[];
   if(r()<.23){const angle=r()*Math.PI*2,distance=radius*(.95+r()*.6);droplets.push({x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,radius:radius*(.055+r()*.12),opacity:.28+r()*.4});}
   dabs.push({x:x+(r()-.5)*radius*.035,y:y+(r()-.5)*radius*.035,radius,droplets,speed,
    // The hand slows at a turn, laying down a little more paint there.
    opacity:Math.min(.86,(movement ? .48+.42*(1-speed) : .56+corner*.22)*(.92+r()*.16)*Math.max(.35,travel/(baseRadius*.34))),variant:Math.floor(r()*4),at});
  };
  add(points[0].x,points[0].y,0,movement?.start??used,0,baseRadius*.34,movement?.speeds[0]??.8);
  for(let i=1;i<points.length;i++){
   const p=points[i-1],q=points[i],dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy);
   if(length<1e-8)continue;
   const next=points[Math.min(i+1,points.length-1)],nx=next.x-q.x,ny=next.y-q.y,nl=Math.hypot(nx,ny);
   const corner=nl?Math.min(1,(1-(dx*nx+dy*ny)/(length*nl))*.5):.2;
   const steps=Math.max(1,Math.ceil(length/Math.max(.55,baseRadius*.34)));
   for(let j=1;j<=steps;j++){
    const f=j/steps,t=movement?.length?(movement.distances[i-1]+length*f)/movement.length:(i-1+f)/(points.length-1);
    const at=movement?movement.start+movement.times[i-1]+f*(movement.times[i]-movement.times[i-1]):used+i-1+f;
    const speed=movement?movement.speeds[i-1]+f*(movement.speeds[i]-movement.speeds[i-1]):.8;
    add(p.x+dx*f,p.y+dy*f,t,at,corner,length/steps,speed);
   }
  }
  used+=points.length;
 }
 const result={dabs,total:tagDuration(tag),halo:HALO};plans.set(tag,result);return result;
}
function stampBank(colour){
 if(stampBanks.has(colour))return stampBanks.get(colour);
 if(!/^#[0-9a-f]{6}$/i.test(colour))throw new TypeError('Spray paint needs a six-digit hex colour.');
 const rgb=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)),bank=[];
 for(let variant=0;variant<4;variant++){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const g=canvas.getContext('2d'),image=g.createImageData(96,96),d=image.data,r=random('PP-AEROSOL-CONE-1|'+variant);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
   const px=(x+.5-48)/48*CONE,py=(y+.5-48)/48*CONE,rad=Math.hypot(px,py);
   const noise=r(),edge=Math.max(0,Math.min(1,(rad-.29)/.71));
   const falloff=(1-edge)**2*(1+2*edge);
   // Repeated deposits build a mottled film. Individual tiny gaps and
   // detached droplets remain at the outer edge of the cone.
   const grain=noise<.055?.16:.68+noise*.36;
   let alpha=rad<1?.84*falloff*grain:0;
   if(rad>.74&&rad<CONE&&r()<.105*(CONE-rad))alpha=Math.max(alpha,.1+r()*.25);
   const i=(y*96+x)*4;d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];d[i+3]=Math.round(alpha*255);
  }
  g.putImageData(image,0,0);bank.push(canvas);
 }
 if(stampBanks.size>=12)stampBanks.delete(stampBanks.keys().next().value);
 stampBanks.set(colour,bank);return bank;
}
export function drawSpray(ctx,tag,{progress=1}={}){
 const plan=buildSprayPlan(tag),portion=Math.max(0,Math.min(1,progress));if(portion<=0)return plan.total;
 const bank=stampBank(tag.ink),limit=plan.total*portion;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle=tag.ink;
 for(const dab of plan.dabs){
  if(dab.at>limit)break;
  const radius=dab.radius*CONE;ctx.globalAlpha=dab.opacity*tag.opacity;
  ctx.drawImage(bank[dab.variant],dab.x-radius,dab.y-radius,radius*2,radius*2);
  for(const drop of dab.droplets){ctx.globalAlpha=drop.opacity*tag.opacity;ctx.beginPath();ctx.arc(dab.x+drop.x,dab.y+drop.y,drop.radius,0,Math.PI*2);ctx.fill();}
 }
 ctx.restore();return plan.total;
}
