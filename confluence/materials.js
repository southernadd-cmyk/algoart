import {artistInk, paint} from './collab.js?v=studio-06';
import {plannedPoints} from './mark-planner.js?v=rect-cells-02';
import {renderNativeDeposit} from './native-material.js?v=confluence-wash-fast-09';

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
  const surfacePasses={tissue:0,watercolour:0,oil:0,action:0};
  const coverageHistory={watercolour:null,oil:null,action:null};

  // The displayed paper is persistent. Native renderers paint each new
  // responsive group into a transparent full-sheet turn buffer, and only
  // that newly deposited pigment is added to the shared picture. This also
  // respects *actual turn order* across different materials.
  const tissueMarks=[],watercolourMarks=[],oilMarks=[],actionMarks=[];
  const tissueSurface=layer(true),watercolourSurface=layer(true),
    oilSurface=layer(true),actionSurface=layer(true);
  const tissueTurn=layer(true),watercolourTurn=layer(true),
    oilTurnSurface=layer(true),actionTurnSurface=layer(true);
  const surfaceSensor=layer(true);
  for(const ctx of [tissueSurface,watercolourSurface,oilSurface,actionSurface,
    tissueTurn,watercolourTurn,oilTurnSurface,actionTurnSurface])
    size(ctx,sheet.width,sheet.height);
  let oilTurn=0,actionTurn=0;
  // Compute a local full-resolution V7/V2S work area for each new gesture.
  // The released material engines remain untouched. Their native bleed is
  // allowed an extra 220-250px and is feathered at artificial crop edges.
  function nativeBounds(traces,padding){
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const trace of traces)for(const pt of trace.points||[]){
      left=Math.min(left,pt.x);top=Math.min(top,pt.y);
      right=Math.max(right,pt.x);bottom=Math.max(bottom,pt.y);
    }
    if(!Number.isFinite(left))return {x:0,y:0,w:sheet.width,h:sheet.height};
    const x=Math.max(0,Math.floor(left-padding));
    const y=Math.max(0,Math.floor(top-padding));
    const r=Math.min(sheet.width,Math.ceil(right+padding));
    const b=Math.min(sheet.height,Math.ceil(bottom+padding));
    return {x,y,w:Math.max(1,r-x),h:Math.max(1,b-y)};
  }
  // Keep the *displayed* physical paper intact, irrespective of material.
  // Composite the new native pigment at the geometry's real sheet position.
  function layTurn(surface,turn,blend='source-over',area={x:0,y:0}){
    surface.save();surface.resetTransform();surface.globalAlpha=1;
    surface.globalCompositeOperation='source-over';
    surface.drawImage(turn.canvas,area.x,area.y);surface.restore();
    output.save();output.resetTransform();output.globalAlpha=1;
    output.globalCompositeOperation=blend;
    output.drawImage(turn.canvas,area.x,area.y);output.restore();
  }
  function materialFootprint(kind,ctx){
    const next=footprintFromSurface(ctx,surfaceSensor,coverageHistory[kind],sheet);
    coverageHistory[kind]=next.coverage;
    return next.footprint;
  }
  function renderActualTissue(newMarks,artist){
    if(!newMarks.length)return;
    const bounds=nativeBounds(newMarks,250);
    size(tissueTurn,bounds.w,bounds.h);
    const representative={settings:{colourCount:Math.min(24,
      new Set(newMarks.map(t=>t.ink)).size)}};
    // One shared seed anchors fibres, tooth and paper texture from turn to
    // turn. The native V7 paints only the *new* paths on that same paper.
    renderNativeDeposit(tissueTurn,'tissue',newMarks,representative,
      bounds,sheet.paper,[seed,'all-tissue-voices','v7-whole-sheet'].join('|'),
      sourceRGB,sheet);
    surfacePasses.tissue++;
    // Preserve V7's extracted pigment opacity. Normal alpha composition
    // lets later tissue overlay earlier marks without multiply-blackening.
    layTurn(tissueSurface,tissueTurn,'source-over',bounds);
  }
  function renderActualWatercolour(newMarks,artist){
    if(!newMarks.length)return;
    const bounds=nativeBounds(newMarks,220);
    size(watercolourTurn,bounds.w,bounds.h);
    const representative={settings:{colourCount:Math.min(24,
      new Set(newMarks.map(t=>t.ink)).size)}};
    // Native V2S still includes full-paper wet edges, capillary flow and
    // source hues. Each fresh wash glazes existing paint; earlier washes
    // are not regenerated, shuffled, recoloured or erased.
    renderNativeDeposit(watercolourTurn,'watercolour',newMarks,
      representative,bounds,sheet.paper,
      [seed,'all-watercolour-voices','v2s-whole-sheet'].join('|'),sourceRGB,
      sheet);
    surfacePasses.watercolour++;
    layTurn(watercolourSurface,watercolourTurn,'multiply',bounds);
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
  function renderActualOil(newMarks,artist){
    if(!newMarks.length)return;
    if(typeof A.renderOilPaintV8!=='function' ||
       typeof A.compositionV5Test?.extract!=='function')
      throw new Error('Confluence requires the complete solo Oil V8 source planner');
    const paths=sourcePaths(newMarks),settings=sourceSettings(newMarks,'oil');
    settings.seed+='|'+artist.id+'|turn-'+(++oilTurn);
    const capture={paths,meta:{guide:{type:'confluence'},voids:[],
      strategy:'collaborative-responsive'},
      chains:A.compositionV5Test.extract(paths)};
    A.renderOilPaintV8(oilTurnSurface.canvas,settings,1,false,{
      masses:true,relief:true,weave:true,amount:.6,
      sourceCapture:capture,transparentSheet:true});
    surfacePasses.oil++;
    layTurn(oilSurface,oilTurnSurface);
  }
  function renderActualAction(newMarks,artist){
    if(!newMarks.length)return;
    if(typeof A.actionPaintingFromPathsV4!=='function')
      throw new Error('Confluence requires the complete solo Action V4 engine');
    const paths=sourcePaths(newMarks),settings=sourceSettings(newMarks,'action');
    const originalInks=artist.inks?.length?artist.inks:
      [...new Set(newMarks.map(mark=>mark.ink))];
    size(actionTurnSurface,sheet.width,sheet.height);
    A.actionPaintingFromPathsV4(actionTurnSurface.canvas,paths,settings,1,{
      sourceInks:originalInks,transparentSheet:true,append:true,
      passes:1,gesturesPerPass:Math.max(2,Math.min(5,paths.length*2)),
      variant:artist.id+'|turn-'+(++actionTurn)});
    surfacePasses.action++;
    layTurn(actionSurface,actionTurnSurface);
  }

  function deposit(action, observe) {
    const {artist, group, placement, plans} = action;
    const material = artist.material;
    const {opacity, overdraw, dryness} = artist.settings;
    if (material === 'marker') {
      // Actual marker geometry is already a single mark in drawing order.
      paint(output, action);
      return;
    }

    let traces = group.traces.map(trace => ({...trace, points: plannedPoints(trace.points, placement, plans.get(trace.mark))}));
    if (material === 'tissue') {
      // Preserve exactly which artist supplied each stroke and its original
      // palette hue. A single V7 material surface can then combine the marks
      // of all three artists without reintroducing per-artist cloud fields.
      const fresh=traces.map(trace=>({...trace,ink:artistInk(artist,trace.mark)}));
      tissueMarks.push(...fresh);
      renderActualTissue(fresh,artist);
      return observe ? tissueFootprint(traces,action.pigmentGain) : undefined;
    }
    if(material==='watercolour'){
      const fresh=traces.map(trace=>({...trace,ink:artistInk(artist,trace.mark)}));
      watercolourMarks.push(...fresh);
      renderActualWatercolour(fresh,artist);
      return observe ? materialFootprint('watercolour',watercolourSurface) : undefined;
    }
    // The released oil and action brushes add their physical marks to the
    // existing sheet without repainting earlier artists' compositions.
    const entry=traces.map(t=>({...t,ink:artistInk(artist,t.mark),
      system:artist.system,palette:artist.palette,settings:artist.settings}));
    if(material==='oil'){
      oilMarks.push(...entry);
      renderActualOil(entry,artist);
      return observe?materialFootprint('oil',oilSurface):undefined;
    }
    if(material==='action'){
      actionMarks.push(...entry);
      renderActualAction(entry,artist);
      return observe?materialFootprint('action',actionSurface):undefined;
    }
    throw new Error('Unknown Confluence material: '+material);
  }

  // Every material is committed on its own turn: Finish adds no surprise.
  deposit.finalize=()=>{};
  deposit.tissueStats=()=>({nativeFullSheetPasses:surfacePasses.tissue,
    tissueMarks:tissueMarks.length});
  deposit.watercolourStats=()=>({nativeFullSheetPasses:surfacePasses.watercolour,
    watercolourMarks:watercolourMarks.length});
  deposit.nativeStats=()=>({...surfacePasses});
  return deposit;
}
