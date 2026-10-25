// Distinct construction and rendering families. All letters start from the
// project's phi dimensions; inflated faces, straight bars and angular spines
// have separate pen grammars from the existing handwriting studies.
export const LETTERING_FORMS=Object.freeze({
 handstyle:Object.freeze({name:'Handstyle',description:'A quick signature, joins and a personal closing mark.',solid:false}),
 hollow:Object.freeze({name:'Hollow throw-up',description:'Inflated letter contours with the brick left showing inside.',solid:true,round:true,hollow:true,bar:25,outline:3.4,width:1.28,height:1,spacing:18}),
 bubble:Object.freeze({name:'Bubble throw-up',description:'Pillowy filled letters, dark outlines and small highlights.',solid:true,round:true,bar:28,outline:3.3,width:1.3,height:.98,spacing:19}),
 straight:Object.freeze({name:'Straight letters',description:'Clear letter faces, square ends and an outline.',solid:true,round:false,bar:18,outline:2.6,width:1.2,height:1,spacing:17}),
 blockbuster:Object.freeze({name:'Blockbuster',description:'Wide, heavy, tightly packed geometric capitals.',solid:true,round:false,bar:30,outline:0,width:1.55,height:.95,spacing:22}),
 calligraphy:Object.freeze({name:'Calligraffiti',description:'Broad angled strokes, fine turns and sweeping script.',solid:false,calligraphy:true,width:.92,height:1.12}),
 pixo:Object.freeze({name:'Pichação study',description:'Tall angular spines, narrow counters and broken bars.',solid:false,pixo:true,width:.62,height:1.75}),
 piece:Object.freeze({name:'Interlocking piece',description:'Angular filled letters, overlapping extensions and stepped depth.',solid:true,round:false,piece:true,bar:24,outline:3,width:1.15,height:1.08,spacing:11})
});
const caches=new WeakMap();
let film=null;
function paintFilm(){
 if(film)return film;
 film=document.createElement('canvas');film.width=film.height=128;
 const g=film.getContext('2d'),image=g.createImageData(128,128);
 let seed=17321;
 for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed>>>24;image.data[i+3]=n<2?80:246+(n%10);}
 g.putImageData(image,0,0);return film;
}
export function formGlyph(character,base,form,m){
 if(form==='handstyle'||form==='calligraphy')return base;
 const {height:H,width:W,short:a,long:b,unit:u,ratio}=m;
 const L=(...ps)=>ps.map(([x,y])=>({x,y})),P=(points,smooth=false)=>({points,smooth});
 let glyph=base;
 if(form==='blockbuster'||form==='pixo'){
  // Open polygonal bowls give these alphabets square/angular construction,
  // rather than a rounded alphabet rendered with a different cap.
  const shapes={
   B:[P(L([0,H],[0,0],[W,0],[W,a],[0,a],[W,a],[W,H],[0,H]))],
   C:[P(L([W,0],[0,0],[0,H],[W,H]))],
   D:[P(L([0,H],[0,0],[W-u,0],[W,H/2],[W-u,H],[0,H]))],
   G:[P(L([W,0],[0,0],[0,H],[W,H],[W,b],[W/2,b]))],
   O:[P(L([0,0],[W,0],[W,H],[0,H],[0,0]))],
   P:[P(L([0,H],[0,0],[W,0],[W,a],[0,a]))],
   Q:[P(L([0,0],[W,0],[W,H],[0,H],[0,0])),P(L([W/2,b],[W+u,H+u]))],
   R:[P(L([0,H],[0,0],[W,0],[W,a],[0,a])),P(L([W/ratio**2,a],[W,H]))],
   S:[P(L([W,0],[0,0],[0,a],[W,b],[W,H],[0,H]))],
   U:[P(L([0,0],[0,H],[W,H],[W,0]))]
  };
  if(shapes[character])glyph={...base,strokes:shapes[character]};
 }
 if(form==='pixo'){
  const runes={
   A:[P(L([0,H],[W/2,0],[W,H])),P(L([0,b],[W,a]))],
   E:[P(L([0,0],[0,H])),P(L([0,0],[W,a/ratio])),P(L([0,b],[W,a])),P(L([0,H],[W,b]))],
   M:[P(L([0,H],[0,0],[W/2,b],[W,0],[W,H]))],
   N:[P(L([0,H],[0,0],[W,H],[W,0]))],
   O:[P(L([W/2,0],[W,H/2],[W/2,H],[0,H/2],[W/2,0]))],
   T:[P(L([0,a/ratio],[W,0])),P(L([W/2,0],[W/2,H]))],
   I:[P(L([W/2,0],[W/2,H])),P(L([0,a],[W,b]))],
   H:[P(L([0,0],[0,H])),P(L([W,0],[W,H])),P(L([0,b],[W,a]))]
  };
  if(runes[character])glyph={...glyph,strokes:runes[character]};
 }
 if(LETTERING_FORMS[form]?.solid){
  // Filled letter faces need larger counters than a signature's centreline.
  // P and R use the long phi bowl, rather than losing the short bowl beneath
  // a fat cap; B shares the available bowl space between its two counters.
  if(character==='P'||character==='R')glyph={...glyph,strokes:glyph.strokes.map(s=>({...s,points:s.points.map(q=>({...q,y:q.y<=a+1e-6?q.y*b/a:q.y}))}))};
  if(character==='B')glyph={...glyph,strokes:glyph.strokes.map(s=>({...s,points:s.points.map(q=>({...q,y:q.y<=a?q.y*(a+b)/2/a:(a+b)/2+(q.y-a)*(a+b)/2/b}))}))};
 }
 if(form==='piece'){
  // Alternating wedge shoulders and extended terminal bars break the word's
  // rectangular silhouette while keeping the letter counter structure.
  glyph={...glyph,strokes:glyph.strokes.map((s,i)=>P(s.points.map(q=>({x:q.x+(q.y<H/2?u:-u)*(i%2?-.65:.65),y:q.y}))))};
 }
 if(form==='bubble'||form==='hollow')glyph={...glyph,strokes:glyph.strokes.map(s=>({...s,smooth:true}))};
 return glyph;
}
function path(ctx,points,fraction=1){
 if(fraction<=0||!points.length)return;
 const last=Math.max(1,Math.min(points.length-1,Math.floor((points.length-1)*fraction)));
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let i=1;i<=last;i++)ctx.lineTo(points[i].x,points[i].y);
 ctx.stroke();
}
function colourPlan(tag){
 const fills=['#d8d4c6','#d6ab66','#9fb5af','#b6a4c0','#b5bc8c'];
 let h=2166136261;for(const c of tag.seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
 const pale=tag.ink==='#e4ddd0';
 return {outline:pale?'#373d3e':tag.ink,fill:pale?tag.ink:fills[(h>>>0)%fills.length],highlight:'#f8f0d6',shadow:'#34383a'};
}
export function drawSolidForm(ctx,tag,{progress=1,fractionAt,finish='spray'}={}){
 const style=LETTERING_FORMS[tag.form];
 if(!style?.solid)throw new TypeError('A filled/outline lettering form is required.');
 if(progress<=0)return;
 let cache=caches.get(tag);
 if(!cache){
  const canvas=document.createElement('canvas');
  // Rasterisation is local to this transparent mark, never the wall. Cache
  // one working layer per tag and let WeakMap release it with that tag.
  const scale=3,b=tag.bounds;canvas.width=Math.ceil(b.width*scale);canvas.height=Math.ceil(b.height*scale);
  cache={canvas,context:canvas.getContext('2d'),scale};caches.set(tag,cache);
 }
 const {canvas,context:g,scale}=cache,b=tag.bounds,colours=colourPlan(tag);
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);g.setTransform(scale,0,0,scale,-b.x*scale,-b.y*scale);
 const width=style.bar*tag.paintWidth/2,outline=style.outline*tag.paintWidth/2;
 const visible=tag.strokes.map((stroke,index)=>({stroke,fraction:fractionAt(tag,index,progress)})).filter(v=>v.fraction>0);
 const letters=new Map();
 for(const entry of visible){const key=entry.stroke.letterIndex??-1;if(!letters.has(key))letters.set(key,[]);letters.get(key).push(entry);}
 for(const entries of letters.values()){
  const draws=()=>{for(const e of entries)path(g,e.stroke.points,e.fraction);};
  g.lineCap=style.round?'round':'butt';g.lineJoin=style.round?'round':'miter';g.miterLimit=2;
  if(style.piece){g.save();g.translate(7,8);g.strokeStyle=colours.shadow;g.lineWidth=width+outline*2;draws();g.restore();}
  g.strokeStyle=style.hollow?tag.ink:colours.outline;
  if(finish==='spray'){for(const [spread,opacity] of [[2.4,.05],[1.2,.15]]){g.save();g.globalAlpha=opacity;g.lineWidth=width+outline*2+spread;draws();g.restore();}}
  g.lineWidth=width+outline*2;draws();
  if(style.hollow){g.globalCompositeOperation='destination-out';g.lineWidth=width;draws();g.globalCompositeOperation='source-over';}
  else{
   g.strokeStyle=style.outline?colours.fill:tag.ink;g.lineWidth=width;draws();
   if(style.round){g.save();g.translate(-width*.12,-width*.13);g.strokeStyle=colours.highlight;g.globalAlpha=.36;g.lineWidth=Math.max(1.2,width*.055);draws();g.restore();}
  }
 }
 if(style.piece){
  for(const extension of tag.extensions||[]){
   if(progress<extension.at)continue;g.fillStyle=colours.outline;g.beginPath();g.moveTo(extension.points[0].x,extension.points[0].y);for(const p of extension.points.slice(1))g.lineTo(p.x,p.y);g.closePath();g.fill();
  }
 }
 // Tiny seeded pinholes sit in the deposited paint, independent of reveal frames.
 g.save();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='destination-in';g.fillStyle=g.createPattern(paintFilm(),'repeat');g.fillRect(0,0,canvas.width,canvas.height);g.restore();
 ctx.save();ctx.globalAlpha=tag.opacity;ctx.drawImage(canvas,b.x,b.y,b.width,b.height);ctx.restore();
}
