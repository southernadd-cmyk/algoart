// SVG geometry renderer for the original 10-family, 260-letter Phase D study.
// No font substitution, CSS filters, tracings, external image or raster resources.
import {getFamily,getGlyph,composeWord,LETTERS,FAMILIES} from './family-library.mjs';
const NS='http://www.w3.org/2000/svg',clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function tag(name,attrs={}){
 const e=document.createElementNS(NS,name);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 return e;
}
function inkRibbon(d,{width=6,kind='marker'}={}){
 const path=tag('path',{d}),length=path.getTotalLength();
 if(!Number.isFinite(length)||length<.05)return tag('path',{d,fill:'none',stroke:'#222','stroke-width':width});
 const count=clamp(Math.ceil(length/2.8),12,480),left=[],right=[];
 for(let i=0;i<=count;i++){
  const u=i/count,t=length*u,p=path.getPointAtLength(t),
   a=path.getPointAtLength(Math.max(0,t-1.6)),
   b=path.getPointAtLength(Math.min(length,t+1.6)),
   dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy)||1,
   nx=-dy/mag,ny=dx/mag;
  const tapered=kind==='airy'?(.28+.72*Math.sin(Math.PI*(.12+.76*u))):
    kind==='sweep'?(.25+.75*Math.pow(Math.sin(Math.PI*(.08+.84*u)),.35)):
    kind==='loop'?(.55+.45*Math.pow(Math.sin(Math.PI*u),.25)):
    .68+.32*Math.pow(Math.sin(Math.PI*u),.27);
  const r=width*tapered/2;
  left.push([p.x+nx*r,p.y+ny*r]);
  right.unshift([p.x-nx*r,p.y-ny*r]);
 }
 return tag('path',{d:polygon(left,right),fill:'currentColor','fill-rule':'evenodd'});
}
const coords=([x,y])=>x.toFixed(2)+' '+y.toFixed(2);
function polygon(left,right){return 'M'+left.map(coords).join(' L')+' L'+right.map(coords).join(' L')+' Z'}
function broadNib(d,width){
 const measure=tag('path',{d}),length=measure.getTotalLength();
 if(!Number.isFinite(length)||length<.1)return tag('path',{d,fill:'none',stroke:'currentColor','stroke-width':1});
 const count=clamp(Math.ceil(length/2),16,600),left=[],right=[];
 // A fixed -39 degree nib axis gives true directional stroke contrast:
 // along its edge: thin; across its edge: broad. NOT a speed proxy.
 const angle=-39*Math.PI/180,ux=Math.cos(angle),uy=Math.sin(angle);
 for(let i=0;i<=count;i++){
  const u=i/count,p=measure.getPointAtLength(length*u),
   r=width*(.63+.37*Math.sin(Math.PI*(.025+.95*u)))/2;
  left.push([p.x+ux*r,p.y+uy*r]);right.unshift([p.x-ux*r,p.y-uy*r]);
 }
 return tag('path',{d:polygon(left,right),fill:'currentColor','fill-rule':'evenodd'});
}
function strokeAttrs(f,s,construction){
 if(construction)return {fill:'none',stroke:'currentColor','stroke-width':1.65,'stroke-linecap':'round','stroke-linejoin':'round'};
 if(s.kind==='hairline')return {fill:'none',stroke:'currentColor','stroke-width':f.technique==='gothic'?1.25:1.8,'stroke-linecap':'round','stroke-linejoin':'round'};
 if(s.kind==='fill')return {fill:'currentColor','fill-rule':'evenodd',stroke:'none'};
 if(f.technique==='block')return {fill:'none',stroke:'currentColor','stroke-width':s.kind==='heavy'?f.weight*1.2:f.weight,
   'stroke-linecap':'square','stroke-linejoin':'miter','stroke-miterlimit':5};
 return {fill:'none',stroke:'currentColor','stroke-width':s.kind==='heavy'?f.weight*1.3:f.weight,
  'stroke-linecap':f.technique==='fragment'?'square':'round','stroke-linejoin':'round'};
}
function drawGlyph(f,ch,{construction=false}={}){
 const g=tag('g',{'data-letter':ch,'aria-label':ch}),glyph=getGlyph(f.id,ch);
 for(const s of glyph.shapes){
  let path;
  if(!construction&&s.kind!=='fill'&&s.kind!=='hairline'&&f.technique==='nib')
   path=broadNib(s.d,f.weight*(s.kind==='heavy'?1.35:1));
  else if(!construction&&s.kind!=='fill'&&s.kind!=='hairline'&&['marker','loop','airy','sweep'].includes(f.technique))
   path=inkRibbon(s.d,{width:f.weight*(s.kind==='heavy'?1.35:1),kind:f.technique});
  else path=tag('path',{d:s.d,...strokeAttrs(f,s,construction)});
  path.setAttribute('data-gesture',s.kind);
  g.append(path);
 }
 return g;
}
function svg(viewBox,label){
 const s=tag('svg',{viewBox,xmlns:NS,role:'img','aria-label':label,
  'stroke-linecap':'round','stroke-linejoin':'round'});
 return s;
}
export function letterSvg(style,letter,{construction=false}={}){
 const f=getFamily(style),g=svg('-25 -28 151 174',f.name+' letter '+letter);
 g.style.color=construction?'#282c28':f.ink;g.append(drawGlyph(f,String(letter).toUpperCase(),{construction}));
 return g;
}
export function alphabetFragment(style,{construction=false}={}){
 const f=getFamily(style),root=document.createDocumentFragment();
 for(const ch of LETTERS){
  const fig=document.createElement('figure');fig.className='letter';
  fig.append(letterSvg(style,ch,{construction}));
  const caption=document.createElement('figcaption');caption.textContent=ch;fig.append(caption);
  root.append(fig);
 }
 return root;
}
export function wordSvg(style,word,{seed='PP-ALPHABETS-01',variation=.04,construction=false}={}){
 const f=getFamily(style),plan=composeWord(style,word,{seed,variation});
 // Give letters room for long strokes and baseline excursions.
 const s=svg('-32 -35 '+(plan.width+61).toFixed(2)+' 189',f.name+' writes '+plan.word);
 s.style.color=construction?'#282c28':f.ink;
 for(const item of plan.letters){
  const g=tag('g',{transform:'translate('+item.x.toFixed(3)+' '+item.y.toFixed(3)+') rotate('+item.rotation.toFixed(3)+' 38 54) matrix('+item.scale.toFixed(4)+' 0 '+f.italic.toFixed(3)+' 1 0 0)'});
  g.append(drawGlyph(f,item.ch,{construction}));s.append(g);
 }
 return s;
}
export function exportSvg(element,filename='graffiti-word.svg'){
 if(!(element instanceof SVGElement))throw new TypeError('Export requires SVG');
 const copy=element.cloneNode(true),fg=copy.style.color||'#232323';
 copy.removeAttribute('style');
 copy.setAttribute('color',fg);
 copy.setAttribute('xmlns',NS);
 const serialized=new XMLSerializer().serializeToString(copy),
  url=URL.createObjectURL(new Blob([serialized],{type:'image/svg+xml;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;
 link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 return serialized.length;
}
export function renderComparison(word,{seed='PP-ALPHABETS-01',variation=.04,construction=false}={}){
 const fragment=document.createDocumentFragment();
 for(const f of FAMILIES){
  const item=document.createElement('article');item.className='specimen';item.dataset.family=f.id;
  const header=document.createElement('div');header.className='specimen-heading';
  const title=document.createElement('h3');title.textContent=f.name;header.append(title);
  const subtitle=document.createElement('p');subtitle.textContent='Source study: sheet '+f.primary+' · '+f.technique+' geometry';header.append(subtitle);
  item.append(header);
  const holder=document.createElement('div');holder.className='word-preview';holder.append(wordSvg(f.id,word,{seed,variation,construction}));item.append(holder);
  const button=document.createElement('button');button.type='button';button.dataset.family=f.id;button.textContent='See full alphabet';
  button.className='family-select';item.append(button);
  fragment.append(item);
 }
 return fragment;
}
