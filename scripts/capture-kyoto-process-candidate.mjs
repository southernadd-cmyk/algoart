// KYOTO process evidence: two unmodified outputs from one real editor session.
// This creates a *candidate replacement artwork*, NOT evidence of the separately
// selected manually exported image. No modifications to the editor or art.
// The published daily archive stores exact full parameters for this artwork.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const id='2026-11-02-ACL01';
const out='artifacts/kyoto-process-candidate';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let page;
try{
  page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/?art='+encodeURIComponent(id),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#seed')?.value==='ACL-20261102-01-03737' &&
    document.querySelector('#materialStyle')?.value==='action'&&
    document.querySelector('#mode')?.value==='rects',null,{timeout:120000});
  // Hide the welcome overlay through the real Begin control.
  const intro=page.locator('#introSplash');
  if(await intro.isVisible())await page.locator('#introEnter').click();
  await page.waitForFunction(()=>document.querySelector('#creatingOverlay')?.hidden!==false,
    null,{timeout:90000});
  await page.locator('#inspectorToggle').click();
  await page.waitForTimeout(1000);
  const details=await page.evaluate(()=>{
    const art=document.querySelector('#art');
    return {
      seed:document.querySelector('#seed').value,
      mode:document.querySelector('#mode').value,
      material:document.querySelector('#materialStyle').value,
      canvas:{width:art.width,height:art.height},
      url:location.href,
      params:window.AlgoArt.readSettings(),
      paintData:art.toDataURL('image/png')
    };
  });
  if(details.seed!=='ACL-20261102-01-03737'||details.mode!=='rects'||details.material!=='action')
    throw Error('The selected exact archive artwork was not restored: '+JSON.stringify(details).slice(0,600));
  const png=Buffer.from(details.paintData.split(',')[1],'base64');
  if(png.length<40000)throw Error('Candidate original artwork PNG unexpectedly small: '+png.length);
  await writeFile(out+'/01_exact_archived_action_painting.png',png);
  delete details.paintData;
  await page.screenshot({path:out+'/process01.png',type:'png',timeout:90000});
  await writeFile(out+'/PROVENANCE.json',JSON.stringify({archiveId:id,source:'PROPORTION PIECE real web editor',note:'Screenshot and PNG captured in same browser session, canvas not altered. This is a proposed new entry, not the previous manually exported artwork.',details,pngBytes:png.length,pageErrors:errors},null,2)+'\n');
  console.log('KYOTO_CANDIDATE '+JSON.stringify({archiveId:id,seed:details.seed,mode:details.mode,material:details.material,pngBytes:png.length,pageErrors:errors}));
}finally{
  await page?.close().catch(()=>{});
  await browser.close();
}
