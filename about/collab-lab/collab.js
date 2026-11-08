const W = 1400;
const H = 1000;
const CELL = 16;
const REACH = 112;
const COLS = Math.ceil(W / CELL);
const ROWS = Math.ceil(H / CELL);
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
  if (artist.palette === 'signature') {
    return [signature.ink, 'hsl(' + (signature.hue + 10) + ' 46% 51%)',
      'hsl(' + (signature.hue - 8) + ' 66% 33%)'];
  }
  const A = window.AlgoArt;
  A.rendererVersion = 10;
  return A.hues({palette: artist.palette, colourCount: 6, saturation: 68, brightness: 45},
    A.makeR(seed + '|palette|' + artist.id));
}

export const responses = {
  weave: {gap: 35, overlap: 1.7, alignment: 0.22},
  echo: {gap: 24, overlap: 0.75, alignment: 0.95},
  space: {gap: 84, overlap: 3.0, alignment: 0}
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pt = (x, y) => ({x, y});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const key = ({x, y}) => x.toFixed(4) + ',' + y.toFixed(4);
const same = (a, b) => distance(a, b) < 0.001;
const identity = point => point;

function parsePath(d) {
  const tokens = d.trim().split(/\s+/);
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

function recordArtist(artist, seed, count, sourceCanvas) {
  const A = window.AlgoArt;
  const recorder = {precise: true, paths: []};
  A.rendererVersion = 10;
  A.svgRecorder = recorder;
  let guide;
  try {
    ({guide} = A.render(sourceCanvas, {
      seed, mode: artist.system, orientation: 'landscape',
      elements: Math.round(42 / Math.sqrt(count / 3)), density: 44, complexity: 56, negativeSpace: 47,
      phiStrength: 76, recursion: count >= 5 ? 3 : 4, spiralInfluence: 71, goldenAngle: 84, nesting: 32,
      pen: artist.pen, thickness: artist.width, wobble: 21, overdraw: 2, opacity: 77, pressure: 39,
      dryness: 10, curveBias: 49, shapeAmount: 63, overlap: 56, rotation: 82,
      lines: true, circles: true, rectangles: true, polygons: true, arcs: true,
      palette: 'marker', colourCount: 3, saturation: 68, brightness: 43, paper: '#f5f0e6', grain: 7
    }, 0.12, false));
  } finally {
    A.svgRecorder = null;
  }

  const groups = [];
  const branches = guide.type === 'organic' ? guide.segments : [];
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
    if (path.pass === 0) group.traces.push({points: samplePath(commands), width: path.width, mark: path.mark});
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
    if (guide.type === 'organic') {
      const branch = branchAnchor.get(token);
      if (branch) group.links = [pt(branch.x1, branch.y1), pt(branch.x2, branch.y2)];
    }
    if (guide.type === 'network') {
      const edge = guide.edges[index];
      group.links = group.info.section === 'nodes'
        ? [guide.layout[index]]
        : [guide.layout[edge.a], guide.layout[edge.b]];
    }
    if (guide.type === 'burst' && Number.isInteger(group.info?.hub)) {
      group.pivot = guide.hubs[group.info.hub];
    }
    if (guide.type === 'rects') {
      group.cell = group.info?.cell || guide.root;
      group.pivot = pt(group.cell.x + group.cell.w / 2, group.cell.y + group.cell.h / 2);
    }
  }
  return {...artist, groups};
}

function field() {
  return {
    distances: new Float32Array(COLS * ROWS).fill(REACH),
    angle: new Float32Array(COLS * ROWS)
  };
}

function indexInk(field, point, angle, radius) {
  const minX = clamp(Math.floor((point.x - REACH) / CELL), 0, COLS - 1);
  const maxX = clamp(Math.floor((point.x + REACH) / CELL), 0, COLS - 1);
  const minY = clamp(Math.floor((point.y - REACH) / CELL), 0, ROWS - 1);
  const maxY = clamp(Math.floor((point.y + REACH) / CELL), 0, ROWS - 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x + 0.5) * CELL - point.x;
      const dy = (y + 0.5) * CELL - point.y;
      const d = Math.max(0, Math.sqrt(dx * dx + dy * dy) - radius);
      const index = x + y * COLS;
      if (d < field.distances[index]) {
        field.distances[index] = d;
        field.angle[index] = angle;
      }
    }
  }
}

function indexTrace(field, trace, place) {
  const points = trace.points.map(place);
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
  const fixed = (group.links || []).filter(point => anchors.has(key(point)));
  const pivot = fixed[0] || group.pivot || group.center;
  const home = anchors.get(key(pivot)) || pivot;
  const gain = strength / 100;
  const alternatives = [];
  if (fixed.length >= 2) {
    const [a, b] = fixed;
    const end = anchors.get(key(b));
    const fromAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const toAngle = Math.atan2(end.y - home.y, end.x - home.x);
    const span = distance(a, b);
    if (span < 0.001) return [{place: transform(a, home, 0, 1), effort: 0}];
    const length = distance(home, end);
    const base = transform(a, home, toAngle - fromAngle, length / span);
    alternatives.push({place: base, effort: 0});
    if (length < 0.001) return alternatives;
    const dx = Math.cos(toAngle);
    const dy = Math.sin(toAngle);
    for (const sign of [-1, 1, -0.5, 0.5]) {
      const amount = Math.min(54, length * 0.23) * gain * sign;
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

  alternatives.push({place: transform(pivot, home, 0, 1), effort: 0});
  if (fixed.length || group.pivot) {
    for (const value of [-1, -0.66, -0.33, 0.33, 0.66, 1]) {
      const cell = Boolean(group.cell);
      const maxAngle = cell ? 0.055 : group.pivot ? 0.20 : 0.33;
      const angle = maxAngle * gain * value;
      const scale = cell ? 1 - Math.abs(value) * 0.2 * gain : 1 + value * 0.12 * gain;
      alternatives.push({place: transform(pivot, home, angle, scale), effort: Math.abs(value)});
    }
    return alternatives;
  }

  const radius = (artist.system === 'spiral' ? 95 : 134) * gain;
  for (let i = 0; i < 16; i++) {
    const angle = (i + turn * 0.23) * GOLD;
    const effort = i < 8 ? 0.5 : 1;
    const dest = pt(home.x + Math.cos(angle) * radius * effort, home.y + Math.sin(angle) * radius * effort);
    alternatives.push({place: transform(pivot, dest, 0, 1), effort});
  }
  return alternatives;
}

function judge(group, candidate, others, response) {
  let sum = 0;
  for (const probe of group.probes) {
    const p = candidate.place(probe.p);
    const outside = Math.max(0, -p.x, p.x - W, -p.y, p.y - H);
    const oldOutside = Math.max(0, -probe.p.x, probe.p.x - W, -probe.p.y, probe.p.y - H);
    sum += Math.max(0, outside - oldOutside) * 0.022;
    const x = clamp(Math.floor(p.x / CELL), 0, COLS - 1);
    const y = clamp(Math.floor(p.y / CELL), 0, ROWS - 1);
    const index = x + y * COLS;
    let nearest = REACH;
    let heading = 0;
    for (const other of others) {
      if (other.distances[index] < nearest) {
        nearest = other.distances[index];
        heading = other.angle[index];
      }
    }
    const next = candidate.place(probe.next);
    const angle = Math.atan2(next.y - p.y, next.x - p.x);
    sum += Math.abs(nearest - response.gap) / REACH;
    sum += Math.max(0, 18 - nearest) / 18 * response.overlap;
    sum -= Math.abs(Math.cos(angle - heading)) * Math.max(0, 1 - nearest / 65) * response.alignment;
  }
  return sum / group.probes.length + candidate.effort * 0.12;
}

export function createStudy(seed, slots) {
  const source = document.createElement('canvas');
  const roster = slots.map((slot, index) => {
    const system = systems.find(candidate => candidate.id === slot.system);
    const artist = {...system, ...slot, number: index + 1, inks: paletteInks(slot, seed), ink: slotInk(slot.id)};
    // Each slot keeps its own random stream and spatial field, including
    // when two slots choose the same system and material.
    return recordArtist(artist, seed + '|artist|' + slot.id, slots.length, source);
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
  return {roster, schedule};
}

export function makeRun(study, strength, mode) {
  const artists = new Map(study.roster.map(artist => [artist.id, {
    ...artist, field: field(), anchors: new Map(), committed: 0
  }]));
  let turn = 0;
  return {
    next(deposit) {
      const entry = study.schedule[turn++];
      if (!entry) return null;
      const artist = artists.get(entry.id);
      const group = entry.group;
      const others = [...artists.values()].filter(other => other !== artist && other.committed > 0);
      let placement = {place: identity, effort: 0};
      if (strength > 0) {
        const choices = candidates(group, artist, strength, turn);
        placement = choices[0];
        if (others.length) {
          const foreignFields = others.map(other => other.field);
          const response = responses[mode];
          let best = judge(group, placement, foreignFields, response);
          for (const candidate of choices.slice(1)) {
            const score = judge(group, candidate, foreignFields, response);
            if (score < best - 0.005) {
              placement = candidate;
              best = score;
            }
          }
        }
      }
      for (const anchor of group.links || []) {
        if (!artist.anchors.has(key(anchor))) artist.anchors.set(key(anchor), placement.place(anchor));
      }
      const action = {
        artist, group, placement, heard: strength > 0 ? others.length : 0, changed: placement.effort > 0
      };
      const footprint = deposit?.(action, strength > 0);
      if (strength > 0) {
        if (footprint) {
          for (const {point, angle, radius} of footprint) indexInk(artist.field, point, angle, radius);
        } else {
          for (const trace of group.traces) indexTrace(artist.field, trace, placement.place);
        }
      }
      if (!footprint || footprint.length) artist.committed++;
      return action;
    }
  };
}

export function prepareCanvas(canvas, seed) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const A = window.AlgoArt;
  A.W = W;
  A.H = H;
  A.paper(ctx, {paper: '#f5f0e6', grain: 11}, A.makeR(seed + '|shared-paper'));
  return ctx;
}

export function artistInk(artist, mark) {
  const index = artist.palette === 'signature' ? [0, 0, 0, 1, 2][mark % 5]
    : (mark - 1) % artist.inks.length;
  return artist.inks[index];
}

export function paint(ctx, action) {
  const {artist, group, placement} = action;
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
    if (placement.curved) {
      // Densify the original path before bending a link between two pinned nodes.
      const [start, ...points] = samplePath(commands).map(placement.place);
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
