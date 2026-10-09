// Mean channel differences use the 0-255 RGB scale; alpha is ignored because
// plotter previews and reference canvases both include opaque paper.
export const PIXEL_THRESHOLDS=Object.freeze({changed:24,severe:48});
export const PLOTTER_LIMITS=Object.freeze({
  // The measured maximum was 0.353/255. Leave roughly 2x mean headroom,
  // but independently bound both the moderate and severe error tails.
  fidelity:Object.freeze({mean:.75,changed:.002,severe:.001}),
  direction:Object.freeze({mean:.02,changed:.0001})
});
export function compareRGB(a,b,heat){
  if(a.length!==b.length||!a.length||a.length%4)throw Error('RGB image sizes disagree');
  if(heat&&heat.length!==a.length)throw Error('Diff image size disagrees');
  let sum=0,changed=0,severe=0;
  for(let i=0;i<a.length;i+=4){
    const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
    sum+=d;
    if(d>PIXEL_THRESHOLDS.changed)changed++;
    if(d>PIXEL_THRESHOLDS.severe)severe++;
    if(heat){
      heat[i]=Math.min(255,d*6);
      heat[i+1]=0;heat[i+2]=0;heat[i+3]=255;
    }
  }
  const pixels=a.length/4;
  return{mean:sum/pixels,changed:changed/pixels,severe:severe/pixels};
}
export function withinLimits(metrics,limits){
  return Object.entries(limits).every(([key,limit])=>
    Number.isFinite(metrics[key])&&metrics[key]>=0&&metrics[key]<=limit);
}
