import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SITE_URL, LOCAL_URL, TIME_ZONE, ACCOUNTS, DAILY_COUNT, ARTWORK_JPEG_QUALITY,
  SCHEDULE, PLATFORM_SLOTS, PORTRAIT_SCHEDULE, PORTRAIT_POST_INDICES, MODES, PALETTES, PENS
} from './config.mjs';
import { makeCaptions } from './captions.mjs';
import { socialRendererVersion, archivedLandscapeStudy } from './renderer-state.mjs';
import { tissueEditionForDate, validateTissueShareUrl } from './tissue-edition.mjs';
import { appendDailyPhiFraming, dailyPhiFramingForDate } from './phi-framing.mjs';

const rendererVersion=socialRendererVersion();

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

function settingsFor(day, index, seedSalt = '', orientation = 'landscape') {
  const salt = String(seedSalt || '').trim();
  const saltKey = salt ? `|${salt}` : '';
  const portrait = orientation === 'portrait';
  // Preserve the existing landscape random sequence and seed identifiers.
  const r = rng(portrait ? `${day}|ALGOART|PORTRAIT|${index}${saltKey}` : `${day}|ALGOART|${index}${saltKey}`);
  const rotation = hash(day + saltKey + (portrait ? '|portrait' : '')) % MODES.length;
  const forcedMode = String(process.env.SOCIAL_FORCE_MODE || '').trim();
  const modeInfo = forcedMode ? (MODES.find(m => m[0] === forcedMode) || MODES[(index + rotation) % MODES.length]) : MODES[(index + rotation) % MODES.length];
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

  const seed = portrait
    ? `AP-${day.replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}-${(hash(day + '|portrait|' + index + saltKey) % 100000).toString().padStart(5, '0')}`
    : `AA-${day.replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}-${(hash(day + '|' + index + saltKey) % 100000).toString().padStart(5, '0')}`;

  return {
    mode,
    ...(portrait ? { orientation: 'portrait' } : {}),
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
  seed:'seed', mode:'mode', orientation:'fmt', elements:'el', density:'den', complexity:'cx', negativeSpace:'neg',
  phiStrength:'phi', recursion:'rec', spiralInfluence:'spi', goldenAngle:'ga', nesting:'nest',
  pen:'pen', thickness:'th', wobble:'wob', overdraw:'od', opacity:'op', pressure:'pr', dryness:'dry',
  curveBias:'curve', shapeAmount:'shape', overlap:'overlap', rotation:'rot',
  lines:'ln', circles:'ci', rectangles:'re', polygons:'po', arcs:'ar',
  palette:'pal', colourCount:'cols', saturation:'sat', brightness:'bri', paper:'paper', grain:'grain'
};

function queryFor(s,version=rendererVersion) {
  const q = new URLSearchParams();
  q.set('v', String(version));
  for (const [key, short] of Object.entries(PARAM_KEYS)) {
    let value = s[key];
    if (value == null || (key === 'orientation' && value !== 'portrait')) continue;
    if (typeof value === 'boolean') value = value ? '1' : '0';
    q.set(short, String(value));
  }
  return q.toString();
}

function platformAssignment(index, orientation = 'landscape') {
  const out = {};
  if (orientation === 'portrait') {
    const slot = PORTRAIT_POST_INDICES.indexOf(index);
    if (slot >= 0) {
      for (const platform of ['instagram', 'threads', 'bluesky']) {
        out[platform] = { scheduledTime: PORTRAIT_SCHEDULE[slot], status: 'pending' };
      }
    } else out.reserve = { status: 'reserve' };
    return out;
  }
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
const orientation = process.env.SOCIAL_ORIENTATION === 'portrait' ? 'portrait' : 'landscape';
// "watercolor" remains the historic Tissue & Graphite queue. New British
// "watercolour" is a distinct V2S paint medium, never an alias of Tissue.
const material = process.env.SOCIAL_MATERIAL === 'oil' ? 'oil' :
  process.env.SOCIAL_MATERIAL === 'watercolour' ? 'watercolour' :
  process.env.SOCIAL_MATERIAL === 'watercolor' ? 'watercolor' : 'marker';
const watercolor = material === 'watercolor',watercolour = material === 'watercolour',oil = material === 'oil';
const tissueEdition = watercolor ? tissueEditionForDate(day) : null;
const generationCount = oil || watercolour ? (day >= '2026-10-17' ? Math.max(1, Number(process.env.SOCIAL_COUNT || 1)) : 1) : watercolor ? 2 :
  Math.max(1, Number(process.env.SOCIAL_COUNT || DAILY_COUNT));
const outDir = path.resolve(process.env.SOCIAL_OUTPUT_DIR || 'social-output', day,
  ...(oil?['oil',orientation]:watercolour?['watercolour',orientation]:watercolor?['watercolor',orientation]:
    orientation==='portrait'?['portrait']:[]));
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const entries = [];

try {
  for (let index = 0; index < generationCount; index++) {
    // Existing landscape editions retain their exact JPEG, settings and version.
    // Portrait editions are already frozen in the release queue by portrait-live.
    if(!oil&&!watercolor&&!watercolour&&orientation==='landscape'&&!seedSalt&&!process.env.SOCIAL_FORCE_MODE){
      const archived=await archivedLandscapeStudy(day,index);
      if(archived){
        await fs.copyFile(archived.imagePath,path.join(outDir,archived.entry.imageFile));
        const item={...archived.entry,platforms:platformAssignment(index,orientation)};
        item.copy=makeCaptions(item);
        if(item.altText)item.copy.altText=item.altText;
        entries.push(item);
        console.log('Reused archived '+item.id+' / V'+item.rendererVersion);
        continue;
      }
    }
    // A few valid portrait seeds produce unusually sparse or off-canvas art.
    // Try deterministic alternatives so one weak render doesn't cancel the
    // whole five-work day. Landscape generation stays byte-for-byte unchanged.
    for (let attempt = 0; attempt < (oil ? 24 : orientation === 'portrait' ? 8 : 1); attempt++) {
    const retrySalt = attempt ? seedSalt + '|retry-' + attempt : seedSalt;
    const settings = settingsFor(day,index,oil?'OIL|V1|'+retrySalt:watercolour?'WATERCOLOUR|V2S|1|'+retrySalt:
      watercolor?'WATERCOLOR|1|'+retrySalt:retrySalt,orientation);
    // All NEW daily gallery images use the same original Marker cream paper.
    // Keep the RNG draw and all archive settings for earlier dates unchanged.
    if(day>='2026-10-14')settings.paper='#f5f0e6';
    if(oil){
      // New random palette for each day's image, recorded in its seed URL.
      const pickOil=rng(day+'|oil-v1|'+orientation+'|'+retrySalt);
      const oilModes=MODES.filter(m=>['organic','spiral','geometric'].includes(m[0]));
      const chosen=oilModes[Math.floor(pickOil()*oilModes.length)];
      settings.mode=chosen[0];settings.series=chosen[1];
      settings.seed='O'+(orientation==='portrait'?'P':'L')+'-'+day.replaceAll('-','')+
        '-'+String(index+1).padStart(2,'0')+'-'+(hash(day+'|oil-v1|'+orientation+'|'+(index ? index+'|' : '')+retrySalt)%100000)
          .toString().padStart(5,'0');
      settings.palette=PALETTES[Math.floor(pickOil()*PALETTES.length)];
      settings.paper='#f5f0e6';
    }
    if(watercolour){
      // Completely independent seed namespace: no collisions with existing
      // AA/AP or historic Tissue AWL/AWP images.
      settings.seed='CW'+(orientation==='portrait'?'P':'L')+'-'+day.replaceAll('-','')+
        '-'+String(index+1).padStart(2,'0')+'-'+(hash(day+'|watercolour-v2s|'+orientation+'|'+(index ? index+'|' : '')+retrySalt)%100000)
          .toString().padStart(5,'0');
      settings.paper='#f5f0e6';
    }
    if(watercolor){
      // Isolate new study IDs and seeds without touching existing AA/AP work.
      settings.seed = 'AW'+(orientation==='portrait'?'P':'L')+'-'+day.replaceAll('-','')+
        '-'+String(index+1).padStart(2,'0')+'-'+
        (hash(day+'|watercolor|'+orientation+'|'+index+'|'+retrySalt)%100000).toString().padStart(5,'0');
      // New seeded Tissue & Graphite editions use one consistent, neutral paper.
      // The randomly selected paper remains available for historical v1 links
      // and ordinary marker work; do not retroactively repaint those images.
      if(tissueEdition.edition==='seeded')settings.paper='#f5f0e6';
    }
    // The cutoff changes only the MATERIAL; V8's settings, daily seed and
    // archive IDs retain the exact same deterministic generation algorithm.
    const itemVersion=oil||watercolour?9:rendererVersion;
    // From 15 October all NEW Marker, Tissue and Watercolour editions share
    // the same φ-derived source fit, in their PNG/SVG and exact share URL.
    // Earlier dates and already-frozen gallery/release assets stay untouched.
    const query=appendDailyPhiFraming(
      queryFor(settings,itemVersion)+(oil?'&material='+ (day>='2026-10-17'?'oil-v4':'oil-v1'):watercolour?'&material=watercolour-v2s&fit=0':
      watercolor?tissueEdition.suffix:''),day);
    const localUrl = `${LOCAL_URL}?${query}`;
    const shareUrl = `${SITE_URL}?${query}`;
    if(watercolor)validateTissueShareUrl(day,shareUrl);
    if(oil){
      const q=new URL(shareUrl).searchParams;
      if(q.get('material')!==(day>='2026-10-17'?'oil-v4':'oil-v1')||q.get('seed')!==settings.seed||
         q.get('pal')!==settings.palette)
        throw Error('Oil image URL does not preserve exact seed and randomly chosen palette');
    }

    await page.goto(localUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const c = document.getElementById('art');
      return c && c.width > 0 && c.height > 0;
    });

    const actualVersion=await page.evaluate(()=>window.AlgoArt.rendererVersion);
    if(actualVersion!==itemVersion)throw new Error('Rendered V'+actualVersion+' but requested V'+itemVersion);
    if(dailyPhiFramingForDate(day)){
      const frame=await page.evaluate(()=>({
        enabled:!!window.AlgoArt.phiFramingEnabled,
        transform:window.AlgoArt.lastPhiSheetFrame
      }));
      if(!frame.enabled||frame.transform?.kind!=='phi-sheet')
        throw new Error('Daily '+material+' image did not apply shared φ framing: '+settings.seed);
    }

    const rendered = await page.evaluate(({paperColour,jpegQuality}) => {
      const canvas = document.getElementById('art');
      const stats = document.getElementById('stats')?.textContent || '';
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;

      // Validate against the actual rendered paper colour. A JPEG existing is not enough:
      // V5 proved a valid canvas can still contain no artwork.
      const paper = getComputedStyle(canvas).backgroundColor || '';
      const paperMatch = paper.match(/\d+/g);
      let pr = 245, pg = 240, pb = 230;
      if (paperMatch && paperMatch.length >= 3) {
        pr = +paperMatch[0]; pg = +paperMatch[1]; pb = +paperMatch[2];
      } else {
        const corner = 0;
        pr = data[corner]; pg = data[corner + 1]; pb = data[corner + 2];
      }

      let changed = 0, strong = 0, minX = width, minY = height, maxX = -1, maxY = -1;
      const step = 4;
      let sampled = 0;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4;
          const d = Math.abs(data[i] - pr) + Math.abs(data[i + 1] - pg) + Math.abs(data[i + 2] - pb);
          sampled++;
          if (d > 34) {
            changed++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
          if (d > 90) strong++;
        }
      }
      const changedRatio = changed / Math.max(1, sampled);
      const strongRatio = strong / Math.max(1, sampled);
      const spanX = maxX >= minX ? (maxX - minX) / width : 0;
      const spanY = maxY >= minY ? (maxY - minY) / height : 0;
      const valid = changedRatio >= 0.006 && strongRatio >= 0.0015 && (spanX >= 0.10 || spanY >= 0.10);
      // Meta's image-publishing API expects at least a 4:5 aspect ratio.
      // Preserve the complete 1000x1400 portrait by padding its sides,
      // never by cropping or stretching the original composition.
      let instagramDataUrl = null;
      if (width === 1000 && height === 1400) {
        const igCanvas = document.createElement('canvas');
        igCanvas.width = 1120;
        igCanvas.height = 1400;
        const ig = igCanvas.getContext('2d');
        ig.fillStyle = paperColour;
        ig.fillRect(0, 0, 1120, 1400);
        ig.drawImage(canvas, 60, 0);
        instagramDataUrl = igCanvas.toDataURL('image/jpeg', jpegQuality);
      }
      return {
        dataUrl: canvas.toDataURL('image/jpeg', jpegQuality),
        instagramDataUrl,
        stats,
        accessibility: {
          altText: canvas.getAttribute('aria-label') || '',
          longDescription: document.getElementById('descriptionLong')?.textContent || '',
          constructionDescription: document.getElementById('descriptionConstruction')?.textContent || ''
        },
        validation: { valid, changedRatio, strongRatio, spanX, spanY }
      };
    }, {paperColour:settings.paper,jpegQuality:ARTWORK_JPEG_QUALITY});

    // Reject wrong-format exports instead of silently archiving resized images.
    const canvasSize = await page.locator('#art').evaluate(c => [c.width, c.height]);
    const expectedSize = orientation === 'portrait' ? [1000, 1400] : [1400, 1000];
    if (canvasSize[0] !== expectedSize[0] || canvasSize[1] !== expectedSize[1]) {
      throw new Error(`Unexpected ${orientation} canvas size: ${canvasSize.join('x')}`);
    }
    if(oil){
      const links=await page.evaluate(()=>{
        const A=window.AlgoArt;
        const plan=A.planCompositionV5(A.readSettings(),
          {phiFraming:A.phiFramingEnabled===true,maxRegions:28});
        return plan.broadConnectionStats?.count||0;
      });
      if(links<2){
        if(attempt<23){console.warn('Oil seed lacks source-connected fields: '+settings.seed);continue;}
        throw Error('Unable to find Oil seed with source-connected fields');
      }
    }
    if (!rendered.validation.valid) {
      if ((oil && attempt<23) || (orientation === 'portrait' && attempt < 7)) {
        console.warn(`Portrait ${index + 1} candidate ${settings.seed} was rejected; trying a deterministic alternate: ${JSON.stringify(rendered.validation)}`);
        continue;
      }
      throw new Error(`Render validation failed for ${settings.seed}: ${JSON.stringify(rendered.validation)}`);
    }

    const filename=`${day}-${oil?'oil-'+orientation+'-':watercolour?'watercolour-'+orientation+'-':
      watercolor?'watercolor-'+orientation+'-':orientation==='portrait'?'portrait-':''}${String(index+1).padStart(2,'0')}-${settings.mode}-${settings.seed}.jpg`;
    const filePath = path.join(outDir, filename);
    await fs.writeFile(filePath, Buffer.from(rendered.dataUrl.split(',')[1], 'base64'));
    const instagramImageFile=orientation==='portrait'?
      filename.replace(/\.jpg$/,'-instagram.jpg'):(oil||watercolor||watercolour?filename:null);
    if (orientation === 'portrait') {
      if (!rendered.instagramDataUrl) throw new Error('Missing Instagram-safe 4:5 portrait derivative');
      await fs.writeFile(path.join(outDir, instagramImageFile), Buffer.from(rendered.instagramDataUrl.split(',')[1], 'base64'));
    }

    const item = {
      id: `${day}-${oil?(orientation==='portrait'?'OP':'OL'):watercolour?(orientation==='portrait'?'CP':'CL'):
        watercolor?(orientation==='portrait'?'WP':'WL'):
        orientation==='portrait'?'P':''}${String(index+1).padStart(2,'0')}`,
      ...(orientation==='portrait'||watercolor||watercolour||oil?{orientation}:{}),
      ...(oil?{material:'oil'}:watercolour?{material:'watercolour'}:watercolor?{material:'watercolor'}:{}),
      generatedAt: new Date().toISOString(),
      seed: settings.seed,
      mode: settings.mode,
      series: settings.series,
      stats: rendered.stats,
      imageFile: filename,
      ...(instagramImageFile ? { instagramImageFile } : {}),
      shareUrl,
      rendererVersion:itemVersion,
      settings,
      platforms:oil?Object.fromEntries(['instagram','threads','bluesky'].map(p=>
         [p,{scheduledTime:'15:00',status:'pending'}])):
         watercolour?Object.fromEntries(['instagram','threads','bluesky'].map(p=>
        [p,{scheduledTime:'15:00',status:'pending'}])):
        watercolor?{instagram:{scheduledTime:index===0?'09:00':'20:30',status:'pending'},threads:{scheduledTime:index===0?'09:00':'20:30',status:'pending'},bluesky:{scheduledTime:index===0?'09:00':'20:30',status:'pending'}}:
        platformAssignment(index,orientation)
    };

    item.copy = makeCaptions(item);
    if (!oil && !watercolor && !watercolour && rendered.accessibility?.altText) {
      item.copy.altText = rendered.accessibility.altText;
    }
    item.accessibility = {
      altText:oil||watercolor||watercolour?item.copy.altText:(rendered.accessibility?.altText||item.copy.altText),
      longDescription: rendered.accessibility?.longDescription || '',
      constructionDescription: rendered.accessibility?.constructionDescription || ''
    };
    entries.push(item);
    console.log(`Generated ${item.id}: ${item.series} / ${item.seed}`);
    break; // one accepted study per requested daily index
    } // candidate attempts
  }
} finally {
  await browser.close();
}

const queue = {
  version: 1,
  date: day,
  ...(oil?{material:'oil'}:watercolour?{material:'watercolour'}:watercolor?{material:'watercolor'}:{}),
  ...(orientation==='portrait'||watercolor||watercolour||oil?{orientation}:{}),
  generatedAt: new Date().toISOString(),
  timezone: TIME_ZONE,
  accounts: ACCOUNTS,
  cadence: {
    instagramPerDay:oil?1:watercolour?1:watercolor?2:orientation==='portrait'?PORTRAIT_SCHEDULE.length:SCHEDULE.instagram.length,
    threadsPerDay:oil?1:watercolour?1:watercolor?2:orientation==='portrait'?PORTRAIT_SCHEDULE.length:SCHEDULE.threads.length
  },
  publishingEnabled: false,
  entries
};

await fs.writeFile(path.join(outDir, 'queue.json'), JSON.stringify(queue, null, 2));
console.log(`\nGenerated ${generationCount} artworks into ${outDir}`);
console.log(`${material} ${orientation} Instagram/Threads/Bluesky: ${(oil?['15:00']:watercolour?['15:00']:
  watercolor?['09:00','20:30']:orientation==='portrait'?PORTRAIT_SCHEDULE:SCHEDULE.instagram).join(', ')} ${TIME_ZONE}`);
