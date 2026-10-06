import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.argv[2] || 'http://127.0.0.1:4173/';
const outDir = path.resolve('output');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
  acceptDownloads: true
});

const page = await context.newPage();
await page.addInitScript(() => {
  try { localStorage.clear(); } catch (e) {}
});

await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.waitForSelector('#art');
await page.waitForTimeout(600);

await page.evaluate(() => {
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  cursor.innerHTML = '<span></span>';
  Object.assign(cursor.style, {
    position: 'fixed', left: '0', top: '0', width: '24px', height: '24px',
    borderRadius: '50%', border: '2px solid rgba(255,255,255,.95)',
    background: 'rgba(18,18,18,.82)', boxShadow: '0 1px 6px rgba(0,0,0,.35)',
    transform: 'translate(-40px,-40px)', transition: 'transform .32s cubic-bezier(.2,.8,.2,1), width .12s, height .12s',
    pointerEvents: 'none', zIndex: '2147483647', boxSizing: 'border-box'
  });
  const dot = cursor.querySelector('span');
  Object.assign(dot.style, { position:'absolute', width:'4px', height:'4px', borderRadius:'50%', background:'#fff', left:'8px', top:'8px' });
  document.body.appendChild(cursor);

  const toast = document.createElement('div');
  toast.id = 'demo-export-toast';
  toast.textContent = 'PNG EXPORTED';
  Object.assign(toast.style, {
    position:'fixed', left:'50%', bottom:'30px', transform:'translate(-50%,20px)',
    padding:'10px 16px', background:'rgba(20,20,20,.92)', color:'#fff',
    font:'700 12px/1.2 Arial, sans-serif', letterSpacing:'1.4px',
    opacity:'0', transition:'opacity .2s, transform .2s', zIndex:'2147483646',
    pointerEvents:'none'
  });
  document.body.appendChild(toast);
});

async function cursorTo(selector, delay = 420) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(({x,y}) => {
    const c = document.getElementById('demo-cursor');
    if (c) c.style.transform = `translate(${x-12}px,${y-12}px)`;
  }, {x,y});
  await page.mouse.move(x, y, { steps: 8 });
  await page.waitForTimeout(delay);
  return {x,y};
}

async function click(selector, hold = 350) {
  await cursorTo(selector, 280);
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) { c.style.width='16px'; c.style.height='16px'; }
  });
  await page.locator(selector).click();
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) { c.style.width='24px'; c.style.height='24px'; }
  });
  await page.waitForTimeout(hold);
}

async function setRange(selector, target, totalMs = 850) {
  await cursorTo(selector, 250);
  const start = await page.locator(selector).inputValue();
  const a = Number(start), b = Number(target);
  const steps = 7;
  for (let i = 1; i <= steps; i++) {
    const v = Math.round(a + (b - a) * (i / steps));
    await page.locator(selector).evaluate((el, value) => {
      el.value = String(value);
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
    }, v);
    await page.waitForTimeout(Math.round(totalMs / steps));
  }
}

await page.waitForTimeout(1900);
await click('#introEnter', 1100);

for (let i = 0; i < 4; i++) {
  await click('#randomise', 1650);
}

await click('button.tab[data-tab="phi"]', 450);
await setRange('#phiStrength', 18, 700);
await page.waitForTimeout(900);
await setRange('#phiStrength', 96, 850);
await page.waitForTimeout(1150);

await click('button.tab[data-tab="composition"]', 400);
await setRange('#density', 82, 800);
await page.waitForTimeout(1100);
await setRange('#complexity', 86, 800);
await page.waitForTimeout(1150);

await click('button.tab[data-tab="export"]', 500);
const downloadPromise = page.waitForEvent('download');
await click('#savePanel', 200);
const download = await downloadPromise;
await download.saveAs(path.join(outDir, 'algoart-demo-export.png'));
await page.evaluate(() => {
  const t = document.getElementById('demo-export-toast');
  if (t) { t.style.opacity='1'; t.style.transform='translate(-50%,0)'; }
});
await page.waitForTimeout(1700);

const video = page.video();
await context.close();
const videoPath = await video.path();
await browser.close();
await fs.copyFile(videoPath, path.join(outDir, 'algoart-demo.webm'));
console.log('Recorded:', path.join(outDir, 'algoart-demo.webm'));
