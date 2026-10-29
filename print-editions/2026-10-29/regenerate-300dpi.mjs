// Re-render at 3x from the ORIGINAL saved engine/settings, not from archived low-resolution JPGs.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {chromium} from 'playwright';
const ROOT=process.cwd(),OUT=path.join(ROOT,'print-editions/2026-10-29/300dpi');
const works=[
  {
    "day": "2026-10-29",
    "filename": "2026-10-29-02-network-AA-20261029-02-92804.jpg",
    "slug": "01-marker-connected-fields",
    "material": "marker",
    "label": "Marker",
    "engine": "Connected Fields",
    "seed": "AA-20261029-02-92804",
    "shareUrl": "https://southernadd-cmyk.github.io/algoart/?v=8&seed=AA-20261029-02-92804&mode=network&el=35&den=53&cx=72&neg=16&phi=84&rec=4&spi=44&ga=86&nest=51&pen=paint&th=7&wob=27&od=2&op=88&pr=66&dry=17&curve=42&shape=81&overlap=28&rot=81&ln=1&ci=1&re=1&po=1&ar=1&pal=neon&cols=8&sat=84&bri=51&paper=%23f5f0e6&grain=14&sheet=phi",
    "imageUrl": "https://southernadd-cmyk.github.io/algoart/gallery/2026-10-29/2026-10-29-02-network-AA-20261029-02-92804.jpg"
  },
  {
    "day": "2026-10-26",
    "filename": "2026-10-26-watercolor-landscape-01-spiral-AWL-20261026-01-82491.jpg",
    "slug": "02-tissue-golden-trajectories",
    "material": "tissue",
    "label": "Tissue & Graphite",
    "engine": "Golden Trajectories",
    "seed": "AWL-20261026-01-82491",
    "shareUrl": "https://southernadd-cmyk.github.io/algoart/?v=8&seed=AWL-20261026-01-82491&mode=spiral&el=63&den=57&cx=73&neg=26&phi=89&rec=5&spi=86&ga=92&nest=31&pen=dry&th=10&wob=22&od=2&op=66&pr=48&dry=20&curve=58&shape=71&overlap=65&rot=69&ln=1&ci=1&re=1&po=1&ar=1&pal=primary&cols=5&sat=93&bri=45&paper=%23f5f0e6&grain=19&tissue=7&sheet=phi",
    "imageUrl": "https://southernadd-cmyk.github.io/algoart/gallery/2026-10-26/2026-10-26-watercolor-landscape-01-spiral-AWL-20261026-01-82491.jpg"
  },
  {
    "day": "2026-10-28",
    "filename": "2026-10-28-watercolour-portrait-01-rects-CWP-20261028-01-36906.jpg",
    "slug": "03-watercolour-recursive-divisions",
    "material": "watercolour",
    "label": "Watercolour",
    "engine": "Recursive Divisions",
    "seed": "CWP-20261028-01-36906",
    "shareUrl": "https://southernadd-cmyk.github.io/algoart/?v=9&seed=CWP-20261028-01-36906&mode=rects&fmt=portrait&el=42&den=58&cx=55&neg=32&phi=95&rec=8&spi=23&ga=99&nest=27&pen=broad&th=7&wob=26&od=4&op=87&pr=60&dry=39&curve=15&shape=80&overlap=62&rot=57&ln=1&ci=1&re=1&po=1&ar=1&pal=neon&cols=8&sat=71&bri=53&paper=%23f5f0e6&grain=26&material=watercolour-v2s&fit=0&sheet=phi",
    "imageUrl": "https://southernadd-cmyk.github.io/algoart/gallery/2026-10-28/2026-10-28-watercolour-portrait-01-rects-CWP-20261028-01-36906.jpg"
  },
  {
    "day": "2026-10-18",
    "filename": "2026-10-18-oil-portrait-01-geometric-OP-20261018-01-11851.jpg",
    "slug": "04-oil-constructed-forms",
    "material": "oil",
    "label": "Oil Paint",
    "engine": "Constructed Forms",
    "seed": "OP-20261018-01-11851",
    "shareUrl": "https://southernadd-cmyk.github.io/algoart/?v=9&seed=OP-20261018-01-11851&mode=geometric&fmt=portrait&el=46&den=46&cx=73&neg=22&phi=93&rec=8&spi=55&ga=87&nest=22&pen=paint&th=13&wob=36&od=2&op=70&pr=54&dry=14&curve=27&shape=82&overlap=34&rot=88&ln=1&ci=1&re=1&po=1&ar=1&pal=mono&cols=4&sat=84&bri=59&paper=%23f5f0e6&grain=19&material=oil-v4&sheet=phi",
    "imageUrl": "https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/2026-10-18-oil-portrait-01-geometric-OP-20261018-01-11851.jpg"
  },
  {
    "day": "2026-10-25",
    "filename": "2026-10-25-action-portrait-01-burst-ACP-20261025-01-74763.jpg",
    "slug": "05-action-radiant-systems",
    "material": "action",
    "label": "Action Painting",
    "engine": "Radiant Systems",
    "seed": "ACP-20261025-01-74763",
    "shareUrl": "https://southernadd-cmyk.github.io/algoart/?v=9&seed=ACP-20261025-01-74763&mode=burst&fmt=portrait&el=56&den=64&cx=62&neg=23&phi=92&rec=7&spi=54&ga=100&nest=46&pen=broad&th=11&wob=35&od=4&op=87&pr=53&dry=32&curve=39&shape=81&overlap=47&rot=87&ln=1&ci=1&re=1&po=1&ar=1&pal=golden&cols=7&sat=76&bri=56&paper=%23f5f0e6&grain=14&material=action-v2&sheet=phi",
    "imageUrl": "https://southernadd-cmyk.github.io/algoart/gallery/2026-10-25/2026-10-25-action-portrait-01-burst-ACP-20261025-01-74763.jpg"
  }
];
await fsp.mkdir(OUT,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url||'/', 'http://127.0.0.1:39871');
 if(req.method==='POST'&&u.pathname.startsWith('/__print_upload/')){
  const n=u.pathname.slice('/__print_upload/'.length);
  if(!works.some(w=>n===w.slug+'-engine-3x.png')){res.writeHead(403);res.end();return;}
  const dest=fs.createWriteStream(path.join(OUT,n));req.pipe(dest);
  dest.on('finish',()=>{res.writeHead(200);res.end('saved')});
  dest.on('error',e=>{res.writeHead(500);res.end(String(e))});
  return;
 }
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 const p=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!p.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
 try{if(!(await fsp.stat(p)).isFile())throw Error('Not file');res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res)}
 catch{res.writeHead(404);res.end('missing');}
});
await new Promise(r=>server.listen(39871,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--js-flags=--max-old-space-size=4096']});
try{
for(const work of works){
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.setDefaultTimeout(600000);
 page.on('pageerror',e=>console.error('[page]',work.slug,e.message));
 console.log('Opening saved composition',work.slug,work.seed);
 await page.goto('http://127.0.0.1:39871/?'+work.shareUrl.split('?')[1],{waitUntil:'load',timeout:90000});
 await page.waitForFunction(seed=>window.AlgoArt?.readSettings?.().seed===seed&&window.AlgoArt?.preparePNG&&document.querySelector('#art')?.width>0,work.seed,{timeout:90000});
 const info=await page.evaluate(async work=>{
  const A=window.AlgoArt,s=A.readSettings(),q=new URL(location.href).searchParams;
  if(s.seed!==work.seed)throw Error('Seed mismatch: '+s.seed);
  A.rendererVersion=Number(q.get('v')); A.phiFramingEnabled=q.get('sheet')==='phi';
  const flags={
   oilRender:work.material==='tissue', tissuePaletteVersion:Number(q.get('tissue')||'7'),
   oilPaintRender:work.material==='oil', oilPaintRevision:'v4',
   watercolourRender:work.material==='watercolour',watercolourRevision:'v2s',watercolourFitToSheet:q.get('fit')!=='0',
   actionPaintingRender:work.material==='action',actionPaintingRevision:2
  };
  const start=performance.now();
  const output=await A.preparePNG(Object.assign({},s,flags),3);
  if(!output.blob||output.blob.size<10000)throw Error('Empty PNG from native renderer');
  const response=await fetch('/__print_upload/'+work.slug+'-engine-3x.png',{method:'POST',body:output.blob});
  if(!response.ok)throw Error('Saving rendered output failed: '+response.status);
  return {bytes:output.blob.size,seconds:Math.round((performance.now()-start)/1000),version:A.rendererVersion,orientation:s.orientation};
 },work);
 console.log('Native renderer exported',work.slug,JSON.stringify(info));
 work.export=info;
 await page.close();
}
await fsp.writeFile(path.join(OUT,'source-manifest.json'),JSON.stringify({artworks:works,export:'Native seeded 3x engine output; no interpolation; 300ppi when placed at 3x logical size'},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
