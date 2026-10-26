import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const server=createServer(async(req,res)=>{
 try{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root))throw Error('Outside root');
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'text/javascript');
  res.end(await fs.readFile(file));
 }catch(e){res.writeHead(404);res.end('Not found')}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true});
const problems=[];
try{
 await fs.mkdir('artifacts/graffiti-v3',{recursive:true});
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
  page.on('pageerror',e=>problems.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/test/graffiti/v3/index.html',{waitUntil:'networkidle'});
  for(const hand of 'ABCDEFGHI'){
   await page.locator('#hand').selectOption(hand);
   const result=await page.locator('.study').evaluateAll(nodes=>nodes.map(node=>{
    const canvases=[...node.querySelectorAll('canvas')];
    if(canvases.length!==2)return {bad:true};
    const ink=canvases[1],data=ink.getContext('2d').getImageData(0,0,ink.width,ink.height).data;
    let nonzero=0;for(let i=3;i<data.length;i+=4)if(data[i]>20)nonzero++;
    return {nonzero,width:ink.width,height:ink.height};
   }));
   if(result.length!==3||result.some(x=>x.bad||x.nonzero<100))throw Error(hand+' lacks material paint: '+JSON.stringify(result));
   if(['A','C','G','H','I'].includes(hand))await page.screenshot({path:'artifacts/graffiti-v3/'+hand+'-'+width+'.png',fullPage:true});
  }
  await page.close();
 }
 if(problems.length)throw Error(problems.join('\n'));
 console.log('V3 comparisons loaded all nine hands, three surfaces, desktop and mobile without page errors');
}finally{await browser.close();await new Promise(done=>server.close(done))}
