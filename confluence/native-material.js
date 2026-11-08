// Real released tissue V7 and watercolour V2S treatments, applied to the
// transformed marks of ONE Confluence turn. Unlike the former simplified
// ribbon shims, this calls the solo material's actual pigment, paper-flow,
// tissue/graphite and finish passes. A matched blank pass removes the paper
// so multiple artists can share one sheet without opaque pasted rectangles.
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
const rgbString=rgb=>'rgb('+rgb.join(',')+')';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function makeChains(traces,area,artist,inkRGB){
  const paths=[],chains=[];
  for(const [i,t] of traces.entries()){
    const points=t.points.map(p=>({x:p.x-area.x,y:p.y-area.y}));
    if(points.length<2)continue;
    const rgb=inkRGB(artist.inks[(t.mark-1)%artist.inks.length]);
    const stroke=rgbString(rgb);
    paths.push({stroke,width:t.width});
    const length=points.slice(1).reduce((total,p,j)=>total+distance(p,points[j]),0);
    chains.push({pts:points,length,width:t.width,sourceRGB:rgb,sourceInk:stroke,sourceIndex:i});
  }
  return {paths,chains};
}
function invoke(A,ctx,material,chains,meta,seed,kit){
  if(material==='tissue'){
    A.oilMaterial(ctx,ctx.canvas.width,ctx.canvas.height,chains,meta,seed,1,kit);
    return;
  }
  // New V2S: source geometry and hue stay exactly where the responding
  // artist placed them. Temporarily opt out of historical fit-to-sheet.
  const options=A.watercolourV2sOptions;
  const previousFit=options.fitToSheet;
  const previousActive=A.watercolourV2sActive;
  const previousChains=A.watercolourV2sAllChains;
  try{
    options.fitToSheet=false;
    A.watercolourV2sActive=true;
    A.watercolourV2sAllChains=chains;
    A.watercolourV2sMaterial(ctx,ctx.canvas.width,ctx.canvas.height,
      chains,meta,seed,1,kit);
  }finally{
    options.fitToSheet=previousFit;
    A.watercolourV2sActive=previousActive;
    A.watercolourV2sAllChains=previousChains;
  }
}

export function renderNativeDeposit(ctx,material,traces,artist,area,paper,seed,inkRGB){
  const A=window.AlgoArt;
  if(!A?.oilMaterial||!A?.watercolourV2sMaterial||!A?.tissueKitFromPaths)
    throw new Error('Confluence requires the released tissue/watercolour renderers');
  if(material!=='tissue'&&material!=='watercolour')throw new Error('Unsupported native material');
  const {paths,chains}=makeChains(traces,area,artist,inkRGB);
  if(!chains.length)return;
  const w=ctx.canvas.width,h=ctx.canvas.height;
  const kit=A.tissueKitFromPaths(paths,{paper,colourCount:artist.settings.colourCount},
    material==='tissue'?7:6);
  const meta={voids:[]};
  const blank=document.createElement('canvas');blank.width=w;blank.height=h;
  const background=blank.getContext('2d',{willReadFrequently:true});
  // Both passes share exactly the same seed, pigment kit and paper model.
  // No guessed flat-paper colour, hue replacement, blur or double-opacity.
  ctx.setTransform(1,0,0,1,0,0);
  invoke(A,background,material,[],meta,seed,kit);
  invoke(A,ctx,material,chains,meta,seed,kit);
  const data=ctx.getImageData(0,0,w,h);
  const reference=background.getImageData(0,0,w,h).data;
  for(let p=0;p<data.data.length;p+=4){
    const contrast=Math.max(Math.abs(data.data[p]-reference[p]),
      Math.abs(data.data[p+1]-reference[p+1]),
      Math.abs(data.data[p+2]-reference[p+2]));
    // Keep delicate wicks/fibres, while excluding subtle differences in
    // the two genuine paper renders outside pigment coverage.
    const alpha=Math.round(clamp((contrast-2)*255/13,0,255));
    data.data[p+3]=alpha;
  }
  ctx.putImageData(data,0,0);
}
