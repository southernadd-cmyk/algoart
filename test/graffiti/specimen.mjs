import {HANDS,CORE_HANDS,LETTERING_FORMS,REFERENCE_STUDIES,HANDSTYLE_SOURCE,createTag,drawTag,planFloorTags,normaliseText,makeRandom,tagDuration} from './tag-engine.mjs?v=sprayed-throwups-v7';
import {drawConstruction} from './phi-lettering.mjs?v=phi-handstyles-v2';
const $=id=>document.getElementById(id),canvas=$('wall'),ctx=canvas.getContext('2d');
const inkLayer=document.createElement('canvas');
const inkCtx=inkLayer.getContext('2d',{willReadFrequently:true});
let plan=[],tags=[],frame=0,playing=false,started=0,elapsed=0,token=0,scan=null,mainWall=null,currentProgress=1;
let studyPage=0;
const studyIds=Object.keys(REFERENCE_STUDIES),pageSize=6;
const featuredIds=['guess','faust','revok','kadism','zephyr','gorey','skofe','skuf'];
const surfaceCache=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const readOptions=()=>({seed:$('seed').value.trim()||'PP-GRAFFITI-01',text:$('word').value,hand:$('hand').value,form:$('form').value,ink:$('ink').value,finish:$('paint').value,paintWidth:Math.max(.75,Math.min(3,(Number($('width').value)||200)/100)),floorId:'specimen-floor-'+Math.min(9999,Math.max(1,Math.floor(Number($('floor').value)||1)))});
function fallbackTile(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),r=makeRandom('PP-BRICK-FALLBACK');g.fillStyle='#aa9e8b';g.fillRect(0,0,512,512);
 for(let row=0;row<16;row++)for(let col=-1;col<9;col++){
  const x=col*64+(row%2)*32+2,y=row*32+2,v=r.int(-10,10);g.fillStyle=`rgb(${181+v},${161+v},${134+v})`;g.fillRect(x,y,60,28);
  g.fillStyle='rgba(255,255,240,.1)';g.fillRect(x,y,60,1);g.fillStyle='rgba(45,35,25,.12)';g.fillRect(x,y+27,60,1);
 }
 const data=g.getImageData(0,0,512,512);for(let i=0;i<data.data.length;i+=4){const n=r.range(-9,9);for(let k=0;k<3;k++)data.data[i+k]+=n;}g.putImageData(data,0,0);return c;
}
function prepareScan(image){
 const c=document.createElement('canvas');c.width=c.height=768;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,768,768);
 const data=g.getImageData(0,0,768,768),d=data.data;
 // Match gallery/visit/architectural-materials.mjs's buff brick tint.
 for(let i=0;i<d.length;i+=4){const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];d[i]=166+(l-120)*.35;d[i+1]=146+(l-120)*.34;d[i+2]=122+(l-120)*.31;}
 g.putImageData(data,0,0);return c;
}
function makeWall(width,height){
 const key=width+'x'+height;if(surfaceCache.has(key))return surfaceCache.get(key);
 const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d',{willReadFrequently:true});
 g.save();const tileSize=width/2.25;g.scale(tileSize/scan.width,tileSize/scan.height);g.fillStyle=g.createPattern(scan,'repeat');g.fillRect(0,0,width*scan.width/tileSize,height*scan.height/tileSize);g.restore();
 const base=g.getImageData(0,0,width,height),mask=new Uint8Array(width*height),d=base.data;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
  const light=.99+.07*(1-x/width)-.11*(y/height)**2;
  for(let k=0;k<3;k++)d[i+k]*=light;
  const grain=((Math.imul(x+31,73856093)^Math.imul(y+17,19349663))>>>9)&255;
  // Broad, shallow pores interrupt the ink; mortar subtly changes its deposit.
  mask[y*width+x]=Math.max(0,Math.min(255,215+(l-140)*.45+(grain-128)*.19));
 }
 g.putImageData(base,0,0);
 const wall={canvas:c,mask,width,height};surfaceCache.set(key,wall);return wall;
}
function positionTag(g,target,tag,placement,count,index,draw){
 const stacked=target.height>target.width*.7&&count===2;
 const place=stacked?{...placement,x:.5,y:index===0?.28:.72}:placement,b=tag.bounds;
 const maxW=target.width*(count===1||stacked?.72:.405),maxH=target.height*(place.maxHeight??(stacked?.32:.48));
 const scale=Math.min(maxW/b.width,maxH/b.height)*place.scale;
 g.save();g.translate(place.x*target.width,place.y*target.height);g.rotate(place.rotation);g.scale(scale,scale);g.translate(-b.x-b.width/2,-b.y-b.height/2);draw();g.restore();
}
function paintWall(target,tagList,placements,progress=1){
 const g=target.getContext('2d'),wall=makeWall(target.width,target.height);g.clearRect(0,0,target.width,target.height);g.drawImage(wall.canvas,0,0);
 if(inkLayer.width!==target.width||inkLayer.height!==target.height){inkLayer.width=target.width;inkLayer.height=target.height;}else inkCtx.clearRect(0,0,target.width,target.height);
 const total=tagList.reduce((n,t)=>n+tagDuration(t),0);let used=0;
 tagList.forEach((tag,i)=>{
  const duration=tagDuration(tag),portion=Math.max(0,Math.min(1,(total*progress-used)/duration));used+=duration;if(!portion)return;
  positionTag(inkCtx,target,tag,placements[i],tagList.length,i,()=>drawTag(inkCtx,tag,{progress:portion,finish:$('paint').value}));
 });
 const image=inkCtx.getImageData(0,0,target.width,target.height),data=image.data;
 for(let i=0;i<wall.mask.length;i++)if(data[i*4+3])data[i*4+3]=data[i*4+3]*wall.mask[i]/255;
 inkCtx.putImageData(image,0,0);
 // All ink is lit by the wall; no shadow, outline rectangle or floating plane.
 g.drawImage(inkLayer,0,0);
 if(target===canvas&&$('show-phi').checked)tagList.forEach((tag,i)=>positionTag(g,target,tag,placements[i],tagList.length,i,()=>drawConstruction(g,tag)));
 return wall;
}
function stop(){cancelAnimationFrame(frame);playing=false;token++;$('play').textContent='Watch it being written';}
function render(progress=1){currentProgress=progress;mainWall=paintWall(canvas,tags,plan,progress);$('progress').style.width=(progress*100)+'%';}
function updateURL(){
 const url=new URL(location.href),o=readOptions();url.searchParams.set('word',normaliseText(o.text));url.searchParams.set('seed',o.seed);url.searchParams.set('floor',$('floor').value);url.searchParams.set('hand',o.hand);url.searchParams.set('form',o.form);url.searchParams.set('ink',o.ink);url.searchParams.set('finish',o.finish);url.searchParams.set('width',o.paintWidth);if($('show-phi').checked)url.searchParams.set('phi','1');else url.searchParams.delete('phi');history.replaceState(null,'',url);
}
function generate({url=true}={}){
 stop();const small=matchMedia('(max-width:700px)').matches;canvas.width=small?1000:1600;canvas.height=small?920:800;
 const raw=$('word').value,clean=normaliseText(raw);$('word').value=clean;$('floor').value=Math.min(9999,Math.max(1,Math.floor(Number($('floor').value)||1)));if(!$('seed').value.trim())$('seed').value='PP-GRAFFITI-01';
 const options=readOptions();$('width-value').textContent=options.paintWidth.toFixed(2).replace(/0$/,'')+'×';plan=planFloorTags(options);tags=plan.map(p=>createTag(p.text,{...p,paintWidth:options.paintWidth}));render();elapsed=0;
 $('previous').disabled=Number($('floor').value)<=1;$('next').disabled=Number($('floor').value)>=9999;
 $('floor-caption').textContent='Floor '+$('floor').value+' · '+(tags.length===1?'one tag':'two tags')+' · '+tags.map(t=>LETTERING_FORMS[t.form].name).join(' / ');
 canvas.setAttribute('aria-label','Floor '+$('floor').value+': '+tags.map(t=>t.text+' in '+LETTERING_FORMS[t.form].name+' lettering').join('; ')+', on a buff brick wall.');
 $('status').textContent=(raw!==clean?'Text adjusted to the supported characters. ':'')+'Same seed and floor, same tags. Every floor receives one or two.';
 $('finish-caption').textContent=options.finish==='spray'?'Soft spray edges and scattered droplets follow the brick.':'Ink follows the brick grain and mortar.';
 const m=tags[0].construction.metrics;
 $('phi-measurements').textContent='At a height of '+m.height+' units, the letter frame is '+m.width.toFixed(2)+' units wide. Its bowl divisions are '+m.short.toFixed(2)+' and '+m.long.toFixed(2)+' units. Each writer then leans, compresses and varies that structure.';
 for(const hand of Object.keys(CORE_HANDS)){
  const tag=createTag(clean||'PHI',{seed:options.seed,hand,ink:options.ink==='mixed'?'#242a28':options.ink,paintWidth:options.paintWidth});
  paintWall($(hand+'-wall'),[tag],[{x:.5,y:.55,scale:.94,rotation:-.025}]);
 }
 renderForms();renderFeatured();renderStudies();
 if(url)updateURL();
}
function renderForms(){
 const options=readOptions(),grid=$('form-grid');grid.replaceChildren();
 for(const [id,style] of Object.entries(LETTERING_FORMS)){
  const article=document.createElement('article');article.className='hand';
  const c=document.createElement('canvas');c.width=900;c.height=400;c.setAttribute('role','img');c.setAttribute('aria-label',style.name+' on brick');
  const title=document.createElement('h3');title.textContent=style.name;
  const description=document.createElement('p');description.textContent=style.description;
  const button=document.createElement('button');button.type='button';button.textContent='Use this lettering';button.dataset.form=id;button.onclick=()=>{$('form').value=id;generate();};
  article.append(c,title,description,button);grid.append(article);
  const hand=options.hand==='mixed'?'loop':options.hand;
  const tag=createTag(normaliseText(options.text)||'ECHO',{seed:options.seed,form:id,hand,ink:options.ink==='mixed'?'#242a28':options.ink,paintWidth:options.paintWidth});
  paintWall(c,[tag],[{x:.5,y:.52,scale:1.05,maxHeight:.64,rotation:-.018}]);
 }
}
function renderFeatured(){
 const options=readOptions(),grid=$('featured-grid');grid.replaceChildren();
 for(const id of featuredIds){
  const study=REFERENCE_STUDIES[id],article=document.createElement('article');article.className='hand';
  const c=document.createElement('canvas');c.width=720;c.height=380;c.setAttribute('role','img');c.setAttribute('aria-label',study.reference+' revised handwriting study on brick');
  const title=document.createElement('h3');title.textContent=study.reference;
  const description=document.createElement('p');description.textContent=study.description;
  const button=document.createElement('button');button.type='button';button.textContent='Use this hand';button.onclick=()=>{$('hand').value=id;generate();window.scrollTo({top:0,behavior:'smooth'});};
  article.append(c,title,description,button);grid.append(article);
  const tag=createTag(normaliseText(options.text)||'ECHO',{seed:options.seed,hand:id,form:'handstyle',ink:options.ink==='mixed'?'#242a28':options.ink,paintWidth:options.paintWidth});
  paintWall(c,[tag],[{x:.5,y:.53,scale:.97,rotation:-.018}]);
 }
}
function renderStudies(){
 const options=readOptions(),start=studyPage*pageSize,grid=$('study-grid');grid.replaceChildren();
 for(const id of studyIds.slice(start,start+pageSize)){
  const study=REFERENCE_STUDIES[id],article=document.createElement('article');article.className='hand';
  const c=document.createElement('canvas');c.width=720;c.height=380;c.setAttribute('role','img');c.setAttribute('aria-label',study.reference+' procedural lettering study on brick');
  const title=document.createElement('h3');title.textContent=study.reference+' study';
  const description=document.createElement('p');description.textContent=study.description;
  const button=document.createElement('button');button.type='button';button.textContent='Use this study';button.dataset.study=id;button.onclick=()=>{$('hand').value=id;generate();};
  article.append(c,title,description,button);grid.append(article);
  const tag=createTag(normaliseText(options.text)||'ECHO',{seed:options.seed,hand:id,ink:options.ink==='mixed'?'#242a28':options.ink,paintWidth:options.paintWidth});paintWall(c,[tag],[{x:.5,y:.53,scale:.97,rotation:-.018}]);
 }
 $('study-range').textContent='Studies '+(start+1)+'–'+Math.min(start+pageSize,studyIds.length)+' of '+studyIds.length;
 $('studies-prev').disabled=studyPage===0;$('studies-next').disabled=start+pageSize>=studyIds.length;
 const selected=HANDS[$('hand').value];
 $('study-selection').textContent=$('form').value!=='handstyle'?"Lettering changes the construction and paint. Handwriting supplies the writer’s alphabet, proportions and rhythm.":selected?selected.name+' · '+selected.description+' New seeds vary the execution while keeping this hand’s habits.':'Choose a hand to compare its habits across seeds, or use Different writers to mix all 53 hands.';
}
function populateHands(){
 const forms=$('form');forms.replaceChildren(new Option('Different forms','mixed'));for(const [id,style] of Object.entries(LETTERING_FORMS))forms.append(new Option(style.name,id));
 const select=$('hand');select.replaceChildren(new Option('Different writers','mixed'));
 for(const [label,entries] of [['Original hands',CORE_HANDS],['Bombing Science — 50 reference studies',REFERENCE_STUDIES]]){
  const group=document.createElement('optgroup');group.label=label;
  for(const [id,hand] of Object.entries(entries))group.append(new Option(hand.name,id));select.append(group);
 }
}
function animate(){
 if(playing){stop();$('status').textContent='Writing paused. Press Watch it being written to continue.';return;}
 playing=true;const own=++token;started=performance.now()-elapsed;$('play').textContent='Pause writing';$('status').textContent='Following the writing rhythm: quick sweeps, slower turns and short pen lifts.';
 const duration=reduced?2600:6200;
 const tick=now=>{if(own!==token)return;elapsed=now-started;const progress=Math.min(1,elapsed/duration);render(progress);if(progress<1)frame=requestAnimationFrame(tick);else{stop();elapsed=0;$('status').textContent='Writing complete. These are the same strokes as the finished tag.';}};
 frame=requestAnimationFrame(tick);
}
function restoreURL(){
 const q=new URLSearchParams(location.search);for(const id of ['word','seed','floor','hand','form','ink'])if(q.has(id)){
  const value=q.get(id),el=$(id);if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===value))el.value=value;
 }
 const requestedWidth=Number(q.get('width'));if(q.has('width')&&Number.isFinite(requestedWidth))$('width').value=Math.round(Math.max(.75,Math.min(3,requestedWidth))*100);
 if(['spray','marker'].includes(q.get('finish')))$('paint').value=q.get('finish');
 $('show-phi').checked=q.get('phi')==='1';
}
async function init(){
 populateHands();restoreURL();scan=fallbackTile();generate({url:false});
 $('controls').addEventListener('submit',e=>{e.preventDefault();generate();});for(const id of ['word','seed','hand','form','ink','floor','paint'])$(id).addEventListener('change',()=>generate());
 $('studies-prev').onclick=()=>{studyPage=Math.max(0,studyPage-1);renderStudies();};$('studies-next').onclick=()=>{studyPage=Math.min(Math.ceil(studyIds.length/pageSize)-1,studyPage+1);renderStudies();};
 let widthFrame=0;$('width').addEventListener('input',()=>{cancelAnimationFrame(widthFrame);widthFrame=requestAnimationFrame(()=>generate());});$('width').addEventListener('change',()=>{cancelAnimationFrame(widthFrame);generate();});
 $('another').onclick=()=>{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);$('seed').value='PP-TAG-'+bytes[0].toString(36).toUpperCase();generate();};
 $('previous').onclick=()=>{$('floor').value=Number($('floor').value)-1;generate();};$('next').onclick=()=>{$('floor').value=Number($('floor').value)+1;generate();};
 $('play').onclick=animate;$('finish').onclick=()=>{stop();elapsed=0;render();$('status').textContent='Finished wall. Same seed and floor, same tags.';};
 $('show-phi').onchange=()=>{render(currentProgress);updateURL();};
 matchMedia('(max-width:700px)').addEventListener('change',()=>generate({url:false}));
 for(const button of document.querySelectorAll('[data-hand]'))button.onclick=()=>{$('hand').value=button.dataset.hand;generate();};
 const image=new Image();image.onload=()=>{try{scan=prepareScan(image);surfaceCache.clear();generate({url:false});document.documentElement.dataset.wall='scan';}catch(e){console.warn('Using the local procedural brick fallback.',e);}};image.onerror=()=>{document.documentElement.dataset.wall='fallback';};image.src='./assets/brick-wall.webp';
 // A small read-only hook makes determinism, counts and actual rendering
 // inspectable without relying on visually identical DOM text.
 window.graffitiSpecimen={get plan(){return structuredClone(plan);},get tags(){return structuredClone(tags);},get finish(){return $('paint').value;},get paintWidth(){return readOptions().paintWidth;},get formCount(){return Object.keys(LETTERING_FORMS).length;},get form(){return $('form').value;},get studyCount(){return studyIds.length;},get featuredHands(){return [...featuredIds];},get playing(){return playing;},get surface(){return mainWall?{width:mainWall.width,height:mainWall.height}:null;},generate};
}
init().catch(error=>{$('status').textContent='The wall could not be prepared: '+error.message;console.error(error);});
