// Bake real material contours and source strokes using the exact same browser
// sculpture renderer that used to do this work for EVERY gallery visitor.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {chromium} from 'playwright';

const root=process.cwd();
const baseUrl=process.env.GALLERY_BAKE_URL||'http://127.0.0.1:4173/';
const args=process.argv.slice(2);
const option=name=>args[args.indexOf(name)+1];
const dates=[];
if(args.includes('--date')){
  const date=option('--date');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Date must be YYYY-MM-DD');
  dates.push(date);
}else if(args.includes('--all')){
  for(const entry of await fs.readdir('gallery',{withFileTypes:true}))
    if(entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(entry.name))dates.push(entry.name);
  dates.sort();
}else throw Error('Use --date YYYY-MM-DD or --all');

const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:900,height:700}});
  page.on('pageerror',error=>console.error('[Sculpture bake page]',error.message));
  page.on('console',message=>{
    if(message.type()==='error')console.error('[Sculpture bake]',message.text().slice(0,400));
  });
  await page.goto(new URL('gallery/visit/sculpture-bake.html',baseUrl).href,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.bakerReady===true,{timeout:40000});
  for(const date of dates){
    const meta=JSON.parse(await fs.readFile(path.join(root,'gallery',date,'meta.json'),'utf8'));
    const portraits=meta.entries.filter(item=>
      item.orientation==='portrait' ||
      (item.orientation==null && new URL(item.shareUrl).searchParams.get('fmt')==='portrait'));
    if(!portraits.length){
      console.log(date+': no portrait studies, skipping bake');
      continue;
    }
    const compiled={version:1,date,studies:{}};
    for(const item of portraits){
      const variants={};
      for(const quality of ['mobile','desktop']){
        const baked=await page.evaluate(
          async values=>await window.bakeStudy(values.item,values.quality),
          {item:{...item,date},quality},
          {timeout:90000}
        );
        if(!baked.entries.length)throw Error('Empty '+quality+' sculpture for '+item.seed);
        variants[quality]=baked.entries;
      }
      compiled.studies[item.imageFile]=variants;
    }
    const dir=path.join(root,'gallery',date,'3d');
    await fs.mkdir(dir,{recursive:true});
    const compressed=zlib.gzipSync(Buffer.from(JSON.stringify(compiled)),{level:9});
    await fs.writeFile(path.join(dir,'sculptures.json.gz'),compressed);
    console.log(date+': baked '+portraits.length+' sculptures in both qualities, '+Math.round(compressed.length/1024)+' KiB compressed');
  }
}finally{
  await browser.close();
}
