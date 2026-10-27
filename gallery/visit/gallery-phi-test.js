// Staging-only reception furnishing refinements.
globalThis.__phiReceptionTestRefresh=true;
globalThis.__phiReceptionTilePreview=true;
await import('./gallery-phi.js?v=reflecting-pool-20261027');
const plantStatus=document.createElement('div');
plantStatus.id='staging-plant-check';
plantStatus.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;background:#18312a;color:#fff;padding:9px 12px;border-radius:6px;font:13px system-ui;box-shadow:0 2px 12px #0007;pointer-events:none';
plantStatus.textContent='Plant check: looking for square geometry…';
document.body.appendChild(plantStatus);
let checks=0;
const checkPlants=setInterval(()=>{
 const d=globalThis.__phiSquarePlantDiagnostics;
 if(d){
  plantStatus.textContent='Plant check: '+d.tallStems+' tall stems created ('+d.plantedBeds+' beds)';
  plantStatus.style.background=d.tallStems>0?'#18312a':'#74312a';
  clearInterval(checkPlants);
 }else if(++checks>=30){
  plantStatus.textContent='Plant check: square geometry not detected';
  plantStatus.style.background='#74312a';
  clearInterval(checkPlants);
 }
},1000);

