// Confluence-only soft limit on accidental cumulative near-black paint.
// Adjust *new* translucent pigment before deposition. Do not recolour,
// brighten previous marks, or change the solo V7/V2S render engines.
const luma=(r,g,b)=>(.2126*r+.7152*g+.0722*b);
export function guardedAlpha(previousR,previousG,previousB,
    newR,newG,newB,alpha,mode='source-over',floor=64){
 const old=luma(previousR,previousG,previousB);
 if(old>=155||alpha<=0)return alpha; // fresh dark marks are not suppressed
 const incoming=luma(newR,newG,newB);
 const factor=mode==='multiply'?
   (previousR*.2126*newR+previousG*.7152*newG+previousB*.0722*newB)/255:
   incoming;
 const predicted=old+(factor-old)*alpha;
 if(predicted>=floor||factor>=old)return alpha;
 // Protect established darks from later glazes while leaving intentional
 // first-pass darks intact. A soft luma floor is a guard, not a recolour.
 return old<=floor?0:Math.max(0,Math.min(alpha,(old-floor)/(old-factor)));
}
export function protectPigmentStack(existing,incoming,mode='source-over',floor=64){
 const src=incoming.data||incoming,old=existing.data||existing;
 if(src.length!==old.length)throw Error('Dark-overlap guard needs equal-sized tiles');
 let adjusted=0;
 for(let i=0;i<src.length;i+=4){
   if(src[i+3]===0)continue;
   const alpha=src[i+3]/255;
   const safe=guardedAlpha(old[i],old[i+1],old[i+2],
     src[i],src[i+1],src[i+2],alpha,mode,floor);
   if(safe<alpha){
     src[i+3]=Math.round(safe*255);
     adjusted++;
   }
 }
 return adjusted;
}
