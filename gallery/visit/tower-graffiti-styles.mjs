// Curated in-development alphabets. Kept separate from the 50 archived references.
export const TOWER_HANDS=Object.freeze(['guess','faust','revok','kadism','zephyr','gorey','skofe','skuf']);
export function pickTowerHand(random){return TOWER_HANDS[Math.floor(random.n()*TOWER_HANDS.length)];}
