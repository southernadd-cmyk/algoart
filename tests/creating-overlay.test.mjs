import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
  for(const mobile of [false,true]){
    const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:900}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/',{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#art').width>0,{timeout:20000});
    const output=await page.evaluate(()=>{
      const overlay=document.getElementById('creatingOverlay');
      const icon=document.querySelector('.creating-phi');
      if(!overlay||!icon||icon.textContent!=='φ')throw Error('Single phi icon missing');
      const style=getComputedStyle(icon);
      if(style.backgroundColor!=='rgba(0, 0, 0, 0)'||!style.fontFamily.includes('AlgoArt Marker'))
        throw Error('Phi must have a transparent background and marker font');
      document.getElementById('newSeed').click();
      const shown=!overlay.hidden&&overlay.getAttribute('aria-hidden')==='false';
      document.getElementById('newSeed').click();
      return {shown};
    });
    assert(output.shown,'Overlay must show synchronously before heavy rendering');
    await page.waitForFunction(()=>document.getElementById('creatingOverlay').hidden,{timeout:90000});
    assert.deepEqual(errors,[],'No browser errors');
    const state=await page.evaluate(()=>{
      const canvas=document.getElementById('art');
      const overlay=document.getElementById('creatingOverlay');
      return {pixels:canvas.width*canvas.height,hidden:overlay.hidden,aria:overlay.getAttribute('aria-hidden')};
    });
    assert.equal(state.hidden,true);
    assert.equal(state.aria,'true');
    assert(state.pixels>100000,'Full art must be rendered');
    console.log('CREATING_OVERLAY_PASS '+JSON.stringify({mobile,state}));
    await context.close();
  }
}finally{await browser.close()}
