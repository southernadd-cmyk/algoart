// Paper isolation shared by region tracing and Three.js artwork textures.
// Treat the original paper as negative space, NOT a pale sculptural material.
// Preserve coloured low-opacity paint when its chroma differs from the paper.
export function paperRGB(hex='#f5f0e6'){
  const h=String(hex).match(/^#([0-9a-f]{6})$/i)?.[1];
  return h?[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]:[245,240,230];
}
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const THRESHOLDS={
  marker:[30,50],tissue:[22,47],watercolour:[22,52],
  oil:[28,58],action:[29,56]
};
// Original artworks are JPEGs and their borders are not always numerically
// identical to the '#f5f0e6' paper selected in the generator. The border
// median reduces compression / colour-profile differences without treating
// a few edge-crossing marks as the paper itself.
export function estimatePaper(imageData,expected='#f5f0e6'){
  const {width:w,height:h,data}=imageData;
  const original=paperRGB(expected);
  if(!w||!h)return original;
  const channels=[[],[],[]],stride=Math.max(1,Math.floor(Math.max(w,h)/55));
  const side=Math.max(1,Math.floor(Math.min(w,h)*.035));
  for(let y=0;y<h;y+=stride)for(let x=0;x<w;x+=stride){
    if(x>side&&x<w-side-1&&y>side&&y<h-side-1)continue;
    const k=(y*w+x)*4;
    if(data[k+3]<160)continue;
    const diff=Math.max(
      Math.abs(data[k]-original[0]),Math.abs(data[k+1]-original[1]),
      Math.abs(data[k+2]-original[2]));
    // Very different border pixels are more likely to be artwork.
    if(diff>75)continue;
    for(let c=0;c<3;c++)channels[c].push(data[k+c]);
  }
  if(channels[0].length<10)return original;
  const med=channels.map(a=>{
    a.sort((x,y)=>x-y);
    return a[Math.floor(a.length/2)];
  });
  // Never let a heavily coloured page edge redefine a bright paper stock.
  return med.every((n,c)=>Math.abs(n-original[c])<=33)?med:original;
}
export function pigmentOpacity(r,g,b,paper,material='marker'){
  const max=Math.max(Math.abs(r-paper[0]),Math.abs(g-paper[1]),Math.abs(b-paper[2]));
  const chroma=Math.max(
    Math.abs((r-g)-(paper[0]-paper[1])),
    Math.abs((g-b)-(paper[1]-paper[2])));
  // Strong hue differences can reveal real pale colour washes; small
  // near-neutral deviations are mostly JPEG paper noise.
  const evidence=Math.max(max,chroma*.96);
  const [start,full]=THRESHOLDS[material]||THRESHOLDS.marker;
  if(evidence<=start)return 0;
  return clamp((evidence-start)/(full-start),0,1);
}
export function maskPaper(imageData,material='marker',paper='#f5f0e6',reference=null){
  const {data}=imageData,base=reference||estimatePaper(imageData,paper);
  for(let i=0;i<data.length;i+=4){
    const opacity=pigmentOpacity(data[i],data[i+1],data[i+2],base,material);
    data[i+3]=Math.round(data[i+3]*opacity);
  }
  return imageData;
}
