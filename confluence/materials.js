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

function box(traces, material, width, height) {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (const {points} of traces) {
    const start = points[0], end = points.at(-1);
    // The pour's cubic control points can move up to a chord length away
    // from the source. The extra margin includes its largest scatter.
    // Native V2S washes can spread beyond the drawn centreline by more
    // than the previous 75px crop margin. That margin created the visible
    // rectangular blue tiles in Confluence compositions.
    const padding = material === 'watercolour' ? 175 :
      material === 'tissue' ? 145 :
      material === 'action' ? 70 + Math.hypot(end.x - start.x, end.y - start.y) : 75;
    for (const {x, y} of points) {
      minX = Math.min(minX, x - padding);
      minY = Math.min(minY, y - padding);
      maxX = Math.max(maxX, x + padding);
      maxY = Math.max(maxY, y + padding);
    }
  }
  const x = Math.max(0, Math.floor(minX / SAMPLE) * SAMPLE);
  const y = Math.max(0, Math.floor(minY / SAMPLE) * SAMPLE);
  const right = Math.min(width, Math.ceil(maxX / SAMPLE) * SAMPLE);
  const bottom = Math.min(height, Math.ceil(maxY / SAMPLE) * SAMPLE);
  return {x, y, w: right - x, h: bottom - y};
}

function inkOnSheet(pigment, sensor, area, heading, opacity) {
  const w = Math.ceil(area.w / SAMPLE);
  const h = Math.ceil(area.h / SAMPLE);
  size(sensor, w, h);
  sensor.drawImage(pigment.canvas, 0, 0, w, h);
  const alpha = sensor.getImageData(0, 0, w, h).data;
  const read = (x, y) => x >= 0 && x < w && y >= 0 && y < h ? alpha[(x + y * w) * 4 + 3] : 0;
  const result = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const coverage = read(x, y) * opacity;
      if (coverage < 10) continue;
      const dx = read(x + 1, y) - read(x - 1, y);
      const dy = read(x, y + 1) - read(x, y - 1);
      const angle = Math.abs(dx) + Math.abs(dy) > 10 ? Math.atan2(dx, -dy) : heading;
      result.push({
        point: {x: area.x + (x + .5) * area.w / w, y: area.y + (y + .5) * area.h / h},
        angle, radius: Math.min(6, coverage / 19), opacity: coverage / 255
      });
    }
  }
  return result;
}

function softenSheetEdge(ctx, area, width, height, border) {
  if (!border) return;
  const feather = 24;
  const limit = border + feather;
  function mask(length, horizontal) {
    const gradient = ctx.createLinearGradient(0, 0, horizontal ? length : 0, horizontal ? 0 : length);
    gradient.addColorStop(border / length, '#0000');
    gradient.addColorStop(limit / length, '#000');
    gradient.addColorStop(1 - limit / length, '#000');
    gradient.addColorStop(1 - border / length, '#0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(area.x, area.y, area.w, area.h);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  if (area.x < limit || area.x + area.w > width - limit) mask(width, true);
  if (area.y < limit || area.y + area.h > height - limit) mask(height, false);
  ctx.restore();
}

function actionTraces(traces) {
  // One open pour per source shape. Split closed loops into two pours.
  return traces.flatMap(trace => {
    const pts = trace.points;
    const a = pts[0], b = pts.at(-1);
    if (pts.length < 6 || Math.hypot(a.x - b.x, a.y - b.y) > 18) return [trace];
    const mid = Math.floor(pts.length / 2);
    return [{...trace, points: pts.slice(0, mid + 1)}, {...trace, points: pts.slice(mid)}];
  });
}

export function makePainter(output, seed, sheet) {
  const A = window.AlgoArt;
  let pigment, relief, sensor, colourSample;
  const colours = new Map();
  const oil = A.oilPigment.createModel();

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

  return function deposit(action, observe) {
    const {artist, group, placement, plans} = action;
    const material = artist.material;
    const {opacity, overdraw, dryness} = artist.settings;
    if (material === 'marker') {
      paint(output, action);
      return;
    }

    let traces = group.traces.map(trace => ({...trace, points: plannedPoints(trace.points, placement, plans.get(trace.mark))}));
    if (material === 'action') traces = actionTraces(traces);
    const width = output.canvas.width, height = output.canvas.height;
    const area = box(traces, material, width, height);
    if (area.w <= 0 || area.h <= 0) return [];
    const scale = RESOLUTION[material];
    const w = Math.ceil(area.w * scale), h = Math.ceil(area.h * scale);
    pigment ||= layer(true);
    size(pigment, w, h);
    pigment.setTransform(w / area.w, 0, 0, h / area.h, -area.x * w / area.w, -area.y * h / area.h);

    if (material === 'oil') {
      relief ||= layer(true);
      size(relief, w, h);
      relief.setTransform(pigment.getTransform());
      A.oilV8Weave = true;
      A.oilStageDRefinement = true;
      A.oilStageCScale = scale;
      A.oilPigmentActive = oil;
    }

    try {
      if(material==='tissue'||material==='watercolour'){
        renderNativeDeposit(pigment,material,traces,artist,area,sheet.paper,
          [seed,artist.id,group.id,artist.system,'v10'].join('|'),sourceRGB,
          {width,height});
        // Native material functions draw in local bitmap coordinates.
        // Restore the world-to-local transform for paper edge trimming.
        pigment.setTransform(w/area.w,0,0,h/area.h,-area.x*w/area.w,-area.y*h/area.h);
      }else{
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        const width = trace.width * (1 + (overdraw - 2) * .045);
        const markSeed = [seed, artist.id, group.id, trace.mark, i, material].join('|');
        const r = A.makeR(markSeed);
        const colour = artistInk(artist, trace.mark);
        if (material === 'tissue') {
          A.collabTissue(pigment, trace.points, Math.min(55, 9 + width * 2.8),
            'rgb(' + sourceRGB(colour).join(',') + ')', r);
        } else if (material === 'watercolour') {
          // The wash mixer reads RGB channels. Palette swatches can be CSS HSL.
          const ink = 'rgb(' + sourceRGB(colour).join(',') + ')';
          A.collabWatercolour(pigment, trace.points, Math.min(64, 10 + width * 3.7), ink, seed, r);
        } else if (material === 'oil') {
          const profile = dryness >= 65 ? 'dry' : r.pick(['filbert', 'flat', 'knife', 'dry']);
          A.oilPaintV4ETest.drawContactBrushV8(pigment, relief, trace.points,
            Math.min(65, 10 + width * 3.2), oil.mapRGB(sourceRGB(colour)), profile, r,
            {thickness: .92, drag: Math.min(1, (profile === 'dry' ? .76 : .45) + dryness / 145)});
        } else {
          A.collabAction(pigment, trace.points, 'rgb(' + oil.mapRGB(sourceRGB(colour)).join(',') + ')',
            width, markSeed, output.canvas.width, height);
        }
      }
      }
      if (material === 'oil') A.collabOilRelief(pigment, relief, scale);
    } finally {
      if (material === 'oil') {
        delete A.oilV8Weave;
        delete A.oilStageDRefinement;
        delete A.oilStageCScale;
        delete A.oilPigmentActive;
      }
    }
    softenSheetEdge(pigment, area, width, height, action.border);
    const coverage = materialOpacity(opacity, action.pigmentGain);
    output.save();
    output.globalAlpha = coverage;
    output.globalCompositeOperation = material === 'watercolour' ? 'multiply' : 'source-over';
    output.drawImage(pigment.canvas, area.x, area.y, area.w, area.h);
    output.restore();
    if (!observe) return;
    sensor ||= layer(true);
    const p = traces[0].points;
    const heading = Math.atan2(p.at(-1).y - p[0].y, p.at(-1).x - p[0].x);
    return inkOnSheet(pigment, sensor, area, heading, coverage);
  };
}
