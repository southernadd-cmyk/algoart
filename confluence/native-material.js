// Real released tissue V7 and watercolour V2S treatments, applied to the
// transformed marks of ONE Confluence turn. Unlike the former simplified
// ribbon shims, this calls the solo material's actual pigment, paper-flow,
// tissue/graphite and finish passes. A matched blank pass removes the paper
// so multiple artists can share one sheet without opaque pasted rectangles.
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
const rgbString=rgb=>'rgb('+rgb.join(',')+')';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Tissue V7 is painted against an opaque cream paper model. A small RGB
// difference is a light translucent wash, NOT nearly opaque cream paint.
// Use the subtractive pigment density to recover its low-alpha layer and
// ignore positive paper highlights that would make white halos over ink.
export function tissuePigmentAlpha(red,green,blue,paperRed,paperGreen,paperBlue){
  const absorption=Math.max(0,paperRed-red,paperGreen-green,paperBlue-blue);
  return clamp((absorption-2)/115,0,1);
}
// A finite native material pass is cropped to an offscreen tile for speed.
// Any pigment reaching its artificial tile edge must taper to zero before
// compositing. Do not fade edges that coincide with the real paper boundary.
export function cropEdgeFeather(x,y,w,h,area,sheet,feather=72){
  let distance=Infinity;
  if(area.x>0)distance=Math.min(distance,x);
  if(area.y>0)distance=Math.min(distance,y);
  if(area.x+area.w<sheet.width)distance=Math.min(distance,w-1-x);
  if(area.y+area.h<sheet.height)distance=Math.min(distance,h-1-y);
  if(distance===Infinity)return 1;
  const t=clamp(distance/feather,0,1);
  return t*t*(3-2*t);
}


// This is the actual solo oil-render.js skeleton, not a simplified
// Confluence trace adapter. The solo script is cloned with one export only.
function makeChains(traces,area,artist,inkRGB,material,kit){
  const paths=[];
  for(const trace of traces){
    const points=trace.points||[];
    if(points.length<2)continue;
    const ink=trace.ink||artist.inks?.[(trace.mark-1)%artist.inks.length];
    if(!ink)continue;
    const rgb=inkRGB(ink);
    const d=points.map((p,i)=>(i?'L':'M')+
      (p.x-area.x).toFixed(3)+' '+(p.y-area.y).toFixed(3)).join(' ');
    paths.push({d,stroke:rgbString(rgb),width:trace.width,
      opacity:trace.opacity??1,mark:trace.mark,pass:0});
  }
  const A=window.AlgoArt;
  if(typeof A.confluenceSoloSkeleton!=='function')
    throw new Error('Confluence requires solo oil-render.js skeleton');
  const previous=A.watercolourV2sActive;
  try{
    if(material==='watercolour')A.watercolourV2sActive=true;
    const chains=A.confluenceSoloSkeleton(paths,
      material==='watercolour'?Math.min(700,paths.length):250,kit);
    return {paths,chains};
  }finally{
    A.watercolourV2sActive=previous;
  }
}
function invoke(A,ctx,material,chains,meta,seed,kit){
  if(material==='tissue'){
    // Enable the approved pencil overlay already present in the material
    // engine. V7 normally disables it, which made Confluence's Tissue &
    // Graphite appear almost entirely like diffuse spray-painted colour.
    const previous=A.confluenceTissueGraphite;
    try{
      A.confluenceTissueGraphite=true;
      A.oilMaterial(ctx,ctx.canvas.width,ctx.canvas.height,chains,meta,seed,1,kit);
    }finally{A.confluenceTissueGraphite=previous;}
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

export function renderNativeDeposit(ctx,material,traces,artist,area,paper,seed,inkRGB,sheet,options={}){
  const A=window.AlgoArt;
  if(!A?.oilMaterial||!A?.watercolourV2sMaterial||!A?.tissueKitFromPaths)
    throw new Error('Confluence requires the released tissue/watercolour renderers');
  if(material!=='tissue'&&material!=='watercolour')throw new Error('Unsupported native material');
  // V7 and V2S require the same stroke kit and ranking as solo mode.
  const paths=traces.map(t=>({stroke:rgbString(inkRGB(
    t.ink||artist.inks?.[(t.mark-1)%artist.inks.length]||'#252525'))}));
  const kit=A.tissueKitFromPaths(paths,{paper,
      colourCount:artist.settings.colourCount},material==='tissue'?7:6);
  const {chains}=makeChains(traces,area,artist,inkRGB,material,kit);
  if(!chains.length)return;
  const w=ctx.canvas.width,h=ctx.canvas.height;
  const meta={voids:[]};
  // When every artist uses this material, there is no second paper layer:
  // paint directly, identically to the solo engine, retaining every fibre,
  // pencil groove, paper grain and atmospheric transition.
  if(options.directPaper===true){
    ctx.setTransform(1,0,0,1,0,0);
    invoke(A,ctx,material,chains,meta,seed,kit);
    return;
  }
  const blank=document.createElement('canvas');blank.width=w;blank.height=h;
  const background=blank.getContext('2d',{willReadFrequently:true});
  // Both passes share exactly the same seed, pigment kit and paper model.
  // No guessed flat-paper colour, hue replacement, blur or double-opacity.
  ctx.setTransform(1,0,0,1,0,0);
  invoke(A,background,material,[],meta,seed,kit);
  invoke(A,ctx,material,chains,meta,seed,kit);
  const data=ctx.getImageData(0,0,w,h);
  const reference=background.getImageData(0,0,w,h).data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=(y*w+x)*4;
    const contrast=Math.max(Math.abs(data.data[p]-reference[p]),
      Math.abs(data.data[p+1]-reference[p+1]),
      Math.abs(data.data[p+2]-reference[p+2]));
    // Separate actual pigment from the material's paper model, then feather
    // offscreen crop boundaries. Neither the pigment colours nor the artist's
    // responsive mark placement is replaced or flattened.
    const pigmentAlpha=material==='tissue'?
      tissuePigmentAlpha(data.data[p],data.data[p+1],data.data[p+2],
        reference[p],reference[p+1],reference[p+2]):
      clamp((contrast-2)/13,0,1);
    const edge=cropEdgeFeather(x,y,w,h,area,sheet);
    if(material==='tissue' && pigmentAlpha>0){
      // Recover the tissue pigment colour from the paper reference at the
      // inferred translucency. Dark graphite remains dense; diffuse tints
      // have low alpha, so earlier artists are visible through the wash.
      for(let c=0;c<3;c++)data.data[p+c]=Math.round(clamp(
        reference[p+c]+(data.data[p+c]-reference[p+c])/pigmentAlpha,0,255));
    }
    data.data[p+3]=Math.round(255*pigmentAlpha*edge);
  }
  ctx.putImageData(data,0,0);
}
