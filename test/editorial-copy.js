/* Editorial presentation of existing renderer metadata; source diagnostics remain available in Describe. */
(function(){
 const node=document.getElementById('statsText');if(!node)return;
 const titles={FIELD:'Orbital Studies',SPIRAL:'Golden Trajectories',RECTS:'Recursive Divisions',BURST:'Radiant Systems',NETWORK:'Connected Fields',ORGANIC:'Growth Systems',GEOMETRIC:'Constructed Forms',SCRIBBLE:'Automatic Marks'};
 let busy=false;
 new MutationObserver(()=>{
  if(busy)return;const original=node.textContent||'';
  if(!original.includes(' / ')||!original.includes('φ '))return;
  const parts=original.split(' / '),first=parts[0].split(' · ');
  const title=first[1]||titles[first[0]]||first[0];
  const material=parts.find(p=>/^(OIL PAINT|WATERCOLOUR|TISSUE & GRAPHITE)$/.test(p))||document.querySelector('#materialStyle')?.selectedOptions?.[0]?.textContent||'Marker';
  const seed=(parts.find(p=>/^[A-Z]{2}-/.test(p))||document.querySelector('#seed')?.value||'').trim();
  const nice=title.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())+', '+material.trim().toLowerCase()+'.'+(seed?'  '+seed:'');
  if(nice!==original){busy=true;node.textContent=nice;busy=false;}
 }).observe(node,{childList:true,characterData:true,subtree:true});
})();