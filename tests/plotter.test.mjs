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

A.render=(canvas)=>{
  canvas.width=100;canvas.height=100;
  A.svgRecorder.paths=[
    {d:'M 5 5 L 25 25',stroke:'#ff0000',width:2,opacity:.5,lineCap:'round'},
    {d:'M 30 30 C 40 60 60 40 70 70',stroke:'#0000ff',width:3,opacity:.3,lineCap:'round'},
    {d:'M 80 80 L 90 90',stroke:'#ff0000',width:1,opacity:.7,lineCap:'butt'}
  ];
};
const layered=A.createPlotterSVG({seed:'LAYERS',paper:'#f5f0e6'},{paper:'A4',margin:10});
assert.equal(layered.metadata.colourRuns,3,'Separated repeated colours were merged');
assert.ok(layered.svg.includes('width="297mm" height="210mm"'));
assert.equal((layered.svg.match(/inkscape:groupmode="layer"/g)||[]).length,3);
assert.equal((layered.svg.match(/<path /g)||[]).length,3);
assert.ok(!layered.svg.includes('<rect width="100%"'),'Paper became a plot path');
assert.ok(layered.preview.includes('<rect width="100%"'));
assert.ok(layered.metadata.penTravelAfterMm<=layered.metadata.penTravelBeforeMm+1e-8);
assert.equal(A.rendererVersion,6);
console.log('PASS: sequential colour layers, millimetre page, no plotted paper, preview background and preserved legacy version.');
