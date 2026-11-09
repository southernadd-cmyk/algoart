import {CELL, REACH, nextGroup, planStrokes, plannedPoints, selfOverlapAt} from './mark-planner.js?v=confluence-self-repel-04';
import {turnBudget, makeSchedule, phiAnchors, inkDensity, crowdingAt, resolveTurnBudget} from './composition.js?v=confluence-rotate-lead-05';
import {inferResponse} from './adaptive-response.js?v=adaptive-01';
import {wantsOilContact,oilContactCandidates,contactFraction} from './oil-contact.js?v=oil-structure-02';
import {capRectangleFootprint, rectangleInteriors, interiorCandidates} from './rect-collaboration.js?v=rect-cells-01';
import {expandRecursiveTurns} from './recursive-turns.js?v=recursive-turns-sparse-02';
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
  spectrum: 'Full Spectrum', golden: 'Golden-angle hues',
  marker: 'Classic Markers', cmyk: 'CMYK', primary: 'Primary', neon: 'Neon',
  pastel: 'Pastel', earth: 'Earth', warm: 'Warm', cold: 'Cold', mono: 'Monochrome'
};

export function slotInk(id) {
  return systems[(id - 1) % systems.length].ink;
}

export function paletteInks(artist, seed) {
  const {colourCount, saturation, brightness} = artist.settings;
  const A = window.AlgoArt;
  A.rendererVersion = 10;
  return A.hues({palette: artist.palette, colourCount, saturation, brightness},
    A.makeR(seed + '|palette|' + artist.id));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pt = (x, y) => ({x, y});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const key = ({x, y}) => x.toFixed(4) + ',' + y.toFixed(4);
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
      points: samplePath(commands), width: path.width, opacity: path.opacity, passes: path.passes, mark: path.mark, kind: path.kind
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
    // Renderer-v2-only provenance. Retain the original SOLO guide's
    // hierarchy for the committed geometry adapter; v1 never reads this.
    // Locations must be transformed when each turn is actually placed.
    if (guide?.type === 'organic' && branchAnchor.has(token)) {
      const segment=branchAnchor.get(token);
      group.oilGuide={type:'organic',branch:segment.branch,depth:segment.depth};
    }
    if (guide?.type === 'spiral' && Array.isArray(guide.points) && guide.points.length) {
      const nearest=guide.points.reduce((best,p)=>{
        const d=distance(p,group.center);
        return !best||d<best.distance?{distance:d,point:p}:best;
      },null);
      group.oilGuide={type:'spiral',arm:nearest.point.arm??0};
    }
    if (guide?.type === 'constructed' && Array.isArray(guide.items) && guide.items.length) {
      const nearest=guide.items.reduce((best,item)=>{
        if(!Number.isFinite(item.x)||!Number.isFinite(item.y))return best;
        const d=distance(item,group.center);
        return !best||d<best.distance?{distance:d,item}:best;
      },null);
      if(nearest)group.oilGuide={type:'constructed',
        tier:nearest.item.tier,size:nearest.item.size};
    }
    if (guide?.type === 'rects' && group.cell) {
      group.oilGuide={type:'rects',depth:group.cell.depth||0};
    }
  }
  // Recursive Divisions cells, Constructed Forms shapes and Automatic
  // Marks runs each contain multiple real strokes. Split their existing
  // recorded geometry into genuine sequential drawing gestures rather
  // than treating a whole shape/run as a single Confluence turn.
  // This changes only Confluence scheduling, never the solo engines.
  // The usual low-group systems need progressive source gestures; so does
  // ANY sparse source drawing. A Golden Trajectories study with five long
  // source groups otherwise caps the entire three-artist study at 8 turns,
  // even when the other hands have dozens of groups. This only slices the
  // recorded existing strokes; it never synthesizes or repeats marks.
  const progressive=['rects','constructed','scribble'].includes(guide?.type) ||
    groups.length<29;
  return {...artist,groups:progressive?
    expandRecursiveTurns(groups,samplePath):groups};
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

function indexTrace(field, density, trace, placement, plan, pigmentGain) {
  const points = plannedPoints(trace.points, placement, plan);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const neighbour = points[i + 1] || points[i - 1] || point;
    const angle = Math.atan2(neighbour.y - point.y, neighbour.x - point.x);
    indexInk(field, point, angle, trace.width / 2);
    density?.stamp(point, trace.width / 2, (1 - (1 - trace.opacity) ** (trace.passes || 1)) * pigmentGain);
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

export function judge(group, candidate, context, width) {
  const {fields, response, sheet} = context;
  const {width: w, height: h, cols, rows, inset} = sheet;
  let sum = 0;
  let peak = 0;
  for (const probe of group.probes) {
    const p = candidate.place(probe.p);
    const outside = Math.max(0, inset - p.x, p.x - w + inset, inset - p.y, p.y - h + inset);
    sum += outside * .065 + crowdingAt(context, p);
    const x = clamp(Math.floor(p.x / CELL), 0, cols - 1);
    const y = clamp(Math.floor(p.y / CELL), 0, rows - 1);
    const index = x + y * cols;
    let nearest = REACH;
    let heading = 0;
    for (const other of fields) {
      if (other.distances[index] < nearest) {
        nearest = other.distances[index];
        heading = other.angle[index];
      }
    }
    const clearance = nearest - width;
    const contact = clamp((19 - clearance) / 19, 0, 2);
    const next = candidate.place(probe.next);
    const angle = Math.atan2(next.y - p.y, next.x - p.x);
    // Other hands set the desired relationship. Same-hand provisional
    // strokes contribute only collision avoidance, never attraction to a
    // preferred gap or their previous direction.
    const selfContact=selfOverlapAt(p,context.selfField,sheet,width);
    sum += Math.abs(clearance - response.gap) / REACH +
      (contact+selfContact)*response.overlap;
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

function anchoredPose(artist, target, sheet) {
  if (!artist.groups.length) return {place: identity};
  const centers = artist.groups.map(group => group.center);
  const origin = pt(
    centers.reduce((sum, p) => sum + p.x / centers.length, 0),
    centers.reduce((sum, p) => sum + p.y / centers.length, 0)
  );
  let scale = 1;
  for (const group of artist.groups) {
    for (const {commands} of group.paths) {
      for (const {points} of commands) {
        for (const p of points) {
          const dx = p.x - origin.x, dy = p.y - origin.y;
          if (dx < 0) scale = Math.min(scale, (target.x - sheet.inset) / -dx);
          if (dx > 0) scale = Math.min(scale, (sheet.width - sheet.inset - target.x) / dx);
          if (dy < 0) scale = Math.min(scale, (target.y - sheet.inset) / -dy);
          if (dy > 0) scale = Math.min(scale, (sheet.height - sheet.inset - target.y) / dy);
        }
      }
    }
  }
  return {place: transform(origin, target, 0, scale)};
}

function limitPigment(group, placement, context) {
  if (!context.density) return 1;
  const loads = group.probes.map(probe => context.density.at(placement.place(probe.p)));
  const average = loads.reduce((sum, value) => sum + value, 0) / loads.length;
  const pressure = average * .7 + Math.max(...loads) * .3;
  return clamp(1 - Math.max(0, pressure - (context.mode === 'space' ? 1.15 : 1.7)) * .22, .46, 1);
}

export function createStudy(seed, slots, paperSettings, collaborationPull = 100, requestedTurns = 55,leadIndex=0) {
  if (slots.length !== 3) throw new Error('Confluence requires exactly three artists.');
  const portrait = paperSettings.orientation === 'portrait';
  const width = portrait ? 1000 : 1400;
  const height = portrait ? 1400 : 1000;
  const edgeMargin = paperSettings.edgeMargin ?? true;
  const shortSide = Math.min(width, height);
  const sheet = {...paperSettings, width, height, cols: Math.ceil(width / CELL), rows: Math.ceil(height / CELL),
    border: 16, inset: shortSide * (edgeMargin ? .12 : .054), edgeMargin};
  const anchors = phiAnchors(sheet, window.AlgoArt.hash(seed + '|phi-anchors') >>> 0);
  sheet.constrain = point => pt(clamp(point.x, sheet.inset, width - sheet.inset),
    clamp(point.y, sheet.inset, height - sheet.inset));
  const source = document.createElement('canvas');
  const roster = slots.map((slot, index) => {
    const system = systems.find(candidate => candidate.id === slot.system);
    const artist = {...system, ...slot, number: index + 1, inks: paletteInks(slot, seed), ink: slotInk(slot.id)};
    // Each slot keeps its own random stream and spatial field, including
    // when two slots choose the same system and material.
    return recordArtist(artist, seed, sheet, source);
  });
  const {count:budget, available:availableTurns} = resolveTurnBudget(turnBudget(roster), requestedTurns);
  const equal = makeSchedule(roster, budget, 0);
  const primary = collaborationPull === 0 ? equal : makeSchedule(roster, budget, collaborationPull,leadIndex);
  return {seed,roster, schedule: primary.turns, primary, equal, sheet, anchors, availableTurns,
    collaborationPull,leadIndex,totalTurns:budget};
}

export function makeRun(study, strength, {equal = false} = {}) {
  const programme = equal ? study.equal : study.primary;
  const density = study.anchors.length && strength > 0 ? inkDensity(study.sheet, CELL) : null;
  const rectCount=study.roster.filter(artist=>artist.system==='rects').length;
  const mixedRects=rectCount>0&&rectCount<study.roster.length&&strength>0&&study.collaborationPull>0;
  const artists = new Map(study.roster.map((artist, i) => {
    const anchor=study.anchors[i];
    const initial=anchor?anchoredPose(artist,anchor,study.sheet):{place:identity};
    const place=mixedRects&&artist.system==='rects'
      ?capRectangleFootprint(artist.groups,initial.place,anchor,study.sheet,
        study.collaborationPull,rectCount)
      :initial.place;
    return [artist.id,{
      ...artist,field:field(study.sheet,artist.id),
      pending:artist.groups.slice(),
      anchors:new Map(),committed:0,rectInvited:0,fragmentPlacements:new Map(),pose:{place}
    }];
  }));
  // The existing rectangle guide is a shared structure, not an exclusion
  // zone. Other systems can work *inside its actual transformed cells*.
  const rectangleCells=mixedRects?rectangleInteriors([...artists.values()].map(a=>({...a,groups:a.pending})),study.sheet):[];
  const rectangleUse=new Map();
  const invitationFraction=Math.min(.62,.72*study.collaborationPull/100*strength/100);

  let turn = 0;
  const oilStats={attempts:0,sites:0,qualified:0,selected:0,rejected:0};
  const intraTurnStats={turns:0,decisions:0,stamped:0,nearby:0};
  return {
    oilDiagnostics:()=>({...oilStats}),
    intraTurnDiagnostics:()=>({...intraTurnStats}),
    next(deposit) {
      const entry=programme.turns[turn++];
      if(!entry)return null;
      const artist=artists.get(entry.id);
      const quota=entry.groupQuota||1;
      const actions=[];
      // Provisional ink is for *planning only*. It makes later gestures in
      // this turn see earlier gestures from the same hand, even though the
      // native painter still renders the entire turn as one batch. Never
      // stamp this provisional ink into the committed material footprint:
      // the physical renderer provides that footprint once after painting.
      const provisional=strength>0&&quota>1?{
        field:field(study.sheet,artist.id),
        density:inkDensity(study.sheet,CELL)
      }:null;
      if(provisional)intraTurnStats.turns++;
      // One public turn can comprise several related drawing gestures.
      // Plan them sequentially, retaining one native material pass per turn.
      for(let gesture=0;gesture<quota;gesture++){
        if(!artist.pending.length)
          throw new Error('Artist '+artist.id+' exhausted marks before completing the schedule');
        const others=[...artists.values()].filter(other=>other!==artist&&other.committed>0);
        const otherFields=others.map(other=>other.field);
        // Only OTHER artists belong to response/gap/alignment fields.
        // Previous same-turn gestures are tracked separately for repulsion.
        const fields=otherFields;
        const selfField=provisional&&gesture>0?provisional.field:null;
        const planningDensity=provisional&&gesture>0?{
          at:point=>(density?.at(point)||0)+provisional.density.at(point)
        }:density;
        if(provisional&&gesture>0){
          intraTurnStats.decisions++;
          const probe=artist.pending[0]?.probes?.[0];
          if(probe){
            const p=artist.pose.place(probe.p);
            const x=clamp(Math.floor(p.x/CELL),0,study.sheet.cols-1);
            const y=clamp(Math.floor(p.y/CELL),0,study.sheet.rows-1);
            if(provisional.field.distances[x+y*study.sheet.cols]<REACH)
              intraTurnStats.nearby++;
          }
        }
        // Do not infer echo/space modes from the hand's own provisional
        // strokes. Its provisional density only affects placement/crowding.
        const initial=inferResponse(artist.pending[0],artist,fields,density,study.sheet);
        let context={fields,selfField,response:initial.response,sheet:study.sheet,
          mode:initial.mode,gain:strength/100,density:planningDensity};
        const selection=strength>0
          ? nextGroup(artist,context,p=>artist.anchors.has(key(p)))
          : {group:artist.pending.shift(),prioritized:false};
        const {group,prioritized}=selection;
        const reaction=inferResponse(group,artist,fields,density,study.sheet);
        context={...context,response:reaction.response,mode:reaction.mode};
        // Reassembled contours must share the same placement; changing it
        // halfway through would tear a rectangle or connected gesture.
        const savedPlacement=group.fragmentParent&&artist.fragmentPlacements.get(group.fragmentParent);
        let placement=savedPlacement||{place:artist.pose.place,effort:0};
        if(strength>0&&!savedPlacement){
          const choices=candidates(group,artist,strength,turn);
          placement=choices[0];
          if(fields.length||density||selfField){
            const width=inkRadius(artist,group);
            let best=judge(group,placement,context,width);
            for(const candidate of choices.slice(1)){
              const score=judge(group,candidate,context,width);
              if(score<best-.005){placement=candidate;best=score;}
            }
            if(mixedRects&&artist.system!=='rects'){
              const inside=interiorCandidates(group,artist,rectangleCells,turn,rectangleUse);
              let bestInside=null,bestInsideScore=Infinity;
              for(const candidate of inside){
                const score=judge(group,candidate,context,width)+candidate.used*.22-
                  invitationFraction*.43;
                if(score<bestInsideScore){bestInside=candidate;bestInsideScore=score;}
              }
              const owed=artist.rectInvited<Math.ceil((artist.committed+gesture+1)*invitationFraction);
              if(bestInside&&bestInsideScore<best+(owed?1.05:0))
                placement=bestInside;
            }
            // Occasionally approach the *actual* marks made by another
            // artist, instead of treating every occupied area as forbidden.
            // The seed decides when; real indexed stroke positions decide
            // where. Guard against dense pools and disruptive placements.
            if(artist.material==='oil'&&
              wantsOilContact(study.seed,artist.id,
                group.fragmentParent||group.id,
                study.collaborationPull,strength)){
              oilStats.attempts++;
              let chosen=null,contactScore=Infinity;
              // Oil's contact invitation specifically targets *other*
              // artists, not this turn's provisional self-ink.
              const sites=oilContactCandidates(group,artist,otherFields,planningDensity,
                study.sheet,turn);
              oilStats.sites+=sites.length;
              for(const candidate of sites){
                const contact=contactFraction(group,candidate,otherFields,study.sheet);
                if(contact<.08)continue;
                oilStats.qualified++;
                const score=judge(group,candidate,context,width)-contact*.9;
                if(score<contactScore){
                  contactScore=score;chosen=candidate;
                }
              }
              const current=judge(group,placement,context,width);
              if(chosen&&contactScore<current+2.5){
                placement=chosen;oilStats.selected++;
              }else if(chosen)oilStats.rejected++;
            }
          }
        }
        if(placement.rectCellId){
          rectangleUse.set(placement.rectCellId,(rectangleUse.get(placement.rectCellId)||0)+1);
          artist.rectInvited++;
        }
        if(study.sheet.constrain&&!savedPlacement){
          const place=placement.place;
          placement={...placement,constrain:study.sheet.constrain,
            place:point=>study.sheet.constrain(place(point))};
        }
        if(group.fragmentParent&&!savedPlacement)
          artist.fragmentPlacements.set(group.fragmentParent,placement);
        for(const anchor of group.links||[])
          if(!artist.anchors.has(key(anchor)))artist.anchors.set(key(anchor),placement.place(anchor));
        const plans=strength>0&&!group.fragmentParent
          ? planStrokes(group,artist,placement,context):new Map();
        const contacts=[...new Set([...plans.values()].flatMap(plan=>plan.contacts))]
          .filter(id=>id!==artist.id&&artists.has(id))
          .map(id=>artists.get(id).number);
        const pigmentGain=limitPigment(group,placement,context);
        actions.push({
          artist,group,placement,plans,contacts,heard:strength>0?others.length:0,
          changed:placement.effort>0||plans.size>0||prioritized,
          reordered:prioritized,reaction:reaction.mode,responseEvidence:reaction.evidence,
          pigmentGain,border:study.sheet.border
        });
        if(provisional){
          for(const trace of group.traces)
            indexTrace(provisional.field,provisional.density,trace,placement,
              plans.get(trace.mark),pigmentGain);
          provisional.density.commit();
          intraTurnStats.stamped++;
        }
      }
      const observe=strength>0;
      let footprint;
      if(deposit?.batch)footprint=deposit.batch(actions,observe);
      else if(deposit){
        const contributed=[];
        for(const action of actions){
          const result=deposit(action,observe);
          if(result?.length)contributed.push(...result);
        }
        footprint=contributed.length?contributed:undefined;
      }
      if(observe){
        if(footprint?.length){
          for(const {point,angle,radius,opacity=1} of footprint){
            indexInk(artist.field,point,angle,radius);
            density?.stamp(point,radius,opacity);
          }
        }else{
          for(const action of actions)for(const trace of action.group.traces)
            indexTrace(artist.field,density,trace,action.placement,
              action.plans.get(trace.mark),action.pigmentGain);
        }
        density?.commit();
      }
      artist.committed+=actions.length;
      const last=actions.at(-1);
      // One history entry and one Step operation per allocated *turn*.
      // The complete list remains available for audit and progress readout.
      if(actions.length===1)return {...last,
        groupIds:[last.group.id],drawnGroups:artist.groups.length-artist.pending.length,
        totalGroups:artist.groups.length,gestureCount:1};
      const combinedPlans=new Map();
      const contacts=new Set();
      actions.forEach((action,i)=>{
        for(const [id,plan] of action.plans)combinedPlans.set(i+':'+id,plan);
        for(const number of action.contacts)contacts.add(number);
      });
      return {...last,
        group:{label:actions.length+' gestures · '+last.group.label},
        groupIds:actions.map(action=>action.group.id),gestureCount:actions.length,
        drawnGroups:artist.groups.length-artist.pending.length,
        totalGroups:artist.groups.length,plans:combinedPlans,
        contacts:[...contacts],heard:Math.max(...actions.map(a=>a.heard)),
        changed:actions.some(a=>a.changed),reordered:actions.some(a=>a.reordered)};

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
    ctx.globalAlpha = path.opacity * action.pigmentGain;
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
