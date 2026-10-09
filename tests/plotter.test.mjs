import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const A={};
const sandbox={window:{AlgoArt:A},document:{createElement:()=>({})}};
runInNewContext(readFileSync(new URL('../js/plotter.js',import.meta.url),'utf8'),sandbox);
const G=A.plotterGeometry;
const make=d=>({commands:G.commands(d),stroke:'#000',width:2,opacity:.5,lineCap:'round'});
const origin={x:0,y:0};
for(let seed=1;seed<=20;seed++){
  const paths=Array.from({length:8},(_,i)=>make('M '+((seed*17+i*43)%97)+' '+((seed*29+i*19)%83)+' L '+((seed*11+i*31)%101)+' '+((seed*13+i*37)%89)));
  let best=Infinity;
  for(let mask=0;mask<256;mask++){
    const candidate=paths.map((p,i)=>({...p,commands:mask&(1<<i)?G.reversed(p.commands):p.commands}));
    best=Math.min(best,G.travel(candidate,origin));
  }
  const optimized=G.optimize(paths,origin);
  assert.ok(Math.abs(G.travel(optimized,origin)-best)<1e-8,'Fixed-order route not optimal');
  assert.ok(G.travel(optimized,origin)<=G.travel(paths,origin)+1e-8);
  assert.equal(optimized.length,paths.length);
}
const cubic=G.commands('M 10 20 C 30 40 50 60 70 80 L 90 100');
assert.equal(JSON.stringify(G.reversed(G.reversed(cubic))),JSON.stringify(cubic));
const rotated=G.commands('M 10 20 C 30 40 50 60 70 80','matrix(0 1 -1 0 1400 0)');
assert.equal(rotated[0].points[0].x,1380);assert.equal(rotated[0].points[0].y,10);
const dash=G.cut([{x:0,y:0},{x:40,y:0}],[10,5],3,100,100);
assert.equal(JSON.stringify(dash),JSON.stringify([
  [{x:0,y:0},{x:7,y:0}],[{x:12,y:0},{x:22,y:0}],[{x:27,y:0},{x:37,y:0}]
]));
const parts=G.prepare([{d:'M -10 50 L 110 50',stroke:'#f00',width:2,opacity:.8,lineCap:'round'}],100,100);
assert.equal(parts[0].commands[0].points[0].x,0);
assert.equal(parts[0].commands[1].points[0].x,100);
const backtrack=G.flatten(G.commands('M 0 0 C 100 0 -100 0 0 0'));
assert.ok(backtrack.length>2,'Collinear looping cubic was lost');
assert.ok(Math.max(...backtrack.map(p=>p.x))>20);
const oldRecorder={sentinel:true},oldMeta={sentinel:true};
A.svgRecorder=oldRecorder;A.lastRenderMeta=oldMeta;A.W=123;A.H=456;A.rendererVersion=6;
A.render=()=>{throw Error('render failed')};
assert.throws(()=>A.createPlotterSVG({seed:'OLD',paper:'#fff'}),/render failed/);
assert.equal(A.svgRecorder,oldRecorder);assert.equal(A.lastRenderMeta,oldMeta);assert.equal(A.W,123);assert.equal(A.H,456);
assert.throws(()=>A.createPlotterSVG({},{margin:110}),/Margin/);
console.log('PASS: exhaustive fixed-order route optimality, reversible cubics, rotated coordinates, physical dash breaks, clipping and renderer-state restoration.');

const layerPaths=[
  {d:'M 5 5 L 25 25',stroke:'#ff0000',width:2,opacity:.5,lineCap:'round'},
  {d:'M 30 30 C 40 60 60 40 70 70',stroke:'#0000ff',width:3,opacity:.3,lineCap:'round'},
  {d:'M 80 80 L 90 90',stroke:'#ff0000',width:1,opacity:.7,lineCap:'butt'}
];
A.render=(canvas)=>{
  canvas.width=100;canvas.height=100;
  A.svgRecorder.paths=layerPaths;
};
const layered=A.createPlotterSVG({seed:'LAYERS',paper:'#f5f0e6'},{paper:'A4',margin:10});
assert.equal(layered.metadata.colourRuns,3,'Separated repeated colours were merged');
assert.ok(layered.svg.includes('width="297mm" height="210mm"'));
assert.equal((layered.svg.match(/inkscape:groupmode="layer"/g)||[]).length,3);
assert.equal((layered.svg.match(/<path /g)||[]).length,3);
assert.ok(!layered.svg.includes('<rect width="100%"'),'Paper became a plot path');
assert.ok(layered.preview.includes('<rect width="297" height="210" fill="#f5f0e6"'));
assert.ok(layered.metadata.penTravelAfterMm<=layered.metadata.penTravelBeforeMm+1e-8);
assert.equal(A.rendererVersion,6);
console.log('PASS: sequential colour layers, millimetre page, no plotted paper, preview background and preserved legacy version.');

const settings={seed:'LAYERS',paper:'#f5f0e6'};
const faithful=A.createPlotterSVG(settings,{optimize:false});
const grouped=A.createPlotterSVG(settings,{grouping:'pens',optimize:false});
const groupedOptimized=A.createPlotterSVG(settings,{grouping:'pens'});
const pathTags=svg=>Array.from(svg.matchAll(/<path [^>]*\/>/g),m=>m[0]);
assert.equal(faithful.metadata.layerGrouping,'runs');
assert.equal(faithful.metadata.pathOrder,'preserved');
assert.equal(faithful.metadata.penChanges,2);
assert.equal(grouped.metadata.layerGrouping,'pens');
assert.equal(grouped.metadata.pathOrder,'preserved-within-pen');
assert.equal(groupedOptimized.metadata.pathOrder,'reordered-within-pen');
assert.equal(grouped.metadata.penOrder,'light-to-dark');
assert.equal(groupedOptimized.metadata.routeOptimization,'nearest-neighbour-and-direction');
assert.equal(faithful.metadata.forcedPauses,2);assert.equal(grouped.metadata.forcedPauses,0);
assert.deepEqual(Array.from(faithful.svg.matchAll(/inkscape:label="([^"]+)"/g),m=>m[1]),
  ['001 · Pen 1 · #ff0000','!002 · Pen 2 · #0000ff','!003 · Pen 1 · #ff0000']);
assert.equal(grouped.metadata.colourRuns,3,'Original run count was lost');
assert.equal(grouped.metadata.penLayers,2);
assert.equal(grouped.metadata.penChanges,1);
assert.equal((grouped.svg.match(/inkscape:groupmode="layer"/g)||[]).length,2);
assert.ok(grouped.svg.includes('id="pen-1" inkscape:groupmode="layer" inkscape:label="1 · #ff0000"'));
assert.ok(grouped.svg.includes('id="pen-2" inkscape:groupmode="layer" inkscape:label="2 · #0000ff"'));
assert.deepEqual(pathTags(grouped.svg),['#ff0000','#0000ff'].flatMap(colour=>pathTags(faithful.svg).filter(tag=>tag.includes('stroke="'+colour+'"'))),
  'Grouping changed geometry, style or stroke order within a pen');
const pageScale=1.9,home={x:-53.5/pageScale,y:-10/pageScale};
const prepared=G.prepare(layerPaths,100,100);
let travelBefore=0,travelAfter=0;
const expectedCommands=[];
for(const colour of ['#ff0000','#0000ff']){
  const pen=prepared.filter(p=>p.stroke===colour);
  travelBefore+=G.travel(pen,home);
  const optimal=G.routePen(pen,home);
  travelAfter+=G.travel(optimal,home);
  expectedCommands.push(...optimal.map(p=>JSON.stringify(p.commands)));
}
assert.ok(Math.abs(grouped.metadata.penTravelBeforeMm-travelBefore*pageScale)<1e-8);
assert.ok(Math.abs(groupedOptimized.metadata.penTravelAfterMm-travelAfter*pageScale)<1e-8);
assert.ok(groupedOptimized.metadata.penTravelAfterMm<=groupedOptimized.metadata.penTravelBeforeMm+1e-8);
assert.deepEqual(Array.from(groupedOptimized.svg.matchAll(/<path d="([^"]+)"/g),m=>JSON.stringify(G.commands(m[1]))),expectedCommands,
  'Routing did not run independently within each pen');
assert.throws(()=>A.createPlotterSVG(settings,{grouping:'unknown'}),/faithful colour runs/);
assert.equal(A.svgRecorder,oldRecorder);assert.equal(A.lastRenderMeta,oldMeta);
assert.equal(A.W,123);assert.equal(A.H,456);assert.equal(A.rendererVersion,6);
console.log('PASS: numbered pen layers, light-to-dark ordering, faithful pen-change pauses and independent grouped routing.');

const scattered=[0,95,5,90,10,85].map((x,i)=>({...make('M '+x+' 0 L '+x+' 1'),source:i}));
const originalScattered=JSON.stringify(scattered);
const routed=G.routePen(scattered,origin);
assert.ok(G.travel(routed,origin)<G.travel(G.optimize(scattered,origin),origin)*.4,'Greedy routing did not shorten a scattered pen');
assert.equal(JSON.stringify(scattered),originalScattered,'Routing mutated source geometry');
assert.deepEqual(Array.from(routed,p=>p.source).sort((a,b)=>a-b),scattered.map(p=>p.source));
const canonical=p=>[JSON.stringify(p.commands),JSON.stringify(G.reversed(p.commands))].sort()[0];
assert.deepEqual(Array.from(routed,canonical).sort(),scattered.map(canonical).sort(),'Routing changed geometry');
assert.equal(JSON.stringify(G.routePen(scattered,origin)),JSON.stringify(routed),'Routing is not deterministic');
for(let seed=1;seed<=20;seed++){
  const pen=Array.from({length:12},(_,i)=>({...make('M '+((seed*17+i*43)%97)+' '+((seed*29+i*19)%83)+' L '+((seed*11+i*31)%101)+' '+((seed*13+i*37)%89)),source:i}));
  assert.ok(G.travel(G.routePen(pen,origin),origin)<=G.travel(G.optimize(pen,origin),origin)+1e-8,'Grouped route regressed against direction-only route');
}
console.log('PASS: deterministic greedy routes cut scattered travel, retain every stroke and never exceed the direction-only fallback.');

const greys=['#2e2e2e','#c7c7c7','#777777','#ffffff','#000000'];
A.render=canvas=>{
  canvas.width=100;canvas.height=100;
  A.svgRecorder.paths=greys.map((stroke,i)=>({d:'M 5 '+(i+5)+' L 95 '+(i+5),stroke,width:2,opacity:.5,lineCap:'round'}));
};
const greyResult=A.createPlotterSVG(settings,{grouping:'pens',optimize:false});
assert.equal(JSON.stringify(greyResult.metadata.penColours),JSON.stringify(['#ffffff','#c7c7c7','#777777','#2e2e2e','#000000']));
assert.ok(Math.abs(G.luminance('#fff')-1)<1e-10);assert.equal(G.luminance('#000'),0);
assert.ok(G.luminance('#00ff00')>G.luminance('#ff0000')&&G.luminance('#ff0000')>G.luminance('#0000ff'));
console.log('PASS: greys and saturated colours use linear relative luminance, lightest pen first.');

A.render=canvas=>{
  canvas.width=100;canvas.height=100;
  A.svgRecorder.paths=Array.from({length:24},(_,i)=>({
    d:'M '+(i+1)+' 5 L '+(i+1)+' 95',stroke:'#'+(i%12+1).toString(16).padStart(6,'0'),width:2,opacity:.5,lineCap:'round'
  }));
};
const manyPens=A.createPlotterSVG(settings,{grouping:'pens'});
const numbered=Array.from(manyPens.svg.matchAll(/inkscape:label="(\d+) · (#[a-f0-9]+)"/g));
assert.equal(manyPens.metadata.colourRuns,24);
assert.equal(manyPens.metadata.penLayers,12);assert.equal(manyPens.metadata.penChanges,11);
assert.equal(numbered.length,12);
assert.deepEqual(numbered.map(m=>Number(m[1])),Array.from({length:12},(_,i)=>i+1));
console.log('PASS: multi-digit AxiDraw pen numbers and repeated colours produce exactly one layer per pen.');

A.render=canvas=>{
  canvas.width=100;canvas.height=100;
  A.svgRecorder.paths=[{d:'M 5 50 L 95 50',stroke:'#123456',width:20,opacity:.4,lineCap:'round',dash:[6,3],dashOffset:0}];
};
const dry=A.createPlotterSVG({seed:'DRY',paper:'#fff'});
const dryGrouped=A.createPlotterSVG({seed:'DRY',paper:'#fff'},{grouping:'pens'});
assert.ok(dry.metadata.paths>1,'Physical dash gaps were lost');
assert.equal(dry.metadata.svgPaths,1,'One marker pass was split into separately composited elements');
assert.equal((dry.svg.match(/stroke-opacity="/g)||[]).length,1);
assert.ok(!dry.svg.includes('stroke-dasharray'));
assert.equal(dryGrouped.metadata.penLayers,1);assert.equal(dryGrouped.metadata.penChanges,0);
assert.equal(dryGrouped.metadata.svgPaths,1);
assert.equal((dryGrouped.svg.match(/stroke-opacity="/g)||[]).length,1);
console.log('PASS: multiple physical pen lifts retain the single source marker pass opacity.');

A.render=canvas=>{
  canvas.width=100;canvas.height=100;
  A.svgRecorder.paths=[
    {d:'M 5 50 L 95 50',stroke:'#123456',width:20,opacity:.4,lineCap:'round',dash:[6,3]},
    {d:'M 5 51 L 95 51',stroke:'#123456',width:20,opacity:.4,lineCap:'round',dash:[6,3]},
    {d:'M 5 52 L 95 52',stroke:'#123456',width:20,opacity:.4,lineCap:'round',dash:[6,3]}
  ];
};
const compoundDry=A.createPlotterSVG(settings,{grouping:'pens'});
assert.equal(compoundDry.metadata.svgPaths,3,'Routing interleaved fragments and split a source pass');
assert.equal((compoundDry.svg.match(/stroke-opacity="/g)||[]).length,3);

A.render=canvas=>{canvas.width=100;canvas.height=100;A.svgRecorder.paths=[]};
const empty=A.createPlotterSVG(settings,{grouping:'pens'});
assert.equal(empty.metadata.penLayers,0);assert.equal(empty.metadata.penChanges,0);
assert.equal(empty.metadata.svgPaths,0);assert.equal(empty.metadata.penTravelAfterMm,0);
