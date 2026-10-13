// UI copy is independent of serialized pen settings and immutable rendering paths.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),help=read('js/control-help.js'),app=read('js/app.js'),description=read('js/describe.js');
assert.match(html,/data-tab="marker"[^>]*><span>03<\/span>Materials<\/button>/);
assert.match(html,/<section class="tab-panel" data-panel="marker"/);
assert.match(html,/id="materialStyle".*?<option value="marker">Marker drawing<\/option><option value="tissue">Tissue &amp; Graphite<\/option>/);
assert.match(html,/<span>MATERIAL CONTROLS<\/span>/);
assert.match(html,/<label>Mark-making tool<\/label><select id="pen">/);
assert.match(html,/<label>Stroke width<\/label>.*?<input id="thickness"/);
assert.match(html,/<label>Repeat passes<\/label>.*?<input id="overdraw"/);
assert.match(html,/SVG and plotter exports use marker paths/);
assert.match(help,/materialStyle:'Choose Marker drawing or Tissue & Graphite/);
assert.match(help,/Keep the selected material, paper colour and shape choices/);
assert.match(app,/pen:'pen'/);
assert.match(app,/\?A\.describeArtwork\(s,m,oilEnabled\(\)\?'tissue':'marker'\)/);
assert.match(description,/material==='tissue'\?'Abstract algorithmic tissue and graphite artwork'/);
assert.doesNotMatch(description,/(geometric marker forms|branching marker|Loose marker strokes)/);
// Both stylesheets must preserve the roomy two-row desktop tab layout.
const style=read('css/style.css'),markerStyle=read('css/marker-font.css');
assert(style.includes('grid-template-columns:repeat(3,minmax(0,1fr));'));
assert(style.includes('.tab:nth-child(3n){border-right:0}'));
assert(style.includes('.tab:nth-child(-n+3){border-bottom:1px solid var(--ink)}'));
assert(!markerStyle.includes('grid-template-columns:1.25fr'));
assert(markerStyle.includes('.tab{font-size:12px;white-space:normal;overflow-wrap:anywhere;text-align:center;}'));
console.log('PASS: Material labels, descriptions, unchanged URL parameters, and readable desktop tabs');
