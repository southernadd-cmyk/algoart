import {artistInk, paint} from './collab.js?v=confluence-edge-margin-01';
import {plannedPoints} from './mark-planner.js?v=confluence-progressive-order-03';
import {renderNativeDeposit} from './native-material.js?v=confluence-tissue-v8-10';
import {protectPigmentStack} from './pigment-guard.js?v=dark-stack-01';
import {committedOilV2Evidence,oilV2PlanCapture,oilV2FallbackFields} from './oil-v2-geometry.js?v=oil-v2-test-01';

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

// The placement inset leaves room for native pigment to spread. Taper only
// the outer wash and stray drops so no material hits a hard paper boundary.
function makeEdgeMask(sheet) {
  const {width, height, inset} = sheet;
  const margin = Math.min(width, height) * .03;
  const fullOpacity = inset * .65;
  const mask = layer();
  size(mask, width, height);
  for (const [x, y] of [[width, 0], [0, height]]) {
    const span = x || y;
    const gradient = mask.createLinearGradient(0, 0, x, y);
    gradient.addColorStop(margin / span, 'transparent');
    gradient.addColorStop(fullOpacity / span, '#000');
    gradient.addColorStop(1 - fullOpacity / span, '#000');
    gradient.addColorStop(1 - margin / span, 'transparent');
    mask.fillStyle = gradient;
    mask.fillRect(0, 0, width, height);
    mask.globalCompositeOperation = 'destination-in';
  }
  return mask.canvas;
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

export function makePainter(output, seed, sheet, {roster=[],rendererVersion=1} = {}) {
  if(rendererVersion!==1&&rendererVersion!==2)
    throw new Error('Unsupported Confluence renderer version: '+rendererVersion);
  const A = window.AlgoArt;
  const edgeMask = sheet.edgeMargin ? makeEdgeMask(sheet) : null;
  function taperPigment(ctx, x = 0, y = 0) {
    if (!edgeMask) return;
    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(edgeMask, -x, -y);
    ctx.restore();
  }
  let colourSample;
  const colours = new Map();
  const surfacePasses={tissue:0,watercolour:0,oil:0,action:0};
  const darkGuard={tissue:0,watercolour:0};
  const coverageHistory={watercolour:null,oil:null,action:null};

  // The displayed paper is persistent. Native renderers paint each new
  // responsive group into a transparent full-sheet turn buffer, and only
  // that newly deposited pigment is added to the shared picture. This also
  // respects *actual turn order* across different materials.
  const tissueMarks=[],watercolourMarks=[],oilMarks=[],actionMarks=[];
  // Track each artist's maximum native V8 pigment coverage. Confluence
  // must not repeatedly layer an entire atmospheric wash at every turn.
  const tissueHistories=new Map();
  const tissueIncrement=layer(true);
  let tissueAddedPixels=0,tissueNegativePixels=0;
  const tissueSurface=layer(true),watercolourSurface=layer(true),
    oilSurface=layer(true),actionSurface=layer(true);
  const tissueTurn=layer(true),watercolourTurn=layer(true),
    oilTurnSurface=layer(true),actionTurnSurface=layer(true);
  const surfaceSensor=layer(true);
  for(const ctx of [tissueSurface,watercolourSurface,oilSurface,actionSurface,
    tissueTurn,tissueIncrement,watercolourTurn,oilTurnSurface,actionTurnSurface])
    size(ctx,sheet.width,sheet.height);
  let oilTurn=0,actionTurn=0;
  // Oil v2 sees committed geometry from previous turns of the SAME hand.
  // It deposits only the new source brushes and newly discovered colour
  // areas, never repaints whole previous turns. V1 does not use this state.
  const oilV2History=new Map(),oilV2Painted=new Map();
  const oilV2Stats={turns:0,plannedFields:0,newFields:0,newTerritories:0,
    eligibleGroups:0,guideCounts:null};
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
  function protectDarkStack(turn,area,blend,kind){
    // Compare the current paper with only this new translucent tile.
    // Never brighten or recolour old strokes, and never globally reduce
    // saturation. The first deliberate dark mark is left untouched.
    const next=turn.getImageData(0,0,area.w,area.h);
    const previous=output.getImageData(area.x,area.y,area.w,area.h);
    const protectedPixels=protectPigmentStack(previous,next,blend);
    if(protectedPixels)turn.putImageData(next,0,0);
    darkGuard[kind]+=protectedPixels;
  }
  function materialFootprint(kind,ctx){
    const next=footprintFromSurface(ctx,surfaceSensor,coverageHistory[kind],sheet);
    coverageHistory[kind]=next.coverage;
    return next.footprint;
  }
  function renderActualTissue(newMarks,artist){
    if(!newMarks.length)return;
    let history=tissueHistories.get(artist.id);
    if(!history){
      history={coverage:new Uint8Array(sheet.width*sheet.height)};
      tissueHistories.set(artist.id,history);
    }
    const area=nativeBounds(newMarks,250);
    const representative={settings:{colourCount:Math.min(14,
      new Set(newMarks.map(t=>t.ink)).size)}};
    size(tissueTurn,area.w,area.h);
    renderNativeDeposit(tissueTurn,'tissue',newMarks,representative,
      area,sheet.paper,[seed,'tissue-artist',artist.id,'v8-layered'].join('|'),
      sourceRGB,sheet);
    taperPigment(tissueTurn,area.x,area.y);
    surfacePasses.tissue++;
    // Each native V8 turn has its own complete atmospheric wash. Naively
    // source-over composing those washes multiplies the grey fog by 27.
    // Instead, each artist maintains the *maximum observed native opacity*
    // at each paper pixel. Only the positive difference is deposited.
    // This preserves dense graphite strokes, new pigment colours and
    // chronological interleaving without repeatedly coating the same paper.
    const current=tissueTurn.getImageData(0,0,area.w,area.h);
    const increment=tissueIncrement.createImageData(area.w,area.h);
    const next=current.data,dst=increment.data;
    for(let y=0;y<area.h;y++)for(let x=0;x<area.w;x++){
      const index=x+y*area.w,p=index*4;
      const globalIndex=area.x+x+(area.y+y)*sheet.width;
      const oldAlpha=history.coverage[globalIndex];
      const newAlpha=next[p+3];
      if(newAlpha<=oldAlpha){
        if(newAlpha<oldAlpha)tissueNegativePixels++;
        continue;
      }
      const alpha=Math.min(255,Math.round(
        (newAlpha-oldAlpha)*255/Math.max(1,255-oldAlpha)));
      if(alpha<=0)continue;
      dst[p]=next[p];dst[p+1]=next[p+1];dst[p+2]=next[p+2];
      dst[p+3]=alpha;
      history.coverage[globalIndex]=newAlpha;
      tissueAddedPixels++;
    }
    size(tissueIncrement,area.w,area.h);
    tissueIncrement.putImageData(increment,0,0);
    protectDarkStack(tissueIncrement,area,'source-over','tissue');
    layTurn(tissueSurface,tissueIncrement,'source-over',area);
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
    taperPigment(watercolourTurn,bounds.x,bounds.y);
    surfacePasses.watercolour++;
    protectDarkStack(watercolourTurn,bounds,'multiply','watercolour');
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
  function renderActualOil(newMarks,artist,evidence=[]){
    if(!newMarks.length)return;
    if(typeof A.renderOilPaintV8!=='function' ||
       typeof A.compositionV5Test?.extract!=='function')
      throw new Error('Confluence requires the complete solo Oil V8 source planner');
    const paths=sourcePaths(newMarks),settings=sourceSettings(newMarks,'oil');
    settings.seed+='|'+artist.id+'|turn-'+(++oilTurn);
    const capture={paths,meta:{guide:{type:'confluence'},voids:[],
      strategy:'collaborative-responsive'},
      chains:A.compositionV5Test.extract(paths)};
    const options={masses:true,relief:true,weave:true,amount:.6,
      sourceCapture:capture,transparentSheet:true};
    let v2;
    if(rendererVersion===2){
      const history=(oilV2History.get(artist.id)||[]).concat(evidence);
      v2=oilV2PlanCapture(history,artist,sheet,seed+'|'+artist.id);
      const painted=oilV2Painted.get(artist.id)||new Set();
      // Stable seed ties connected areas to their source guide IDs, rather
      // than rearranging every prior area on each successive new turn.
      settings.seed=[seed,'confluence','oil-v2',artist.id].join('|');
      options.planCapture=v2.capture;
      options.v2Painted=painted;
      options.v2FallbackFields=oilV2FallbackFields(v2.groups,sheet,
        seed+'|'+artist.id);
    }
    const result=A.renderOilPaintV8(oilTurnSurface.canvas,settings,1,false,options);
    if(v2){
      oilV2History.set(artist.id,(oilV2History.get(artist.id)||[]).concat(evidence));
      oilV2Painted.set(artist.id,options.v2Painted);
      oilV2Stats.turns++;
      oilV2Stats.plannedFields+=result.work?.v2PlannedFields||0;
      oilV2Stats.newFields+=result.work?.v2NewFields||0;
      oilV2Stats.newTerritories+=result.work?.v2NewTerritories||0;
      oilV2Stats.eligibleGroups=Math.max(oilV2Stats.eligibleGroups,v2.groups.length);
      oilV2Stats.guideCounts=v2.guideCounts;
      // Diagnostic only. Tests must demand positive actual semantic fields,
      // not pass merely because the V8 brushes executed.
      A.lastConfluenceOilV2Stats={...oilV2Stats};
    }
    taperPigment(oilTurnSurface);
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
    taperPigment(actionTurnSurface);
    surfacePasses.action++;
    layTurn(actionSurface,actionTurnSurface);
  }

  // One artist turn may now contain several real source gestures.
  // Plan them individually, then render the complete batch as one native
  // material deposit. This avoids a full V7/V2S/oil redraw per small stroke.
  function depositBatch(actions,observe){
    if(!actions.length)return;
    const artist=actions[0].artist;
    const material=artist.material;
    if(material==='marker'){
      for(const action of actions)paint(output, action);
      return;
    }
    const traces=actions.flatMap(({group,placement,plans})=>
      group.traces.map(trace=>({...trace,
        points:plannedPoints(trace.points,placement,plans.get(trace.mark))})));
    const gain=actions.reduce((sum,action)=>sum+action.pigmentGain,0)/actions.length;
    if(material==='tissue'){
      const fresh=traces.map(trace=>({...trace,ink:artistInk(artist,trace.mark)}));
      tissueMarks.push(...fresh);
      renderActualTissue(fresh,artist);
      return observe?tissueFootprint(traces,gain):undefined;
    }
    if(material==='watercolour'){
      const fresh=traces.map(trace=>({...trace,ink:artistInk(artist,trace.mark)}));
      watercolourMarks.push(...fresh);
      renderActualWatercolour(fresh,artist);
      return observe?materialFootprint('watercolour',watercolourSurface):undefined;
    }
    // Each V8 oil / V4 action call consumes all of this turn's transformed
    // source paths. Previous artists' marks are never regenerated.
    const entry=traces.map(t=>({...t,ink:artistInk(artist,t.mark),
      system:artist.system,palette:artist.palette,settings:artist.settings}));
    if(material==='oil'){
      oilMarks.push(...entry);
      const evidence=rendererVersion===2
        ?committedOilV2Evidence(actions,artistInk):[];
      renderActualOil(entry,artist,evidence);
      return observe?materialFootprint('oil',oilSurface):undefined;
    }
    if(material==='action'){
      actionMarks.push(...entry);
      renderActualAction(entry,artist);
      return observe?materialFootprint('action',actionSurface):undefined;
    }
    throw new Error('Unknown Confluence material: '+material);
  }
  function deposit(action,observe){
    return depositBatch([action],observe);
  }
  deposit.batch=depositBatch;

  // Every material is committed on its own turn: Finish adds no surprise.
  deposit.finalize=()=>{};
  deposit.tissueStats=()=>({nativeFullSheetPasses:surfacePasses.tissue,
    tissueMarks:tissueMarks.length,artists:tissueHistories.size,
    addedPixels:tissueAddedPixels,negativePixels:tissueNegativePixels});
  deposit.watercolourStats=()=>({nativeFullSheetPasses:surfacePasses.watercolour,
    watercolourMarks:watercolourMarks.length});
  deposit.nativeStats=()=>({...surfacePasses,darkGuard:{...darkGuard}});
  deposit.oilV2Stats=()=>rendererVersion===2?{...oilV2Stats}:null;
  return deposit;
}
