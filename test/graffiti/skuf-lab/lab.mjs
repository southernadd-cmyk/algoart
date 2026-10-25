import {SKUF_SOURCES,describeCoverage} from './references.mjs';
import {initialDocument,validateDocument,pathD,simulateDocument,ribbonForStroke} from './gesture-model.mjs';
const NS='http://www.w3.org/2000/svg',by=id=>document.getElementById(id);
let doc=initialDocument(),selected=doc.strokes[0]?.id,mode='select',drag=null,drawing=null;
let imageUrl='',imageXY={x:-25,y:-30,w:400,h:200},undoStack=[],playFrame=0,referenceId=SKUF_SOURCES[0].id;
const svg=by('stage'),msg=by('status'),node=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
const write=message=>{msg.textContent=message};
const current=()=>doc.strokes.find(s=>s.id===selected);
function snapshot(){undoStack.push(JSON.stringify(doc));if(undoStack.length>60)undoStack.shift()}
function select(id){selected=id;render()}
function coordinate(event){
 const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
 const ctm=svg.getScreenCTM();return ctm?p.matrixTransform(ctm.inverse()):{x:p.x,y:p.y};
}
function pathStroke(stroke,colour,weight,extra={}){
 const p=node('path',{d:pathD(stroke),fill:'none',stroke:colour,'stroke-width':weight,
 'stroke-linecap':'round','stroke-linejoin':'round',...extra});p.dataset.id=stroke.id;return p;
}
function visibleReference(){
 if(!imageUrl)return;
 const img=node('image',{href:imageUrl,x:imageXY.x,y:imageXY.y,width:imageXY.w,height:imageXY.h,opacity:Number(by('opacity').value)/100,
 preserveAspectRatio:'none'});img.style.pointerEvents='none';svg.append(img);
}
function render(){
 cancelAnimationFrame(playFrame);playFrame=0;svg.replaceChildren();
 visibleReference();
 let simulated=null;
 try{simulated=simulateDocument(doc,{seed:by('seed').value})}
 catch(error){write(error.message)}
 const view=by('view').value;
 if(view==='paint'&&simulated){
  for(const s of doc.strokes){
   const events=simulated.events.filter(e=>e.strokeId===s.id);
   if(events.length<2)continue;
   svg.append(node('path',{d:ribbonForStroke(events,{width:9}),fill:s.id===selected?'#384f48':'#202924',opacity:s.id===selected?'.9':'.75'}));
  }
 }
 for(const s of doc.strokes){
  const group=node('g');
  group.append(pathStroke(s,s.id===selected?'#ad5538':view==='paint'?'#576f6744':'#25332e',view==='paint'?1:3));
  const hit=pathStroke(s,'transparent',18);hit.style.pointerEvents='stroke';
  hit.addEventListener('pointerdown',e=>{if(mode==='select'){e.stopPropagation();select(s.id)}});
  group.append(hit);svg.append(group);
 }
 const s=current();
 if(mode==='select'&&s){
  for(const [i,k] of s.knots.entries()){
   for(const which of ['in','out']){
    const h=k[which];if(!h)continue;
    svg.append(node('line',{x1:k.x,y1:k.y,x2:h.x,y2:h.y,stroke:'#876c58','stroke-width':'.9'}));
    const c=node('circle',{cx:h.x,cy:h.y,r:3,fill:'#fff',stroke:'#866a5b','stroke-width':'1.1'});
    c.dataset.role=which;c.dataset.index=i;svg.append(c);
   }
   const dot=node('circle',{cx:k.x,cy:k.y,r:4.2,fill:i===0?'#436e51':'#f5e7d5',stroke:'#a14d36','stroke-width':'1.5'});
   dot.dataset.role='anchor';dot.dataset.index=i;svg.append(dot);
  }
 }
 const menu=by('strokes');menu.replaceChildren();
 for(const [i,s] of doc.strokes.entries()){
  const b=document.createElement('button');b.type='button';b.className=s.id===selected?'active':'';b.textContent=(i+1)+'. '+s.letter+' / '+s.id+(s.liftAfter?'  ↑':'  joined');
  b.addEventListener('click',()=>select(s.id));menu.append(b);
 }
 updateProperties();updateCoverage();if(simulated)by('timing').textContent=Math.round(simulated.durationMs)+' ms · '+simulated.events.length+' time samples · '+doc.strokes.length+' strokes';
}
function updateCoverage(){
 const items=doc.observations||[],c=describeCoverage(items);
 by('coverage').textContent=c.referenceLeads+' dated reference leads across '+c.sourcePages+' source pages · '+c.handstyleExamples+' annotated handstyle photos · '+c.needed+' more to meet the minimum reference target';
 const host=by('observations');host.replaceChildren();
 for(const [i,a] of items.entries()){
  const p=document.createElement('p');p.textContent=(i+1)+'. '+a.sourceId+' — '+a.medium+' ('+a.confidence+'), '+a.lettersVisible+'. '+a.geometry;
  host.append(p);
 }
}
function updateProperties(){
 const s=current();by('strokeProperties').hidden=!s;if(!s)return;
 by('letter').value=s.letter||'';by('duration').value=s.durationMs;by('pressure').value=s.pressure;
 by('lift').checked=s.liftAfter;by('confidence').value=s.confidence||'inferred';by('note').value=s.note||'';
}
svg.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const p=coordinate(e);
 if(mode==='draw'){
  if(e.target.dataset.role)return;
  snapshot();drawing=[p];svg.setPointerCapture(e.pointerId);e.preventDefault();return;
 }
 if(e.target.dataset.role&&current()){
  snapshot();drag={role:e.target.dataset.role,index:Number(e.target.dataset.index),previous:p};
  svg.setPointerCapture(e.pointerId);e.preventDefault();
 }
});
svg.addEventListener('pointermove',e=>{
 const p=coordinate(e);
 if(drawing){if(Math.hypot(p.x-drawing.at(-1).x,p.y-drawing.at(-1).y)>2)drawing.push(p);return}
 if(!drag)return;
 const s=current(),k=s?.knots[drag.index];if(!k)return;
 if(drag.role==='anchor'){
  const dx=p.x-drag.previous.x,dy=p.y-drag.previous.y;
  k.x+=dx;k.y+=dy;for(const side of ['in','out'])if(k[side]){k[side].x+=dx;k[side].y+=dy}
 }else k[drag.role]={x:p.x,y:p.y};
 drag.previous=p;render();
});
function simplified(points){
 const filtered=points.filter((p,i)=>i===0||i===points.length-1||i%3===0);
 if(filtered.length<2)return [];
 return filtered.slice(0,50).map((p,i,a)=>{
  const prev=a[Math.max(0,i-1)],next=a[Math.min(a.length-1,i+1)],dx=(next.x-prev.x)/6,dy=(next.y-prev.y)/6;
  return {x:p.x,y:p.y,in:i?{x:p.x-dx,y:p.y-dy}:null,out:i<a.length-1?{x:p.x+dx,y:p.y+dy}:null};
 });
}
svg.addEventListener('pointerup',e=>{
 if(drawing){
  const knots=simplified(drawing);drawing=null;
  if(knots.length>=2){
   const id='g'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
   doc.strokes.push({id,letter:'?',knots,durationMs:700,pressure:1,liftAfter:true,confidence:'inferred',note:'New manually authored gesture'});
   selected=id;write('New stroke created. Set its letter and mark any inferred movement.');
  }else undoStack.pop();
  mode='select';by('tool').value=mode;
 }
 if(drag)drag=null;
 if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
 render();
});
svg.addEventListener('pointercancel',e=>{drawing=null;drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);render()});
by('tool').addEventListener('change',e=>{mode=e.target.value;render()});
by('view').addEventListener('change',render);
by('seed').addEventListener('change',render);
by('opacity').addEventListener('input',()=>{const image=svg.querySelector('image');if(image)image.setAttribute('opacity',Number(by('opacity').value)/100)});
for(const key of ['x','y','w','h'])by('ref-'+key).addEventListener('change',()=>{
 const v=Number(by('ref-'+key).value);if(!Number.isFinite(v)||((key==='w'||key==='h')&&v<=0))return;
 imageXY[key]=v;render();
});
by('referenceImage').addEventListener('change',e=>{
 const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/')){write('Choose an image file');return}
 if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(f);render();
 write('Local reference loaded for overlay. The image is not uploaded or included in exported JSON.');
});
for(const [name,field,conv] of [['letter','letter',String],['duration','durationMs',Number],['pressure','pressure',Number],['confidence','confidence',String],['note','note',String]]){
 by(name).addEventListener('change',e=>{const s=current();if(!s)return;snapshot();s[field]=conv(e.target.value);
  try{validateDocument(doc);render()}catch(error){const prev=JSON.parse(undoStack.pop());doc=prev;render();write(error.message)}
 });
}
by('lift').addEventListener('change',e=>{const s=current();if(!s)return;snapshot();s.liftAfter=e.target.checked;try{simulateDocument(doc,{seed:by('seed').value});render()}catch(error){doc=JSON.parse(undoStack.pop());render();write(error.message)}});
by('delete').addEventListener('click',()=>{if(!current())return;snapshot();doc.strokes=doc.strokes.filter(s=>s.id!==selected);selected=doc.strokes[0]?.id;render()});
for(const [id,step] of [['up',-1],['down',1]])by(id).addEventListener('click',()=>{const i=doc.strokes.findIndex(s=>s.id===selected),j=i+step;if(i<0||j<0||j>=doc.strokes.length)return;snapshot();[doc.strokes[i],doc.strokes[j]]=[doc.strokes[j],doc.strokes[i]];render()});
by('undo').addEventListener('click',()=>{if(!undoStack.length)return;doc=JSON.parse(undoStack.pop());if(!current())selected=doc.strokes[0]?.id;render()});
function download(name,contents,type){
 const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
by('add-observation').addEventListener('click',()=>{
 const geometry=by('obs-visible').value.trim(),inferredMotion=by('obs-inferred').value.trim();
 if(!geometry){write('Describe what you actually see in the chosen photograph before saving.');return}
 snapshot();
 const a={sourceId:referenceId,imageDescription:'Locally viewed reference image (not embedded)',medium:by('obs-medium').value,
  word:'SKUF',lettersVisible:by('obs-letters').value.trim(),contour:geometry,connections:'',terminal:'',
  confidence:by('obs-confidence').value,geometry,inferredMotion,reviewedBy:'manual-review',reviewedAt:new Date().toISOString()};
 (doc.observations??=[]).push(a);render();write('Saved image-specific evidence note; geometry and motion are labelled separately.');
});
by('remove-observation').addEventListener('click',()=>{
 if(!doc.observations?.length)return;snapshot();doc.observations.pop();render();write('Latest evidence note removed.');
});
by('export').addEventListener('click',()=>{
 try{validateDocument(doc);download('skuf-gestures.json',JSON.stringify({...doc,referenceSourceId:referenceId},null,2),'application/json');write('Downloaded editable stroke data (reference photo not included).')}
 catch(error){write(error.message)}
});
by('import').addEventListener('change',async e=>{
 try{
  const f=e.target.files?.[0];if(!f)return;
  const data=JSON.parse(await f.text());validateDocument(data);snapshot();doc=data;selected=doc.strokes[0]?.id;referenceId=data.referenceSourceId||referenceId;
  by('source').value=referenceId;render();write('Imported document.');
 }catch(error){write('Import rejected: '+error.message)}e.target.value='';
});
by('svgexport').addEventListener('click',()=>{
 const data=simulateDocument(doc,{seed:by('seed').value}),paths=[];
 for(const s of doc.strokes){
  const d=ribbonForStroke(data.events.filter(e=>e.strokeId===s.id),{width:9});
  paths.push('<path fill="#26322c" d="'+d+'"/>');
 }
 download('skuf-study.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -30 400 200">'+paths.join('')+'</svg>','image/svg+xml');
});
by('play').addEventListener('click',()=>{
 const events=simulateDocument(doc,{seed:by('seed').value}).events;
 if(!events.length)return;
 render();
 const layer=node('g');layer.style.pointerEvents='none';svg.append(layer);
 const start=performance.now(),total=events.at(-1).t,byStroke=new Map();
 for(const s of doc.strokes){const p=node('path',{fill:'none',stroke:'#1c4e43','stroke-width':5,'stroke-linecap':'round','stroke-linejoin':'round'});layer.append(p);byStroke.set(s.id,p)}
 function tick(now){
  const elapsed=(now-start)%Math.max(1,total+350),paths=new Map();
  for(const e of events){if(e.t>elapsed)break;if(e.contact&&e.strokeId){
   const before=paths.get(e.strokeId)||[];before.push([e.x,e.y]);paths.set(e.strokeId,before)}
  }
  for(const [id,path] of byStroke){const pts=paths.get(id)||[];path.setAttribute('d',pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' '))}
  by('timing').textContent=Math.floor(elapsed)+' / '+Math.floor(total)+' ms · replay';
  playFrame=requestAnimationFrame(tick);
 }
 playFrame=requestAnimationFrame(tick);
 write('Replaying time-based contact paths. Choose another control to stop.');
});
const selectSource=by('source');for(const s of SKUF_SOURCES){
 const o=document.createElement('option');o.value=s.id;o.textContent=s.publisher+' — '+s.title;selectSource.append(o);
 const article=document.createElement('article');
 const title=document.createElement('a');title.href=s.url;title.target='_blank';title.rel='noopener noreferrer';title.textContent=s.title;
 const paragraph=document.createElement('p');paragraph.textContent=s.category+' · '+s.priority+' priority. '+s.evidence+' Limitation: '+s.limitation;
 article.append(title,paragraph);by('sources').append(article);
}
selectSource.value=referenceId;selectSource.addEventListener('change',()=>{referenceId=selectSource.value;write('Reference selected; use its link to obtain a photograph you have rights to inspect locally.')});
updateCoverage();
render();write('This is an unapproved reconstructed sketch. Load an actual tag photograph to start a source-led revision.');
