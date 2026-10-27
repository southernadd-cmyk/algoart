// Staging-only reception furnishing refinements.
globalThis.__phiReceptionTestRefresh=true;
globalThis.__phiReceptionTilePreview=true;
await import('./gallery-phi.js?v=music-controls-only-20261027');
// Inspect in DevTools as window.__phiPerformance and window.__phiPoolPerf.
 // A compact on-screen display is opt-in with ?perf=1.
if(new URLSearchParams(location.search).has('perf')){
 const monitor=document.createElement('div');
 monitor.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;color:#eaf5f1;background:#142924e8;padding:8px 12px;border-radius:6px;pointer-events:none;font:12px/1.5 monospace;white-space:pre';
 document.body.appendChild(monitor);
 setInterval(()=>{
  const d=window.__phiPerformance;
  monitor.textContent=d?.fps
   ?'FPS '+d.fps+' | p95 '+d.p95FrameMs+'ms | DPR '+d.pixelRatio+'\\nDraws '+d.drawCalls+' | Triangles '+d.triangles+' | Textures '+d.textures+'\\nPool '+(d.pool?.averagePassMs??'—')+'ms avg / '+(d.pool?.passes??0)+' passes'
   :'Collecting frame samples…';
 },1500);
}
