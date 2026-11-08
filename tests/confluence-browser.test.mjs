import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Browser regression: Confluence must actually resize and switch orientation,
// not merely render non-functional HTML buttons.
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const server=createServer(async (req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+path);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    if(path.endsWith('/'))file=resolve(file,'index.html');
    const data=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
      'cache-control':'no-store'}).end(data);
  }catch(error){res.writeHead(404).end('Not found');}
});
let browser;
const errors=[];
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+port+'/confluence/',{waitUntil:'load'});
  await page.waitForFunction(()=>{
    const c=document.querySelector('#shared');
    const text=document.querySelector('#counter')?.textContent||'';
    return c?.width===1400 && text.includes(' / ') && text.endsWith(' turns') && Number(text.split('/')[1]?.trim().split(' ')[0])>0;
  },undefined,{timeout:60000});
  async function measure(label,w,h){
    await page.waitForFunction(([w,h])=>{
      const c=document.querySelector('#shared');
      return c?.width===w && c?.height===h && c.getBoundingClientRect().height>0;
    },[w,h],{timeout:60000});
    await page.waitForTimeout(150);
    const m=await page.evaluate(()=>{
      const c=document.querySelector('#shared'),box=c.getBoundingClientRect();
      const stage=document.querySelector('#canvases').getBoundingClientRect();
      return {w:c.width,h:c.height,shownW:box.width,shownH:box.height,
        left:box.left,right:box.right,top:box.top,bottom:box.bottom,
        stageW:stage.width,stageH:stage.height,stageBottom:stage.bottom,
        viewportW:innerWidth,viewportH:innerHeight,
        pageW:document.documentElement.scrollWidth,pageH:document.documentElement.scrollHeight};
    });
    assert(m.shownW>20&&m.shownH>20,label+' canvas unexpectedly tiny: '+JSON.stringify(m));
    assert(Math.abs(m.shownW/m.shownH-w/h)<.015,label+' has wrong visual aspect ratio: '+JSON.stringify(m));
    assert(m.shownW<=m.stageW+2&&m.shownH<=m.stageH+2,label+' exceeds stage: '+JSON.stringify(m));
    assert(m.left>=-2&&m.right<=m.viewportW+2&&m.top>=0&&m.bottom<=m.viewportH+2,
      label+' canvas extends beyond viewport: '+JSON.stringify(m));
    assert(m.pageW<=m.viewportW+3&&m.pageH<=m.viewportH+3,
      label+' page scroll exceeds viewport: '+JSON.stringify(m));
    console.log(label,JSON.stringify(m));
  }
  await measure('desktop landscape',1400,1000);
  await page.locator('#format-portrait').click();
  assert.equal(await page.locator('#orientation').inputValue(),'portrait');
  assert.equal(await page.locator('#format-portrait').getAttribute('aria-pressed'),'true');
  await measure('desktop portrait',1000,1400);
  await page.locator('#format-landscape').click();
  assert.equal(await page.locator('#orientation').inputValue(),'landscape');
  await measure('desktop landscape restored',1400,1000);
  await page.setViewportSize({width:390,height:844});
  await measure('mobile landscape',1400,1000);
  await page.locator('#format-portrait').click();
  await measure('mobile portrait',1000,1400);
  assert.deepEqual(errors,[],'Confluence JavaScript errors: '+errors.join('; '));
  console.log('Confluence responsive orientation smoke passed');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
