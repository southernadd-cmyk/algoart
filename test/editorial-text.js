/* Presentation-only captions for /test. The renderer and its metadata are unchanged. */
(function(){
 'use strict';
 const stats=document.getElementById('statsText'),fit=document.getElementById('phiSheetInfo');
 const modes={field:'Orbital Studies',spiral:'Golden Trajectories',rects:'Recursive Divisions',burst:'Radiant Systems',network:'Connected Fields',organic:'Growth Systems',geometric:'Constructed Forms',scribble:'Automatic Marks'};
 const materials={marker:'marker on paper',tissue:'tissue and graphite',watercolour:'watercolour',oil:'oil',action:'action painting'};
 function refresh(){
  const mode=document.getElementById('mode')?.value;
  const mat=document.getElementById('materialStyle')?.value;
  const seed=document.getElementById('seed')?.value;
  if(!stats||!mode||!seed)return;
  const caption=(modes[mode]||mode)+', '+(materials[mat]||mat)+'.\n'+seed;
  if(stats.textContent!==caption)stats.textContent=caption;
  if(fit)fit.hidden=true;
 }
 if(stats)new MutationObserver(refresh).observe(stats,{childList:true,characterData:true,subtree:true});
 if(fit)new MutationObserver(()=>{if(!fit.hidden)fit.hidden=true}).observe(fit,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('change',e=>{if(e.target?.id==='materialStyle'||e.target?.id==='mode')refresh()});
 window.addEventListener('load',refresh,{once:true});
})();