// Style-specific cross-letter gestures anchored to authored stroke geometry.
// Unlike a decorative underline, each connector begins and ends on measured
// points of neighbouring glyphs. Detached families never receive forced joins.
import {stableNoise} from './family-library.mjs';
const NS='http://www.w3.org/2000/svg';
const POLICIES=Object.freeze({
 A:Object.freeze({kind:'angular-cross',rate:.48,min:9,max:37,range:25,width:2.65}),
 B:Object.freeze({kind:'crossbar',rate:.48,min:7,max:62,range:27,width:3.3}),
 F:Object.freeze({kind:'calligraphic-link',rate:.66,min:9,max:45,range:22,width:1.25}),
 G:Object.freeze({kind:'orbital-link',rate:.72,min:11,max:46,range:28,width:2.2})
});
export const CONNECTING_FAMILIES=Object.freeze(Object.keys(POLICIES));
export function joinPolicy(id){return POLICIES[id]||null}
export function shouldConsiderJoin(id,prev,next,seed='PP-61-SHEET-01'){
 const p=POLICIES[id];
 if(!p||!prev||!next||next.index!==prev.index+1)return false;
 if(prev.ch==='Φ'||next.ch==='Φ')return false;
 const score=stableNoise(seed+'|join|'+id+'|'+prev.index+'|'+prev.ch+next.ch);
 return score<p.rate;
}
function tag(name,attrs={}){
 const e=document.createElementNS(NS,name);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 return e;
}
function world(item,f,p){
 const x=p.x*item.scale+f.italic*p.y,y=p.y;
 const a=item.rotation*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
 return {x:item.x+38+(x-38)*cos-(y-54)*sin,
  y:item.y+54+(x-38)*sin+(y-54)*cos};
}
function sample(item,f,side){
 const out=[];
 for(const shape of item.glyph.shapes){
  if(shape.kind==='hairline')continue;
  const measure=tag('path',{d:shape.d}),length=measure.getTotalLength();
  if(!Number.isFinite(length)||length<10)continue;
  const count=Math.min(80,Math.max(14,Math.ceil(length/5)));
  for(let i=0;i<=count;i++){
   const p=measure.getPointAtLength(length*i/count);
   if(p.y<28||p.y>102)continue;
   if(side==='out'&&p.x<45)continue;
   if(side==='in'&&p.x>44)continue;
   out.push(world(item,f,p));
  }
 }
 return out;
}
const fmt=n=>n.toFixed(2);
function geometry(kind,a,b){
 const x0=a.x,y0=a.y,x1=b.x,y1=b.y;
 const dx=x1-x0,my=(y0+y1)/2,mx=(x0+x1)/2;
 const xy=(x,y)=>fmt(x)+' '+fmt(y);
 if(kind==='angular-cross')return 'M '+xy(x0,y0)+' L '+xy(mx,my-7)+' L '+xy(x1,y1);
 if(kind==='crossbar')return 'M '+xy(x0,y0)+' Q '+xy(mx+dx*.08,my-11)+' '+xy(x1,y1);
 if(kind==='calligraphic-link')return 'M '+xy(x0,y0)+' C '+xy(x0+dx*.28,y0+12)+' '+xy(x1-dx*.32,y1-11)+' '+xy(x1,y1);
 if(kind==='orbital-link')return 'M '+xy(x0,y0)+' C '+xy(x0+dx*.85,y0-16)+' '+xy(x1-dx*.7,y1+20)+' '+xy(x1,y1);
 return 'M '+xy(x0,y0)+' C '+xy(x0+dx*.45,y0+16)+' '+xy(x1-dx*.4,y1-14)+' '+xy(x1,y1);
}
function bestPair(from,to,policy){
 let best=null,score=Infinity;
 for(const a of from)for(const b of to){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx<policy.min||dx>policy.max||Math.abs(dy)>policy.range)continue;
  const midY=(a.y+b.y)/2;
  // Favour a short natural transfer near the waist.
  const cost=Math.abs(dx-17)*.3+Math.abs(dy)*.7+Math.abs(midY-63)*.16;
  if(cost<score){score=cost;best={a,b}}
 }
 return best;
}
export function contextualJoinLayer(f,plan,{seed='PP-61-SHEET-01',enabled=true,construction=false}={}){
 const layer=tag('g',{'data-role':'contextual-joins','data-family':f.id});
 const policy=POLICIES[f.id];if(!enabled||!policy)return layer;
 const items=plan.letters;
 for(let i=1;i<items.length;i++){
  const prev=items[i-1],next=items[i];
  if(!shouldConsiderJoin(f.id,prev,next,seed))continue;
  const match=bestPair(sample(prev,f,'out'),sample(next,f,'in'),policy);
  if(!match)continue;
  const p=tag('path',{d:geometry(policy.kind,match.a,match.b),
   fill:'none',stroke:'currentColor','stroke-width':construction?1.55:policy.width,
   'stroke-linecap':'round','stroke-linejoin':'round',
   'data-join':prev.ch+next.ch,'data-letter-index':i-1});
  layer.append(p);
 }
 return layer;
}
