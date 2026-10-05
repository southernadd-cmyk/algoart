import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SITE_URL, LOCAL_URL, TIME_ZONE, ACCOUNTS, DAILY_COUNT,
  SCHEDULE, PLATFORM_SLOTS, MODES, PALETTES, PENS
} from './config.mjs';
import { makeCaptions } from './captions.mjs';

function dateInZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function hash(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function int(r, min, max) {
  return Math.floor(min + r() * (max - min + 1));
}

function pick(r, values) {
  return values[Math.floor(r() * values.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function settingsFor(day, index, seedSalt = '') {
  const salt = String(seedSalt || '').trim();
  const saltKey = salt ? `|${salt}` : '';
  const r = rng(`${day}|ALGOART|${index}${saltKey}`);
  const rotation = hash(day + saltKey) % MODES.length;
  const modeInfo = MODES[(index + rotation) % MODES.length];
  const mode = modeInfo[0];

  const modeDefaults = {
    field:     { elements: 48, density: 58, complexity: 62, negativeSpace: 28, spiralInfluence: 54, curveBias: 45 },
    spiral:    { elements: 54, density: 55, complexity: 60, negativeSpace: 24, spiralInfluence: 84, curveBias: 62 },
    rects:     { elements: 38, density: 48, complexity: 66, negativeSpace: 22, spiralInfluence: 18, curveBias: 12 },
    burst:     { elements: 50, density: 60, complexity: 63, negativeSpace: 24, spiralInfluence: 56, curveBias: 38 },
    network:   { elements: 42, density: 52, complexity: 64, negativeSpace: 26, spiralInfluence: 48, curveBias: 32 },
    organic:   { elements: 44, density: 54, complexity: 60, negativeSpace: 30, spiralInfluence: 58, curveBias: 84 },
    geometric: { elements: 30, density: 50, complexity: 58, negativeSpace: 34, spiralInfluence: 28, curveBias: 8 },
    scribble:  { elements: 46, density: 56, complexity: 66, negativeSpace: 31, spiralInfluence: 52, curveBias: 72 }
  }[mode];

  const seed = `AA-${day.replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}-${(hash(day + '|' + index + saltKey) % 100000).toString().padStart(5, '0')}`;

  return {
    mode,
    series: modeInfo[1],
    seed,
    elements: clamp(modeDefaults.elements + int(r, -8, 9), 14, 78),
    density: clamp(modeDefaults.density + int(r, -12, 12), 28, 78),
    complexity: clamp(modeDefaults.complexity + int(r, -11, 13), 35, 82),
    negativeSpace: clamp(modeDefaults.negativeSpace + int(r, -10, 13), 12, 58),
    phiStrength: int(r, 82, 100),
    recursion: int(r, 4, 8),
    spiralInfluence: clamp(modeDefaults.spiralInfluence + int(r, -10, 10), 8, 95),
    goldenAngle: int(r, 86, 100),
    nesting: int(r, 22, 62),
    pen: pick(r, PENS),
    thickness: int(r, 5, 13),
    wobble: int(r, 22, 58),
    overdraw: int(r, 2, 6),
    opacity: int(r, 64, 88),
    pressure: int(r, 28, 66),
    dryness: int(r, 8, 42),
    curveBias: clamp(modeDefaults.curveBias + int(r, -10, 10), 0, 96),
    shapeAmount: int(r, 48, 82),
    overlap: int(r, 28, 66),
    rotation: int(r, 55, 100),
    lines: true,
    circles: true,
    rectangles: true,
    polygons: true,
    arcs: true,
    palette: pick(r, PALETTES),
    colourCount: int(r, 4, 10),
    saturation: int(r, 64, 94),
    brightness: int(r, 43, 62),
    paper: pick(r, ['#f5f0e6', '#f0eadc', '#f7f1e7', '#ece5d5', '#f3eee4']),
    grain: int(r, 10, 28)
  };
}

const PARAM_KEYS = {
  seed:'seed', mode:'mode', elements:'el', density:'den', complexity:'cx', negativeSpace:'neg',
  phiStrength:'phi', recursion:'rec', spiralInfluence:'spi', goldenAngle:'ga', nesting:'nest',
  pen:'pen', thickness:'th', wobble:'wob', overdraw:'od', opacity:'op', pressure:'pr', dryness:'dry',
  curveBias:'curve', shapeAmount:'shape', overlap:'overlap', rotation:'rot',
  lines:'ln', circles:'ci', rectangles:'re', polygons:'po', arcs:'ar',
  palette:'pal', colourCount:'cols', saturation:'sat', brightness:'bri', paper:'paper', grain:'grain'
};

function queryFor(s) {
  const q = new URLSearchParams();
  for (const [key, short] of Object.entries(PARAM_KEYS)) {
    let value = s[key];
    if (typeof value === 'boolean') value = value ? '1' : '0';
    q.set(short, String(value));
  }
  return q.toString();
}

function platformAssignment(index) {
  const out = {};
  const igSlot = PLATFORM_SLOTS.instagram.indexOf(index);
  const thSlot = PLATFORM_SLOTS.threads.indexOf(index);
  if (igSlot >= 0) out.instagram = { scheduledTime: SCHEDULE.instagram[igSlot], status: 'pending' };
  if (thSlot >= 0) out.threads = { scheduledTime: SCHEDULE.threads[thSlot], status: 'pending' };
  if (!Object.keys(out).length) out.reserve = { status: 'reserve' };
  return out;
}

const requestedDate = process.env.SOCIAL_DATE;
const day = requestedDate || dateInZone();
const seedSalt = String(process.env.SOCIAL_SEED_SALT || '').trim();
const generationCount = Math.max(1, Number(process.env.SOCIAL_COUNT || DAILY_COUNT));
const outDir = path.resolve('social-output', day);
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const entries = [];

try {
  for (let index = 0; index < generationCount; index++) {
    const settings = settingsFor(day, index, seedSalt);
    const query = queryFor(settings);
    const localUrl = `${LOCAL_URL}?${query}`;
    const shareUrl = `${SITE_URL}?${query}`;

    await page.goto(localUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const c = document.getElementById('art');
      return c && c.width > 0 && c.height > 0;
    });

    const rendered = await page.evaluate(() => {
      const canvas = document.getElementById('art');
      const stats = document.getElementById('stats')?.textContent || '';
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.94),
        stats
      };
    });

    const filename = `${day}-${String(index + 1).padStart(2, '0')}-${settings.mode}-${settings.seed}.jpg`;
    const filePath = path.join(outDir, filename);
    await fs.writeFile(filePath, Buffer.from(rendered.dataUrl.split(',')[1], 'base64'));

    const item = {
      id: `${day}-${String(index + 1).padStart(2, '0')}`,
      generatedAt: new Date().toISOString(),
      seed: settings.seed,
      mode: settings.mode,
      series: settings.series,
      stats: rendered.stats,
      imageFile: filename,
      shareUrl,
      settings,
      platforms: platformAssignment(index)
    };

    item.copy = makeCaptions(item);
    entries.push(item);
    console.log(`Generated ${item.id}: ${item.series} / ${item.seed}`);
  }
} finally {
  await browser.close();
}

const queue = {
  version: 1,
  date: day,
  generatedAt: new Date().toISOString(),
  timezone: TIME_ZONE,
  accounts: ACCOUNTS,
  cadence: {
    instagramPerDay: SCHEDULE.instagram.length,
    threadsPerDay: SCHEDULE.threads.length
  },
  publishingEnabled: false,
  entries
};

await fs.writeFile(path.join(outDir, 'queue.json'), JSON.stringify(queue, null, 2));
console.log(`\nGenerated ${generationCount} artworks into ${outDir}`);
console.log(`Instagram: ${SCHEDULE.instagram.join(', ')} ${TIME_ZONE}`);
console.log(`Threads: ${SCHEDULE.threads.join(', ')} ${TIME_ZONE}`);
