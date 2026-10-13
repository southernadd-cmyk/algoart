// Isolate the V5 torn-edge path to check closed shape seams. No changes to
// historical rendering geometry or paint layering are allowed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
await fs.mkdir('oil-check-results',{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1320,height:980}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  const url=new URL(base);
  url.searchParams.set('v','8');
  url.searchParams.set('mode','rects');
  url.searchParams.set('seed','V5-CORNER-RECT-CHECK');
  url.searchParams.set('tissue','5');
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  const summary=await page.evaluate(async ()=>{
    const source=await fetch('js/oil-material.js?test=closed-corner').then(x=>x.text());
    const marker='function pathStroke(ctx,pts,width,col,alpha){';
    if(!source.includes(marker))throw Error('No ribbon hook available');
    const patched=source.replace(marker,
      "A.tissueRibbonGeometryTest=function(ctx,pts,half,rev){var old=tissueTornEdges;tissueTornEdges=rev===5;try{return ribbon(ctx,pts,half,{range:function(a,b){return(a+b)/2}})}finally{tissueTornEdges=old}};\n"+marker);
    (0,eval)(patched);
    const A=window.AlgoArt,canvas=document.createElement('canvas');
    canvas.width=550;canvas.height=550;
    const ctx=canvas.getContext('2d');
    const color=[245,240,230];
    const paths={
      thick:[[82,82],[468,82],[468,468],[82,468],[82,82]],
      medium:[[85,85],[465,85],[465,465],[85,465],[85,85]],
      ellipse:Array.from({length:49},(_,i)=>{
        const t=i/48*Math.PI*2;return [275+175*Math.cos(t),275+175*Math.sin(t)]})
    };
    const parts=[];
    for(const [key,poly] of Object.entries(paths)){
      ctx.fillStyle='rgb(245,240,230)';ctx.fillRect(0,0,550,550);
      const pts=poly.map(([x,y])=>({x,y}));
      const half=key==='thick'?114:(key==='medium'?44:48);
      A.tissueRibbonGeometryTest(ctx,pts,half,5);
      ctx.fillStyle='rgb(36,91,142)';ctx.fill();
      const corners=[[5,5],[10,40],[40,10],[0,0]].map(([x,y])=>
         Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3));
      const centre=Array.from(ctx.getImageData(275,275,1,1).data).slice(0,3);
      const top=Array.from(ctx.getImageData(275,key==='ellipse'?100:82,1,1).data).slice(0,3);
      parts.push({key,half,corners,centre,top});
      const tile=document.createElement('div');
      tile.style.cssText='display:inline-flex;flex-direction:column;gap:10px';
      const label=document.createElement('b');label.textContent=key+' / V5 closed ribbon';
      tile.append(label,canvas.cloneNode(false));
      tile.querySelector('canvas').getContext('2d').drawImage(canvas,0,0);
      tile.querySelector('canvas').style.cssText='width:320px;border:1px solid #aaa';
      document.body.append(tile);tile.id='corner-check-'+key;
    }
    return {parts,version:A.lastOilMaterialStats?.tissuePaletteVersion};
  });
  assert.equal(summary.version,5);
  const cream=[245,240,230];
  for(const x of summary.parts){
    assert(x.corners.every(p=>p.every((v,i)=>Math.abs(v-cream[i])<=2)),
      'V5 closed tissue ribbon must not flood square corner: '+JSON.stringify(x));
    assert(x.centre.every((v,i)=>Math.abs(v-cream[i])<=2),
      'Closed tissue ribbon should have an empty centre, not a giant fill: '+JSON.stringify(x));
    assert(x.top.some((v,i)=>Math.abs(v-cream[i])>8),
      'Closed ribbon border must remain painted: '+JSON.stringify(x));
  }
  await page.screenshot({path:'oil-check-results/v5-torn-closed-geometry.png',fullPage:true});
  console.log('PASS V5 closed outlines retain paper at canvas corner and centre',summary);
  assert.deepEqual(errors,[]);
}finally{await browser.close()}
