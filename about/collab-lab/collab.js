import {CELL, REACH, nextGroup, planStrokes, plannedPoints} from './mark-planner.js?v=studio-05';
const GOLD = Math.PI * (3 - Math.sqrt(5));

export const systems = [
  {id: 'field', name: 'Orbital / Field', hue: 215, ink: '#254b88', pen: 'broad', width: 9},
  {id: 'spiral', name: 'Golden Trajectories', hue: 12, ink: '#ae442b', pen: 'felt', width: 11},
  {id: 'organic', name: 'Growth Systems', hue: 153, ink: '#30664b', pen: 'felt', width: 10},
  {id: 'rects', name: 'Recursive Divisions', hue: 42, ink: '#956811', pen: 'felt', width: 5},
  {id: 'burst', name: 'Radiant Systems', hue: 286, ink: '#744477', pen: 'fine', width: 8},
  {id: 'network', name: 'Connected Fields', hue: 183, ink: '#1d6b76', pen: 'fine', width: 10},
  {id: 'geometric', name: 'Constructed Forms', hue: 345, ink: '#9c3456', pen: 'broad', width: 6},
  {id: 'scribble', name: 'Automatic Marks', hue: 25, ink: '#71503b', pen: 'scribble', width: 6}
];

export const palettes = {
  signature: 'Signature ink', spectrum: 'Full Spectrum', golden: 'Golden-angle hues',
  marker: 'Classic Markers', cmyk: 'CMYK', primary: 'Primary', neon: 'Neon',
  pastel: 'Pastel', earth: 'Earth', warm: 'Warm', cold: 'Cold', mono: 'Monochrome'
};

export function slotInk(id) {
  return systems[(id - 1) % systems.length].ink;
}

export function paletteInks(artist, seed) {
  const signature = systems[(artist.id - 1) % systems.length];
  const {colourCount, saturation, brightness} = artist.settings;
  if (artist.palette === 'signature') {
    const offsets = [0, 11, -8, 19, -17, 27, -26, 36, -35, 45, -44, 54, -53, 63];
    return offsets.slice(0, colourCount).map((shift, index) => {
      const hue = (signature.hue + shift + 360) % 360;
      const light = clamp(brightness + [0, 8, -7][index % 3], 20, 80);
      return 'hsl(' + hue + ' ' + saturation + '% ' + light + '%)';
    });
  }
  const A = window.AlgoArt;
  A.rendererVersion = 10;
  return A.hues({palette: artist.palette, colourCount, saturation, brightness},
    A.makeR(seed + '|palette|' + artist.id));
}

export const responses = {
  weave: {gap: 40, overlap: 2.3, alignment: .14},
  echo: {gap: 22, overlap: 1.0, alignment: 1.20},
  space: {gap: 120, overlap: 3.4, alignment: 0}
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pt = (x, y) => ({x, y});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const key = ({x, y}) => x.toFixed(4) + ',' + y.toFixed(4);
const same = (a, b) => distance(a, b) < 0.001;
const identity = point => point;

function parsePath(d) {
  const tokens = d.match(/[MLC]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g);
  const commands = [];
  for (let i = 0; i < tokens.length;) {
    const type = tokens[i++];
    const points = [];
    for (let p = 0; p < (type === 'C' ? 3 : 1); p++) {
      points.push(pt(Number(tokens[i++]), Number(tokens[i++])));
    }
    commands.push({type, points});
  }
  return commands;
}

function samplePath(commands) {
  const samples = [commands[0].points[0]];
  for (const {type, points} of commands.slice(1)) {
    const start = samples.at(-1);
    const length = points.reduce((sum, point, i) => sum + distance(point, points[i - 1] || start), 0);
    const count = Math.max(1, Math.ceil(length / 12));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      if (type === 'C') {
        const u = 1 - t;
        const [a, b, end] = points;
        samples.push(pt(
          u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x,
          u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y
        ));
      } else {
        samples.push(pt(start.x + (points[0].x - start.x) * t, start.y + (points[0].y - start.y) * t));
      }
    }
  }
  return samples;
}

function recordArtist(artist, seed, sheet, sourceCanvas) {
  const A = window.AlgoArt;
  const recorder = {precise: true, paths: []};
  A.rendererVersion = 10;
  A.svgRecorder = recorder;
  const {fit, seed: artistSeed, colourCount, saturation, brightness, ...settings} = artist.settings;
  const previousFit = A.phiFramingEnabled;
  let guide;
  try {
    A.phiFramingEnabled = fit;
    ({guide} = A.render(sourceCanvas, {
      seed: artistSeed.trim() || seed + '|artist|' + artist.id,
      mode: artist.system, orientation: sheet.orientation, ...settings,
      palette: 'marker', colourCount: 3, saturation: 68, brightness: 43, paper: '#f5f0e6', grain: 7
    }, 0.12, false));
  } finally {
    A.svgRecorder = null;
    A.phiFramingEnabled = previousFit;
  }

  const groups = [];
  const branches = guide?.type === 'organic' ? guide.segments : [];
  const branchAnchor = new Map(branches.map((branch, i) => ['seg-' + i, branch]));
  for (const path of recorder.paths) {
    const info = path.group;
    const id = info?.id || 'mark-' + path.mark;
    if (groups.at(-1)?.id !== id) {
      groups.push({id, info, label: info?.label || 'Stroke', paths: [], traces: [], probes: []});
    }
    const group = groups.at(-1);
    const commands = parsePath(path.d);
    group.paths.push({path, commands});
    // Each pen pass is painted. One centreline per mark is enough for scoring.
    if (path.pass === 0) group.traces.push({
      points: samplePath(commands), width: path.width, mark: path.mark, kind: path.kind
    });
  }

  for (const group of groups) {
    const points = group.traces.flatMap(trace => trace.points.map((p, i, line) => ({
      p, next: line[i + 1] || line[i - 1] || p
    })));
    const stride = Math.max(1, Math.ceil(points.length / 26));
    group.probes = points.filter((_, i) => i % stride === 0);
    group.center = pt(
      points.reduce((sum, item) => sum + item.p.x, 0) / points.length,
      points.reduce((sum, item) => sum + item.p.y, 0) / points.length
    );
    const token = group.id.split('/').at(-1);
    const index = Number(token.split('-').at(-1));
    if (guide?.type === 'organic') {
      const branch = branchAnchor.get(token);
      if (branch) group.links = [pt(branch.x1, branch.y1), pt(branch.x2, branch.y2)];
    }
    if (guide?.type === 'network') {
      const edge = guide.edges[index];
      group.links = group.info.section === 'nodes'
        ? [guide.layout[index]]
        : [guide.layout[edge.a], guide.layout[edge.b]];
    }
    if (guide?.type === 'burst' && Number.isInteger(group.info?.hub)) {
      group.pivot = guide.hubs[group.info.hub];
    }
    if (guide?.type === 'rects') {
      group.cell = guide.cells[index] || guide.root;
      group.pivot = pt(group.cell.x + group.cell.w / 2, group.cell.y + group.cell.h / 2);
    }
  }
  return {...artist, groups};
}

function field(sheet, owner) {
  const {cols, rows, width, height} = sheet;
  const count = cols * rows;
  return {cols, rows, width, height, owner, distances: new Float32Array(count).fill(REACH),
    angle: new Float32Array(count), x: new Float32Array(count), y: new Float32Array(count)};
}

function indexInk(field, point, angle, radius) {
  const {cols, rows, width, height} = field;
  if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) return;
  const minX = clamp(Math.floor((point.x - REACH) / CELL), 0, cols - 1);
  const maxX = clamp(Math.floor((point.x + REACH) / CELL), 0, cols - 1);
  const minY = clamp(Math.floor((point.y - REACH) / CELL), 0, rows - 1);
  const maxY = clamp(Math.floor((point.y + REACH) / CELL), 0, rows - 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x + 0.5) * CELL - point.x;
      const dy = (y + 0.5) * CELL - point.y;
      const d = Math.max(0, Math.sqrt(dx * dx + dy * dy) - radius);
      const index = x + y * cols;
      if (d < field.distances[index]) {
        field.distances[index] = d;
        field.angle[index] = angle;
        field.x[index] = point.x;
        field.y[index] = point.y;
      }
    }
  }
}

function indexTrace(field, trace, placement, plan) {
  const points = plannedPoints(trace.points, placement, plan);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const neighbour = points[i + 1] || points[i - 1] || point;
    const angle = Math.atan2(neighbour.y - point.y, neighbour.x - point.x);
    indexInk(field, point, angle, trace.width / 2);
  }
}

function transform(origin, dest, angle, scale) {
  const c = Math.cos(angle) * scale;
  const s = Math.sin(angle) * scale;
  return point => {
    const x = point.x - origin.x;
    const y = point.y - origin.y;
    return pt(dest.x + c * x - s * y, dest.y + s * x + c * y);
  };
}

function candidates(group, artist, strength, turn) {
  const anchors = artist.anchors;
  const pose = artist.pose.place;
  const fixed = (group.links || []).filter(point => anchors.has(key(point)));
  const sourcePivot = fixed[0] || group.pivot || group.center;
  const pivot = pose(sourcePivot);
  const home = anchors.get(key(sourcePivot)) || pivot;
  const gain = strength / 100;
  if (fixed.length >= 2) {
    const [a, b] = fixed;
    const end = anchors.get(key(b));
    const fromAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const toAngle = Math.atan2(end.y - home.y, end.x - home.x);
    const span = distance(a, b);
    if (span < 0.001) {
      const translate = transform(pivot, home, 0, 1);
      return [{place: point => translate(pose(point)), effort: 0}];
    }
    const length = distance(home, end);
    const base = transform(a, home, toAngle - fromAngle, length / span);
    const alternatives = [{place: base, effort: 0}];
    if (length < 0.001) return alternatives;
    const dx = Math.cos(toAngle);
    const dy = Math.sin(toAngle);
    for (const sign of [-1, 1, -0.5, 0.5]) {
      const amount = Math.min(114, length * 0.41) * gain * sign;
      const place = point => {
        const p = base(point);
        const t = clamp(((p.x - home.x) * dx + (p.y - home.y) * dy) / length, 0, 1);
        const bend = Math.sin(Math.PI * t) * amount;
        return pt(p.x - dy * bend, p.y + dx * bend);
      };
      alternatives.push({place, effort: Math.abs(sign), curved: true});
    }
    return alternatives;
  }

  const alternatives = [];
  function offer(dest, angle, scale, effort) {
    const local = transform(pivot, dest, angle, scale);
    alternatives.push({place: point => local(pose(point)), effort});
  }
  offer(home, 0, 1, 0);
  if (fixed.length || group.pivot) {
    for (const value of [-1, -0.66, -0.33, 0.33, 0.66, 1]) {
      const maxAngle = group.cell ? .10 : .58;
      const scale = group.cell ? 1 - Math.abs(value) * .27 * gain : 1 + value * .28 * gain;
      offer(home, maxAngle * gain * value, scale, Math.abs(value));
      if (!group.cell) offer(home, -maxAngle * gain * value, scale, Math.abs(value));
    }
    return alternatives;
  }

  const radius = (artist.system === 'spiral' ? 155 : 235) * gain;
  for (let i = 0; i < 16; i++) {
    const angle = (i + turn * 0.23) * GOLD;
    const effort = i < 8 ? .50 : 1;
    const dest = pt(home.x + Math.cos(angle) * radius * effort, home.y + Math.sin(angle) * radius * effort);
    const tilt = Math.sin(angle) * .31 * gain * effort;
    offer(dest, tilt, 1 - .12 * gain * effort, effort);
  }
  return alternatives;
}

function judge(group, candidate, others, response, sheet, width) {
  const {width: w, height: h, cols, rows} = sheet;
  let sum = 0;
  let peak = 0;
  for (const probe of group.probes) {
    const p = candidate.place(probe.p);
    const outside = Math.max(0, -p.x, p.x - w, -p.y, p.y - h);
    const oldOutside = Math.max(0, -probe.p.x, probe.p.x - w, -probe.p.y, probe.p.y - h);
    sum += Math.max(0, outside - oldOutside) * .024;
    const x = clamp(Math.floor(p.x / CELL), 0, cols - 1);
    const y = clamp(Math.floor(p.y / CELL), 0, rows - 1);
    const index = x + y * cols;
    let nearest = REACH;
    let heading = 0;
    for (const other of others) {
      if (other.distances[index] < nearest) {
        nearest = other.distances[index];
        heading = other.angle[index];
      }
    }
    const clearance = nearest - width;
    const contact = clamp((19 - clearance) / 19, 0, 2);
    const next = candidate.place(probe.next);
    const angle = Math.atan2(next.y - p.y, next.x - p.x);
    sum += Math.abs(clearance - response.gap) / REACH + contact * response.overlap;
    peak = Math.max(peak, contact);
    sum -= Math.abs(Math.cos(angle - heading)) * Math.max(0, 1 - nearest / 94) * response.alignment;
  }
  return sum / group.probes.length + peak * response.overlap * .13 + candidate.effort * .09;
}

function inkRadius(artist, group) {
  const width = Math.max(...group.traces.map(trace => trace.width));
  const media = {marker: .5, tissue: 1.3, watercolour: 1.6, oil: 1.45, action: .65};
  return Math.min(30, width * media[artist.material]);
}

function entrancePose(group, artist, strength, others, response, sheet) {
  const home = pt(sheet.width / 2, sheet.height / 2);
  const gain = strength / 100;
  const stride = Math.max(1, Math.ceil(artist.groups.length / 20));
  const preview = {probes: artist.groups.filter((_, i) => i % stride === 0)
    .map(mark => ({p: mark.center, next: mark.probes[0].p}))};
  const radius = Math.min(sheet.width, sheet.height) * .25 * gain;
  const width = inkRadius(artist, group);
  const score = candidate => judge(group, candidate, others, response, sheet, width) * .52 +
    judge(preview, candidate, others, response, sheet, width) * .48;
  let pose = {place: identity, effort: 0};
  let best = score(pose);
  for (let i = 0; i < 12; i++) {
    const angle = (i + artist.id) * GOLD;
    const effort = i < 6 ? .62 : 1;
    const dest = pt(home.x + Math.cos(angle) * radius * effort, home.y + Math.sin(angle) * radius * effort);
    const candidate = {place: transform(home, dest, Math.sin(angle) * .28 * gain, 1 - .21 * gain * effort), effort};
    const result = score(candidate);
    if (result < best - .035) {
      pose = candidate;
      best = result;
    }
  }
  return pose;
}

export function createStudy(seed, slots, paperSettings) {
  if (slots.length !== 1 && slots.length !== 3) throw new Error('Choose one or three artists.');
  const portrait = paperSettings.orientation === 'portrait';
  const width = portrait ? 1000 : 1400;
  const height = portrait ? 1400 : 1000;
  const sheet = {...paperSettings, width, height, cols: Math.ceil(width / CELL), rows: Math.ceil(height / CELL)};
  const source = document.createElement('canvas');
  const roster = slots.map((slot, index) => {
    const system = systems.find(candidate => candidate.id === slot.system);
    const artist = {...system, ...slot, number: index + 1, inks: paletteInks(slot, seed), ink: slotInk(slot.id)};
    // Each slot keeps its own random stream and spatial field, including
    // when two slots choose the same system and material.
    return recordArtist(artist, seed, sheet, source);
  });
  const schedule = [];
  const offset = window.AlgoArt.hash(seed + '|collab-order') % roster.length;
  const rounds = Math.max(...roster.map(artist => artist.groups.length));
  for (let round = 0; round < rounds; round++) {
    // Rotate the lead so every artist gets opportunities to set the terms.
    for (let seat = 0; seat < roster.length; seat++) {
      const artist = roster[(offset + round + seat) % roster.length];
      if (artist.groups[round]) schedule.push({id: artist.id, group: artist.groups[round]});
    }
  }
  return {roster, schedule, sheet};
}

export function makeRun(study, strength, mode) {
  const artists = new Map(study.roster.map(artist => [artist.id, {
    ...artist, field: field(study.sheet, artist.id), pending: artist.groups.slice(),
    anchors: new Map(), committed: 0, started: false, pose: {place: identity, effort: 0}
  }]));
  let turn = 0;
  return {
    next(deposit) {
      const entry = study.schedule[turn++];
      if (!entry) return null;
      const artist = artists.get(entry.id);
      const others = [...artists.values()].filter(other => other !== artist && other.committed > 0);
      const fields = others.map(other => other.field);
      const response = responses[mode];
      const context = {fields, response, sheet: study.sheet, mode, gain: strength / 100};
      const selection = strength > 0 ? nextGroup(artist, context, p => artist.anchors.has(key(p))) : {group: entry.group, prioritized: false};
      const {group, prioritized} = selection;
      let placement = {place: identity, effort: 0};
      let entered = false;
      if (strength > 0) {
        if (!artist.started && fields.length) {
          artist.pose = entrancePose(group, artist, strength, fields, response, study.sheet);
          entered = artist.pose.effort > 0;
        }
        const choices = candidates(group, artist, strength, turn);
        placement = choices[0];
        if (fields.length) {
          const width = inkRadius(artist, group);
          let best = judge(group, placement, fields, response, study.sheet, width);
          for (const candidate of choices.slice(1)) {
            const score = judge(group, candidate, fields, response, study.sheet, width);
            if (score < best - .005) {
              placement = candidate;
              best = score;
            }
          }
        }
      }
      artist.started = true;
      for (const anchor of group.links || []) {
        if (!artist.anchors.has(key(anchor))) artist.anchors.set(key(anchor), placement.place(anchor));
      }
      const plans = strength > 0 ? planStrokes(group, artist, placement, context) : new Map();
      const contacts = [...new Set([...plans.values()].flatMap(plan => plan.contacts))]
        .map(id => artists.get(id).number);
      const action = {
        artist, group, placement, plans, contacts, heard: strength > 0 ? others.length : 0,
        changed: entered || placement.effort > 0 || plans.size > 0 || prioritized,
        entered, reordered: prioritized
      };
      const footprint = deposit?.(action, strength > 0);
      if (strength > 0) {
        if (footprint) {
          for (const {point, angle, radius} of footprint) indexInk(artist.field, point, angle, radius);
        } else {
          for (const trace of group.traces) indexTrace(artist.field, trace, placement, plans.get(trace.mark));
        }
      }
      if (!footprint || footprint.length) artist.committed++;
      return action;
    }
  };
}

export function prepareCanvas(canvas, seed, sheet) {
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  const ctx = canvas.getContext('2d');
  const A = window.AlgoArt;
  A.W = sheet.width;
  A.H = sheet.height;
  A.paper(ctx, sheet, A.makeR(seed + '|shared-paper'));
  return ctx;
}

export function artistInk(artist, mark) {
  return artist.inks[(mark - 1) % artist.inks.length];
}

export function paint(ctx, action) {
  const {artist, group, placement, plans} = action;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const {path, commands} of group.paths) {
    ctx.strokeStyle = artistInk(artist, path.mark);
    ctx.globalAlpha = path.opacity;
    ctx.lineWidth = path.width;
    ctx.lineCap = path.lineCap;
    ctx.globalCompositeOperation = path.blend;
    ctx.setLineDash(path.dash || []);
    ctx.lineDashOffset = path.dashOffset;
    ctx.beginPath();
    const plan = plans.get(path.mark);
    if (placement.curved || plan) {
      const [start, ...points] = plannedPoints(samplePath(commands), placement, plan);
      ctx.moveTo(start.x, start.y);
      for (const p of points) ctx.lineTo(p.x, p.y);
    } else {
      for (const {type, points} of commands) {
        const [a, b, c] = points.map(placement.place);
        if (type === 'M') ctx.moveTo(a.x, a.y);
        else if (type === 'L') ctx.lineTo(a.x, a.y);
        else ctx.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}
