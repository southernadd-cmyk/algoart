// Production bridge between the nine reference-informed A–Z letter grammars
// and the existing tower's synchronous Canvas2D atlas painter.
//
// Unlike the earlier procedural font, glyph geometry is supplied independently
// for each of the 26 letters and φ, by the approved Phase D family study.
// Versioned seeds and atlas signatures prevent stale PNGs from shadowing v1.
import {composeWord,getFamily} from '../../test/graffiti/v2/v2-library.mjs';
import {wordPlan,showGesture,limitJoins,exitContinuations} from '../../test/graffiti/v2/word-flow.mjs';
import {contextualJoinLayer} from '../../test/graffiti/family-joins.mjs';
import {composeBroadNib} from '../../test/graffiti/v3/broadnib-library.mjs';

export const TOWER_LETTERING_REVISION='az-nine-v3-broadnib-20261026';
const NS='http://www.w3.org/2000/svg';
const SVG_STROKE_CACHE=new Map(),PATH_CACHE=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function makeTowerFamilyTag(text,{hand='A',seed='PP-TOWER',ink='#2b2c29',finish='spray',paintWidth=2}={}){
 const family=getFamily(hand);
 const versionedSeed=seed+'|'+TOWER_LETTERING_REVISION;
 const planned=wordPlan(family,composeWord(hand,text,{seed:versionedSeed,variation:.04}));
 const v3=hand==='F'?composeBroadNib(planned,{seed:versionedSeed,mode:'restrained'}):null;
 const plan={...planned,letters:v3?v3.letters:planned.letters,shared:v3?v3.shared:[],accented:[...planned.accented]}; // JSON-safe atlas payload
 const bounds={x:-32,y:-35,width:plan.width+61,height:189};
 return {
  renderer:'az-nine-v1',version:TOWER_LETTERING_REVISION,
  hand,seed:versionedSeed,text:plan.word,form:'handstyle',ink,
  family:hand,finish,paintWidth,plan,bounds,
  // Keep the previous tag's public metadata without inventing a legacy outline.
  construction:{letters:plan.letters.map(l=>({char:l.ch,index:l.index}))}
 };
}
function pathFor(d){
 let p=PATH_CACHE.get(d);if(!p){p=new Path2D(d);PATH_CACHE.set(d,p);}return p;
}
function svgMeasure(d){
 let p=SVG_STROKE_CACHE.get(d);
 if(!p){
  p=document.createElementNS(NS,'path');p.setAttribute('d',d);
  SVG_STROKE_CACHE.set(d,p);
 }
 return p;
}
function smoothPressure(u,mode){
 if(mode==='airy')return .28+.72*Math.sin(Math.PI*(.12+.76*u));
 if(mode==='sweep')return .25+.75*Math.pow(Math.sin(Math.PI*(.08+.84*u)),.35);
 if(mode==='loop')return .55+.45*Math.pow(Math.sin(Math.PI*u),.25);
 return .68+.32*Math.pow(Math.sin(Math.PI*u),.27);
}
function fillStrip(ctx,d,width,technique){
 const p=svgMeasure(d),length=p.getTotalLength();
 if(!Number.isFinite(length)||length<.03)return;
 const count=clamp(Math.ceil(length/2.8),12,480);
 const left=[],right=[];
 const phiNib=technique==='nib',chisel=technique==='chisel',heavy=technique==='fatmarker';
 const nibAngle=(phiNib?-39:-10)*Math.PI/180;
 const ux=Math.cos(nibAngle),uy=Math.sin(nibAngle);
 for(let i=0;i<=count;i++){
  const u=i/count,t=length*u,pt=p.getPointAtLength(t);
  let nx,ny,pressure;
  if(phiNib||chisel){
   nx=ux;ny=uy;
   pressure=phiNib?.63+.37*Math.sin(Math.PI*(.025+.95*u)):
    (1-.80*u*u*(3-2*u))*(.82+.18*Math.min(1,u/.06));
  }else{
   const a=p.getPointAtLength(Math.max(0,t-1.6)),b=p.getPointAtLength(Math.min(length,t+1.6));
   const dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy)||1;
   nx=-dy/mag;ny=dx/mag;
   if(heavy){
    pressure=(.67+.33*Math.abs(ny))*(.80+.20*Math.min(1,u/.075))*
      (u>.87?Math.max(.23,1-.77*(u-.87)/.13):1)*
      (.96+.04*Math.cos(6*Math.PI*u));
   }else pressure=smoothPressure(u,technique);
  }
  const r=width*pressure/2;
  left.push([pt.x+nx*r,pt.y+ny*r]);
  right.unshift([pt.x-nx*r,pt.y-ny*r]);
 }
 ctx.beginPath();
 for(const [i,[x,y]] of [...left,...right].entries())i?ctx.lineTo(x,y):ctx.moveTo(x,y);
 ctx.closePath();ctx.fill('nonzero');
}
function drawStroke(ctx,s,f){
 const d=s.d,kind=s.kind;
 if(kind==='fill'){ctx.fill(pathFor(d),'evenodd');return;}
 if(kind==='hairline'){
  ctx.lineWidth=f.id==='F'&&s.subtype==='crossbar'?5.2:f.technique==='gothic'?1.25:1.8;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(pathFor(d));return;
 }
 const weight=f.weight*(kind==='heavy'?(f.technique==='fatmarker'?1.18:1.3):1);
 const technique=f.technique;
 if(['nib','chisel','marker','loop','airy','sweep','crosshand','fatmarker'].includes(technique)){
  fillStrip(ctx,d,weight,technique);return;
 }
 ctx.lineWidth=weight;ctx.lineCap=technique==='fragment'?'square':technique==='block'?'square':'round';
 ctx.lineJoin=technique==='block'?'miter':'round';
 ctx.miterLimit=5;ctx.stroke(pathFor(d));
}
/** Paint a deterministic tag into the existing atlas coordinate system. */
export function drawTowerFamilyTag(ctx,tag,{finish='spray',joins=true}={}){
 if(tag?.renderer!=='az-nine-v1')throw new TypeError('Expected nine-family tower tag');
 const f=getFamily(tag.hand),plan={...tag.plan,accented:new Set(tag.plan.accented)};
 ctx.save();
 ctx.fillStyle=tag.ink;ctx.strokeStyle=tag.ink;
 ctx.globalAlpha*=finish==='spray'?.90:1;
 for(const item of plan.letters){
  ctx.save();
  ctx.translate(item.x,item.y);
  ctx.translate(38,54);
  ctx.rotate(item.rotation*Math.PI/180);
  ctx.translate(-38,-54);
  ctx.transform(item.scale,0,f.italic,1,0,0);
  for(const s of (item.shapes||item.glyph.shapes))if(s.role==='ornament'?showGesture(f,item,s,plan):s.role==='structure')drawStroke(ctx,s,f);
  ctx.restore();
 }
 if(tag.hand==='F'&&plan.shared?.length){
  for(const stroke of plan.shared){
   ctx.save();
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.lineWidth=stroke.subtype==='crossbar'?5.2:Math.max(3.2,stroke.width||4.7);
   ctx.stroke(pathFor(stroke.d));ctx.restore();
  }
 }
 if(joins&&tag.hand!=='F'){
  const layer=['A','F','G'].includes(f.id)?exitContinuations(f,plan,{seed:plan.seed,enabled:true}):limitJoins(f,contextualJoinLayer(f,plan,{seed:plan.seed,enabled:f.id!=='E'}),plan);
  for(const path of layer.querySelectorAll('path')){
   ctx.save();
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.lineWidth=Number(path.getAttribute('stroke-width'))||2;
   ctx.stroke(pathFor(path.getAttribute('d')));
   ctx.restore();
  }
 }
 ctx.restore();
 return 1;
}
export function paintTowerTag(ctx,tag,options={}){
 if(tag?.renderer==='az-nine-v1')return drawTowerFamilyTag(ctx,tag,options);
 throw new TypeError('Legacy tag must use the legacy drawTag() engine');
}
export function towerGraffitiSignature(marks){
 return TOWER_LETTERING_REVISION+'|'+marks.map(m=>m.id+'|'+m.hand+'|'+m.seed).join(';');
}
