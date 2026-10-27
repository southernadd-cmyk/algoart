import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4173';
const query='v=9&seed=AA-20261005-03-55769&mode=rects&el=36&den=53&cx=71&neg=41&phi=91&rec=4&spi=63&ga=93&nest=44&pen=fine&th=13&wob=32&od=3&op=70&pr=36&dry=19&curve=91&shape=68&overlap=65&rot=91&ln=1&ci=1&re=1&po=1&ar=1&pal=mono&cols=4&sat=86&bri=59&paper=%23f5f0e6&grain=13&material=oil-v6';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try {
 const editor=await browser.newPage({viewport:{width:1440,height:1000}});
 editor.on('pageerror',e=>console.error('[editor]',e.message));
 await editor.goto(origin+'/?'+query,{waitUntil:'domcontentloaded'});
 await editor.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>c.width>=600&&c.height>=400),{timeout:45000});
 await editor.waitForTimeout(4000);
 const imageUrl=await editor.evaluate(()=>{
  const canvas=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  if(!canvas||!canvas.width)throw Error('Source canvas unavailable');
  const temp=document.createElement('canvas');temp.width=Math.min(900,canvas.width);temp.height=Math.round(canvas.height*temp.width/canvas.width);
  temp.getContext('2d').drawImage(canvas,0,0,temp.width,temp.height);
  return temp.toDataURL('image/png');
 });
 if(imageUrl.length<10000)throw Error('Editor canvas output unexpectedly empty');
 const baker=await browser.newPage();
 baker.on('pageerror',e=>console.error('[baker]',e.message));
 await baker.goto(origin+'/gallery/visit/sculpture-bake.html',{waitUntil:'domcontentloaded'});
 await baker.waitForFunction(()=>window.bakerReady===true,{timeout:45000});
 const item={seed:'AA-20261005-03-55769',title:'Growth Systems',date:'2026-10-05',imageFile:'reception-source.png',
  shareUrl:origin+'/?'+query,material:'oil-v6',imageUrl};
 const variants={};
 for(const quality of ['mobile','desktop']){
  const result=await baker.evaluate(async ({item,quality})=>window.bakeStudy(item,quality),{item,quality});
  if(!result.entries?.length)throw Error('No baked '+quality+' geometry');
  variants[quality]=result.entries;
  console.log(quality,result.entries.length,'traced elements');
 }
 const output={version:1,seed:item.seed,href:'https://southernadd-cmyk.github.io/algoart/?'+query,qualities:variants};
 await fs.mkdir('gallery/visit/data',{recursive:true});
 await fs.writeFile('gallery/visit/data/reception-growth-systems.json',JSON.stringify(output));
 await fs.writeFile('gallery/visit/data/reception-growth-systems.png',Buffer.from(imageUrl.slice(imageUrl.indexOf(',')+1),'base64'));
 console.log('Saved offline reception bake');
} finally {await browser.close();}
