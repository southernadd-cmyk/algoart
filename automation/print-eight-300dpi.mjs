// Isolated print generation: 8 authentic PROPORTION PIECE PNGs, no live-site edits.
// Outputs one image for each engine, with all five materials and eight palettes represented.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('print-eight-output');
await mkdir(root,{recursive:true});
const defs=[
  {mode:'field',series:'Orbital Studies',material:'marker',palette:'golden',seed:'PP-PRINT-20261103-01'},
  {mode:'spiral',series:'Golden Trajectories',material:'watercolour',palette:'cold',seed:'PP-PRINT-20261103-02'},
  {mode:'rects',series:'Recursive Divisions',material:'tissue',palette:'earth',seed:'PP-PRINT-20261103-03'},
  {mode:'burst',series:'Radiant Systems',material:'action',palette:'neon',seed:'PP-PRINT-20261103-04'},
  {mode:'network',series:'Connected Fields',material:'marker',palette:'cmyk',seed:'PP-PRINT-20261103-05'},
  {mode:'organic',series:'Growth Systems',material:'oil',palette:'warm',seed:'PP-PRINT-20261103-06'},
  {mode:'geometric',series:'Constructed Forms',material:'tissue',palette:'pastel',seed:'PP-PRINT-20261103-07'},
  {mode:'scribble',series:'Automatic Marks',material:'watercolour',palette:'primary',seed:'PP-PRINT-20261103-08'}
];
const modes={
 field:{elements:48,density:58,complexity:62,negativeSpace:28,spiralInfluence:54,curveBias:45},
 spiral:{elements:54,density:55,complexity:60,negativeSpace:24,spiralInfluence:84,curveBias:62},
 rects:{elements:38,density:48,complexity:66,negativeSpace:22,spiralInfluence:18,curveBias:12},
 burst:{elements:50,density:60,complexity:63,negativeSpace:24,spiralInfluence:56,curveBias:38},
 network:{elements:42,density:52,complexity:64,negativeSpace:26,spiralInfluence:48,curveBias:32},
 organic:{elements:44,density:54,complexity:60,negativeSpace:30,spiralInfluence:58,curveBias:84},
 geometric:{elements:30,density:50,complexity:58,negativeSpace:34,spiralInfluence:28,curveBias:8},
 scribble:{elements:46,density:56,complexity:66,negativeSpace:31,spiralInfluence:52,curveBias:72}
};
const filename=(n,x)=>String(n+1).padStart(2,'0')+'_'+x.mode+'_'+x.material+'_'+x.palette+'_300dpi.png';
function crc32(buf) {
  let crc=-1;
  for(const byte of buf){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^(-(crc&1)&0xEDB88320)}
  return (crc^-1)>>>0;
}
function addDpi(png){
  // pHYs in integer pixels/metre; 11811 ≈ 300 dpi.
  if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not PNG');
  const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
  if(w!==4900||h!==3500)throw Error('Wrong rendered size '+w+'x'+h);
  const d=Buffer.alloc(9);d.writeUInt32BE(11811,0);d.writeUInt32BE(11811,4);d[8]=1;
  const type=Buffer.from('pHYs'), c=Buffer.concat([type,d]), chunk=Buffer.alloc(12+d.length);
  chunk.writeUInt32BE(d.length,0);c.copy(chunk,4);chunk.writeUInt32BE(crc32(c),chunk.length-4);
  const ihdrEnd=33;
  return Buffer.concat([png.subarray(0,ihdrEnd),chunk,png.subarray(ihdrEnd)]);
}
for(let i=0;i<defs.length;i++){
 const spec=defs[i],name=filename(i,spec);
 console.log('START '+(i+1)+'/8 '+spec.series+' / '+spec.material+' / '+spec.palette);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--js-flags=--max-old-space-size=4096']});
 try{
   const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true});
   page.setDefaultTimeout(700000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
     try {localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1');}
     catch{}
   });
   await page.goto('http://127.0.0.1:4173/?v=9&seed='+encodeURIComponent(spec.seed)+'&mode='+spec.mode,
     {waitUntil:'load',timeout:120000});
   await page.waitForFunction(()=>window.AlgoArt?.renderActionPaintingV4&&
     window.AlgoArt?.renderWatercolourV2S&&window.AlgoArt?.renderOilPaintV7&&
     document.getElementById('creatingOverlay')?.hidden===true,{timeout:240000});
   if(errors.length)throw Error('Page errors: '+errors.join(' | '));
   const downloadPromise=page.waitForEvent('download',{timeout:700000});
   const result=await page.evaluate(async (job)=>{
     const A=window.AlgoArt;
     A.rendererVersion=9;
     A.phiFramingEnabled=false;
     if(A.watercolourV2sOptions)A.watercolourV2sOptions.fitToSheet=true;
     const s={...A.readSettings(),...job.defaults,seed:job.spec.seed,mode:job.spec.mode,
       orientation:'landscape',palette:job.spec.palette,paper:'#f5f0e6',
       colourCount:8,saturation:81,brightness:52,
       phiStrength:94,goldenAngle:96,recursion:6,nesting:48,
       thickness:8,wobble:43,overdraw:4,opacity:78,pressure:47,dryness:21,
       shapeAmount:66,overlap:44,rotation:79,grain:20,
       pen:'felt',lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
     const canvas=document.createElement('canvas');
     let info;
     switch(job.spec.material){
       case 'marker': info=A.render(canvas,s,3.5,false);break;
       case 'tissue': info=A.renderTissueV8(canvas,s,3.5,false);break;
       case 'watercolour':info=A.renderWatercolourV2S(canvas,s,3.5,false);break;
       case 'oil':info=A.renderOilPaintV7(canvas,s,3.5,false);break;
       case 'action':info=A.renderActionPaintingV4(canvas,s,3.5,false,{version:4});break;
       default:throw Error('Unsupported material');
     }
     if(canvas.width!==4900||canvas.height!==3500)throw Error('Bad canvas: '+canvas.width+'×'+canvas.height);
     const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG encode failed')),'image/png'));
     const sz=png.size;
     A.downloadBlob(png,job.name);
     canvas.width=1;canvas.height=1;
     return {w:4900,h:3500,bytes:sz,mode:job.spec.mode,material:job.spec.material,
       rendererVersion:A.rendererVersion};
   },{spec,defaults:modes[spec.mode],name});
   const dl=await downloadPromise;
   if(dl.suggestedFilename()!==name)throw Error('Unexpected download '+dl.suggestedFilename());
   const output=path.join(root,name);
   await dl.saveAs(output);
   const raw=await readFile(output);
   if(raw.length<100000)throw Error('Suspiciously small PNG: '+raw.length);
   await writeFile(output,addDpi(raw));
   console.log('DONE '+JSON.stringify({file:name,bytes:raw.length,...result}));
 }finally{await browser.close();}
}
const {readdir}=await import('node:fs/promises');
const actual=(await readdir(root)).filter(x=>x.endsWith('.png')).sort();
if(actual.length!==8)throw Error('Expected exactly eight prints, got '+actual.length);
console.log('PASS exactly eight authentic A3-ish 300 dpi 4900×3500 PNGs: '+JSON.stringify(actual));
