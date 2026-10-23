import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TIME_ZONE } from './config.mjs';

const SITE_ORIGIN = 'https://southernadd-cmyk.github.io';
const SITE_PATH = '/algoart';
const SITE_URL = SITE_ORIGIN + SITE_PATH;
const GALLERY_URL = SITE_URL + '/gallery';
const GALLERY_DESCRIPTION = 'A fresh collection each day. Open a drawing to see its seed and try another version.';
const FEED_DESCRIPTION = 'A fresh set of PROPORTION PIECE drawings every day. Browse marker, tissue and graphite, watercolour, oil paint and action painting, then open any piece to make it your own.';

function dateInZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function displayDate(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(iso + 'T12:00:00Z'));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value = '') {
  return escapeHtml(value);
}

function jsonLd(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function slugText(value = '') {
  return String(value).replace(/[^a-zA-Z0-9 _./:%+-]/g, '').trim();
}

function materialLabel(item) { return item.material==='action'?'Action Painting':item.material==='oil'?'Oil Paint':item.material==='watercolour'?'Watercolour':item.material==='watercolor'?'Tissue & Graphite':'Marker'; }

function artworkTitle(item, index) {
  return `${item.series} — ${item.material==='action'?'Action Painting ':item.material==='oil'?'Oil Paint ':item.material==='watercolour'?'Watercolour ':item.material==='watercolor'?'Tissue & Graphite ':''}Study ${String(index + 1).padStart(2, '0')}`;
}

function countWord(count) {
  const words = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
  return words[count] || String(count);
}

function artworkDescription(item) {
  const s = item.settings || {};
  return item.material==='action'?`${item.series} Action Painting using seed ${item.seed}, the ${s.palette} palette and geometry-guided flowing paint.`:item.material==='oil'?
    `${item.series} Oil Paint artwork using seed ${item.seed}, ${s.palette} palette, source-connected colour masses and real loaded bristle paint.`:
    item.material==='watercolour'?
    `${item.series} Watercolour V2S artwork using seed ${item.seed}, source-matched pigment, and ${s.phiStrength}% Additional φ pull.`:
    item.material==='watercolor'
    ? `${item.series} Tissue & Graphite artwork using seed ${item.seed} and ${s.phiStrength}% Additional φ pull.`
    : `${item.series} generative marker artwork using seed ${item.seed}, ${s.phiStrength}% Additional φ pull, ${s.pen || 'marker'} pen and the ${s.palette || 'generated'} palette.`;
}

function artworkCard(item, index) {
  const title = artworkTitle(item, index);
  const s = item.settings || {};
  const alt = item.copy?.altText || artworkDescription(item);
  const portrait = (item.orientation || s.orientation) === 'portrait';
  return `
    <article id="${escapeHtml(item.id)}" class="art-card" data-orientation="${portrait ? 'portrait' : 'landscape'}" data-material="${item.material==='action'?'action':item.material==='oil'?'oil':item.material==='watercolour'?'watercolour':item.material==='watercolor'?'watercolor':'marker'}">
      <a class="art-image-link" href="${escapeHtml(item.shareUrl)}" aria-label="Open and remix ${escapeHtml(title)} in PROPORTION PIECE">
        <img src="${escapeHtml(item.imageFile)}" width="${portrait ? 1000 : 1400}" height="${portrait ? 1400 : 1000}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" alt="${escapeHtml(alt)}">
      </a>
      <div class="art-info">
        <div class="art-number">${String(index + 1).padStart(2, '0')}</div>
        <div>
          <h2>${escapeHtml(item.series)} · ${escapeHtml(materialLabel(item))}</h2>
          
          <dl>
            <div><dt>Seed</dt><dd>${escapeHtml(item.seed)}</dd></div>
            <div><dt>Series</dt><dd>${escapeHtml(item.series)}</dd></div>
            <div><dt>Format</dt><dd>${portrait ? 'Portrait · 1000 × 1400' : 'Landscape · 1400 × 1000'}</dd></div>
            <div><dt>Additional φ pull</dt><dd>${escapeHtml(s.phiStrength)}%</dd></div>
            <div><dt>Material</dt><dd>${escapeHtml(materialLabel(item))}</dd></div>
            <div><dt>Palette</dt><dd>${escapeHtml(s.palette)}</dd></div>
          </dl>
          <a class="remix" href="${escapeHtml(item.shareUrl)}">Open this drawing →</a>
        </div>
      </div>
    </article>`;
}

function dayPage(queue) {
  const date = queue.date;
  const pretty = displayDate(date);
  const entries = queue.entries;
  const series = [...new Set(entries.map(e => e.series))];
  const title = `PROPORTION PIECE Daily Gallery — ${pretty} | Golden Ratio Generative Art`;
  const description = `${entries.length} drawings made on ${pretty}. Different materials, different compositions, and room to make each one your own.`;
  const canonical = `${GALLERY_URL}/${date}/`;
  const cover = `${canonical}${entries[0].imageFile}`;

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `PROPORTION PIECE Daily Gallery — ${pretty}`,
    description,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: 'PROPORTION PIECE',
      url: SITE_URL + '/'
    },
    about: ['generative art', 'algorithmic art', 'golden ratio', 'creative coding', 'digital marker art'],
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: entries.length,
      itemListElement: entries.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'VisualArtwork',
          name: artworkTitle(item, index),
          description: artworkDescription(item),
          image: `${canonical}${item.imageFile}`,
          url: item.shareUrl,
          artform:item.material==='action'?'Generative action painting':item.material==='oil'?'Generative oil painting':item.material==='watercolour'?'Generative watercolour painting':
            item.material==='watercolor'?'Tissue and graphite generative art':'Generative digital marker art',
          artMedium: 'Browser canvas and deterministic algorithm',
          creator: {
            '@type': 'Organization',
            name: 'PROPORTION PIECE',
            url: SITE_URL + '/'
          }
        }
      }))
    }
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="../../favicon.svg">
<link rel="stylesheet" href="../gallery.css?v=20261013-site-quality">
<link rel="stylesheet" href="../editorial.css?v=20261017-release">\n<link rel="stylesheet" href="../../css/nav-lettering.css?v=11">\n<script defer src="../../js/nav-lettering.js?v=2"></script>
<link rel="alternate" type="application/rss+xml" title="PROPORTION PIECE Daily Gallery" href="../feed.xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PROPORTION PIECE">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${cover}">
<meta property="og:image:width" content="1400">
<meta property="og:image:height" content="1000">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${cover}">
<script type="application/ld+json">${jsonLd(structured)}</script>
</head>
<body>
<header class="algo-global-header">
  <div class="algo-global-brand"><a class="brand" href="../../">PROPORTION PIECE</a></div>
  <div class="algo-global-numbers" aria-label="Golden ratio and golden angle"><span>1.6180339887</span><span class="algo-number-slash" aria-hidden="true">/</span><span>137.507764°</span></div>
  <p class="algo-global-question">Can one number compose a drawing?</p>
  <nav class="algo-site-nav" aria-label="Site navigation"><a data-algo-nav href="../../">try it out</a><a data-algo-nav href="../" aria-current="page">daily gallery</a><a data-algo-nav href="../../about/">how it works</a></nav>
</header>
<main>
  <section class="hero">
    <div class="kicker">DAILY ARCHIVE / ${escapeHtml(date)}</div>
    <h1>Drawings from<br>${escapeHtml(pretty)}.</h1>
    <p>${escapeHtml(description)}</p>
    <p class="visit-day-link"><a href="../visit/?date=${escapeHtml(date)}">Walk this floor in 3D →</a></p>
    <div class="hero-meta"><span>${entries.length} drawings</span><span>Different materials</span><span>Each one can be revisited</span></div>
  </section>
  <section class="grid" aria-label="Artwork generated on ${escapeHtml(pretty)}">
    ${entries.map(artworkCard).join('\n')}
  </section>
  <section class="about">
    <span class="section-no">${String(entries.length + 1).padStart(2, '0')}</span>
    <div>
      <h2>THE SAME PROPORTION.<br>DIFFERENT MARKS.</h2>
      <p>The golden ratio helps arrange each drawing. The material changes how those arrangements feel. Open a piece to see its settings, then change whatever you like.</p>
      <a class="remix primary" href="../../">MAKE YOUR OWN →</a>
    </div>
  </section>
</main>
<footer><a href="../">← ALL DAILY GALLERIES</a><span>@artalgorithm</span><span>PROPORTION PIECE / ${escapeHtml(date)}</span></footer>
</body>
</html>`;
}

function archivePage(archive) {
  const days = [...new Map([...archive.days].map(day => [day.date, day])).values()]
    .sort((a, b) => b.date.localeCompare(a.date));
  const cards = days.map((day, index) => `
    <article class="day-card">
      <a href="./${day.date}/">
        <img src="./${day.date}/archive-preview.jpg?v=${encodeURIComponent(day.date)}-${day.count}" width="840" height="600" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async" ${index === 0 ? 'fetchpriority="high"' : 'fetchpriority="low"'} onerror="this.onerror=null;this.src=\'./${day.date}/${escapeHtml(day.cover)}\'" alt="Recursive Divisions mosaic showing the artworks from ${escapeHtml(displayDate(day.date))}">
        <div>
          <h2>${escapeHtml(displayDate(day.date))}</h2>
        </div>
      </a>
    </article>`).join('\n');

  const latest = days[0];
  const latestImage = latest ? `${GALLERY_URL}/${latest.date}/${latest.cover}` : SITE_URL + '/social-card.svg';
  const description = GALLERY_DESCRIPTION;

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'PROPORTION PIECE Daily Gallery',
    description,
    url: GALLERY_URL + '/',
    isPartOf: { '@type': 'WebSite', name: 'PROPORTION PIECE', url: SITE_URL + '/' },
    hasPart: days.map(day => ({
      '@type': 'CollectionPage',
      name: `PROPORTION PIECE Daily Gallery — ${displayDate(day.date)}`,
      url: `${GALLERY_URL}/${day.date}/`
    }))
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROPORTION PIECE Daily Gallery | Golden Ratio Generative Art Archive</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${GALLERY_URL}/">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="stylesheet" href="gallery.css?v=20261013-site-quality">
<link rel="stylesheet" href="editorial.css?v=20261017-release">\n<link rel="stylesheet" href="../css/nav-lettering.css?v=11">\n<script defer src="../js/nav-lettering.js?v=2"></script>

<link rel="alternate" type="application/rss+xml" title="PROPORTION PIECE Daily Gallery" href="feed.xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PROPORTION PIECE">
<meta property="og:title" content="PROPORTION PIECE Daily Gallery">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${GALLERY_URL}/">
<meta property="og:image" content="${latestImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="PROPORTION PIECE Daily Gallery">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${latestImage}">
<script type="application/ld+json">${jsonLd(structured)}</script>
</head>
<body>
<header class="algo-global-header">
  <div class="algo-global-brand"><a class="brand" href="../">PROPORTION PIECE</a></div>
  <div class="algo-global-numbers" aria-label="Golden ratio and golden angle"><span>1.6180339887</span><span class="algo-number-slash" aria-hidden="true">/</span><span>137.507764°</span></div>
  <p class="algo-global-question">Can one number compose a drawing?</p>
  <nav class="algo-site-nav" aria-label="Site navigation"><a data-algo-nav href="../">try it out</a><a data-algo-nav href="./" aria-current="page">daily gallery</a><a data-algo-nav href="../about/">how it works</a></nav>
</header>
<main>
  <section class="hero archive-hero">
    <div class="kicker">PERMANENT DAILY ARCHIVE</div>
    <h1>A DRAWING A DAY.<br>AND THEN SOME.</h1>
    <p>${escapeHtml(description)}</p>
    <div class="hero-meta"><span>${days.length} DAILY ${days.length === 1 ? 'EDITION' : 'EDITIONS'}</span><span>LATEST: ${latest ? latest.count : 0} STUDIES</span><span>EXACT STATES PRESERVED</span></div>
  </section>
  <section class="visit-band" aria-labelledby="visit-title">
    <a href="./visit/">
      <img src="./visit/tower-still.svg?v=lower-fifteen-20261023" width="1200" height="480" loading="eager" alt="Illustration of the virtual exhibition's stacked glass gallery floors, entrance and elevated walkways">
      <div class="visit-copy">
        <h2 id="visit-title">Walk the tower.</h2>
        <p>Every daily edition is a floor. Begin outside and take the lift through ${days.length} days of drawings.</p>
        <span>Enter the exhibition →</span>
      </div>
    </a>
  </section>
  <section class="day-grid" aria-label="Daily PROPORTION PIECE galleries">
    ${cards || '<p class="empty">The first daily edition is being generated.</p>'}
  </section>
</main>
<footer><a href="../">← Make a drawing</a><span>@artalgorithm</span><span>PROPORTION PIECE DAILY ARCHIVE</span></footer>

</body>
</html>`;
}

function rss(archive) {
  const days = [...archive.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>PROPORTION PIECE Daily Gallery</title>
<link>${GALLERY_URL}/</link>
<description>${escapeXml(FEED_DESCRIPTION)}</description>
<language>en-gb</language>
${days.map(day => `<item>
<title>PROPORTION PIECE Daily Gallery — ${escapeXml(displayDate(day.date))}</title>
<link>${GALLERY_URL}/${day.date}/</link>
<guid isPermaLink="true">${GALLERY_URL}/${day.date}/</guid>
<pubDate>${new Date(day.date + 'T12:00:00Z').toUTCString()}</pubDate>
<description>${escapeXml(day.count + ' generative studies: ' + day.series.join(', '))}</description>
</item>`).join('\n')}
</channel>
</rss>`;
}

function sitemap(archive) {
  const days = [...archive.days].sort((a, b) => b.date.localeCompare(a.date));
  const latest = days[0]?.date || dateInZone();
  const urls = [
    { loc: SITE_URL + '/', lastmod: latest },
    { loc: GALLERY_URL + '/', lastmod: latest },
    { loc: GALLERY_URL + '/visit/', lastmod: latest },
    ...days.map(day => ({ loc: `${GALLERY_URL}/${day.date}/`, lastmod: day.date }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>`;
}

const day = process.env.SOCIAL_DATE || dateInZone();
const galleryOrientation = process.env.GALLERY_QUEUE_ORIENTATION === 'portrait' ? 'portrait' : 'landscape';
const galleryMaterial=process.env.GALLERY_QUEUE_MATERIAL==='action'?'action':process.env.GALLERY_QUEUE_MATERIAL==='oil'?'oil':
  process.env.GALLERY_QUEUE_MATERIAL==='watercolour'?'watercolour':
  process.env.GALLERY_QUEUE_MATERIAL==='watercolor'?'watercolor':'marker';
const queuePath = path.resolve('social-output', day,
  ...(galleryMaterial==='action'?['action',galleryOrientation]:galleryMaterial==='oil'?['oil',galleryOrientation]:galleryMaterial==='watercolour'?['watercolour',galleryOrientation]:
    galleryMaterial==='watercolor'?['watercolor',galleryOrientation]:
    galleryOrientation==='portrait'?['portrait']:[]),'queue.json');
const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));

if (!Array.isArray(queue.entries) || queue.entries.length === 0) {
  throw new Error('Daily gallery cannot be built from an empty social queue.');
}

const galleryRoot = path.resolve('gallery');
const dayDir = path.join(galleryRoot, day);
await fs.mkdir(dayDir, { recursive: true });

// Preserve curated/repaired studies that are already in the day's gallery.
// The scheduled queue is the canonical source for its own seeds, but it must
// never erase additional validated studies that were appended later.
let existingMeta = { entries: [] };
try {
  existingMeta = JSON.parse(await fs.readFile(path.join(dayDir, 'meta.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const queuedSeeds = new Set(queue.entries.map(entry => entry.seed).filter(Boolean));
const queuedFiles = new Set(queue.entries.map(entry => entry.imageFile).filter(Boolean));
const preservedEntries = [];

for (const entry of Array.isArray(existingMeta.entries) ? existingMeta.entries : []) {
  if (queuedSeeds.has(entry.seed) || queuedFiles.has(entry.imageFile)) continue;
  try {
    await fs.access(path.join(dayDir, entry.imageFile));
  } catch {
    continue;
  }
  preservedEntries.push({
    ...entry,
    copy: { altText: entry.altText || artworkDescription(entry) }
  });
}

queue.entries = [...queue.entries, ...preservedEntries];
// Always display the existing landscape set first, then the five portraits.
// Otherwise each publishing slot flips the gallery order as its own queue
// becomes the input, producing needless commits and changing the cover.
function galleryOrder(entry) {
  // Existing five marker landscapes and five marker portraits keep their order.
  // Stable order: Marker landscapes, Marker portraits, historical Tissue
  // landscapes/portraits, then V2S Watercolour landscape/portrait.
  const orientation=entry.orientation||entry.settings?.orientation;
  const tier=entry.material==='action'?8:entry.material==='oil'?6:entry.material==='watercolour'?4:entry.material==='watercolor'?2:0;
  return tier+(orientation==='portrait'?1:0);
}
queue.entries.sort((a, b) =>
  galleryOrder(a) - galleryOrder(b) ||
  String(a.id || a.seed).localeCompare(String(b.id || b.seed))
);

// From 17 October cap each material at four gallery entries, preferring
// two landscape and two portrait studies when both are available.
if (day >= '2026-10-17') {
  const materialOf = e => e.material === 'action' ? 'action' : e.material === 'oil' ? 'oil' :
    e.material === 'watercolour' ? 'watercolour' :
    e.material === 'watercolor' ? 'tissue' : 'marker';
  const chosen = [];
  for (const material of ['marker', 'tissue', 'watercolour', 'oil', 'action']) {
    const items = queue.entries.filter(e => materialOf(e) === material);
    const landscapes = items.filter(e => (e.orientation || e.settings?.orientation) !== 'portrait');
    const portraits = items.filter(e => (e.orientation || e.settings?.orientation) === 'portrait');
    const preferred = [...landscapes.slice(0, 2), ...portraits.slice(0, 2)];
    const used = new Set(preferred.map(e => e.imageFile));
    chosen.push(...preferred, ...items.filter(e => !used.has(e.imageFile)).slice(0, 4 - preferred.length));
  }
  queue.entries = chosen;
}


// Only the freshly generated queue images are copied; preserved gallery
// studies already exist in dayDir. Sorting must not change that distinction.
const queuedImageFiles = new Set(
  queue.entries.filter(item => !preservedEntries.some(old => old.imageFile === item.imageFile))
    .map(item => item.imageFile)
);
for (const item of queue.entries) {
  if (!queuedImageFiles.has(item.imageFile)) continue;
  const source = path.resolve('social-output', day,
    ...(galleryMaterial==='action'?['action',galleryOrientation]:galleryMaterial==='oil'?['oil',galleryOrientation]:galleryMaterial==='watercolour'?['watercolour',galleryOrientation]:
      galleryMaterial==='watercolor'?['watercolor',galleryOrientation]:
      galleryOrientation==='portrait'?['portrait']:[]),item.imageFile);
  const dest = path.join(dayDir, item.imageFile);
  await fs.copyFile(source, dest);
}

const keepImages = new Set(queue.entries.map(entry => entry.imageFile));
for (const existing of await fs.readdir(dayDir)) {
  if (existing.toLowerCase().endsWith('.jpg') && existing !== 'archive-preview.jpg' && !keepImages.has(existing)) {
    await fs.rm(path.join(dayDir, existing), { force: true });
  }
}

const dayMeta = {
  version: 1,
  date: day,
  count: queue.entries.length,
  series: [...new Set(queue.entries.map(e => e.series))],
  entries: queue.entries.map((item, index) => ({
    id: item.id,
    title: artworkTitle(item, index),
    orientation: item.orientation || item.settings?.orientation || 'landscape',
    ...(item.material==='action'?{material:'action'}:item.material==='oil'?{material:'oil'}:item.material==='watercolour'?{material:'watercolour'}:
      item.material==='watercolor'?{material:'watercolor'}:{}),
    seed: item.seed,
    mode: item.mode,
    series: item.series,
    imageFile: item.imageFile,
    shareUrl: item.shareUrl,
    rendererVersion: item.rendererVersion || 3,
    settings: item.settings,
    altText: item.copy?.altText || artworkDescription(item)
  }))
};

await fs.writeFile(path.join(dayDir, 'index.html'), dayPage(queue));
await fs.writeFile(path.join(dayDir, 'meta.json'), JSON.stringify(dayMeta, null, 2) + '\n');
// Compose the daily cover once during the build, rather than making each visitor
// download every full-resolution artwork. Missing Pillow leaves the old cover as
// a fallback; CI's gallery-preview job installs the image dependency.
const previewBuild = spawnSync('python3', ['automation/build-gallery-previews.py', '--date', day], {encoding:'utf8'});
if (previewBuild.status !== 0) {
  console.warn('Gallery preview not generated (single-image fallback remains):', (previewBuild.stderr || previewBuild.error?.message || '').trim());
} else {
  console.log(previewBuild.stdout.trim());
}

const archivePath = path.join(galleryRoot, 'archive.json');
let archive = { version: 1, days: [] };
try {
  archive = JSON.parse(await fs.readFile(archivePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

archive.days = Array.isArray(archive.days) ? archive.days.filter(d => d.date !== day) : [];
archive.days.push({
  date: day,
  cover: queue.entries[0].imageFile,
  coverOrientation: queue.entries[0].orientation || queue.entries[0].settings?.orientation || 'landscape',
  count: queue.entries.length,
  series: [...new Set(queue.entries.map(e => e.series))]
});
archive.days.sort((a, b) => b.date.localeCompare(a.date));

await fs.mkdir(galleryRoot, { recursive: true });
await fs.writeFile(archivePath, JSON.stringify(archive, null, 2) + '\n');
// A small index contains the precise seed and engine sequence for every day.
// The 3D tower can reproduce each level without fetching every full gallery page.
const towerFloors=[];
for(const record of [...archive.days].sort((a,b)=>a.date.localeCompare(b.date))){
  const meta=JSON.parse(await fs.readFile(path.join(galleryRoot,record.date,'meta.json'),'utf8'));
  towerFloors.push({date:record.date,studies:meta.entries.map(entry=>[entry.seed,entry.mode])});
}
await fs.writeFile(path.join(galleryRoot,'tower-layouts.json'),
  JSON.stringify({version:1,floors:towerFloors})+'\n');
await fs.writeFile(path.join(galleryRoot, 'index.html'), archivePage(archive));
await fs.writeFile(path.join(galleryRoot, 'feed.xml'), rss(archive));
await fs.writeFile(path.resolve('sitemap.xml'), sitemap(archive));
await fs.writeFile(path.resolve('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built PROPORTION PIECE daily gallery for ${day} with ${queue.entries.length} artworks.`);
console.log(`Gallery URL: ${GALLERY_URL}/${day}/`);
