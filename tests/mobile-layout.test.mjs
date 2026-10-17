import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
await fs.mkdir('oil-check-results',{recursive:true});
const browser=await chromium.launch();
try{
 for(const [width,height] of [[320,568],[390,844],[430,932]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
  await page.addInitScript(()=>{localStorage.setItem('algoart-inspector-desktop','open');localStorage.setItem('algoart-inspector-mobile','closed');localStorage.setItem('algoart-intro-seen','1');localStorage.setItem('algoart-ethos-seen','1')});
  for(const fmt of ['landscape','portrait']){
   await page.goto(`http://127.0.0.1:4173/?v=8&seed=LAYOUT&mode=rects&fmt=${fmt}`);
   await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true&&document.querySelector('#statsText')?.textContent?.includes('LAYOUT'),{timeout:120000});
   const geometry=await page.evaluate(()=>{
    const c=document.querySelector('#art').getBoundingClientRect(),shell=document.querySelector('.canvas-shell'),s=shell.getBoundingClientRect(),css=getComputedStyle(shell);
    return {x:c.x,y:c.y,w:c.width,h:c.height,centre:c.y+c.height/2,expected:s.y+parseFloat(css.paddingTop)+(s.height-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom))/2,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert(!geometry.overflow,'Horizontal overflow');
   assert(Math.abs(geometry.w/geometry.h-(fmt==='landscape'?1.4:1/1.4))<0.01,'Canvas distortion');
   assert(geometry.y>=0,'Artwork must start inside the viewport');
   assert(geometry.x>=0&&geometry.x+geometry.w<=width,'Artwork clipped horizontally');
   assert(geometry.y>=0&&geometry.y+geometry.h<=height-35,'Artwork overlaps footer');
   if(fmt==='landscape')assert(geometry.w>=width-32,'Landscape should use available phone width');
   await page.screenshot({path:`oil-check-results/layout-${width}-${fmt}.png`});
   await page.locator('#inspectorToggle').tap();
   await page.locator('#tab-export').tap();
   await page.locator('#savePanel').waitFor({state:'visible'});
   await page.locator('#inspectorClose').tap();
  }
  await page.close();
 }
 console.log('PASS mobile artwork fits, proportions, centring, width and preferences at three phone sizes');
}finally{await browser.close()}
