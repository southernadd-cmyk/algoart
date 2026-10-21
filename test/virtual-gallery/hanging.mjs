// Deterministic, geometry-only exhibition hanging planner.
// The paintings themselves are still the source images; no artwork is duplicated.
// Keeping this independent of Three.js makes it testable across archive editions.
import { DOOR_WIDTH, makeRandom, seedFromString } from './layout.mjs';

const PROFILES = ['paired', 'focal', 'end-wall', 'salon', 'asymmetric', 'quiet'];
const SCALE = {
  landscape: {hero: 4.25, medium: 3.15, small: 2.35},
  portrait: {hero: 2.22, medium: 1.88, small: 1.54}
};

function ratio(study) {
  return Math.max(.4, Math.min(2.5, Number(study.aspect) || (study.portrait ? 1 / 1.4 : 1.4)));
}

function picture(study, role, room, rand) {
  const isPortrait = Boolean(study.portrait);
  const group = SCALE[isPortrait ? 'portrait' : 'landscape'];
  const width = group[role] * (.965 + rand() * .075);
  const bounded = Math.min(width, room.depth * .40);
  const height = bounded / ratio(study);
  const centerY = Math.max(2.45, Math.min(2.75, 1.15 + height / 2));
  return {
    studyId: study.id,
    width: bounded,
    height,
    y: room.y + centerY,
    role
  };
}

// Layout profiles establish genuinely distinct display rhythms.
// Position fractions leave clearance at both room ends for visitors and labels.
export function planRoomHangs(room, studies, date) {
  const rand = makeRandom(seedFromString('PROPORTION-PIECE-HANGING-v1:' + date + ':' + room.index +
    ':' + studies.map(s => s.seed || s.id).join('|')));
  const profile = PROFILES[room.index % PROFILES.length];
  const result = [];
  const remaining = [...studies];
  const landscapes = remaining.filter(s => !s.portrait);
  const direction = rand() < .5 ? -1 : 1;

  function consume(study, role, surface, fraction) {
    if (!study) return;
    const at = remaining.indexOf(study);
    if (at < 0) throw new Error('Study scheduled twice');
    remaining.splice(at, 1);
    const p = picture(study, role, room, rand);
    p.surface = surface;
    p.roomIndex = room.index;
    p.profile = profile;
    if (surface === 'left' || surface === 'right') {
      p.x = room.x + (surface === 'left' ? -1 : 1) * (room.width / 2 - .24);
      p.z = room.z0 + fraction * room.depth;
    } else {
      // The far end wall has a central doorway. Its wings can host a small
      // portrait or landscape without obscuring the exit.
      const wing = (room.width - DOOR_WIDTH) / 2;
      const maxImageWidth = wing - .9;
      p.width = Math.min(p.width, maxImageWidth);
      p.height = p.width / ratio(study);
      p.y = room.y + Math.max(2.35, Math.min(2.7, 1.1 + p.height / 2));
      p.surface = surface;
      p.x = room.x + (surface === 'end-left' ? -1 : 1) * (DOOR_WIDTH / 2 + wing / 2);
      p.z = room.z1 - .235;
    }
    result.push(p);
  }

  const side = direction < 0 ? 'left' : 'right';
  const opposite = direction < 0 ? 'right' : 'left';

  if (profile === 'paired' && landscapes.length >= 2) {
    // The pair occupies one wall, while a contrasting work anchors the other.
    consume(landscapes[0], 'medium', side, .30);
    consume(landscapes[1], 'medium', side, .70);
    if (remaining.length) consume(remaining[0], 'hero', opposite, .50);
  } else if (profile === 'salon' && remaining.length >= 3) {
    consume(remaining[0], 'small', side, .24);
    consume(remaining[1], 'medium', side, .74);
    consume(remaining[0], 'hero', opposite, .51);
  } else if (profile === 'end-wall' && remaining.length >= 2) {
    const endStudy = [...remaining].sort((a,b) => Number(b.portrait) - Number(a.portrait))[0];
    consume(endStudy, 'small', direction < 0 ? 'end-left' : 'end-right');
    if (remaining.length) consume(remaining[0], 'hero', side, .50);
    if (remaining.length) consume(remaining[0], 'medium', opposite, .48);
  } else if (profile === 'asymmetric' && remaining.length >= 3) {
    consume(landscapes[0] || remaining[0], 'hero', side, .34);
    consume(remaining[0], 'small', side, .78);
    consume(remaining[0], 'medium', opposite, .51);
  } else if (profile === 'quiet') {
    consume(landscapes[0] || remaining[0], 'hero', side, .51);
    if (remaining.length) consume(remaining[0], 'small', opposite, .25);
    if (remaining.length) consume(remaining[0], 'small', opposite, .75);
  } else {
    // Focal wall: one dominant landscape plus two supporting studies.
    consume(landscapes[0] || remaining[0], 'hero', side, .51);
    if (remaining.length) consume(remaining[0], 'medium', opposite, .28);
    if (remaining.length) consume(remaining[0], 'small', opposite, .73);
  }

  // Valid for partial editions with 1 or 2 works as well.
  const fractions = [.50, .26, .76];
  while (remaining.length) {
    consume(remaining[0], 'small', result.length % 2 ? opposite : side, fractions[result.length % fractions.length]);
  }

  return result;
}

export function planGalleryHangs(layout, studies) {
  const planned = layout.rooms.flatMap(room => {
    const works = studies.slice(room.artStart, room.artEnd);
    return planRoomHangs(room, works, layout.date);
  });
  if (planned.length !== studies.length || new Set(planned.map(p => p.studyId)).size !== studies.length) {
    throw new Error('Exhibition must hang every archived study exactly once');
  }
  return planned;
}
