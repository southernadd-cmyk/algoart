// Tissue & Graphite V7 visual release: same Marker seed, same wash geometry,
// source-colour-matched pigments/blooms. Historical V6 remains byte-identical.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const folder='tissue-v6-v7-matched';
await mkdir(folder,{recursive:true});
const cases=[
  {seed:'TISSUE-V7-SOURCE-FIELD',mode:'field',palette:'neon'},
  {seed:'TISSUE-V7-SOURCE-SPIRAL',mode:'spiral',palette:'earth'},
  {seed:'TISSUE-V7-SOURCE-RECTS',mode:'rects',palette:'mono'}
];
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.setDefaultTimeout(180000);
  const manifests=[];
  for(const [i,c] of cases.entries()){
    const u=new URL(root);
    u.search='?v=9&seed='+c.seed+'&mode='+c.mode+'&pal='+c.palette+
      '&tissue=7&paper=%23f5f0e6';
    await page.goto(u.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(seed=>
      document.querySelector('#statsText')?.textContent.includes(seed),c.seed);
    assert.equal(await page.locator('#materialStyle').inputValue(),'tissue');
    const a=await page.evaluate(()=>{
      const A=window.AlgoArt,s=A.readSettings();
      const render=revision=>{
        const canvas=document.createElement('canvas'),started=performance.now();
        A.renderOil(canvas,s,.66,false,revision);
        return {png:canvas.toDataURL('image/png').split(',')[1],
          stats:JSON.parse(JSON.stringify(A.lastOilMaterialStats)),
          ms:Math.round(performance.now()-started)};
      };
      const v6=render(6),v7=render(7),repeated=render(7),v6again=render(6);
      return {v6,v7,v7identical:v7.png===repeated.png,
        v6unchanged:v6.png===v6again.png,settings:s};
    });
    assert(a.v7identical,'V7 pigment/blooms not deterministic');
    assert(a.v6unchanged,'V7 contaminated historic V6 renderer');
    if(c.palette==='mono')assert.equal(a.v6.png,a.v7.png,
      'Neutral Marker palette must not darken the historical tissue artwork');
    else assert.notEqual(a.v6.png,a.v7.png,
      'Chromatic source ink must visibly recolour tissue and blooms');
    assert.equal(a.v7.stats.tissuePaletteVersion,7);
    assert(a.v7.stats.sourceMatchedChains>0,'Original marker ink not preserved');
    assert.deepEqual(a.v7.stats.atmosphericBloomColours,a.v7.stats.inkColours,
      'Bloom hues must be derived from the source Marker ink kit');
    assert.equal(a.v6.stats.tissuePaletteVersion,6);
    const stem=String(i+1).padStart(2,'0')+'-'+c.mode,files=[];
    for(const revision of ['v6','v7']){
      const data=Buffer.from(a[revision].png,'base64');
      assert(data.length>18000);
      const name=stem+'-'+revision+'.png';
      await writeFile(folder+'/'+name,data);
      files.push({name,bytes:data.length});
    }
    manifests.push({...c,settings:a.settings,files,sourceMatchedChains:a.v7.stats.sourceMatchedChains,
      sourceBloomColours:a.v7.stats.atmosphericBloomColours,
      timingsMs:{v6:a.v6.ms,v7:a.v7.ms}});
    console.log('PASS tissue V7',c.mode,c.palette,
      'source chains',a.v7.stats.sourceMatchedChains,
      'bloom colours',a.v7.stats.atmosphericBloomColours.join(','));
  }
  await writeFile(folder+'/manifest.json',JSON.stringify({
    goal:'Tissue V7 source-hue pigment & atmospheric blooms vs archived V6',
    guarantees:'identical settings, unchanged V6 after V7, deterministic V7',
    dateCutover:'2026-10-15',
    studies:manifests
  },null,2));
}finally{await browser.close();}
