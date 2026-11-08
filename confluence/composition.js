const INV_PHI = (Math.sqrt(5) - 1) / 2;
const PHI_SHARES = [.5, .5 * INV_PHI, .5 * INV_PHI * INV_PHI];
const sum = values => values.reduce((total, value) => total + value, 0);

export function turnShares(pull) {
  const mix = pull / 100;
  return PHI_SHARES.map(share => (1 - mix) / 3 + mix * share);
}

function apportion(total, shares, capacities) {
  const desired = shares.map(share => share * total);
  const counts = capacities.map((limit, i) => Math.min(limit, Math.floor(desired[i])));
  let remaining = total - sum(counts);
  while (remaining > 0) {
    let chosen = -1;
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] < capacities[i] && (chosen < 0 || desired[i] - counts[i] > desired[chosen] - counts[chosen])) chosen = i;
    }
    counts[chosen]++;
    remaining--;
  }
  return counts;
}

export function turnBudget(roster) {
  const capacities = roster.map(artist => artist.groups.length);
  if (roster.length !== 3) throw new Error('Three artists are required.');
  const total = sum(capacities);
  if (capacities.includes(0)) return total;
  // Choose the largest shared budget the artists can supply at either end
  // of the slider. The smaller native drawing limits both comparison panels.
  const maxShare = PHI_SHARES.map(share => Math.max(share, 1 / 3));
  const limit = Math.min(...capacities.map((capacity, i) => Math.floor(capacity / maxShare[i])));
  return Math.max(capacities.length, Math.floor(limit / capacities.length) * capacities.length);
}

export function makeSchedule(roster, total, pull) {
  const capacities = roster.map(artist => artist.groups.length);
  const shares = turnShares(pull);
  const counts = apportion(total, shares, capacities);
  const drawn = counts.map(() => 0);
  const turns = [];
  for (let i = 0; i < total; i++) {
    let seat = -1;
    for (let k = 0; k < counts.length; k++) {
      if (drawn[k] === counts[k]) continue;
      if (seat < 0 || (i + 1) * (counts[k] - counts[seat]) > (drawn[k] - drawn[seat]) * total) seat = k;
    }
    const artist = roster[seat];
    turns.push({id: artist.id, group: artist.groups[drawn[seat]++]});
  }
  return {turns, counts};
}

export function phiAnchors(sheet, seedHash) {
  const near = 1 - INV_PHI;
  const fractions = [[near, near], [INV_PHI, near], [INV_PHI, INV_PHI], [near, INV_PHI]];
  return [0, 2, 1].map(shift => {
    const [x, y] = fractions[(seedHash + shift) % fractions.length];
    return {x: x * sheet.width, y: y * sheet.height};
  });
}

export function inkDensity(sheet, cell) {
  const count = sheet.cols * sheet.rows;
  const load = new Float32Array(count);
  const layer = new Float32Array(count);
  const touched = [];
  return {
    at(point) {
      const x = Math.max(0, Math.min(sheet.cols - 1, Math.floor(point.x / cell)));
      const y = Math.max(0, Math.min(sheet.rows - 1, Math.floor(point.y / cell)));
      return load[x + y * sheet.cols];
    },
    stamp(point, radius, opacity) {
      const reach = Math.min(3 * cell, cell + radius);
      const minX = Math.max(0, Math.floor((point.x - reach) / cell));
      const maxX = Math.min(sheet.cols - 1, Math.floor((point.x + reach) / cell));
      const minY = Math.max(0, Math.floor((point.y - reach) / cell));
      const maxY = Math.min(sheet.rows - 1, Math.floor((point.y + reach) / cell));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const distance = Math.hypot((x + .5) * cell - point.x, (y + .5) * cell - point.y);
          const value = opacity * Math.max(0, 1 - distance / reach);
          const index = x + y * sheet.cols;
          if (value <= layer[index]) continue;
          if (!layer[index]) touched.push(index);
          layer[index] = value;
        }
      }
    },
    commit() {
      for (const index of touched) {
        load[index] += layer[index];
        layer[index] = 0;
      }
      touched.length = 0;
    }
  };
}

export function crowdingAt(context, point) {
  const density = context.density?.at(point) || 0;
  const excess = Math.max(0, density - .8);
  return Math.min(9, excess * excess) * (context.mode === 'space' ? 2.8 : 1.15);
}


// Minimum five turns keeps all three voices present at any φ allocation.
export const FIBONACCI_TURNS = Object.freeze([5,8,13,21,34,55,89,144,233,377,610,987,1597,2584]);
export function fibonacciTurnOptions(capacity){
  return FIBONACCI_TURNS.filter(n=>n<=capacity);
}
export function resolveTurnBudget(capacity,requested){
  const available=fibonacciTurnOptions(capacity);
  if(!available.length) throw new Error('Choose systems with at least five available drawing turns.');
  const asked=Number(requested);
  if(available.includes(asked))return {count:asked,available};
  return {count:available.filter(n=>n<=asked).at(-1)||available.at(-1),available};
}
