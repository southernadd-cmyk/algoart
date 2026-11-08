import {artistInk, paint} from './collab.js?v=studio-06';
import {plannedPoints} from './mark-planner.js?v=studio-06';
import {renderNativeDeposit} from './native-material.js?v=confluence-wash-seams-07';

export const materials = {
  marker: 'Marker',
  tissue: 'Tissue & Graphite',
  watercolour: 'Watercolour',
  oil: 'Oil',
  action: 'Action Painting'
};

const SAMPLE = 12;
// Paint fibres and relief at the same physical pixel scale as the solo editor.
// Oil rendered at .7 previously lost the small bristle/tooth relief details.
const RESOLUTION = {tissue: 1, watercolour: 1, oil: 1, action: 1};

export function materialOpacity(opacity, pigmentGain) {
  // The per-material native routines already apply their own brush transparency.
  // Avoid multiplying that by another 77% default layer, which double-faded
  // tissue, watercolour, action and oil. Still honour the artist's Opacity
  // slider relative to its 77% neutral default.
  const normalized = Math.max(0, Math.min(1, opacity / 77));
  return Math.max(0, Math.min(1, normalized ** .85 * pigmentGain));
}

function layer(readback = false) {
  return document.createElement('canvas').getContext('2d', {willReadFrequently: readback});
}

function size(ctx, width, height) {
  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;
  ctx.resetTransform();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
}

// Native full-sheet material coverage feeds the response planner. It records
// *changes*, not the whole accumulated paint field again each turn.
function footprintFromSurface(ctx,sensor,previous,sheet){
  const w=Math.ceil(sheet.width/SAMPLE),h=Math.ceil(sheet.height/SAMPLE);
  size(sensor,w,h);
  sensor.drawImage(ctx.canvas,0,0,w,h);
  const image=sensor.getImageData(0,0,w,h).data;
  const next=new Uint8Array(w*h),footprint=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=x+y*w,alpha=image[i*4+3],delta=alpha-(previous?.[i]||0);
    next[i]=alpha;
    if(delta<18||((x+y)%2))continue;
    footprint.push({point:{x:(x+.5)*sheet.width/w,y:(y+.5)*sheet.height/h},
      angle:0,radius:Math.min(11,Math.max(2,delta/25)),
      opacity:Math.max(.08,delta/255)});
  }
  return {footprint,coverage:next};
}

export function makePainter(output, seed, sheet, {roster=[]} = {}) {
  const A = window.AlgoArt;
  let colourSample;
  const colours = new Map();
  const onlyMaterial=roster.length===3 && roster.every(a=>a.material===roster[0].material)
    ? roster[0].material : null;
  const surfacePasses={tissue:0,watercolour:0,oil:0,action:0};
  const coverageHistory={watercolour:null,oil:null,action:null};

  // Persistent full-paper context: all other materials retain their own
  // composition and blend modes while native tissue grows around them.
  const tissueMarks=[],watercolourMarks=[],oilMarks=[],actionMarks=[];
  const tissueSurface=layer(true),watercolourSurface=layer(true),
    oilSurface=layer(true),actionSurface=layer(true);
  const paintingWithoutTissue=layer(true),foreignInk=layer(true),watercolourForeignInk=layer(true);
  const surfaceSensor=layer(true);
  for(const ctx of [tissueSurface,watercolourSurface,oilSurface,actionSurface,
    paintingWithoutTissue,foreignInk,watercolourForeignInk])
    size(ctx,sheet.width,sheet.height);
  paintingWithoutTissue.drawImage(output.canvas,0,0);
  const oilActionOrder={oil:0,action:0};
  let oilActionClock=0;
  function showSheet(){
    output.save();
    output.resetTransform();output.globalAlpha=1;
    output.globalCompositeOperation='source-over';
    output.clearRect(0,0,sheet.width,sheet.height);
    if(onlyMaterial==='tissue'){
      output.drawImage(tissueSurface.canvas,0,0);
      output.restore();return;
    }
    if(onlyMaterial==='watercolour'){
      output.drawImage(watercolourSurface.canvas,0,0);
      output.restore();return;
    }
    output.drawImage(paintingWithoutTissue.canvas,0,0);
    output.globalCompositeOperation='multiply';
    output.drawImage(watercolourSurface.canvas,0,0);
    output.globalCompositeOperation='source-over';
    output.drawImage(tissueSurface.canvas,0,0);
    // Both paint materials use their full native layered engine. A later
    // action/oil turn can physically overpaint an earlier one.
    for(const kind of ['oil','action'].sort((a,b)=>oilActionOrder[a]-oilActionOrder[b])){
      if(kind==='oil')output.drawImage(oilSurface.canvas,0,0);
      else output.drawImage(actionSurface.canvas,0,0);
    }
    output.restore();
  }
  function protectGeometry(traces){
    for(const ctx of [foreignInk,watercolourForeignInk]){
      ctx.save();
      ctx.strokeStyle='#000';ctx.globalAlpha=.9;
      ctx.lineCap='round';ctx.lineJoin='round';
      for(const trace of traces){
        if(trace.points.length<2)continue;
        ctx.lineWidth=Math.max(16,trace.width*2.4);
        ctx.beginPath();ctx.moveTo(trace.points[0].x,trace.points[0].y);
        for(let i=1;i<trace.points.length;i++)
          ctx.lineTo(trace.points[i].x,trace.points[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function protectRaster(ctx,area){
    for(const mask of [foreignInk,watercolourForeignInk]){
      mask.save();
      mask.globalCompositeOperation='source-over';
      mask.drawImage(ctx.canvas,area.x,area.y,area.w,area.h);
      mask.restore();
    }
  }
  function protectWatercolourAgainstTissue(){
    // Tissue's shape is visible to subsequent watercolour artists, as well
    // as to the composition planner's response field.
    watercolourForeignInk.save();
    watercolourForeignInk.globalCompositeOperation='source-over';
    watercolourForeignInk.globalAlpha=.5;
    watercolourForeignInk.drawImage(tissueSurface.canvas,0,0);
    watercolourForeignInk.restore();
  }
  function materialFootprint(kind,ctx){
    const next=footprintFromSurface(ctx,surfaceSensor,coverageHistory[kind],sheet);
    coverageHistory[kind]=next.coverage;
    return next.footprint;
  }
  function avoidForeignMarks(ctx,mask=foreignInk){
    ctx.save();ctx.resetTransform();
    ctx.globalCompositeOperation='destination-out';
    ctx.filter='blur(15px)';
    ctx.drawImage(mask.canvas,0,0);
    ctx.restore();
  }
  function renderActualTissue(){
    if(!tissueMarks.length)return;
    // No approximated local scraps: V7 runs on every accumulated reactive
    // stroke in original artist colours, on the *whole* sheet at every turn.
    size(tissueSurface,sheet.width,sheet.height);
    const representative={settings:{colourCount:Math.min(24,
      new Set(tissueMarks.map(t=>t.ink)).size)}};
    const bounds={x:0,y:0,w:sheet.width,h:sheet.height};
    renderNativeDeposit(tissueSurface,'tissue',tissueMarks,representative,
      bounds,sheet.paper,[seed,'all-tissue-voices','v7-whole-sheet'].join('|'),
      sourceRGB,sheet,{directPaper:onlyMaterial==='tissue'});
    surfacePasses.tissue++;
    if(onlyMaterial!=='tissue')avoidForeignMarks(tissueSurface);
    showSheet();
  }
  function renderActualWatercolour(){
    if(!watercolourMarks.length)return;
    // Full-sheet V2S is re-run against every source stroke so wet pooling,
    // drying, bleed, ragged edges and original pigment hues are continuous
    // across *all* responsive artists. No local crop, no separate tiles.
    size(watercolourSurface,sheet.width,sheet.height);
    const representative={settings:{colourCount:Math.min(24,
      new Set(watercolourMarks.map(t=>t.ink)).size)}};
    const bounds={x:0,y:0,w:sheet.width,h:sheet.height};
    renderNativeDeposit(watercolourSurface,'watercolour',watercolourMarks,
      representative,bounds,sheet.paper,
      [seed,'all-watercolour-voices','v2s-whole-sheet'].join('|'),sourceRGB,
      sheet,{directPaper:onlyMaterial==='watercolour'});
    surfacePasses.watercolour++;
    if(onlyMaterial!=='watercolour')
      avoidForeignMarks(watercolourSurface,watercolourForeignInk);
    // The current paint footprint informs later tissue artists; it must
    // never be mistaken for opaque paper or a replacement composition.
    foreignInk.save();
    foreignInk.globalAlpha=.44;
    foreignInk.drawImage(watercolourSurface.canvas,0,0);
    foreignInk.restore();
    if(tissueMarks.length)avoidForeignMarks(tissueSurface);
    showSheet();
  }

  function tissueFootprint(traces,gain) {
    // This is the material-aware response field for the *next* artist, not
    // the final raster. Tissue broad pigment reaches beyond the pencil line.
    const footprint=[];
    for(const trace of traces){
      const points=trace.points,stride=Math.max(1,Math.floor(points.length/110));
      for(let i=0;i<points.length;i+=stride){
        const point=points[i],next=points[Math.min(points.length-1,i+1)];
        footprint.push({point,angle:Math.atan2(next.y-point.y,next.x-point.x),
          radius:Math.min(52,Math.max(21,trace.width*2.5)),
          opacity:Math.min(.85,Math.max(.18,gain*.56))});
      }
    }
    return footprint;
  }

  function sourceRGB(css) {
    if (!colours.has(css)) {
      colourSample ||= layer(true);
      size(colourSample, 1, 1);
      colourSample.fillStyle = css;
      colourSample.fillRect(0, 0, 1, 1);
      const pixels = colourSample.getImageData(0, 0, 1, 1).data;
      colours.set(css, Array.from(pixels.slice(0, 3)));
    }
    return colours.get(css);
  }

  // Format the responsive Confluence geometry as genuine marker source
  // paths, precisely the input type the solo Oil V8 and Action V4 use.
  const sourcePaths=traces=>traces.filter(t=>t.points.length>=2).map(t=>({
    d:t.points.map((p,i)=>(i?'L':'M')+p.x.toFixed(3)+' '+p.y.toFixed(3)).join(' '),
    stroke:t.ink,width:t.width,mark:t.mark,pass:0
  }));
  const sourceSettings=(marks,material)=>({
    ...marks[0]?.settings,
    // Artist seed must not overwrite the deterministic shared-paint seed.
    seed:[seed,'confluence',material].join('|'),
    mode:marks[0]?.system||'field',orientation:sheet.orientation,
    paper:sheet.paper,palette:marks[0]?.palette||'spectrum',
    colourCount:Math.min(14,new Set(marks.map(m=>m.ink)).size)
  });
  function reserveForOtherArtists(ctx){
    protectRaster(ctx,{x:0,y:0,w:sheet.width,h:sheet.height});
    if(tissueMarks.length)avoidForeignMarks(tissueSurface);
    if(watercolourMarks.length&&onlyMaterial!=='watercolour')
      avoidForeignMarks(watercolourSurface,watercolourForeignInk);
  }
  function renderActualOil(){
    if(!oilMarks.length)return;
    if(typeof A.renderOilPaintV8!=='function' ||
       typeof A.compositionV5Test?.extract!=='function')
      throw new Error('Confluence requires the complete solo Oil V8 source planner');
    const paths=sourcePaths(oilMarks),settings=sourceSettings(oilMarks,'oil');
    const capture={paths,meta:{guide:{type:'confluence'},voids:[],
      strategy:'collaborative-responsive'},
      chains:A.compositionV5Test.extract(paths)};
    A.renderOilPaintV8(oilSurface.canvas,settings,1,false,{
      masses:true,relief:true,weave:true,amount:.6,
      sourceCapture:capture,transparentSheet:true});
    surfacePasses.oil++;oilActionOrder.oil=++oilActionClock;
    reserveForOtherArtists(oilSurface);
    showSheet();
  }
  function renderActualAction(){
    if(!actionMarks.length)return;
    if(typeof A.actionPaintingFromPathsV4!=='function')
      throw new Error('Confluence requires the complete solo Action V4 engine');
    const paths=sourcePaths(actionMarks),settings=sourceSettings(actionMarks,'action');
    const originalInks=[...new Set(actionMarks.map(m=>m.ink))];
    A.actionPaintingFromPathsV4(actionSurface.canvas,paths,settings,1,{
      sourceInks:originalInks,transparentSheet:true});
    surfacePasses.action++;oilActionOrder.action=++oilActionClock;
    reserveForOtherArtists(actionSurface);
    showSheet();
  }

  function deposit(action, observe) {
    const {artist, group, placement, plans} = action;
    const material = artist.material;
    const {opacity, overdraw, dryness} = artist.settings;
    if (material === 'marker') {
      paint(paintingWithoutTissue, action);
      // Marker is visible in true turn order and also reserves the paper
      // from future spreading tissue, rather than being painted over.
      protectGeometry(group.traces.map(trace=>({...trace,
        points:plannedPoints(trace.points,placement,plans.get(trace.mark))})));
      if(tissueMarks.length)avoidForeignMarks(tissueSurface);
      if(watercolourMarks.length)avoidForeignMarks(watercolourSurface,watercolourForeignInk);
      showSheet();
      return;
    }

    let traces = group.traces.map(trace => ({...trace, points: plannedPoints(trace.points, placement, plans.get(trace.mark))}));
    if (material === 'tissue') {
      // Preserve exactly which artist supplied each stroke and its original
      // palette hue. A single V7 material surface can then combine the marks
      // of all three artists without reintroducing per-artist cloud fields.
      for(const trace of traces){
        tissueMarks.push({...trace,ink:artistInk(artist,trace.mark)});
      }
      renderActualTissue();
      protectWatercolourAgainstTissue();
      if(watercolourMarks.length)avoidForeignMarks(watercolourSurface,watercolourForeignInk);
      showSheet();
      return observe ? tissueFootprint(traces,action.pigmentGain) : undefined;
    }
    if(material==='watercolour'){
      for(const trace of traces)
        watercolourMarks.push({...trace,ink:artistInk(artist,trace.mark)});
      renderActualWatercolour();
      return observe ? materialFootprint('watercolour',watercolourSurface) : undefined;
    }
    // Neither Oil nor Action use miniature paints or turn-local shortcuts.
    // Both receive all responding source geometry and render onto the shared
    // full-size sheet using their complete solo painting algorithms.
    const entry=traces.map(t=>({...t,ink:artistInk(artist,t.mark),
      system:artist.system,palette:artist.palette,settings:artist.settings}));
    if(material==='oil'){
      oilMarks.push(...entry);
      renderActualOil();
      return observe?materialFootprint('oil',oilSurface):undefined;
    }
    if(material==='action'){
      actionMarks.push(...entry);
      renderActualAction();
      return observe?materialFootprint('action',actionSurface):undefined;
    }
    throw new Error('Unknown Confluence material: '+material);
  }

  // Both native materials already exist on the canvas on their own turns:
  // Finish must not introduce another late material reveal.
  deposit.finalize=()=>{};
  deposit.tissueStats=()=>({nativeFullSheetPasses:surfacePasses.tissue,
    tissueMarks:tissueMarks.length});
  deposit.watercolourStats=()=>({nativeFullSheetPasses:surfacePasses.watercolour,
    watercolourMarks:watercolourMarks.length});
  deposit.nativeStats=()=>({...surfacePasses});
  return deposit;
}
