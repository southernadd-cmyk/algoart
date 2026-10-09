import fs from 'node:fs/promises';
import path from 'node:path';
import { TIME_ZONE, SCHEDULE, PLATFORM_SLOTS } from './config.mjs';
import { makeCaptions } from './captions.mjs';

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

function isoDate(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftIsoDate(dateText, deltaDays) {
  const [year, month, day] = String(dateText).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

let date = process.env.SOCIAL_DATE || isoDate(now);

if (command === 'gate') {
  const forced = String(process.env.FORCE_SLOT || '').trim();
  const scheduled = String(process.env.SCHEDULED_SLOT || '').trim();
  let slot = null;

  if (forced !== '' && scheduled !== '') {
    throw new Error('FORCE_SLOT and SCHEDULED_SLOT cannot both be set.');
  }

  if (forced !== '') {
    const parsed = Number(forced);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= SCHEDULE.instagram.length) {
      throw new Error(`Invalid FORCE_SLOT: ${forced}`);
    }
    slot = parsed;
  } else if (scheduled !== '') {
    const parsed = Number(scheduled);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= SCHEDULE.instagram.length) {
      throw new Error(`Invalid SCHEDULED_SLOT: ${scheduled}`);
    }
    slot = parsed;

    // A delayed scheduled event can arrive after midnight. If the current London clock
    // is earlier than that slot's nominal time, this trigger must belong to yesterday.
    const current = Number(now.hour) * 60 + Number(now.minute);
    const target = minutes(SCHEDULE.instagram[slot]);
    if (!process.env.SOCIAL_DATE && current < target) {
      date = shiftIsoDate(date, -1);
    }
  } else {
    // Push-based recovery: publish the latest slot that is already due today.
    const current = Number(now.hour) * 60 + Number(now.minute);
    // Push recovery considers only the three normal production slots.
    // Slot 3 is a temporary externally-triggered noon test slot.
    for (const i of [2, 1, 0]) {
      if (current >= minutes(SCHEDULE.instagram[i])) {
        slot = i;
        break;
      }
    }
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
    instagram_caption_b64: b64(makeCaptions(item).instagram),
    threads_caption_b64: b64(makeCaptions(item).threads),
    bluesky_caption_b64: b64(makeCaptions(item).bluesky),
    pinterest_title_b64: b64(item.series + ' — ALGO/ART'),
    pinterest_description_b64: b64(
      item.series + ' generated with golden-ratio composition and imperfect digital marker strokes. ' +
      'Open this exact artwork state in ALGO/ART and remix it.'
    ),
    alt_text_b64: b64(item.copy.altText),
    share_url: item.shareUrl
  });
  process.exit(0);
}

throw new Error('Unknown command: ' + command);
