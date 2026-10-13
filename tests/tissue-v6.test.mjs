// Exercise the real Canvas2D renderer: the new material stays local, inherits
// the fixed V5 closed outlines, and cannot contaminate historical renders.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const site=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const {base,cases}=JSON.parse(await fs.readFile(new URL('fixtures/tissue-v6-settings.json',import.meta.url),'utf8'));
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1360,height:980}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(new URL('?v=8&tissue=6&seed=V6-MATERIAL-CHECK&mode=rects',site).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AlgoArt?.lastOilMaterialStats?.tissuePaletteVersion===6);
  assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
  for(const test of cases){
    const result=await page.evaluate(s=>{
      const A=window.AlgoArt;A.rendererVersion=8;
      function render(revision){
        const c=document.createElement('canvas');A.renderOil(c,s,1,false,revision);return c;
      }
      const old=render(5),oldPNG=old.toDataURL(),oldMeta=JSON.stringify(A.lastRenderMeta);
      const fresh=render(6),stats=JSON.parse(JSON.stringify(A.lastOilMaterialStats));
      const sameGeometry=oldMeta===JSON.stringify(A.lastRenderMeta);
      const freshPNG=fresh.toDataURL(),repeat=render(6).toDataURL();
      const historic=render(5).toDataURL();
      const a=old.getContext('2d').getImageData(0,0,old.width,old.height).data;
      const b=fresh.getContext('2d').getImageData(0,0,fresh.width,fresh.height).data;
      let changed=0,cornerSame=true;
      for(let k=0;k<a.length;k+=4){
        if(Math.max(Math.abs(a[k]-b[k]),Math.abs(a[k+1]-b[k+1]),Math.abs(a[k+2]-b[k+2]))>2)changed++;
      }
      for(let y=0;y<48;y++)for(let x=0;x<48;x++){
        const k=(y*old.width+x)*4;
        for(let c=0;c<4;c++)if(a[k+c]!==b[k+c])cornerSame=false;
      }
      return {stats,sameGeometry,deterministic:freshPNG===repeat,historicSame:oldPNG===historic,
        cornerSame,changedRatio:changed/(old.width*old.height)};
    },{...base,...test});
    assert.equal(result.stats.tissuePaletteVersion,6);
    assert(result.stats.lightTissue.pieces>0&&result.stats.lightTissue.pieces<=8);
    assert.equal(result.stats.graphitePaths,0,'V6 must retain the original internal graphite');
    assert(result.sameGeometry,'Material must preserve the source composition');
    assert(result.deterministic,'V6 repeated pixels must match');
    assert(result.historicSame,'V5 pixels must survive a V6 render');
    assert(result.cornerSame,'Approved top-left reserve must stay unchanged');
    assert(result.changedRatio>.0005&&result.changedRatio<.15,'Pale tissue must remain local');
    console.log('PASS V6 '+test.name+' / '+result.stats.lightTissue.pieces+' pieces / '+(result.changedRatio*100).toFixed(2)+'% local change');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close()}
