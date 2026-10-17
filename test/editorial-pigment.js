/* Read one pigment from the finished artwork, never from a fixed UI palette. */
(function(){
 'use strict';
 const canvas=document.getElementById('art'),overlay=document.getElementById('creatingOverlay');
 if(!canvas||!overlay)return;
 function refresh(){
  try{
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
   if(!w||!h)return;
   const candidates=[],stride=15;
   for(let y=Math.floor(h*.16);y<h*.84;y+=Math.max(1,Math.floor(h/stride)))
    for(let x=Math.floor(w*.12);x<w*.88;x+=Math.max(1,Math.floor(w/stride))){
     const v=ctx.getImageData(x,y,1,1).data;
     const max=Math.max(v[0],v[1],v[2]),min=Math.min(v[0],v[1],v[2]);
     if(max-min>45&&max>95&&min<190)candidates.push([v[0],v[1],v[2],max-min]);
    }
   if(!candidates.length)return;
   candidates.sort((a,b)=>b[3]-a[3]);
   const v=candidates[Math.floor(Math.min(candidates.length-1,4))];
   document.documentElement.style.setProperty('--pigment','rgb('+v.slice(0,3).join(',')+')');
  }catch(_){/* Rendering remains functional if sampling is restricted. */}
 }
 new MutationObserver(()=>{if(overlay.hidden)requestAnimationFrame(refresh)})
   .observe(overlay,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('load',()=>requestAnimationFrame(refresh),{once:true});
})();