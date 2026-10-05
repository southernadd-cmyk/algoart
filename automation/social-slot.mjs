import fs from 'node:fs/promises';
import path from 'node:path';
import { TIME_ZONE, SCHEDULE, PLATFORM_SLOTS } from './config.mjs';

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function minutes(text) {
  const [h, m] = String(text).split(':').map(Number);
  return h * 60 + m;
}

async function writeOutput(values) {
  const target = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}`).join('\n') + '\n';
  if (target) await fs.appendFile(target, lines);
  else process.stdout.write(lines);
}

function b64(text) {
  return Buffer.from(String(text || ''), 'utf8').toString('base64');
}

const command = process.argv[2] || 'gate';
const now = localParts();
const date = process.env.SOCIAL_DATE || `${now.year}-${now.month}-${now.day}`;

if (command === 'gate') {
  const forced = String(process.env.FORCE_SLOT || '').trim();
  let slot = null;

  if (forced !== '') {
    const parsed = Number(forced);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= SCHEDULE.instagram.length) {
      throw new Error(`Invalid FORCE_SLOT: ${forced}`);
    }
    slot = parsed;
  } else {
    const current = Number(now.hour) * 60 + Number(now.minute);
    let best = null;
    for (let i = 0; i < SCHEDULE.instagram.length; i++) {
      const delta = Math.abs(current - minutes(SCHEDULE.instagram[i]));
      if (delta <= 55 && (!best || delta < best.delta)) best = { slot: i, delta };
    }
    if (best) slot = best.slot;
  }

  if (slot === null) {
    await writeOutput({ should_post: 'false', date });
    process.exit(0);
  }

  if (SCHEDULE.instagram[slot] !== SCHEDULE.threads[slot]) {
    throw new Error('Instagram and Threads schedules are not aligned for slot ' + slot);
  }

  await writeOutput({
    should_post: 'true',
    date,
    slot,
    target_time: SCHEDULE.instagram[slot],
    local_time: `${now.hour}:${now.minute}`
  });
  process.exit(0);
}

if (command === 'select') {
  const slot = Number(process.env.SLOT);
  if (!Number.isInteger(slot) || slot < 0 || slot >= SCHEDULE.instagram.length) {
    throw new Error('SLOT is missing or invalid.');
  }

  const igIndex = PLATFORM_SLOTS.instagram[slot];
  const threadsIndex = PLATFORM_SLOTS.threads[slot];
  if (igIndex !== threadsIndex) {
    throw new Error('Instagram and Threads must use the same artwork for each live slot.');
  }

  const queuePath = path.resolve('social-output', date, 'queue.json');
  const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));
  const item = queue.entries[igIndex];
  if (!item) throw new Error(`No generated queue entry for slot ${slot} at index ${igIndex}.`);

  const imagePath = path.resolve('social-output', date, item.imageFile);
  await fs.access(imagePath);

  await writeOutput({
    id: item.id,
    image_path: imagePath,
    asset_name: `algoart-${date}-slot${slot + 1}.jpg`,
    instagram_caption_b64: b64(item.copy.instagram),
    threads_caption_b64: b64(item.copy.threads),
    alt_text_b64: b64(item.copy.altText),
    share_url: item.shareUrl
  });
  process.exit(0);
}

throw new Error('Unknown command: ' + command);
