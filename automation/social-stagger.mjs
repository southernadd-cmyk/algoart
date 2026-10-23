// Spread social publishing jobs apart without delaying artwork generation.
// Each live material/orientation job pauses just once after media is hosted.
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const STAGGER_MINUTES_MIN = 5;
export const STAGGER_MINUTES_MAX = 20;
export function pickStaggerMinutes(random = randomInt) {
  const minutes = random(STAGGER_MINUTES_MIN, STAGGER_MINUTES_MAX + 1);
  if (!Number.isInteger(minutes) ||
      minutes < STAGGER_MINUTES_MIN || minutes > STAGGER_MINUTES_MAX) {
    throw new Error('Invalid social publishing delay');
  }
  return minutes;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]))) {
  const minutes = pickStaggerMinutes();
  console.log('Social publishing stagger: ' + minutes + ' minutes (5–20 minute range).');
  if (!process.argv.includes('--dry-run')) {
    await sleep(minutes * 60_000);
    console.log('Social stagger complete; beginning platform publishing.');
  }
}
