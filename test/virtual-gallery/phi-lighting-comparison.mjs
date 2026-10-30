// Test-tower experiment. Source lighting, meshes and artwork stay unchanged.
export const PHI=(1+Math.sqrt(5))/2;
export function planPhiRoomLighting(entries,toWorld=(x,z)=>({x,z})){
 const ranked=entries.map((entry,index)=>({entry,index})).sort((a,b)=>b.entry.cell.w*b.entry.cell.h-a.entry.cell.w*a.entry.cell.h||a.index-b.index);
 const primary=new Set(ranked.slice(0,Math.ceil(entries.length/2)).map(row=>row.index));
 const weights=entries.map((_,i)=>primary.has(i)?PHI:1);
 const total=entries.reduce((sum,entry)=>sum+entry.power,0);
 const scale=total/(weights.reduce((sum,w)=>sum+w,0)||1);
 return entries.map((entry,i)=>{
  const {cell}=entry;
  const fx=i%2?1/PHI:1-1/PHI, fz=1-fx;
  const point=toWorld(cell.x+cell.w*fx,cell.z+cell.h*fz);
  return {x:point.x,z:point.z,power:weights[i]*scale,primary:primary.has(i)};
 });
}
export function createPhiLightingComparison(){
 let entries=[],world=(x,z)=>({x,z}),mode='current',ready=false;
 const panel=document.createElement('fieldset');
 panel.id='phiLightingComparison';
 panel.innerHTML='<legend>Lighting study</legend><div class="phi-lighting-options"><button type="button" data-mode="current" aria-pressed="true">Current</button><button type="button" data-mode="phi" aria-pressed="false">φ guided</button></div><p role="status" aria-live="polite"></p>';
 const style=document.createElement('style');
 style.textContent=`#phiLightingComparison{position:fixed;left:12px;bottom:76px;z-index:40;max-width:min(310px,calc(100vw - 48px));margin:0;padding:10px 14px;background:#f4f0e6f5;color:#252d28;border:1px solid #777e70;border-radius:8px;font:14px/1.4 system-ui,sans-serif}#phiLightingComparison legend{background:#f4f0e6;padding:0 6px;font-family:'AlgoArt Marker',sans-serif;font-size:20px}#phiLightingComparison p{margin:8px 0 0;font-size:12px}#phiLightingComparison .phi-lighting-options{display:flex;gap:8px}#phiLightingComparison button{cursor:pointer;border:1px solid #616d60;border-radius:5px;padding:7px 14px;background:#faf8f1;color:#25372f;font:inherit}#phiLightingComparison button[aria-pressed=true]{background:#30483c;color:#fff}#phiLightingComparison button:focus-visible{outline:3px solid #aa751d;outline-offset:2px}#phiLightingComparison:has(button:disabled){opacity:.85}@media(max-width:600px){#phiLightingComparison{bottom:auto;top:calc(var(--gallery-ui-bottom,150px) + 8px);padding:6px 10px;max-width:260px}#phiLightingComparison legend{font-size:17px}#phiLightingComparison p{font-size:11px}}`;
 document.head.append(style);document.body.append(panel);
 function apply(){
  const variants=planPhiRoomLighting(entries,world);
  entries.forEach((entry,i)=>{
   if(!entry.original)return;
   const variant=variants[i],original=entry.original;
   const dx=mode==='phi'?variant.x-original.light.x:0;
   const dz=mode==='phi'?variant.z-original.light.z:0;
   for(const [object,key] of [[entry.light,'light'],[entry.light.target,'target'],[entry.mount,'mount'],[entry.fallback,'fallback']]){
    object.position.copy(original[key]);object.position.x+=dx;object.position.z+=dz;
    object.updateMatrixWorld(true);
   }
   entry.light.intensity=mode==='phi'?variant.power:entry.power;
  });
  const count=entries.length;
  for(const button of panel.querySelectorAll('button')){
   button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
   button.disabled=!ready||count===0;
  }
  panel.querySelector('p').textContent=!ready?'Preparing lighting…':!count?'Take the lift to a gallery floor to compare lighting.':mode==='phi'
   ?`${count} room lights · golden-division positions · 1:φ room balance. Same total intensity settings.`
   :`${count} room lights · original positions and balance. Switch while standing in the same place.`;
 }
 const api={
  reset(){entries=[];ready=false;apply();},
  register(entry){entries.push(entry);},
  finish(transform){
   world=transform?.toWorld||((x,z)=>({x,z}));ready=true;
   for(const entry of entries)entry.original={light:entry.light.position.clone(),target:entry.light.target.position.clone(),mount:entry.mount.position.clone(),fallback:entry.fallback.position.clone()};
   apply();
  },
  setMode(value){if(value!=='current'&&value!=='phi')throw Error('Unknown lighting mode');mode=value;apply();},
  inspect(){return {mode,ready,count:entries.length,totalPower:entries.reduce((sum,e)=>sum+e.light.intensity,0),lights:entries.map(e=>({position:e.light.position.toArray(),target:e.light.target.position.toArray(),power:e.light.intensity,shadow:e.light.castShadow}))};}
 };
 for(const button of panel.querySelectorAll('button'))button.addEventListener('click',()=>api.setMode(button.dataset.mode));
 // Keyboard works while the canvas owns pointer lock, without moving the camera.
 window.addEventListener('keydown',event=>{
  if(event.code!=='KeyB'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)||!ready||!entries.length)return;
  event.preventDefault();api.setMode(mode==='phi'?'current':'phi');
 });
 panel.title='Press B to compare lighting while walking. φ divides each room’s main ceiling rectangle at 38.2% and 61.8%. Larger rooms receive the primary intensity. Settings sum equally; this does not imply equal perceived brightness.';
 globalThis.__phiLightingComparison=api;apply();return api;
}
