import {crowdingAt} from './composition.js?v=studio-06';
export const CELL = 16;
export const REACH = 144;
const GOLD = Math.PI * (3 - Math.sqrt(5));
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const offset = (point, angle, distance) => ({
  x: point.x + Math.cos(angle) * distance,
  y: point.y + Math.sin(angle) * distance
});

function inkAt(point, fields, sheet) {
  const x = clamp(Math.floor(point.x / CELL), 0, sheet.cols - 1);
  const y = clamp(Math.floor(point.y / CELL), 0, sheet.rows - 1);
  const index = x + y * sheet.cols;
  let nearest = null;
  let distance = REACH;
  for (const field of fields) {
    if (field.distances[index] < distance) {
      nearest = field;
      distance = field.distances[index];
    }
  }
  return nearest ? {distance, angle: nearest.angle[index], owner: nearest.owner,
    x: nearest.x[index], y: nearest.y[index]} : {distance, angle: 0};
}

function costAt(point, heading, context, width) {
  const {fields, sheet, response} = context;
  const ink = inkAt(point, fields, sheet);
  const clearance = ink.distance - width;
  const overlap = Math.max(0, 13 - clearance) / 14;
  const alignment = Math.abs(Math.cos(ink.angle - heading)) * Math.max(0, 1 - ink.distance / 88);
  return Math.abs(clearance - response.gap) / REACH + overlap * response.overlap - alignment * response.alignment + crowdingAt(context, point);
}

export function nextGroup(artist, context, anchors) {
  const {pending, pose, system} = artist;
  const first = pending[0];
  if (!context.fields.length || pending.length < 2 || system === 'scribble') return {group: pending.shift(), prioritized: false};
  const section = first.info?.section;
  if (!section || section === 'frame' || section === 'axis') return {group: pending.shift(), prioritized: false};
  let index = 0;
  let best = Infinity;
  for (let i = 0; i < Math.min(pending.length, 5); i++) {
    const group = pending[i];
    if (group.info?.section !== section) break;
    // A branch can be chosen early once the artist has drawn its parent.
    if (i && system === 'organic' && group.info.depth && (!group.links || !anchors(group.links[0]))) continue;
    const probes = group.probes;
    const samples = [probes[0], probes[Math.floor(probes.length / 2)], probes.at(-1)];
    const score = samples.reduce((sum, {p, next}) => {
      const a = pose.place(p), b = pose.place(next);
      return sum + costAt(a, Math.atan2(b.y - a.y, b.x - a.x), context, 6);
    }, 0) / samples.length * context.gain + i * .13;
    if (score < best) {
      best = score;
      index = i;
    }
  }
  return {group: pending.splice(index, 1)[0], prioritized: index > 0};
}

function arcLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += length(points[i - 1], points[i]);
  return total;
}

function inside(point, sheet) {
  const edge = sheet.inset || 3;
  return point.x >= edge && point.y >= edge && point.x <= sheet.width - edge && point.y <= sheet.height - edge;
}

function alongSegment(a, b, fraction) {
  return {x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction};
}

function curvedPlan(points, context, width, constraints) {
  const travel = arcLength(points);
  if (points.length < 3 || travel < 27) return;
  const radius = clamp(travel * .34, 46, 142) * context.gain;
  const count = Math.min(points.length, clamp(Math.ceil(travel / 80) + 1, 4, 10));
  const stations = Array.from({length: count}, (_, i) => {
    const fraction = i / (count - 1);
    const index = Math.round(fraction * (points.length - 1));
    const point = points[index];
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    return {fraction: index / (points.length - 1), point,
      heading: Math.atan2(next.y - prev.y, next.x - prev.x)};
  });
  let observed = false;
  const layers = stations.map(({point, heading}, i) => {
    const near = inkAt(point, context.fields, context.sheet);
    const choices = [point];
    if (near.owner) observed = true;
    const pinned = (i === 0 && constraints.start) || (i === count - 1 && constraints.end);
    if (!pinned && inside(point, context.sheet)) {
      for (let k = 0; k < 12; k++) {
        const candidate = offset(point, k * GOLD + heading, radius * (k < 6 ? .55 : 1));
        if (inside(candidate, context.sheet)) choices.push(candidate);
      }
      if (near.owner && context.mode !== 'space') {
        for (const side of [-1, 1]) {
          const candidate = offset(near, near.angle + side * Math.PI / 2, width + context.response.gap);
          if (inside(candidate, context.sheet) && length(candidate, point) <= radius) choices.push(candidate);
        }
      }
    }
    return choices.map(candidate => ({
      candidate,
      cost: costAt(candidate, heading, context, width) + length(candidate, point) / radius * .23
    }));
  });
  if (!observed) return;
  let previous = layers[0].map(option => ({...option, path: [option.candidate]}));
  for (let i = 1; i < layers.length; i++) {
    const nominal = Math.max(8, length(stations[i - 1].point, stations[i].point));
    const reference = Math.atan2(stations[i].point.y - stations[i - 1].point.y, stations[i].point.x - stations[i - 1].point.x);
    previous = layers[i].map(({candidate, cost}) => {
      let best = Infinity;
      let parent;
      for (const option of previous) {
        const distance = length(option.candidate, candidate);
        const heading = Math.atan2(candidate.y - option.candidate.y, candidate.x - option.candidate.x);
        const midpoint = alongSegment(option.candidate, candidate, .5);
        const continuity = .28 * Math.abs(distance - nominal) / (nominal + 24) +
          .14 * (1 - Math.cos(heading - reference));
        const score = option.cost + cost + continuity + .66 * costAt(midpoint, heading, context, width);
        if (score < best) {
          best = score;
          parent = option;
        }
      }
      return {candidate, cost: best, path: [...parent.path, candidate]};
    });
  }
  const best = previous.reduce((a, b) => a.cost <= b.cost ? a : b);
  const offsets = stations.map(({point, fraction}, i) => ({
    fraction, x: best.path[i].x - point.x, y: best.path[i].y - point.y
  }));
  if (!offsets.some(point => Math.hypot(point.x, point.y) > 13)) return;
  const contacts = best.path.map(point => inkAt(point, context.fields, context.sheet))
    .filter(ink => ink.owner && ink.distance < 92).map(ink => ink.owner);
  return {offsets, contacts};
}

function fittedOutline(points, context, width) {
  const center = points.reduce((sum, p) => ({x: sum.x + p.x / points.length, y: sum.y + p.y / points.length}), {x: 0, y: 0});
  if (!inside(center, context.sheet)) return;
  const stride = Math.max(1, Math.ceil(points.length / 24));
  const samples = points.filter((_, i) => i % stride === 0);
  if (!samples.some(p => inkAt(p, context.fields, context.sheet).owner)) return;
  function score(move) {
    return samples.reduce((sum, point) => {
      const p = move(point);
      return sum + (inside(p, context.sheet) || !inside(point, context.sheet) ? 0 : 2) + costAt(p, 0, context, width);
    }, 0) / samples.length;
  }
  let best = score(point => point);
  let chosen;
  for (const dx of [-.40, -.22, 0, .22]) {
    for (const dy of [-.40, -.22, 0, .22]) {
      if (!dx && !dy) continue;
      const fx = 1 + dx * context.gain, fy = 1 + dy * context.gain;
      const move = point => ({x: center.x + (point.x - center.x) * fx, y: center.y + (point.y - center.y) * fy});
      const current = score(move) + (Math.abs(dx) + Math.abs(dy)) * .23;
      if (current < best - .045) {
        best = current;
        chosen = move;
      }
    }
  }
  if (chosen) {
    const contacts = samples.map(point => inkAt(chosen(point), context.fields, context.sheet))
      .filter(ink => ink.owner && ink.distance < 92).map(ink => ink.owner);
    return {move: chosen, contacts};
  }
}

export function planStrokes(group, artist, placement, context) {
  const plans = new Map();
  if (!context.fields.length || group.info?.section === 'frame') return plans;
  const materialWidths = {marker: .5, tissue: 1.2, watercolour: 1.5, oil: 1.4, action: .65};
  for (const trace of group.traces) {
    const points = trace.points.map(placement.place);
    const width = Math.min(28, trace.width * materialWidths[artist.material]);
    const first = trace.points[0], last = trace.points.at(-1);
    const closed = trace.points.length > 4 && length(first, last) < 15;
    const outline = trace.kind === 'rect' || trace.kind === 'poly';
    const links = group.links || [];
    const plan = outline && !links.length ? fittedOutline(points, context, width)
      : curvedPlan(points, context, width, {
        start: closed || links.some(point => length(first, point) < 16) ||
          Boolean(group.pivot && length(first, group.pivot) < 23),
        end: closed || links.some(point => length(last, point) < 16)
      });
    if (plan) plans.set(trace.mark, plan);
  }
  return plans;
}

export function plannedPoints(points, placement, plan) {
  const world = points.map(placement.place);
  if (!plan || world.length < 2) return world;
  if (plan.move) return world.map(point => (placement.constrain || (p => p))(plan.move(point)));
  const offsets = plan.offsets;
  let j = 1;
  return world.map((point, i) => {
    const fraction = i / (world.length - 1);
    while (j < offsets.length - 1 && fraction > offsets[j].fraction) j++;
    const before = offsets[j - 1], after = offsets[j];
    const t = clamp((fraction - before.fraction) / (after.fraction - before.fraction), 0, 1);
    const eased = t * t * (3 - 2 * t);
    const shift = alongSegment(before, after, eased);
    const moved = {x: point.x + shift.x, y: point.y + shift.y};
    return placement.constrain ? placement.constrain(moved) : moved;
  });
}
