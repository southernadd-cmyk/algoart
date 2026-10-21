// Standalone architectural study. Do not change the legacy drawing engines.
export const PHI = (1 + Math.sqrt(5)) / 2;
export const INV_PHI = 1 / PHI;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const DOOR_WIDTH = 3.8;
export const ROOM_HEIGHT = 5.2;

export function seedFromString(value) {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let z = Math.imul(state ^ (state >>> 15), 1 | state);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// A seeded sequence of linked golden-section rooms and elevated promenades.
// Inverse-phi divisions control room size and the golden angle steers the route.
// Every doorway stays aligned to a continuous traversable central path.
export function buildLayout(date, artworkCount, artworkStates = []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid archive date');
  const count = Math.max(1, Math.floor(artworkCount));
  const sourceSignature = artworkStates.map(s => (s.seed || '') + ':' + (s.engine || '')).join('|');
  const rng = makeRandom(seedFromString('PROPORTION-PIECE-ARCHITECTURE-v1:' + date + ':' + sourceSignature));
  const roomCount = Math.ceil(count / 3);
  const rooms = [];
  const gap = 5.8;
  let start = 0;
  let center = 0;
  const phase = rng() * Math.PI * 2;
  const levelPattern = [0, INV_PHI * .75, INV_PHI * 1.5, INV_PHI * .75, 0];
  const reverse = rng() < 0.5 ? 1 : -1;

  for (let i = 0; i < roomCount; i++) {
    const system = artworkStates[i * 3]?.engine || 'field';
    const width = 10.7 + (i % 3) * 1.05 * INV_PHI + rng() * 1.1 + (system === 'rects' ? .8 : 0);
    const depth = 11.1 + Math.floor(rng() * 3) * INV_PHI * 1.6 + (system === 'organic' ? .6 : 0);
    const turn = system === 'spiral' ? 2.6 : system === 'network' ? 1.4 : 2.15;
    if (i) center = Math.max(-3.2, Math.min(3.2, center + Math.cos(phase + i * GOLDEN_ANGLE) * turn));
    const level = levelPattern[i % levelPattern.length] * reverse;
    // Galleries remain above ground; the pattern's orientation changes the rise sequence.
    const y = reverse < 0 ? INV_PHI * 1.5 + level : level;
    rooms.push({
      index: i, x: center, z0: start, z1: start + depth, width, depth, y, system,
      artStart: i * 3, artEnd: Math.min(count, i * 3 + 3),
      aspect: width / depth
    });
    start += depth + gap;
  }
  return { date, rooms, artworkCount: count, gap, doorWidth: DOOR_WIDTH };
}

// At a room the full chamber is available; between rooms, the path contracts
// to a door-width sloped bridge. One function serves drawing and collision.
export function footprintAt(layout, z) {
  const rooms = layout.rooms;
  const first = rooms[0];
  const last = rooms[rooms.length - 1];
  if (z < first.z0 || z > last.z1) return null;
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i];
    if (z >= a.z0 && z <= a.z1) return { x: a.x, y: a.y, halfWidth: a.width / 2, room: i };
    const b = rooms[i + 1];
    if (b && z > a.z1 && z < b.z0) {
      const t = (z - a.z1) / (b.z0 - a.z1);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        halfWidth: layout.doorWidth / 2,
        room: null
      };
    }
  }
  return null;
}

export function canStand(layout, x, z, padding = 0.48) {
  const section = footprintAt(layout, z);
  return Boolean(section && Math.abs(x - section.x) <= section.halfWidth - padding);
}
