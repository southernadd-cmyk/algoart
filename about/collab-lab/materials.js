import {artistInk, paint} from './collab.js';

export const materials = {
  marker: 'Marker',
  tissue: 'Tissue & Graphite',
  watercolour: 'Watercolour',
  oil: 'Oil',
  action: 'Action Painting'
};

const SAMPLE = 12;
const RESOLUTION = {tissue: 1, watercolour: 1, oil: 0.7, action: 1};

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
    const padding = material === 'action' ? 70 + Math.hypot(end.x - start.x, end.y - start.y) : 75;
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

function inkOnSheet(pigment, sensor, area, heading) {
  const w = Math.ceil(area.w / SAMPLE);
  const h = Math.ceil(area.h / SAMPLE);
  size(sensor, w, h);
  sensor.drawImage(pigment.canvas, 0, 0, w, h);
  const alpha = sensor.getImageData(0, 0, w, h).data;
  const read = (x, y) => x >= 0 && x < w && y >= 0 && y < h ? alpha[(x + y * w) * 4 + 3] : 0;
  const result = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const coverage = read(x, y);
      if (coverage < 10) continue;
      const dx = read(x + 1, y) - read(x - 1, y);
      const dy = read(x, y + 1) - read(x, y - 1);
      const angle = Math.abs(dx) + Math.abs(dy) > 10 ? Math.atan2(dx, -dy) : heading;
      result.push({
        point: {x: area.x + (x + .5) * area.w / w, y: area.y + (y + .5) * area.h / h},
        angle, radius: Math.min(6, coverage / 19)
      });
    }
  }
  return result;
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

export function makePainter(output, seed) {
  const A = window.AlgoArt;
  let pigment, relief, sensor, colourSample;
  const colours = new Map();
  const oil = A.oilPigment.createModel();

  function rgb(css) {
    if (!colours.has(css)) {
      colourSample ||= layer(true);
      size(colourSample, 1, 1);
      colourSample.fillStyle = css;
      colourSample.fillRect(0, 0, 1, 1);
      const pixels = colourSample.getImageData(0, 0, 1, 1).data;
      colours.set(css, oil.mapRGB(Array.from(pixels.slice(0, 3))));
    }
    return colours.get(css);
  }

  return function deposit(action, observe) {
    const {artist, group, placement} = action;
    const material = artist.material;
    if (material === 'marker') {
      paint(output, action);
      return;
    }

    let traces = group.traces.map(trace => ({...trace, points: trace.points.map(placement.place)}));
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
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        const markSeed = [seed, artist.id, group.id, trace.mark, i, material].join('|');
        const r = A.makeR(markSeed);
        const colour = artistInk(artist, trace.mark);
        if (material === 'tissue') {
          A.collabTissue(pigment, trace.points, Math.min(55, 9 + trace.width * 2.8), colour, r);
        } else if (material === 'watercolour') {
          A.collabWatercolour(pigment, trace.points, Math.min(64, 10 + trace.width * 3.7), colour, seed, r);
        } else if (material === 'oil') {
          const profile = r.pick(['filbert', 'flat', 'knife', 'dry']);
          A.oilPaintV4ETest.drawContactBrushV8(pigment, relief, trace.points,
            Math.min(65, 10 + trace.width * 3.2), rgb(colour), profile, r,
            {thickness: .92, drag: profile === 'dry' ? .84 : .57});
        } else {
          A.collabAction(pigment, trace.points, 'rgb(' + rgb(colour).join(',') + ')',
            trace.width, markSeed, width, height);
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
    output.save();
    output.globalCompositeOperation = material === 'watercolour' ? 'multiply' : 'source-over';
    output.drawImage(pigment.canvas, area.x, area.y, area.w, area.h);
    output.restore();
    if (!observe) return;
    sensor ||= layer(true);
    const p = traces[0].points;
    const heading = Math.atan2(p.at(-1).y - p[0].y, p.at(-1).x - p[0].x);
    return inkOnSheet(pigment, sensor, area, heading);
  };
}
