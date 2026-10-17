// Desktop Chromium with touch emulation: validates our flow, not Android's
// download manager. Physical Android Chrome verification is still required.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
  await context.addInitScript(()=>{localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1')});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?v=8&seed=MOBILE-TEST&mode=rects');
  await page.evaluate(()=>{
    const click=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download)throw Error('Synthetic download click');return click.call(this)};
  });
  let lastURL,lastName;
  for(let i=0;i<3;i++){
    await page.locator('#inspectorToggle').tap();
    await page.locator('#tab-export').tap();
    await page.locator('#savePanel').tap();
    await page.locator('#pngDownload').waitFor({state:'visible'});
    const url=await page.locator('#pngDownload').getAttribute('href');
    const name=await page.locator('#pngDownload').getAttribute('download');
    assert.notEqual(url,lastURL);assert.notEqual(name,lastName);
    assert.equal(await page.locator('#pngOpen').getAttribute('href'),url);
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#pngDownload').tap()]);
    assert.equal(await download.failure(),null);
    assert.equal(download.suggestedFilename(),name);
    const bytes=await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer()).slice(0,8)),url);
    assert.deepEqual(bytes,[137,80,78,71,13,10,26,10]);
    lastURL=url;lastName=name;
    await page.locator('#inspectorClose').tap();
    await page.locator('#randomise').tap();
    assert.equal(await page.locator('#pngDownload').getAttribute('href'),null);
  }
  // In-flight encode must not make an old composition available after Randomise.
  await page.locator('#inspectorToggle').tap();
  await page.locator('#tab-export').tap();
  await page.evaluate(()=>{
    const original=AlgoArt.preparePNG;
    AlgoArt.preparePNG=(...args)=>original(...args).then(file=>new Promise(resolve=>{window.finishPNG=()=>resolve(file)}));
  });
  await page.locator('#savePanel').tap();
  await page.waitForFunction(()=>!!window.finishPNG);
  await page.locator('#inspectorClose').tap();
  await page.locator('#randomise').tap();
  await page.evaluate(()=>window.finishPNG());
  await page.waitForFunction(()=>!document.querySelector('#savePanel').disabled);
  assert.equal(await page.locator('#pngDownload').getAttribute('href'),null);
  assert.deepEqual(errors,[]);
  // Desktop remains a one-click export.
  const desktop=await browser.newPage({acceptDownloads:true});
  await desktop.addInitScript(()=>localStorage.setItem('algoart-inspector-desktop','open'));
  await desktop.addInitScript(()=>{localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1')});
  await desktop.goto('http://127.0.0.1:4173/?v=8&seed=DESKTOP&mode=rects');
  await desktop.locator('#tab-export').click();
  await desktop.locator('#exportScale').selectOption('1');
  const [download]=await Promise.all([desktop.waitForEvent('download'),desktop.locator('#savePanel').click()]);
  assert.equal(await download.failure(),null);
  console.log('PASS: repeated touch exports, close/randomise/reopen, fresh PNG bytes, stale encode rejection, no synthetic mobile downloads, desktop export');
}finally{await browser.close()}
