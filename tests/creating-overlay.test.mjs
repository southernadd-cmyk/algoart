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
      const icon=document.getElementById('creatingMarker');
      if(!overlay||!icon||!window.AlgoArt.stroke)throw Error('Creating UI missing');
      const rgba=icon.getContext('2d').getImageData(0,0,icon.width,icon.height).data;
      if(!rgba.some((v,i)=>i%4===3&&v>0))throw Error('Marker icon has no ink');
      document.getElementById('newSeed').click();
      const shown=!overlay.hidden&&overlay.getAttribute('aria-hidden')==='false';
      document.getElementById('newSeed').click();
      const box=overlay.getBoundingClientRect();
      const topAtPanel=document.elementFromPoint(window.innerWidth/2,window.innerHeight-30);
      return {shown,fullViewport:box.width>=innerWidth-1&&box.height>=innerHeight-1,
        aboveParameters:topAtPanel===overlay||overlay.contains(topAtPanel),
        atDocumentRoot:overlay.parentElement===document.body};
    });
    assert(output.shown,'Overlay must show synchronously before heavy rendering');
    assert(output.fullViewport,'Overlay must cover whole viewport including Parameters');
    assert(output.aboveParameters,'Overlay must be topmost over mobile Parameters area');
    assert(output.atDocumentRoot,'Overlay must not be clipped by canvas wrapping');
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
