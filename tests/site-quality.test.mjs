import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

const editor=read('index.html'), baseCSS=read('css/style.css');
assert(editor.includes('<h1 class="brand">ALGO<span>/</span>ART</h1>'));
assert.match(baseCSS, /\.brand\{\s*margin:0;/);
const scripts=[...editor.matchAll(/<script src="(js\/[^"]+\.js\?v=[^"]+)"\s*><\/script>/g)].map(x=>x[1]);
const allScripts=[...editor.matchAll(/<script src="(js\/[^"]+)"\s*><\/script>/g)].map(x=>x[1]);
assert(scripts.length>=12 && scripts.length===allScripts.length, 'Every editor script needs cache versioning');
const versions=new Set(scripts.map(x=>new URL(x,'https://example.invalid').searchParams.get('v')));
assert.equal(versions.size,1, 'Every editor script must share one release cache version');

const gallery=read('gallery/index.html'),source=read('automation/build-gallery.mjs'),rss=read('gallery/feed.xml');
const description='A growing daily archive of deterministic golden-ratio generative artworks from ALGO/ART, created with Marker drawing and Tissue & Graphite.';
assert(source.includes(description),'Daily gallery generator must retain material-aware description');
assert(gallery.includes(description),'Gallery JSON-LD must match generated description');
assert(gallery.includes(description.replaceAll('&','&amp;')),'Gallery HTML descriptions must be escaped');
assert(!source.includes('imperfect digital marker strokes')&&!gallery.includes('imperfect digital marker strokes'));
assert(source.includes('escapeXml(FEED_DESCRIPTION)'),'RSS description must be XML-escaped');
assert(rss.includes('Marker drawing and Tissue &amp; Graphite'),'Published RSS must name both materials');
assert(source.includes('from marker wobble and overdraw to translucent torn tissue and graphite'),
  'Daily editions must explain both materials');
assert(gallery.includes('gallery.css?v=20261013-site-quality'));
for(const day of ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13']){
 const content=read('gallery/'+day+'/index.html');
 assert(content.includes('gallery.css?v=20261013-site-quality'),day+' should load the new accessible colours');
 assert(!content.includes('the marker engine adds wobble'),day+' still has a marker-only explanation');
}

// Contrast assertions are independent of headless-browser background heuristics.
// Text colours must satisfy WCAG AA (4.5:1 normal; 3:1 large text) on real panel backgrounds.
const palette=read('gallery/gallery.css');
const vars=Object.fromEntries([...palette.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map(([,k,v])=>[k,v]));
function luminance(hex){
 const values=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
 return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
}
function ratio(a,b){const l=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (l[0]+0.05)/(l[1]+0.05);}
for(const background of ['paper','paper2']){
 assert(ratio(vars.muted,vars[background])>=4.5,background+' muted captions need AA contrast');
 assert(ratio(vars['orange-text'],vars[background])>=3,background+' orange labels need large-text AA contrast');
 assert(ratio(vars.blue,vars[background])>=4,background+' blue labels should remain legible');
}
assert(palette.includes('.brand span{color:var(--orange-text)'));
assert(palette.includes('color:var(--orange-text)}'));
console.log('PASS site quality: both materials in gallery/RSS, contrast-safe labels, editor heading and coherent script cache version');
