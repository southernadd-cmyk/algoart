import fs from 'node:fs/promises';
import path from 'node:path';
import { TIME_ZONE } from './config.mjs';

const SITE_ORIGIN = 'https://southernadd-cmyk.github.io';
const SITE_PATH = '/algoart';
const SITE_URL = SITE_ORIGIN + SITE_PATH;
const GALLERY_URL = SITE_URL + '/gallery';

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

function artworkTitle(item, index) {
  return `${item.series} — Study ${String(index + 1).padStart(2, '0')}`;
}

function countWord(count) {
  const words = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
  return words[count] || String(count);
}

function artworkDescription(item) {
  const s = item.settings || {};
  return `${item.series} generative marker artwork using seed ${item.seed}, ${s.phiStrength}% golden-ratio adherence, ${s.pen || 'marker'} pen and the ${s.palette || 'generated'} palette.`;
}

function artworkCard(item, index) {
  const title = artworkTitle(item, index);
  const s = item.settings || {};
  const alt = item.copy?.altText || artworkDescription(item);
  return `
    <article class="art-card">
      <a class="art-image-link" href="${escapeHtml(item.shareUrl)}" aria-label="Open and remix ${escapeHtml(title)} in ALGO/ART">
        <img src="${escapeHtml(item.imageFile)}" width="1400" height="1000" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" alt="${escapeHtml(alt)}">
      </a>
      <div class="art-info">
        <div class="art-number">${String(index + 1).padStart(2, '0')}</div>
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(artworkDescription(item))}</p>
          <dl>
            <div><dt>Seed</dt><dd>${escapeHtml(item.seed)}</dd></div>
            <div><dt>Series</dt><dd>${escapeHtml(item.series)}</dd></div>
            <div><dt>φ adherence</dt><dd>${escapeHtml(s.phiStrength)}%</dd></div>
            <div><dt>Pen</dt><dd>${escapeHtml(s.pen)}</dd></div>
            <div><dt>Palette</dt><dd>${escapeHtml(s.palette)}</dd></div>
          </dl>
          <a class="remix" href="${escapeHtml(item.shareUrl)}">OPEN EXACT ARTWORK + REMIX →</a>
        </div>
      </div>
    </article>`;
}

function dayPage(queue) {
  const date = queue.date;
  const pretty = displayDate(date);
  const entries = queue.entries;
  const series = [...new Set(entries.map(e => e.series))];
  const title = `ALGO/ART Daily Gallery — ${pretty} | Golden Ratio Generative Art`;
  const description = `${entries.length} deterministic ALGO/ART studies generated on ${pretty}: ${series.join(', ')}. Golden-ratio composition rendered with imperfect digital marker ink.`;
  const canonical = `${GALLERY_URL}/${date}/`;
  const cover = `${canonical}${entries[0].imageFile}`;

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `ALGO/ART Daily Gallery — ${pretty}`,
    description,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: 'ALGO/ART',
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
          artform: 'Generative digital marker art',
          artMedium: 'Browser canvas and deterministic algorithm',
          creator: {
            '@type': 'Organization',
            name: 'ALGO/ART',
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
<link rel="stylesheet" href="../gallery.css">
<link rel="alternate" type="application/rss+xml" title="ALGO/ART Daily Gallery" href="../feed.xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ALGO/ART">
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
<header class="site-head">
  <a class="brand" href="../../">ALGO<span>/</span>ART</a>
  <div class="formula">1.6180339887 <i></i> 137.507764°</div>
  <nav><a href="../">DAILY GALLERY</a><a href="../../">GENERATOR</a></nav>
</header>
<main>
  <section class="hero">
    <div class="kicker">DAILY ARCHIVE / ${escapeHtml(date)}</div>
    <h1>${countWord(entries.length)} studies.<br>One deterministic day.</h1>
    <p>${escapeHtml(description)}</p>
    <div class="hero-meta"><span>φ / 1.6180339887</span><span>GOLDEN ANGLE / 137.507764°</span><span>SEEDABLE / REMIXABLE</span></div>
  </section>
  <section class="grid" aria-label="Artwork generated on ${escapeHtml(pretty)}">
    ${entries.map(artworkCard).join('\n')}
  </section>
  <section class="about">
    <span class="section-no">${String(entries.length + 1).padStart(2, '0')}</span>
    <div>
      <h2>MATHEMATICS SETS THE RULES.<br>THE MARKER BREAKS THEM.</h2>
      <p>ALGO/ART separates composition from rendering. φ influences placement, scale, hierarchy, negative space and trajectories; the marker engine adds wobble, pressure, overdraw and dryness. Every image above is deterministic: the exact seed and settings can be reopened and changed in the generator.</p>
      <a class="remix primary" href="../../">MAKE YOUR OWN →</a>
    </div>
  </section>
</main>
<footer><a href="../">← ALL DAILY GALLERIES</a><span>@artalgorithm</span><span>ALGO/ART / ${escapeHtml(date)}</span></footer>
</body>
</html>`;
}

function archivePage(archive) {
  const days = [...archive.days].sort((a, b) => b.date.localeCompare(a.date));
  const cards = days.map((day, index) => `
    <article class="day-card">
      <a href="./${day.date}/">
        <img src="./${day.date}/${escapeHtml(day.cover)}" width="1400" height="1000" loading="${index < 2 ? 'eager' : 'lazy'}" alt="ALGO/ART daily gallery cover for ${escapeHtml(displayDate(day.date))}">
        <div>
          <span>${escapeHtml(day.date)}</span>
          <h2>${escapeHtml(displayDate(day.date))}</h2>
          <p>${escapeHtml(day.series.join(' · '))}</p>
        </div>
      </a>
    </article>`).join('\n');

  const latest = days[0];
  const latestImage = latest ? `${GALLERY_URL}/${latest.date}/${latest.cover}` : SITE_URL + '/social-card.svg';
  const description = 'A growing daily archive of deterministic golden-ratio generative artworks created by ALGO/ART and rendered with imperfect digital marker strokes.';

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'ALGO/ART Daily Gallery',
    description,
    url: GALLERY_URL + '/',
    isPartOf: { '@type': 'WebSite', name: 'ALGO/ART', url: SITE_URL + '/' },
    hasPart: days.map(day => ({
      '@type': 'CollectionPage',
      name: `ALGO/ART Daily Gallery — ${displayDate(day.date)}`,
      url: `${GALLERY_URL}/${day.date}/`
    }))
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ALGO/ART Daily Gallery | Golden Ratio Generative Art Archive</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${GALLERY_URL}/">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="stylesheet" href="gallery.css">
<link rel="alternate" type="application/rss+xml" title="ALGO/ART Daily Gallery" href="feed.xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ALGO/ART">
<meta property="og:title" content="ALGO/ART Daily Gallery">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${GALLERY_URL}/">
<meta property="og:image" content="${latestImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="ALGO/ART Daily Gallery">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${latestImage}">
<script type="application/ld+json">${jsonLd(structured)}</script>
</head>
<body>
<header class="site-head">
  <a class="brand" href="../">ALGO<span>/</span>ART</a>
  <div class="formula">1.6180339887 <i></i> 137.507764°</div>
  <nav><a class="active" href="./">DAILY GALLERY</a><a href="../">GENERATOR</a></nav>
</header>
<main>
  <section class="hero archive-hero">
    <div class="kicker">PERMANENT DAILY ARCHIVE</div>
    <h1>GENERATED DAILY.<br>BUILT TO BE REMIXED.</h1>
    <p>${escapeHtml(description)}</p>
    <div class="hero-meta"><span>${days.length} DAILY ${days.length === 1 ? 'EDITION' : 'EDITIONS'}</span><span>LATEST: ${latest ? latest.count : 0} STUDIES</span><span>EXACT STATES PRESERVED</span></div>
  </section>
  <section class="day-grid" aria-label="Daily ALGO/ART galleries">
    ${cards || '<p class="empty">The first daily edition is being generated.</p>'}
  </section>
</main>
<footer><a href="../">← OPEN GENERATOR</a><span>@artalgorithm</span><span>ALGO/ART DAILY ARCHIVE</span></footer>
</body>
</html>`;
}

function rss(archive) {
  const days = [...archive.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>ALGO/ART Daily Gallery</title>
<link>${GALLERY_URL}/</link>
<description>Daily deterministic golden-ratio generative marker art from ALGO/ART.</description>
<language>en-gb</language>
${days.map(day => `<item>
<title>ALGO/ART Daily Gallery — ${escapeXml(displayDate(day.date))}</title>
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
    ...days.map(day => ({ loc: `${GALLERY_URL}/${day.date}/`, lastmod: day.date }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>`;
}

const day = process.env.SOCIAL_DATE || dateInZone();
const queuePath = path.resolve('social-output', day, 'queue.json');
const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));

if (!Array.isArray(queue.entries) || queue.entries.length === 0) {
  throw new Error('Daily gallery cannot be built from an empty social queue.');
}

const galleryRoot = path.resolve('gallery');
const dayDir = path.join(galleryRoot, day);
await fs.mkdir(dayDir, { recursive: true });

for (const existing of await fs.readdir(dayDir)) {
  if (existing.toLowerCase().endsWith('.jpg')) {
    await fs.rm(path.join(dayDir, existing), { force: true });
  }
}

for (const item of queue.entries) {
  const source = path.resolve('social-output', day, item.imageFile);
  const dest = path.join(dayDir, item.imageFile);
  await fs.copyFile(source, dest);
}

const dayMeta = {
  version: 1,
  date: day,
  count: queue.entries.length,
  series: [...new Set(queue.entries.map(e => e.series))],
  entries: queue.entries.map((item, index) => ({
    id: item.id,
    title: artworkTitle(item, index),
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
  count: queue.entries.length,
  series: [...new Set(queue.entries.map(e => e.series))]
});
archive.days.sort((a, b) => b.date.localeCompare(a.date));

await fs.mkdir(galleryRoot, { recursive: true });
await fs.writeFile(archivePath, JSON.stringify(archive, null, 2) + '\n');
await fs.writeFile(path.join(galleryRoot, 'index.html'), archivePage(archive));
await fs.writeFile(path.join(galleryRoot, 'feed.xml'), rss(archive));
await fs.writeFile(path.resolve('sitemap.xml'), sitemap(archive));
await fs.writeFile(path.resolve('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ALGO/ART daily gallery for ${day} with ${queue.entries.length} artworks.`);
console.log(`Gallery URL: ${GALLERY_URL}/${day}/`);
