import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error('PAGE ERROR:',e.message));
 await page.goto('http://127.0.0.1:8765/experiments/action-painting-v1.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Four studies rendered'),{timeout:180000});
 await fs.mkdir('action-painting-samples',{recursive:true});
 const canvases=await page.locator('main canvas').all();
 if(canvases.length!==4)throw Error('Expected four canvases');
 for(let i=0;i<canvases.length;i++){
  const b=await canvases[i].evaluate(c=>c.toDataURL('image/png').split(',')[1]);
  await fs.writeFile('action-painting-samples/study-'+String(i+1).padStart(2,'0')+'.png',Buffer.from(b,'base64'));
 }
 const summary=await page.locator('#status').textContent();console.log(summary);
 if(!summary.includes('source paths'))throw Error('No source-path evidence');
}finally{await browser.close()}
