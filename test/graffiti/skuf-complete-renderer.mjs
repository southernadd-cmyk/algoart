// Render the independently authored capitals as structural strokes or
// pressure-varied ink ribbons. Does not require the SKUF reference lab.
import {glyphFor,planLetters,LETTERS,ALPHABET_ID} from './skuf-complete-alphabet.mjs';
const NS='http://www.w3.org/2000/svg',clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const node=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e};
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
function widthProfile(progress,turn,seed){
 const entrance=.35+.65*clamp(progress/.09,0,1),exit=.3+.7*clamp((1-progress)/.11,0,1);
 const texture=1+.065*Math.sin(progress*17.3+seed*.000002)+.04*Math.sin(progress*37+seed*.00001);
 return clamp((.91+Math.min(.32,turn*.65))*Math.min(entrance,exit)*texture,.2,1.5);
}
export function paintedPath(d,{seed='',weight=7.5}={}){
 const measure=node('path',{d});let total=0;
 try{total=measure.getTotalLength()}catch(error){throw new Error('Invalid glyph stroke: '+error.message)}
 if(!Number.isFinite(total)||total<1)return node('path',{d,fill:'none',stroke:'#242b28','stroke-width':weight});
 const resolution=clamp(Math.ceil(total/2.3),12,550),pts=[],k=hash(seed);
 for(let i=0;i<=resolution;i++){
  const progress=i/resolution,t=total*progress,p=measure.getPointAtLength(t),
   bef=measure.getPointAtLength(Math.max(0,t-2)),
   aft=measure.getPointAtLength(Math.min(total,t+2));
  const dx=aft.x-bef.x,dy=aft.y-bef.y,len=Math.hypot(dx,dy)||1;
  const a=measure.getPointAtLength(Math.max(0,t-5)),b=measure.getPointAtLength(Math.min(total,t+5));
  const da=Math.atan2(p.y-a.y,p.x-a.x),db=Math.atan2(b.y-p.y,b.x-p.x);
  const curvature=Math.abs(Math.atan2(Math.sin(db-da),Math.cos(db-da)));
  const w=weight*widthProfile(progress,curvature,k);
  pts.push({x:p.x,y:p.y,nx:-dy/len,ny:dx/len,w});
 }
 const left=pts.map(p=>[p.x+p.nx*p.w/2,p.y+p.ny*p.w/2]),right=pts.slice().reverse().map(p=>[p.x-p.nx*p.w/2,p.y-p.ny*p.w/2]);
 const fmt=([x,y])=>x.toFixed(2)+','+y.toFixed(2);
 const ribbon='M'+left.map(fmt).join('L')+'L'+right.map(fmt).join('L')+'Z';
 return node('path',{d:ribbon,fill:'#26312b','data-stroke-kind':'variable-width'});
}
function gestureGroup(gesture,{mode='ink',seed='PP-AZ-01',x=0,y=0,scaleX=1,scaleY=1,lean=0,index=0}={}){
 const transform='translate('+x.toFixed(2)+' '+y.toFixed(2)+') matrix('+scaleX.toFixed(4)+' 0 '+lean.toFixed(4)+' '+scaleY.toFixed(4)+' 0 0)';
 const g=node('g',{transform,'data-letter':gesture.ch||''});
 for(const [i,d] of gesture.strokes.entries()){
  if(mode==='skeleton')g.append(node('path',{d,fill:'none',stroke:'#26312b','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'}));
  else g.append(paintedPath(d,{seed:seed+'|'+index+'|'+i,weight:i===0?9.4:6.4}));
 }
 return g;
}
export function renderLetter(ch,{mode='ink',seed='PP-AZ-01'}={}){
 const glyph=glyphFor(ch),svg=node('svg',{xmlns:NS,viewBox:'-16 -19 '+(glyph.width+36)+' 158',
 'aria-label':'Letter '+ch+' in authored graffiti alphabet',role:'img'});
 svg.append(gestureGroup({...glyph,ch},{mode,seed,index:LETTERS.indexOf(ch)}));
 return svg;
}
export function renderWord(text,{mode='ink',seed='PP-AZ-01',tightness=.88,variation=.08}={}){
 const p=planLetters(text,{seed,tightness,variation});
 const svg=node('svg',{xmlns:NS,viewBox:'-23 -20 '+(p.width+44).toFixed(2)+' 161',
  role:'img','aria-label':p.text+' in original authored graffiti alphabet'});
 for(const item of p.items)svg.append(gestureGroup(item,{mode,seed,
  x:item.x,y:item.y,scaleX:item.scaleX,scaleY:item.scaleY,lean:item.lean,index:item.index}));
 return svg;
}
export function renderAlphabet({mode='ink',seed='PP-AZ-01'}={}){
 const fragment=document.createDocumentFragment();
 for(const ch of LETTERS){
  const cell=document.createElement('figure');cell.className='letter';
  const image=renderLetter(ch,{mode,seed});cell.append(image);
  const label=document.createElement('figcaption');label.textContent=ch;cell.append(label);
  fragment.append(cell);
 }
 return fragment;
}
export function exportSvg(svg,filename='handstyle.svg'){
 if(!(svg instanceof SVGElement))throw new TypeError('Missing SVG');
 const copy=svg.cloneNode(true);
 copy.setAttribute('xmlns',NS);copy.setAttribute('version','1.1');
 const xml=new XMLSerializer().serializeToString(copy),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
 const a=document.createElement('a'),url=URL.createObjectURL(blob);
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
 return xml.length;
}
export const RENDERER_ALPHABET=ALPHABET_ID;
