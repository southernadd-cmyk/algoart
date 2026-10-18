// Marker-drawn sketches of Threads' @-spiral and Bluesky's butterfly.
// Both are inked with ALGO/ART's ACTUAL marker stroke engine, A.stroke,
// not downloaded brand images, SVG fonts or AI-generated replacements.
(function(A){
 'use strict';
 function bezier(a,b,c,d,n){
   const out=[];
   for(let i=0;i<=n;i++){
     const t=i/n,u=1-t;
     out.push({
       x:u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
       y:u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]
     });
   }
   return out;
 }
 function combine(){
   let p=[];
   for(const section of arguments){
     p=p.concat(p.length?section.slice(1):section);
   }
   return p;
 }
 const instagram=[
   combine(bezier([17,9],[10,9],[9,15],[9,22],12),bezier([9,22],[9,34],[9,42],[9,48],14),bezier([9,48],[9,55],[15,56],[22,56],12),bezier([22,56],[35,56],[43,56],[48,56],12),bezier([48,56],[55,56],[56,49],[56,42],12),bezier([56,42],[56,30],[56,22],[56,17],12),bezier([56,17],[56,10],[49,9],[42,9],12),bezier([42,9],[31,9],[24,9],[17,9],12)),
   combine(bezier([32,21],[18,21],[17,42],[32,43],24),bezier([32,43],[47,43],[47,21],[32,21],24)),
   bezier([46,17],[46,17],[47,18],[47,18],3)
 ];
 const threads=[
   combine(
     bezier([53,27],[49,13],[39,10],[30,10],17),
     bezier([30,10],[12,10],[10,24],[11,36],18),
     bezier([11,36],[12,52],[28,57],[40,51],18),
     bezier([40,51],[55,44],[54,29],[41,26],18)
   ),
   combine(
     bezier([44,29],[35,23],[19,25],[20,35],16),
     bezier([20,35],[20,44],[38,45],[42,36],16),
     bezier([42,36],[47,23],[41,19],[32,19],13)
   )
 ];
 const leftUpper=combine(
   bezier([32,32],[18,12],[8,3],[8,17],14),
   bezier([8,17],[8,33],[21,40],[32,32],16)
 );
 const rightUpper=leftUpper.map(p=>({x:64-p.x,y:p.y})).reverse();
 const leftLower=combine(
   bezier([32,33],[20,33],[12,37],[17,47],13),
   bezier([17,47],[25,60],[30,46],[32,33],16)
 );
 const rightLower=leftLower.map(p=>({x:64-p.x,y:p.y})).reverse();
 const butterfly=[leftUpper,rightUpper,leftLower,rightLower,
   bezier([31.5,32],[30,39],[29,44],[26,47],12),
   bezier([32.5,32],[34,39],[35,44],[38,47],12)];
 function draw(canvas,kind){
   if(!canvas||!canvas.getContext||!A.stroke||!A.makeR)return false;
   const dpr=2;
   canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext('2d');
   ctx.clearRect(0,0,128,128);
   ctx.scale(dpr,dpr);
   const r=A.makeR('ALGOART-MARKER-SOCIAL-'+kind+'|V1');
   const settings={
     pen:'felt',thickness:3.4,overdraw:2,wobble:12,
     pressure:31,dryness:17,opacity:89
   };
   const ink=kind==='bluesky'?'#145cb6':'#161613';
   const paths=kind==='bluesky'?butterfly:kind==='instagram'?instagram:threads;
   const oldRecorder=A.svgRecorder;
   // Toolbar sketch marks must never enter an artwork's exported SVG.
   try{
     A.svgRecorder=null;
     for(const pts of paths)A.stroke(ctx,pts,ink,settings,r,false);
   }finally{A.svgRecorder=oldRecorder}
   return true;
 }
 A.drawSocialMarkerLogo=draw;
 A.drawSocialMarkerIcons=function(){
   document.querySelectorAll('canvas[data-social-marker]').forEach(
     el=>draw(el,el.dataset.socialMarker));
 };
 A.drawSocialMarkerIcons();
})(window.AlgoArt);
